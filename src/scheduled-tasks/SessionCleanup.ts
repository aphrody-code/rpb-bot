import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import prisma from '../lib/prisma.js';

export class SessionCleanupTask extends ScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, {
      ...options,
      // Run daily at 3:00 AM (low traffic)
      pattern: '0 3 * * *',
      timezone: 'Europe/Paris',
    });
  }

  public async run() {
    this.container.logger.info('[Task] Running session cleanup...');

    try {
      // Delete expired sessions
      const deleted = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      // Delete expired verifications
      const deletedVerifications = await prisma.verification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      this.container.logger.info(
        `[Task] Cleanup complete: ${deleted.count} sessions, ${deletedVerifications.count} verifications deleted`,
      );
    } catch (error) {
      this.container.logger.error('[Task] Session cleanup error:', error);
    }
  }
}

declare module '@sapphire/plugin-scheduled-tasks' {
  interface ScheduledTasks {
    SessionCleanup: never;
  }
}
