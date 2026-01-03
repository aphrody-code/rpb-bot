import { Listener } from "@sapphire/framework";
import { ChannelType, type GuildChannel } from "discord.js";

// Salon visible pour les utilisateurs mutés
const MUTED_CHANNEL_ID = process.env.MUTED_CHANNEL_ID ?? "1456761597245784260";
const MUTED_ROLE_NAME = "Muted";

export class MutedChannelSyncListener extends Listener {
  constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: "channelCreate",
    });
  }

  async run(channel: GuildChannel) {
    // Ignorer les DMs
    if (!channel.guild) return;

    // Ignorer certains types de channels
    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildVoice &&
      channel.type !== ChannelType.GuildForum &&
      channel.type !== ChannelType.GuildCategory
    ) {
      return;
    }

    // Chercher le rôle Muted
    const mutedRole = channel.guild.roles.cache.find(
      (r) => r.name === MUTED_ROLE_NAME,
    );

    if (!mutedRole) {
      // Le rôle Muted n'existe pas, rien à faire
      return;
    }

    try {
      if (channel.id === MUTED_CHANNEL_ID) {
        // Nouveau salon = salon muted (peu probable mais on gère)
        await channel.permissionOverwrites.edit(mutedRole, {
          ViewChannel: true,
          SendMessages: true,
          AddReactions: false,
          AttachFiles: false,
          EmbedLinks: false,
        });
      } else {
        // Nouveau salon = refuser l'accès aux mutés
        await channel.permissionOverwrites.edit(mutedRole, {
          ViewChannel: false,
          SendMessages: false,
        });
      }

      this.container.logger.debug(
        `Permissions Muted configurées pour le nouveau salon: ${channel.name}`,
      );
    } catch (error) {
      this.container.logger.warn(
        `Impossible de configurer les permissions Muted pour ${channel.name}:`,
        error,
      );
    }
  }
}
