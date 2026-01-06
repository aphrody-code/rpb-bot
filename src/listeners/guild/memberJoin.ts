import { Listener } from '@sapphire/framework';
import {
  AttachmentBuilder,
  EmbedBuilder,
  Events,
  type GuildMember,
} from 'discord.js';
import { generateWelcomeImage } from '../../lib/canvas-utils.js';
import { Colors, RPB } from '../../lib/constants.js';

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

    // Fetch all channels to ensure cache is complete (API usage)
    await member.guild.channels.fetch();

    // Generate welcome image
    const avatarUrl = member.displayAvatarURL({ extension: 'png', size: 256 });
    const imageBuffer = await generateWelcomeImage(
      member.displayName,
      avatarUrl,
      member.guild.memberCount,
    );
    const attachmentItems = [
      new AttachmentBuilder(imageBuffer, { name: 'welcome.png' }),
    ];

    // Helper to find channels robustly
    const findChannel = (search: string) =>
      member.guild.channels.cache.find((c) => {
        if (c.id === search) return true; // Direct ID match
        const name = c.name.toLowerCase().replace(/[^a-z0-9]/g, ''); // Normalize: remove emojis, spaces, dashes
        const query = search.toLowerCase().replace(/[^a-z0-9]/g, '');
        return name.includes(query);
      });

    // Find the "bienvenue" channel
    const welcomeChannel = findChannel(RPB.Channels.Welcome);

    if (!welcomeChannel?.isTextBased()) return;

    // Find other channels for mentions
    const rulesChannel = findChannel(RPB.Channels.Rules);
    const rolesChannel = findChannel(RPB.Channels.Roles);
    const generalChannel = findChannel(RPB.Channels.GeneralChat);

    const getMention = (
      channel: { id: string } | undefined,
      fallback: string,
    ) => {
      if (channel?.id) return `<#${channel.id}>`;
      return fallback;
    };

    const embed = new EmbedBuilder()
      .setTitle('🌀 Bienvenue à la RPB !')
      .setDescription(
        `Bienvenue ${member.toString()} dans la **${RPB.FullName}** !\n\n` +
          `📜 Lis le ${getMention(rulesChannel, '#règlement')} pour connaître les règles\n` +
          `🎭 Récupère tes rôles dans ${getMention(rolesChannel, '#rôles')}\n` +
          `💬 Viens discuter dans ${getMention(generalChannel, '#chat-general')}\n\n` +
          `**Let it rip !** 🌀`,
      )
      .setColor(Colors.Primary)
      .setImage('attachment://welcome.png')
      .addFields(
        { name: '👤 Membre', value: member.user.tag, inline: true },
        {
          name: '🔢 Membre #',
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
      await welcomeChannel.send({ embeds: [embed], files: attachmentItems });
    } catch (error) {
      this.container.logger.error('Erreur envoi message bienvenue:', error);
    }
  }
}
