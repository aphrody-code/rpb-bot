import { Command } from "@sapphire/framework";
import { EmbedBuilder, PermissionFlagsBits, TextChannel } from "discord.js";

export class ClearCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Delete multiple messages at once",
      preconditions: ["ModeratorOnly"],
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("clear")
        .setDescription("Delete multiple messages at once")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false)
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Number of messages to delete (1-100)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100),
        )
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Only delete messages from this user"),
        ),
    );
  }

  override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger("amount", true);
    const targetUser = interaction.options.getUser("user");
    const channel = interaction.channel as TextChannel;

    if (!channel || !("bulkDelete" in channel)) {
      return interaction.reply({ content: "❌ Cannot delete messages in this channel.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      let messages = await channel.messages.fetch({ limit: amount });

      if (targetUser) {
        messages = messages.filter((m) => m.author.id === targetUser.id);
      }

      // Filter out messages older than 14 days (bulk delete limit)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messages = messages.filter((m) => m.createdTimestamp > twoWeeksAgo);

      const deleted = await channel.bulkDelete(messages, true);

      const embed = new EmbedBuilder()
        .setTitle("🧹 Messages Cleared")
        .setColor(0x00ff00)
        .addFields(
          { name: "Deleted", value: `${deleted.size} message(s)`, inline: true },
          { name: "Moderator", value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      if (targetUser) {
        embed.addFields({ name: "From User", value: targetUser.tag, inline: true });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Clear command error:", error);
      return interaction.editReply({ content: "❌ Failed to delete messages." });
    }
  }
}
