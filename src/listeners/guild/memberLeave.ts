import { Listener } from "@sapphire/framework";
import { Events, GuildMember, EmbedBuilder } from "discord.js";

export class MemberLeaveListener extends Listener<typeof Events.GuildMemberRemove> {
  constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.GuildMemberRemove,
    });
  }

  override async run(member: GuildMember) {
    this.container.logger.info(`Member left: ${member.user.tag} from ${member.guild.name}`);

    // Find log channel (customize this logic as needed)
    const logChannel = member.guild.channels.cache.find(
      (c) => c.name.includes("log") || c.name.includes("mod-log"),
    );

    if (!logChannel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle("👋 Member Left")
      .setColor(0xff6b6b)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Member", value: member.user.tag, inline: true },
        { name: "ID", value: member.id, inline: true },
        { name: "Joined", value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Unknown", inline: true },
      )
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Failed to send leave message:", error);
    }
  }
}
