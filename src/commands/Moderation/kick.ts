import { Command } from "@sapphire/framework";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";

export class KickCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Kick a member from the server",
      preconditions: ["ModeratorOnly"],
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("kick")
        .setDescription("Kick a member from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .setDMPermission(false)
        .addUserOption((opt) =>
          opt
            .setName("member")
            .setDescription("The member to kick")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for the kick"),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const target = interaction.options.getUser("member", true);
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) {
      return interaction.reply({
        content: "❌ Member not found.",
        ephemeral: true,
      });
    }

    if (!member.kickable) {
      return interaction.reply({
        content: "❌ I cannot kick this member.",
        ephemeral: true,
      });
    }

    try {
      await member.kick(`${reason} | Kicked by ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setTitle("👢 Member Kicked")
        .setColor(0xffa500)
        .addFields(
          {
            name: "Member",
            value: `${target.tag} (${target.id})`,
            inline: true,
          },
          { name: "Moderator", value: interaction.user.tag, inline: true },
          { name: "Reason", value: reason },
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Kick command error:", error);
      return interaction.reply({
        content: "❌ Failed to kick member.",
        ephemeral: true,
      });
    }
  }
}
