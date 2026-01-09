import {
  ApplicationCommandRegistries,
  RegisterBehavior,
  SapphireClient,
} from '@sapphire/framework';
import '@sapphire/plugin-logger/register';
import '@sapphire/plugin-scheduled-tasks/register';
import '@sapphire/plugin-subcommands/register';
import { GatewayIntentBits, Partials } from 'discord.js';
import 'dotenv/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApiServer } from './lib/api-server.js';
import { generateCustomCommands } from './lib/command-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Set default behavior for application commands
ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
  RegisterBehavior.BulkOverwrite,
);

// If GUILD_ID is provided in .env, set it as default for faster command registration during development
// We only do this in development to avoid duplicate commands in production (global + guild)
if (process.env.NODE_ENV !== 'production' && process.env.GUILD_ID) {
  ApplicationCommandRegistries.setDefaultGuildIds([process.env.GUILD_ID]);
}

try {
  // Generate custom commands from DB before starting
  await generateCustomCommands();

  const client = new SapphireClient({
    baseUserDirectory: __dirname,
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildPresences, // Required for tracking online status
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
    loadMessageCommandListeners: true,
    tasks: {
      bull: {
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PASSWORD,
        },
      },
    },
  });

  await client.login(process.env.DISCORD_TOKEN);

  // Start API server for dashboard integration after login
  const apiPort = parseInt(process.env.BOT_API_PORT ?? '3001', 10);
  startApiServer(apiPort);
} catch (err) {
  console.error('Failed to start bot:', err);
  process.exitCode = 1;
}
