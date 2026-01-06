import { container, Listener, type SapphireClient } from '@sapphire/framework';
import { type ClientEvents, Events, type GuildMember } from 'discord.js';
import { setupLogCapture } from '../lib/log-capture.js';
import prisma from '../lib/prisma.js';

export class ReadyListener extends Listener<Events.ClientReady> {
  constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, once: true, event: Events.ClientReady });
  }

  override async run(...[client]: ClientEvents[Events.ClientReady]) {
    // Setup log capture for dashboard integration
    setupLogCapture();

    container.logger.info('Connecté en tant que :', client.user.tag);

    // Sync admin roles
    await this.syncAdminRoles(client);

    // Cleanup guild commands if requested (to fix duplicate commands bug)
    if (process.env.CLEAR_GUILD_COMMANDS === 'true' && process.env.GUILD_ID) {
      try {
        container.logger.info(
          `Nettoyage des commandes de guilde pour : ${process.env.GUILD_ID}`,
        );
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.commands.set([]);
        container.logger.info('Commandes de guilde nettoyées avec succès !');
      } catch (error) {
        container.logger.error(
          'Erreur lors du nettoyage des commandes de guilde :',
          error,
        );
      }
    }
  }

  private async syncAdminRoles(client: SapphireClient) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      container.logger.warn(
        'GUILD_ID pas configuré, impossible de synchroniser les rôles admin.',
      );
      return;
    }

    try {
      // Find guild and fetch members
      const guild =
        client.guilds.cache.get(guildId) ??
        (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) {
        container.logger.error(
          `Guilde ${guildId} non trouvée lors de la synchronisation des rôles.`,
        );
        return;
      }

      const members = await guild.members.fetch();
      const admins = members.filter((member: GuildMember) =>
        member.permissions.has('Administrator'),
      );

      container.logger.info(
        `Synchronisation de ${admins.size} administrateurs...`,
      );

      // Better Auth roles sync
      for (const [id, member] of admins) {
        try {
          // Use upsert to ensure the user exists in DB before setting role
          // This avoids "Record not found" errors
          await prisma.user.upsert({
            where: { discordId: id },
            update: { role: 'admin' },
            create: {
              discordId: id,
              discordTag: member.user.tag,
              name: member.displayName,
              email: `${id}@discord.rpbey.fr`,
              role: 'admin',
            },
          });
        } catch (error) {
          container.logger.debug(`Impossible de sync l'admin ${id}: ${error}`);
        }
      }

      // Also reset non-admins if they were previously admin?
      // For safety, let's also find all 'admin' in DB and check if they still have the perm
      const dbAdmins = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { discordId: true },
      });

      for (const dbAdmin of dbAdmins) {
        if (!dbAdmin.discordId) continue;
        const member = members.get(dbAdmin.discordId);
        if (!member || !member.permissions.has('Administrator')) {
          await prisma.user.update({
            where: { discordId: dbAdmin.discordId },
            data: { role: 'user' },
          });
        }
      }

      container.logger.info('Synchronisation des rôles terminée.');
    } catch (error) {
      container.logger.error(
        'Erreur lors de la synchronisation des rôles :',
        error,
      );
    }
  }
}
