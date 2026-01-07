import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { container } from '@sapphire/framework';
import type { GuildTextBasedChannel } from 'discord.js';
import { Colors, RPB } from './constants.js';

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

export async function getBotStatus() {
  const client = container.client;
  const guild = await client.guilds
    .fetch({
      guild: process.env.GUILD_ID ?? '',
      withCounts: true,
    })
    .catch(() => null);

  return {
    status: client.isReady() ? 'running' : 'starting',
    uptime: client.uptime ?? 0,
    uptimeFormatted: formatUptime(client.uptime ?? 0),
    guilds: client.guilds.cache.size,
    users: client.users.cache.size,
    memberCount: guild?.approximateMemberCount ?? guild?.memberCount ?? 0,
    onlineCount: guild?.approximatePresenceCount ?? 0,
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

/**
 * Base JSON response helper
 */
function sendJSON(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Error response helper
 */
function sendError(res: ServerResponse, message: string, status = 400) {
  sendJSON(res, { error: message }, status);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  // OPTIONS for Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Check API key
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.BOT_API_KEY;

  if (expectedKey && apiKey !== expectedKey) {
    return sendError(res, 'Unauthorized', 401);
  }

  const url = new URL(
    req.url ?? '/',
    `http://${req.headers.host ?? 'localhost'}`,
  );

  // Router Logic
  try {
    switch (url.pathname) {
      case '/health':
        return sendJSON(res, { ok: true });

      case '/api/status':
        return sendJSON(res, await getBotStatus());

      case '/api/logs': {
        const tail = parseInt(url.searchParams.get('tail') ?? '100', 10);
        return sendJSON(res, { logs: getLogs(tail) });
      }

      case '/api/restart':
      case '/api/sync-commands': {
        if (req.method !== 'POST')
          return sendError(res, 'Method not allowed', 405);
        sendJSON(res, { ok: true, message: 'Bot syncing/restarting...' });
        container.logger.info(
          'Sync/Restart requested via API. Exiting in 1s...',
        );
        setTimeout(() => process.exit(0), 1000);
        return;
      }

      case '/api/roles': {
        const guildId = process.env.GUILD_ID;
        if (!guildId) return sendError(res, 'GUILD_ID not configured');

        const guild = container.client.guilds.cache.get(guildId);
        if (!guild) return sendError(res, 'Guild not found in cache', 404);

        const roles = guild.roles.cache
          .filter((role) => role.name !== '@everyone')
          .map((role) => ({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            position: role.position,
            managed: role.managed,
          }))
          .sort((a, b) => b.position - a.position);

        return sendJSON(res, { roles });
      }

      case '/api/members-by-role': {
        const roleId = url.searchParams.get('roleId');
        const guildId = process.env.GUILD_ID;

        if (!roleId || !guildId)
          return sendError(res, 'Missing roleId or GUILD_ID');

        const guild = container.client.guilds.cache.get(guildId);
        if (!guild) return sendError(res, 'Guild not found', 404);

        const role = await guild.roles.fetch(roleId);
        if (!role) return sendError(res, 'Role not found', 404);

        await guild.members.fetch();
        const members = role.members.map((m) => ({
          id: m.id,
          username: m.user.username,
          displayName: m.displayName,
          avatar: m.user.displayAvatarURL({ extension: 'png', size: 256 }),
        }));

        return sendJSON(res, { members });
      }

      case '/api/config': {
        const safeEnvKeys = ['NODE_ENV', 'GUILD_ID', 'OWNER_IDS'];
        const env: Record<string, string> = {};
        for (const key of safeEnvKeys) {
          if (process.env[key]) env[key] = process.env[key];
        }

        const colorsFormatted: Record<string, string> = {};
        for (const [key, value] of Object.entries(Colors)) {
          colorsFormatted[key] = `0x${value.toString(16).padStart(6, '0')}`;
        }

        return sendJSON(res, {
          env,
          constants: {
            RPB: {
              Name: RPB.Name,
              FullName: RPB.FullName,
              Discord: RPB.Discord,
            },
            Colors: colorsFormatted,
            Channels: RPB.Channels,
          },
        });
      }

      case '/api/webhook/twitch': {
        if (req.method !== 'POST')
          return sendError(res, 'Method not allowed', 405);

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            if (data.event?.type === 'live') {
              const channel = container.client.channels.cache.get(
                RPB.Channels.Social,
              );
              if (channel?.isTextBased()) {
                await (channel as GuildTextBasedChannel).send({
                  content: `@everyone 🔴 **${data.event.broadcaster_user_name} est en LIVE !**\nhttps://www.twitch.tv/${data.event.broadcaster_user_login}`,
                });
              }
            }
            sendJSON(res, { ok: true });
          } catch (_e) {
            sendError(res, 'Invalid JSON', 400);
          }
        });
        return;
      }

      default:
        return sendError(res, 'Not found', 404);
    }
  } catch (error) {
    container.logger.error('API Server Error:', error);
    return sendError(res, 'Internal server error', 500);
  }
}

export function startApiServer(port = 3001) {
  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  server.listen(port, '0.0.0.0', () => {
    container.logger.info(`Bot API server listening on port ${port}`);
  });

  return server;
}
