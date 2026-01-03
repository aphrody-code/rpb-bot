import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { Colors, RPB } from "../../lib/constants.js";
import prisma from "../../lib/prisma.js";

export class ProfileContextMenuCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Voir le profil Beyblade d'un utilisateur",
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    // User context menu (right-click on user)
    registry.registerContextMenuCommand((builder) =>
      builder.setName("Profil Beyblade").setType(ApplicationCommandType.User),
    );
  }

  override async contextMenuRun(
    interaction: Command.ContextMenuCommandInteraction,
  ) {
    if (!interaction.isUserContextMenuCommand()) return;

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.targetUser;

    try {
      // Find user in database
      const user = await prisma.user.findFirst({
        where: { discordId: targetUser.id },
        include: {
          profile: true,
          tournaments: {
            include: { tournament: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      });

      if (!user || !user.profile) {
        const embed = new EmbedBuilder()
          .setTitle(`👤 ${targetUser.displayName}`)
          .setDescription(
            "Cet utilisateur n'a pas encore de profil Beyblade sur RPB.",
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
        .setDescription(profile.bio ?? "Pas de bio")
        .setColor(Colors.Primary)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: "🎮 Type favori",
            value: profile.favoriteType ?? "Non défini",
            inline: true,
          },
          {
            name: "⭐ Niveau",
            value: profile.experience ?? "Non défini",
            inline: true,
          },
          {
            name: "📊 Statistiques",
            value:
              `✅ Victoires: ${profile.wins}\n` +
              `❌ Défaites: ${profile.losses}\n` +
              `📈 Win Rate: ${winRate}%`,
            inline: true,
          },
          {
            name: "🏆 Tournois gagnés",
            value: profile.tournamentWins.toString(),
            inline: true,
          },
        );

      // Add recent tournaments
      if (user.tournaments.length > 0) {
        const recentTournaments = user.tournaments
          .map(
            (tp) =>
              `• ${tp.tournament.name} ${tp.checkedIn ? "✅" : "⏳"} ${tp.finalRank ? `#${tp.finalRank}` : ""}`,
          )
          .join("\n");

        embed.addFields({
          name: "🎯 Tournois récents",
          value: recentTournaments,
          inline: false,
        });
      }

      // Add social links
      const socials = [];
      if (profile.twitterHandle) socials.push(`🐦 @${profile.twitterHandle}`);
      if (profile.tiktokHandle) socials.push(`🎵 @${profile.tiktokHandle}`);
      if (socials.length > 0) {
        embed.addFields({
          name: "📱 Réseaux sociaux",
          value: socials.join(" | "),
          inline: false,
        });
      }

      embed
        .setFooter({
          text: `${RPB.FullName} | Membre depuis ${user.createdAt.toLocaleDateString("fr-FR")}`,
        })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`battle-challenge-${targetUser.id}`)
          .setLabel("Défier en combat")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⚔️"),
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      this.container.logger.error("Profile context menu error:", error);
      return interaction.editReply({
        content: "❌ Erreur lors de la récupération du profil.",
      });
    }
  }
}
