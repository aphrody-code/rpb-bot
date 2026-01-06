import { Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { Colors, RPB } from '../../lib/constants.js';
import prisma from '../../lib/prisma.js';

export class ProfileCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Voir ton profil Beyblade ou celui d'un autre joueur",
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('profile')
        .setDescription("Voir le profil d'un blader")
        .addUserOption((opt) =>
          opt
            .setName('joueur')
            .setDescription('Le blader à voir')
            .setRequired(false),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const targetUser =
      interaction.options.getUser('joueur') ?? interaction.user;

    await interaction.deferReply();

    try {
      // Find user in database
      const user = await prisma.user.findFirst({
        where: { discordId: targetUser.id },
        include: {
          profile: true,
          tournaments: {
            include: { tournament: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!user || !user.profile) {
        const embed = new EmbedBuilder()
          .setTitle(`👤 ${targetUser.displayName}`)
          .setDescription(
            targetUser.id === interaction.user.id
              ? "Tu n'as pas encore de profil Beyblade. Utilise `/inscription rejoindre` pour en créer un !"
              : "Cet utilisateur n'a pas encore de profil Beyblade sur RPB.",
          )
          .setColor(Colors.Warning)
          .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
          .setFooter({ text: RPB.FullName })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      const profile = user.profile;
      const winRate =
        profile.wins + profile.losses > 0
          ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
          : 0;

      const embed = new EmbedBuilder()
        .setTitle(`🌀 ${profile.bladerName ?? targetUser.displayName}`)
        .setDescription(profile.bio || 'Pas de bio définie.')
        .setColor(Colors.Primary)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: '🎮 Type favori',
            value: profile.favoriteType ?? 'Non défini',
            inline: true,
          },
          {
            name: '⭐ Niveau',
            value: profile.experience ?? 'Non défini',
            inline: true,
          },
          {
            name: '📊 Statistiques',
            value:
              `✅ Victoires: ${profile.wins}\n` +
              `❌ Défaites: ${profile.losses}\n` +
              `📈 Win Rate: ${winRate}%`,
            inline: true,
          },
          {
            name: '🏆 Tournois gagnés',
            value: profile.tournamentWins.toString(),
            inline: true,
          },
        );

      // Add recent tournaments
      if (user.tournaments.length > 0) {
        const recentTournaments = user.tournaments
          .map(
            (tp) =>
              `• ${tp.tournament.name} ${tp.checkedIn ? '✅' : '⏳'} ${tp.finalPlacement ? `#${tp.finalPlacement}` : ''}`,
          )
          .join('\n');

        embed.addFields({
          name: '🎯 Tournois récents',
          value: recentTournaments,
          inline: false,
        });
      }

      // Add social links
      const socials = [];
      if (profile.twitterHandle)
        socials.push(`[Twitter](https://twitter.com/${profile.twitterHandle})`);
      if (profile.tiktokHandle)
        socials.push(`[TikTok](https://tiktok.com/@${profile.tiktokHandle})`);
      if (socials.length > 0) {
        embed.addFields({
          name: '📱 Réseaux sociaux',
          value: socials.join(' | '),
          inline: false,
        });
      }

      embed
        .setFooter({
          text: `${RPB.FullName} | Membre depuis ${user.createdAt.toLocaleDateString('fr-FR')}`,
        })
        .setTimestamp();

      const components = [];
      if (targetUser.id !== interaction.user.id) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`battle-challenge-${targetUser.id}`)
            .setLabel('Défier en combat')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚔️'),
        );
        components.push(row);
      }

      return interaction.editReply({ embeds: [embed], components });
    } catch (error) {
      this.container.logger.error('Profile command error:', error);
      return interaction.editReply({
        content: '❌ Erreur lors de la récupération du profil.',
      });
    }
  }
}
