import { Listener } from '@sapphire/framework';
import { Events, type GuildMember } from 'discord.js';
import prisma from '../../lib/prisma.js';

export class MemberUpdateListener extends Listener<Events.GuildMemberUpdate> {
  constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.GuildMemberUpdate });
  }

  override async run(oldMember: GuildMember, newMember: GuildMember) {
    // Only care about role changes
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    if (
      oldRoles.size === newRoles.size &&
      oldRoles.every((role) => newRoles.has(role.id))
    ) {
      return;
    }

    // Check if member has Admin role
    const isAdmin = newMember.permissions.has('Administrator');
    const role = isAdmin ? 'admin' : 'user';

    try {
      await prisma.user.update({
        where: { discordId: newMember.id },
        data: { role },
      });

      this.container.logger.debug(
        `Synced role for ${newMember.user.tag}: ${role}`,
      );
    } catch (_error) {
      // User might not be in DB yet, ignore
    }
  }
}
