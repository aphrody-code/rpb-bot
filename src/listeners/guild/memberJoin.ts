import { Listener } from "@sapphire/framework";
import { EmbedBuilder, Events, GuildMember } from "discord.js";
import { Colors, RPB } from "../../lib/constants.js";

export class MemberJoinListener extends Listener<typeof Events.GuildMemberAdd> {
  constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.GuildMemberAdd,
    });
  }

  override async run(member: GuildMember) {
    this.container.logger.info(
      `Nouveau membre: ${member.user.tag} sur ${member.guild.name}`,
    );

    // Find the "bienvenue" channel
    const welcomeChannel = member.guild.channels.cache.find(
      (c) => c.name === RPB.Channels.Welcome || c.name.includes("bienvenue"),
    );

    if (!welcomeChannel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle("🌀 Bienvenue à la RPB !")
      .setDescription(
        `Bienvenue ${member.toString()} dans la **${RPB.FullName}** !\n\n` +
          `📜 Lis le <#règlement> pour connaître les règles\n` +
          `🎭 Récupère tes rôles dans <#rôles>\n` +
          `💬 Viens discuter dans <#chat-general>\n\n` +
          `**Let it rip !** 🌀`,
      )
      .setColor(Colors.Primary)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "👤 Membre", value: member.user.tag, inline: true },
        {
          name: "🔢 Membre #",
          value: `${member.guild.memberCount}`,
          inline: true,
        },
      )
      .setFooter({
        text: RPB.FullName,
        iconURL: member.guild.iconURL() ?? undefined,
      })
      .setTimestamp();

    try {
      await welcomeChannel.send({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Erreur envoi message bienvenue:", error);
    }
  }
}
