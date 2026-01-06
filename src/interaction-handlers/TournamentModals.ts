import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import type { ModalSubmitInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { Colors, RPB } from '../lib/constants.js';
import prisma from '../lib/prisma.js';

export class TournamentModalHandler extends InteractionHandler {
  public constructor(context: InteractionHandler.LoaderContext) {
    super(context, {
      interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
    });
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith('tournament-register-modal-')) {
      return this.none();
    }

    const tournamentId = interaction.customId.replace(
      'tournament-register-modal-',
      '',
    );
    return this.some({ tournamentId });
  }

  public async run(
    interaction: ModalSubmitInteraction,
    { tournamentId }: { tournamentId: string },
  ) {
    await interaction.deferReply({ ephemeral: true });

    const bladerName = interaction.fields.getTextInputValue('blader-name');
    const beyblade = interaction.fields.getTextInputValue('beyblade');

    try {
      // Find or create user
      let user = await prisma.user.findFirst({
        where: { discordId: interaction.user.id },
      });

      // Create user from Discord info if not found
      user ??= await prisma.user.create({
        data: {
          discordId: interaction.user.id,
          discordTag: interaction.user.tag,
          name: interaction.user.displayName,
          email: `${interaction.user.id}@discord.placeholder`,
        },
      });

      // Check if tournament exists
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          _count: { select: { participants: true } },
        },
      });

      if (!tournament) {
        return interaction.editReply({
          content: "❌ Ce tournoi n'existe plus.",
        });
      }

      // Check if already registered
      const existingParticipant = await prisma.tournamentParticipant.findFirst({
        where: {
          tournamentId,
          userId: user.id,
        },
      });

      if (existingParticipant) {
        return interaction.editReply({
          content: '❌ Tu es déjà inscrit à ce tournoi !',
        });
      }

      // Check max participants
      if (tournament._count.participants >= tournament.maxPlayers) {
        return interaction.editReply({
          content: '❌ Le tournoi est complet !',
        });
      }

      // Check tournament status
      if (tournament.status !== 'REGISTRATION_OPEN') {
        return interaction.editReply({
          content: '❌ Les inscriptions sont fermées pour ce tournoi.',
        });
      }

      // Create participant
      await prisma.tournamentParticipant.create({
        data: {
          tournamentId,
          userId: user.id,
        },
      });

      // Update profile with blader name if provided
      await prisma.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          bladerName,
        },
        update: {
          bladerName: bladerName ?? undefined,
        },
      });

      const embed = new EmbedBuilder()
        .setTitle('🎉 Inscription confirmée !')
        .setDescription(`Tu es maintenant inscrit à **${tournament.name}** !`)
        .setColor(Colors.Success)
        .addFields(
          { name: '👤 Nom de Blader', value: bladerName, inline: true },
          {
            name: '🌀 Toupie',
            value: beyblade || 'Non spécifiée',
            inline: true,
          },
          {
            name: '📅 Date',
            value: tournament.date.toLocaleDateString('fr-FR'),
            inline: true,
          },
        )
        .setFooter({
          text: `${RPB.FullName} | Pense à faire ton check-in le jour J !`,
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Tournament registration error:', error);
      return interaction.editReply({
        content: "❌ Erreur lors de l'inscription. Réessaie plus tard.",
      });
    }
  }
}
