import { Command } from "@sapphire/framework";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";

export class BanCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Ban a member from the server",
      preconditions: ["ModeratorOnly"],
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("ban")
        .setDescription("Ban a member from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setDMPermission(false)
        .addUserOption((opt) =>
          opt
            .setName("member")
            .setDescription("The member to ban")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for the ban"),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("delete_days")
            .setDescription("Days of messages to delete (0-7)")
            .setMinValue(0)
            .setMaxValue(7),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const target = interaction.options.getUser("member", true);
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const deleteDays = interaction.options.getInteger("delete_days") ?? 0;
    const member = interaction.guild?.members.cache.get(target.id);

    if (member && !member.bannable) {
      return interaction.reply({
        content: "❌ I cannot ban this member.",
        ephemeral: true,
      });
    }

    try {
      await interaction.guild?.bans.create(target.id, {
        reason: `${reason} | Banned by ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 24 * 60 * 60,
      });

      const embed = new EmbedBuilder()
        .setTitle("🔨 Member Banned")
        .setColor(0xff0000)
        .addFields(
          {
            name: "Member",
            value: `${target.tag} (${target.id})`,
            inline: true,
          },
          { name: "Moderator", value: interaction.user.tag, inline: true },
          { name: "Reason", value: reason },
          {
            name: "Messages Deleted",
            value: `${deleteDays} day(s)`,
            inline: true,
          },
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Ban command error:", error);
      return interaction.reply({
        content: "❌ Failed to ban member.",
        ephemeral: true,
      });
    }
  }
}
