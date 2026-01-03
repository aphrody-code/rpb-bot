import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ButtonInteraction } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { Colors, RPB } from "../lib/constants.js";

const battleResults = [
  { result: "burst", message: "💥 **BURST FINISH !**", points: 2, emoji: "💥" },
  { result: "over", message: "🔄 **OVER FINISH !**", points: 1, emoji: "🔄" },
  { result: "spin", message: "🌀 **SPIN FINISH !**", points: 1, emoji: "🌀" },
  {
    result: "xtreme",
    message: "⚡ **X-TREME FINISH !**",
    points: 3,
    emoji: "⚡",
  },
];

// Store pending battles: challengerId -> { opponentId, channelId, timestamp }
const pendingBattles = new Map<
  string,
  { opponentId: string; channelId: string; timestamp: number }
>();

export class BattleButtonHandler extends InteractionHandler {
  public constructor(context: InteractionHandler.LoaderContext) {
    super(context, {
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("battle-")) {
      return this.none();
    }

    const [, action, challengerId] = interaction.customId.split("-");
    return this.some({ action, challengerId });
  }

  public async run(
    interaction: ButtonInteraction,
    { action, challengerId }: { action: string; challengerId: string },
  ) {
    switch (action) {
      case "accept":
        return this.handleAccept(interaction, challengerId);
      case "decline":
        return this.handleDecline(interaction, challengerId);
      case "rematch":
        return this.handleRematch(interaction, challengerId);
      case "stats":
        return this.handleStats(interaction);
      default:
        return interaction.reply({
          content: "❌ Action inconnue.",
          ephemeral: true,
        });
    }
  }

  private async handleAccept(
    interaction: ButtonInteraction,
    challengerId: string,
  ) {
    const battle = pendingBattles.get(challengerId);

    if (!battle) {
      return interaction.reply({
        content: "❌ Ce défi a expiré ou n'existe plus.",
        ephemeral: true,
      });
    }

    if (interaction.user.id !== battle.opponentId) {
      return interaction.reply({
        content: "❌ Ce défi n'est pas pour toi !",
        ephemeral: true,
      });
    }

    // Remove from pending
    pendingBattles.delete(challengerId);

    // Get challenger user
    const challenger = await interaction.client.users
      .fetch(challengerId)
      .catch(() => null);

    if (!challenger) {
      return interaction.reply({
        content: "❌ Le challenger n'a pas pu être trouvé.",
        ephemeral: true,
      });
    }

    // Start battle animation
    await interaction.update({
      content: null,
      embeds: [
        new EmbedBuilder()
          .setTitle("⚔️ Combat Beyblade !")
          .setDescription(
            `**${challenger.displayName}** VS **${interaction.user.displayName}**\n\n` +
              "🌀 3... 2... 1... **LET IT RIP !**",
          )
          .setColor(Colors.Secondary)
          .setFooter({ text: RPB.FullName }),
      ],
      components: [],
    });

    // Simulate battle
    await this.sleep(2500);

    // Determine winner
    const winner = Math.random() > 0.5 ? challenger : interaction.user;
    const loser = winner.id === challenger.id ? interaction.user : challenger;
    const finishType =
      battleResults[Math.floor(Math.random() * battleResults.length)];

    const resultEmbed = new EmbedBuilder()
      .setTitle(`${finishType.emoji} ${finishType.message}`)
      .setDescription(
        `**${winner.displayName}** remporte le combat !\n\n` +
          `🏆 Victoire contre **${loser.displayName}**\n` +
          `📊 Points gagnés: **${finishType.points}**`,
      )
      .setColor(Colors.Primary)
      .setThumbnail(winner.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "🥇 Vainqueur", value: winner.tag, inline: true },
        { name: "💔 Perdant", value: loser.tag, inline: true },
        {
          name: "🎯 Type de finish",
          value: finishType.result.toUpperCase(),
          inline: true,
        },
      )
      .setFooter({ text: `${RPB.FullName} | GG !` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`battle-rematch-${loser.id}`)
        .setLabel("Revanche !")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔄"),
      new ButtonBuilder()
        .setCustomId(`battle-stats-${winner.id}`)
        .setLabel("Voir stats")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📊"),
    );

    return interaction.editReply({ embeds: [resultEmbed], components: [row] });
  }

  private async handleDecline(
    interaction: ButtonInteraction,
    challengerId: string,
  ) {
    const battle = pendingBattles.get(challengerId);

    if (!battle) {
      return interaction.reply({
        content: "❌ Ce défi a expiré ou n'existe plus.",
        ephemeral: true,
      });
    }

    if (interaction.user.id !== battle.opponentId) {
      return interaction.reply({
        content: "❌ Ce défi n'est pas pour toi !",
        ephemeral: true,
      });
    }

    pendingBattles.delete(challengerId);

    const embed = new EmbedBuilder()
      .setTitle("😔 Défi refusé")
      .setDescription(`**${interaction.user.displayName}** a refusé le combat.`)
      .setColor(Colors.Error)
      .setTimestamp();

    return interaction.update({ embeds: [embed], components: [] });
  }

  private async handleRematch(
    interaction: ButtonInteraction,
    challengerId: string,
  ) {
    // The person who lost can request a rematch
    const opponent = await interaction.client.users
      .fetch(challengerId)
      .catch(() => null);

    if (!opponent) {
      return interaction.reply({
        content: "❌ Impossible de trouver l'adversaire.",
        ephemeral: true,
      });
    }

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Tu ne peux pas te défier toi-même !",
        ephemeral: true,
      });
    }

    // Store pending battle
    pendingBattles.set(interaction.user.id, {
      opponentId: opponent.id,
      channelId: interaction.channelId,
      timestamp: Date.now(),
    });

    // Auto-expire after 5 minutes
    setTimeout(
      () => {
        pendingBattles.delete(interaction.user.id);
      },
      5 * 60 * 1000,
    );

    const embed = new EmbedBuilder()
      .setTitle("🔄 Demande de revanche !")
      .setDescription(
        `**${interaction.user.displayName}** veut une revanche contre **${opponent.displayName}** !\n\n` +
          `${opponent}, acceptes-tu le défi ?`,
      )
      .setColor(Colors.Secondary)
      .setFooter({ text: "Le défi expire dans 5 minutes" })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`battle-accept-${interaction.user.id}`)
        .setLabel("Accepter")
        .setStyle(ButtonStyle.Success)
        .setEmoji("⚔️"),
      new ButtonBuilder()
        .setCustomId(`battle-decline-${interaction.user.id}`)
        .setLabel("Refuser")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌"),
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  private async handleStats(interaction: ButtonInteraction) {
    // Show ephemeral stats - placeholder for now
    return interaction.reply({
      content:
        "📊 **Fonctionnalité à venir !**\nLes statistiques de combat seront bientôt disponibles.",
      ephemeral: true,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export for use in battle command
export { pendingBattles };
