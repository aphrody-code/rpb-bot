import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUSTOM_COMMANDS_DIR = path.join(__dirname, '../../commands/Custom');

const COMMAND_TEMPLATE = (
  name: string,
  description: string,
  response: string,
) => `
import { Command } from '@sapphire/framework';

export class CustomCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: '${name}',
      description: '${description.replace(/'/g, "'")}',
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const response = \`${response.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`;
    
    // Check if response is JSON (simple check)
    if (response.trim().startsWith('{')) {
      try {
        const json = JSON.parse(response);
        return interaction.reply(json);
      } catch {
        // Fallback to text
      }
    }
    return interaction.reply({ content: response });
  }
}
`;

export async function generateCustomCommands() {
  console.log('Generating custom commands...');

  try {
    // Ensure directory exists
    await fs.mkdir(CUSTOM_COMMANDS_DIR, { recursive: true });

    // Clear existing commands (except if we want to keep some static ones? No, this dir is for dynamic ones)
    const existingFiles = await fs.readdir(CUSTOM_COMMANDS_DIR);
    for (const file of existingFiles) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        await fs.unlink(path.join(CUSTOM_COMMANDS_DIR, file));
      }
    }

    const commands = await prisma.botCommand.findMany({
      where: { enabled: true },
    });

    for (const cmd of commands) {
      const filePath = path.join(CUSTOM_COMMANDS_DIR, `${cmd.name}.ts`);
      await fs.writeFile(
        filePath,
        COMMAND_TEMPLATE(cmd.name, cmd.description, cmd.response),
      );
    }

    console.log(
      `Generated ${commands.length} custom commands in ${CUSTOM_COMMANDS_DIR}`,
    );
  } catch (error) {
    console.error('Failed to generate custom commands:', error);
  }
}
