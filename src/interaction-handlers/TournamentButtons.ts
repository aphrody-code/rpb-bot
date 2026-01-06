import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { Colors, RPB } from '../lib/constants.js';
import prisma from '../lib/prisma.js';

export class TournamentButtonHandler extends InteractionHandler {
  public constructor(context: InteractionHandler.LoaderContext) {
    super(context, {
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    // Handle tournament-related buttons
    if (!interaction.customId.startsWith('tournament-')) {
      return this.none();
    }

    const [, action, tournamentId] = interaction.customId.split('-');
    return this.some({ action, tournamentId });
  }

  public async run(
    interaction: ButtonInteraction,
    { action, tournamentId }: { action: string; tournamentId: string },
  ) {
    switch (action) {
      case 'register':
        return this.handleRegister(interaction, tournamentId);
      case 'unregister':
        return this.handleUnregister(interaction, tournamentId);
      case 'checkin':
        return this.handleCheckIn(interaction, tournamentId);
      case 'info':
        return this.handleInfo(interaction, tournamentId);
      default:
        return interaction.reply({
          content: '❌ Action inconnue.',
          ephemeral: true,
        });
    }
  }

  private async handleRegister(
    interaction: ButtonInteraction,
    tournamentId: string,
  ) {
    // Show modal for registration details
    const modal = new ModalBuilder()
      .setCustomId(`tournament-register-modal-${tournamentId}`)
      .setTitle('Inscription au tournoi');

    const bladerNameInput = new TextInputBuilder()
      .setCustomId('blader-name')
      .setLabel('Ton nom de Blader')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Valt Aoi')
      .setRequired(true)
      .setMaxLength(32);

    const beybladeInput = new TextInputBuilder()
      .setCustomId('beyblade')
      .setLabel('Ta toupie principale')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Dran Sword 3-60F')
      .setRequired(false)
      .setMaxLength(50);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(bladerNameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(beybladeInput),
    );

    return interaction.showModal(modal);
  }

  private async handleUnregister(
    interaction: ButtonInteraction,
    tournamentId: string,
  ) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Find user by Discord ID
      const user = await prisma.user.findFirst({
        where: { discordId: interaction.user.id },
      });

      if (!user) {
        return interaction.editReply({
          content: "❌ Tu n'es pas inscrit sur le dashboard RPB.",
        });
      }

      // Check if registered
      const participant = await prisma.tournamentParticipant.findFirst({
        where: {
          tournamentId,
          userId: user.id,
        },
      });

      if (!participant) {
        return interaction.editReply({
          content: "❌ Tu n'es pas inscrit à ce tournoi.",
        });
      }

      // Remove participant
      await prisma.tournamentParticipant.delete({
        where: { id: participant.id },
      });

      const embed = new EmbedBuilder()
        .setTitle('👋 Désinscription confirmée')
        .setDescription('Tu as été retiré du tournoi.')
        .setColor(Colors.Warning)
        .setFooter({ text: RPB.FullName })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Tournament unregister error:', error);
      return interaction.editReply({
        content: '❌ Erreur lors de la désinscription.',
      });
    }
  }

  private async handleCheckIn(
    interaction: ButtonInteraction,
    tournamentId: string,
  ) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const user = await prisma.user.findFirst({
        where: { discordId: interaction.user.id },
      });

      if (!user) {
        return interaction.editReply({
          content: "❌ Tu n'es pas inscrit sur le dashboard RPB.",
        });
      }

      const participant = await prisma.tournamentParticipant.findFirst({
        where: {
          tournamentId,
          userId: user.id,
        },
      });

      if (!participant) {
        return interaction.editReply({
          content: "❌ Tu n'es pas inscrit à ce tournoi.",
        });
      }

      if (participant.checkedIn) {
        return interaction.editReply({
          content: '✅ Tu es déjà check-in !',
        });
      }

      // Update check-in status
      await prisma.tournamentParticipant.update({
        where: { id: participant.id },
        data: { checkedIn: true },
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Check-in confirmé !')
        .setDescription('Tu es maintenant prêt pour le tournoi. Bonne chance !')
        .setColor(Colors.Success)
        .setFooter({ text: RPB.FullName })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Tournament check-in error:', error);
      return interaction.editReply({
        content: '❌ Erreur lors du check-in.',
      });
    }
  }

  private async handleInfo(
    interaction: ButtonInteraction,
    tournamentId: string,
  ) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          _count: { select: { participants: true } },
        },
      });

      if (!tournament) {
        return interaction.editReply({
          content: '❌ Tournoi non trouvé.',
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🏆 ${tournament.name}`)
        .setDescription(tournament.description ?? 'Pas de description')
        .setColor(Colors.Primary)
        .addFields(
          {
            name: '📅 Date',
            value: tournament.date.toLocaleDateString('fr-FR'),
            inline: true,
          },
          {
            name: '📍 Lieu',
            value: tournament.location ?? 'En ligne',
            inline: true,
          },
          { name: '🎮 Format', value: tournament.format, inline: true },
          {
            name: '👥 Participants',
            value: `${tournament._count.participants}/${tournament.maxPlayers}`,
            inline: true,
          },
          { name: '📊 Statut', value: tournament.status, inline: true },
        )
        .setFooter({ text: RPB.FullName })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`tournament-register-${tournamentId}`)
          .setLabel("S'inscrire")
          .setStyle(ButtonStyle.Success)
          .setEmoji('✍️'),
        new ButtonBuilder()
          .setCustomId(`tournament-checkin-${tournamentId}`)
          .setLabel('Check-in')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✅'),
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      this.container.logger.error('Tournament info error:', error);
      return interaction.editReply({
        content: '❌ Erreur lors de la récupération des infos.',
      });
    }
  }
}
