import { Scraper } from 'agent-twitter-client';
import { file } from 'bun';

// Type definitions
type MediaData = { data: ArrayBuffer, mediaType: string };
type StoredCookies = { cookies: string[], timestamp: number };
type TweetConfig = { content: string, mediaPaths?: string[] };
type ScheduleOptions = { delayMinutes: number, tweetCount: number };

// Utility function for parsing time strings
function parseTimeString(timeStr: string): number {
  const match = timeStr.match(/^(\d+)(min|minutes|m)?$/i);
  if (!match) {
    throw new Error('Invalid time format. Use format: "5min" or just "5"');
  }
  return parseInt(match[1]);
}

class TwitterClient {
  private scraper: Scraper;
  private readonly cookiesPath: string;
  private readonly cookieExpirationMs: number;
  private readonly MIN_DELAY_MINUTES = 2; // Minimum 2 minutes between tweets

  constructor (cookiesPath = './twitter_cookies.json', cookieExpirationHours = 24) {
    this.scraper = new Scraper();
    this.cookiesPath = cookiesPath;
    this.cookieExpirationMs = cookieExpirationHours * 60 * 60 * 1000;
  }

  private getMimeType(extension: string | undefined): string | undefined {
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      mp4: 'video/mp4'
    };
    return extension ? mimeTypes[extension] : undefined;
  }

  private async loadCookies(): Promise<StoredCookies | null> {
    try {
      const cookieFile = file(this.cookiesPath);
      const cookieData = await cookieFile.text();
      return JSON.parse(cookieData);
    } catch {
      return null;
    }
  }

  private async saveCookies(cookies: string[]): Promise<void> {
    const cookieData: StoredCookies = { cookies, timestamp: Date.now() };
    await Bun.write(this.cookiesPath, JSON.stringify(cookieData, null, 2));
  }

  private areCookiesValid(stored: StoredCookies): boolean {
    return Date.now() - stored.timestamp < this.cookieExpirationMs;
  }

  async loadTweetsConfig(configPath: string): Promise<TweetConfig[]> {
    try {
      const configFile = file(configPath);
      const configData = await configFile.text();
      const tweets: TweetConfig[] = JSON.parse(configData);

      if (!Array.isArray(tweets)) {
        throw new Error('Tweets configuration must be an array');
      }

      tweets.forEach((tweet, index) => {
        if (!tweet.content) {
          throw new Error(`Tweet at index ${index} is missing required 'content' field`);
        }
      });

      return tweets;
    } catch (error) {
      console.error('Error loading tweets configuration:', error);
      throw error;
    }
  }

  async login(): Promise<void> {
    try {
      console.log('\nAttempting authentication...');
      const storedCookies = await this.loadCookies();

      if (storedCookies && this.areCookiesValid(storedCookies)) {
        console.log('Found valid stored cookies from:', new Date(storedCookies.timestamp).toLocaleString());
        try {
          await this.scraper.setCookies(storedCookies.cookies);
          console.log('✓ Successfully authenticated using stored cookies');
          return;
        } catch (error) {
          console.log('⚠ Stored cookies are invalid or expired');
          console.log('Falling back to credential-based authentication...');
        }
      } else {
        if (!storedCookies) {
          console.log('No stored cookies found');
        } else {
          console.log('Found expired cookies from:', new Date(storedCookies.timestamp).toLocaleString());
        }
        console.log('Proceeding with credential-based authentication...');
      }

      await this.scraper.login(Bun.env.TWITTER_USERNAME!, Bun.env.TWITTER_PASSWORD!, Bun.env.TWITTER_EMAIL!);

      const newCookies = await this.scraper.getCookies();
      await this.saveCookies(newCookies);
      console.log('✓ Successfully authenticated using credentials');
      console.log('New cookies have been stored for future use\n');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async sendTweet(content: string, mediaPaths: string[] = []): Promise<void> {
    try {
      let mediaData: MediaData[] | undefined;
      if (mediaPaths.length > 0) {
        mediaData = await Promise.all(mediaPaths.map(async (path): Promise<MediaData> => {
          const extension = path.split('.').pop()?.toLowerCase();
          const mimeType = this.getMimeType(extension);

          if (!mimeType) {
            throw new Error(`Unsupported media type for file: ${path}`);
          }

          const f = file(path);
          const data = await f.arrayBuffer();

          return { data, mediaType: mimeType };
        }));
      }

      const convertedMediaData = mediaData?.map(item => ({ data: Buffer.from(item.data), mediaType: item.mediaType }));

      const response = await this.scraper.sendTweet(content, undefined, convertedMediaData);
      console.log('Tweet posted successfully:', response);
    } catch (error) {
      console.error('Error sending tweet:', error);
      throw error;
    }
  }

  async sendConfiguredTweets(configPath: string, options: ScheduleOptions): Promise<void> {
    try {
      const tweets = await this.loadTweetsConfig(configPath);
      const delayMinutes = Math.max(options.delayMinutes, this.MIN_DELAY_MINUTES);
      const delayMs = delayMinutes * 60 * 1000;

      console.log(`Delay set to ${delayMinutes} minutes (${delayMs} milliseconds)`);
      const tweetsToSend = options.tweetCount > 0 ? tweets.slice(0, options.tweetCount) : tweets;

      console.log(`Starting tweet schedule:`);
      console.log(`- Will send ${tweetsToSend.length} tweets`);
      console.log(`- Delay between tweets: ${options.delayMinutes} minutes`);

      for (let i = 0;i < tweetsToSend.length;i++) {
        const tweet = tweetsToSend[i];
        const nextTweetTime = new Date(Date.now() + (i === 0 ? 0 : delayMs));

        console.log(`\nTweet ${i + 1}/${tweetsToSend.length}:`);
        console.log(`Current time: ${new Date().toLocaleTimeString()}`);
        console.log(`Scheduled time: ${nextTweetTime.toLocaleTimeString()}`);
        console.log(`Content: ${tweet.content}`);

        if (i > 0) {
          console.log(`Waiting ${delayMinutes} minutes before sending...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          console.log(`Wait complete, sending tweet...`);
        }

        await this.sendTweet(tweet.content, tweet.mediaPaths || []);
      }

      console.log('\nAll configured tweets have been sent successfully');
    } catch (error) {
      console.error('Error sending configured tweets:', error);
      throw error;
    }
  }
}

function parseArgs(): ScheduleOptions {
  const args = process.argv.slice(2);
  let delayMinutes = 2; // default delay
  let tweetCount = 0; // 0 means send all tweets

  for (let i = 0;i < args.length;i++) {
    if (args[i] === '--delay' && i + 1 < args.length) {
      const timeStr = args[i + 1];
      delayMinutes = parseTimeString(timeStr);
      i++;
    } else if (args[i] === '--count' && i + 1 < args.length) {
      tweetCount = parseInt(args[i + 1]);
      if (isNaN(tweetCount) || tweetCount < 1) {
        throw new Error('Count must be a positive number');
      }
      i++;
    }
  }

  return { delayMinutes, tweetCount };
}

async function main() {
  try {
    const options = parseArgs();
    const client = new TwitterClient();
    await client.login();
    await client.sendConfiguredTweets('./tweets.json', options);
  } catch (error) {
    console.error('Failed to send tweets:', error);
    process.exit(1);
  }
}

main();

declare global {
  namespace Bun {
    interface Env {
      TWITTER_USERNAME: string;
      TWITTER_PASSWORD: string;
      TWITTER_EMAIL: string;
    }
  }
}
