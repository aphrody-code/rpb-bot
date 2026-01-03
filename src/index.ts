import { container, SapphireClient } from "@sapphire/framework";
import "@sapphire/plugin-logger/register";
import "@sapphire/plugin-scheduled-tasks/register";
import "@sapphire/plugin-subcommands/register";
import { GatewayIntentBits, Partials } from "discord.js";
import "dotenv/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startApiServer } from "./lib/api-server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Start API server for dashboard integration
const apiPort = parseInt(process.env.BOT_API_PORT ?? "3001", 10);
startApiServer(apiPort);

try {
  const client = new SapphireClient({
    baseUserDirectory: __dirname,
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
    loadMessageCommandListeners: true,
    tasks: {
      bull: {
        connection: {
          host: process.env.REDIS_HOST ?? "localhost",
          port: parseInt(process.env.REDIS_PORT ?? "6379"),
          password: process.env.REDIS_PASSWORD,
        },
      },
    },
  });

  await client.login(process.env.DISCORD_TOKEN);
} catch (err) {
  container.logger.error("Failed to login:", err);
  process.exitCode = 1;
}
