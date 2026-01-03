import { Listener } from "@sapphire/framework";
import { EmbedBuilder, Events, GuildMember } from "discord.js";

export class MemberLeaveListener extends Listener<
  typeof Events.GuildMemberRemove
> {
  constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.GuildMemberRemove,
    });
  }

  override async run(member: GuildMember) {
    this.container.logger.info(
      `Membre parti : ${member.user.tag} de ${member.guild.name}`,
    );

    // Trouver le salon de logs
    const logChannel = member.guild.channels.cache.find(
      (c) => c.name.includes("log") || c.name.includes("mod-log"),
    );

    if (!logChannel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle("👋 Membre parti")
      .setColor(0xff6b6b)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Membre", value: member.user.tag, inline: true },
        { name: "ID", value: member.id, inline: true },
        {
          name: "A rejoint",
          value: member.joinedAt
            ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
            : "Inconnu",
          inline: true,
        },
      )
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Échec envoi message départ :", error);
    }
  }
}
