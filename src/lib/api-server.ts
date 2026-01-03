import { container } from "@sapphire/framework";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

const logs: { timestamp: string; level: string; message: string }[] = [];
const MAX_LOGS = 1000;

export function addLog(level: string, message: string) {
  logs.push({
    timestamp: new Date().toISOString(),
    level,
    message,
  });

  // Keep only the last MAX_LOGS entries
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

export function getLogs(tail = 100) {
  return logs.slice(-tail);
}

export function getBotStatus() {
  const client = container.client;

  return {
    status: client.isReady() ? "running" : "starting",
    uptime: client.uptime ?? 0,
    uptimeFormatted: formatUptime(client.uptime ?? 0),
    guilds: client.guilds.cache.size,
    users: client.users.cache.size,
    ping: client.ws.ping,
    memoryUsage: formatMemory(process.memoryUsage().heapUsed),
    nodeVersion: process.version,
  };
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}j ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  // Check API key
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.BOT_API_KEY;

  if (expectedKey && apiKey !== expectedKey) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === "/api/logs") {
    const tail = parseInt(url.searchParams.get("tail") ?? "100", 10);
    res.writeHead(200);
    res.end(JSON.stringify({ logs: getLogs(tail) }));
    return;
  }

  if (url.pathname === "/api/status") {
    res.writeHead(200);
    res.end(JSON.stringify(getBotStatus()));
    return;
  }

  if (url.pathname === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
}

export function startApiServer(port = 3001) {
  const server = createServer(handleRequest);

  server.listen(port, "0.0.0.0", () => {
    container.logger.info(`Bot API server listening on port ${port}`);
  });

  return server;
}
