import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { Colors, RPB } from "../../lib/constants.js";

// Store pending battles
const pendingBattles = new Map<
  string,
  { opponentId: string; channelId: string; timestamp: number }
>();

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

export class BattleCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Lance un combat Beyblade virtuel !",
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("battle")
        .setDescription(
          "Lance un combat Beyblade virtuel contre un autre membre !",
        )
        .addUserOption((opt) =>
          opt
            .setName("adversaire")
            .setDescription("Ton adversaire")
            .setRequired(true),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("rapide")
            .setDescription("Combat rapide sans confirmation")
            .setRequired(false),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const opponent = interaction.options.getUser("adversaire", true);
    const quickBattle = interaction.options.getBoolean("rapide") ?? false;
    const challenger = interaction.user;

    if (opponent.id === challenger.id) {
      return interaction.reply({
        content: "❌ Tu ne peux pas te battre contre toi-même !",
        ephemeral: true,
      });
    }

    if (opponent.bot) {
      return interaction.reply({
        content: "❌ Tu ne peux pas défier un bot !",
        ephemeral: true,
      });
    }

    // Quick battle mode (old behavior)
    if (quickBattle) {
      return this.executeQuickBattle(interaction, challenger, opponent);
    }

    // Challenge mode with accept/decline buttons
    pendingBattles.set(challenger.id, {
      opponentId: opponent.id,
      channelId: interaction.channelId,
      timestamp: Date.now(),
    });

    // Auto-expire after 5 minutes
    setTimeout(
      () => {
        pendingBattles.delete(challenger.id);
      },
      5 * 60 * 1000,
    );

    const embed = new EmbedBuilder()
      .setTitle("⚔️ Défi Beyblade !")
      .setDescription(
        `**${challenger.displayName}** défie **${opponent.displayName}** en combat !\n\n` +
          `${opponent}, acceptes-tu le défi ?`,
      )
      .setColor(Colors.Secondary)
      .setThumbnail(challenger.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "🎯 Challenger", value: challenger.tag, inline: true },
        { name: "🎮 Adversaire", value: opponent.tag, inline: true },
      )
      .setFooter({ text: `${RPB.FullName} | Le défi expire dans 5 minutes` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`battle-accept-${challenger.id}`)
        .setLabel("Accepter le défi")
        .setStyle(ButtonStyle.Success)
        .setEmoji("⚔️"),
      new ButtonBuilder()
        .setCustomId(`battle-decline-${challenger.id}`)
        .setLabel("Refuser")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌"),
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  private async executeQuickBattle(
    interaction: Command.ChatInputCommandInteraction,
    challenger: {
      id: string;
      displayName: string;
      tag: string;
      displayAvatarURL: (opts: { size: number }) => string;
    },
    opponent: {
      id: string;
      displayName: string;
      tag: string;
      displayAvatarURL: (opts: { size: number }) => string;
    },
  ) {
    // Initial message
    const startEmbed = new EmbedBuilder()
      .setTitle("⚔️ Combat Beyblade !")
      .setDescription(
        `**${challenger.displayName}** VS **${opponent.displayName}**\n\n` +
          "🌀 3... 2... 1... **LET IT RIP !**",
      )
      .setColor(Colors.Secondary)
      .setFooter({ text: RPB.FullName });

    await interaction.reply({ embeds: [startEmbed] });

    // Simulate battle with suspense
    await this.sleep(2000);

    // Determine winner
    const winner = Math.random() > 0.5 ? challenger : opponent;
    const loser = winner.id === challenger.id ? opponent : challenger;
    const finishType =
      battleResults[Math.floor(Math.random() * battleResults.length)] ??
      battleResults[0]!;

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
    );

    return interaction.editReply({ embeds: [resultEmbed], components: [row] });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export { pendingBattles };
