import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import { Colors, RPB } from "../../lib/constants.js";

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
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const opponent = interaction.options.getUser("adversaire", true);
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

    return interaction.editReply({ embeds: [resultEmbed] });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
