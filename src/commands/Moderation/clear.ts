import { Command } from '@sapphire/framework';
import {
  EmbedBuilder,
  PermissionFlagsBits,
  type TextChannel,
} from 'discord.js';

export class ClearCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: 'Supprimer plusieurs messages à la fois',
      preconditions: ['ModeratorOnly'],
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('clear')
        .setDescription('Supprimer plusieurs messages à la fois')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setContexts(0)
        .addIntegerOption((opt) =>
          opt
            .setName('nombre')
            .setDescription('Nombre de messages à supprimer (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100),
        )
        .addUserOption((opt) =>
          opt
            .setName('utilisateur')
            .setDescription(
              'Supprimer uniquement les messages de cet utilisateur',
            ),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const amount = interaction.options.getInteger('nombre', true);
    const targetUser = interaction.options.getUser('utilisateur');
    const channel = interaction.channel as TextChannel;

    if (!channel || !('bulkDelete' in channel)) {
      return interaction.reply({
        content: '❌ Impossible de supprimer des messages dans ce salon.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      let messages = await channel.messages.fetch({ limit: amount });

      if (targetUser) {
        messages = messages.filter((m) => m.author.id === targetUser.id);
      }

      // Filtrer les messages de plus de 14 jours (limite de suppression en masse)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messages = messages.filter((m) => m.createdTimestamp > twoWeeksAgo);

      const deleted = await channel.bulkDelete(messages, true);

      const embed = new EmbedBuilder()
        .setTitle('🧹 Messages supprimés')
        .setColor(0x00ff00)
        .addFields(
          {
            name: 'Supprimés',
            value: `${deleted.size} message(s)`,
            inline: true,
          },
          { name: 'Modérateur', value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      if (targetUser) {
        embed.addFields({
          name: "De l'utilisateur",
          value: targetUser.tag,
          inline: true,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Clear command error:', error);
      return interaction.editReply({
        content: '❌ Échec de la suppression des messages.',
      });
    }
  }
}
