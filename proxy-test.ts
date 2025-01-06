import { serve } from 'bun';
import { ProxyAgent } from 'undici';

// Configuration interface
interface ProxyConfig {
  proxyUrl: string;
  targetUrl: string;
  port: number;
}

// Response handler interface
interface ResponseHandler {
  status: number;
  headers: Record<string, string>;
  body: any;
}

class ProxyServer {
  private agent: ProxyAgent;
  private config: ProxyConfig;
  private server!: ReturnType<typeof serve>;

  constructor (config: ProxyConfig) {
    this.config = config;
    this.agent = new ProxyAgent({ uri: this.config.proxyUrl, keepAliveTimeout: 10000, keepAliveMaxTimeout: 30000 });
  }

  // Handle incoming requests
  private async handleRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const targetUrl = `${this.config.targetUrl}${url.pathname}${url.search}`;

      const response = await fetch(targetUrl, { method: request.method, headers: request.headers, body: request.body });

      const responseBody = await response.text();
      return new Response(responseBody, { status: response.status, headers: response.headers });
    } catch (error) {
      console.error('Proxy error:', error);
      return new Response('Proxy Error', { status: 500 });
    }
  }

  // Start the server
  public async start(): Promise<void> {
    this.server = serve({ port: this.config.port, fetch: (request: Request) => this.handleRequest(request) });

    console.log(`Proxy server running at http://localhost:${this.config.port}`);
  }

  // Graceful shutdown
  public async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
    }
    console.log('Proxy server stopped');
  }
}

const config: ProxyConfig = {
  proxyUrl: 'http://proxy.example.com:8080',
  targetUrl: 'http://api.example.com',
  port: 3000
};

const proxyServer = new ProxyServer(config);

// Handle process termination
process.on('SIGINT', async () => {
  await proxyServer.stop();
  process.exit(0);
});

// Start the server
proxyServer.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { ProxyServer };
export type { ProxyConfig, ResponseHandler };
