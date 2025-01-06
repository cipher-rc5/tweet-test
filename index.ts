import { Scraper } from "agent-twitter-client";
import { file } from "bun";

// Type definition for media data
type MediaData = {
  data: ArrayBuffer;
  mediaType: string;
};

// Function to send a tweet
async function sendTweet(content: string, mediaPaths: string[] = []): Promise<void> {
  try {
    const scraper = new Scraper();

    // Login using Bun.env instead of process.env
    await scraper.login(
      process.env.TWITTER_USERNAME!,
      process.env.TWITTER_PASSWORD!,
      process.env.TWITTER_EMAIL!
    );

    console.log('Logged in successfully!');

    // Process media if provided
    let mediaData: MediaData[] | undefined;
    if (mediaPaths.length > 0) {
      mediaData = await Promise.all(
        mediaPaths.map(async (path): Promise<MediaData> => {
          const extension = path.split('.').pop()?.toLowerCase();
          const mimeType = getMimeType(extension);

          if (!mimeType) {
            throw new Error(`Unsupported media type for file: ${path}`);
          }

          // Use Bun's file API
          const f = file(path);
          const data = await f.arrayBuffer();

          return {
            data,
            mediaType: mimeType,
          };
        }),
      );
    }
    // Convert ArrayBuffer to Buffer for each media item
    const convertedMediaData = mediaData?.map(item => ({
      data: Buffer.from(item.data),
      mediaType: item.mediaType
    }));

    // Send the tweet
    const response = await scraper.sendTweet(content, undefined, convertedMediaData);
    console.log('Tweet posted successfully:', response);
  } catch (error) {
    console.error('Error sending tweet:', error);
    throw error; // Re-throw the error for proper error handling
  }
}

// Helper function to determine MIME type
function getMimeType(extension: string | undefined): string | undefined {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    mp4: 'video/mp4',
  };

  return extension ? mimeTypes[extension] : undefined;
}

// Example usage
sendTweet('Hello world from mort!', ['./Ahkjmort.png'])
  .catch(error => {
    console.error('Failed to send tweet:', error);
    process.exit(1);
  });

// For TypeScript type checking of environment variables
declare global {
  interface ProcessEnv {
    TWITTER_USERNAME: string;
    TWITTER_PASSWORD: string;
    TWITTER_EMAIL: string;
  }
}