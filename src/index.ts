import { container, SapphireClient } from "@sapphire/framework";
import "@sapphire/plugin-logger/register";
import "@sapphire/plugin-scheduled-tasks/register";
import "@sapphire/plugin-subcommands/register";
import { GatewayIntentBits, Partials } from "discord.js";
import "dotenv/config";

try {
  const client = new SapphireClient({
    baseUserDirectory: import.meta.dirname,
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
