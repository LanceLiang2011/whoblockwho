import * as http from "http";

export class HealthCheckServer {
  private server?: http.Server;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
  }

  public start(): void {
    this.server = http.createServer((req, res) => {
      if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "healthy",
            service: "whoblockwho-bot",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
          })
        );
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });

    this.server.listen(this.port, () => {
      console.log(`Health check server running on port ${this.port}`);
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
    }
  }
}
