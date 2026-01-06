import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { EmbedBuilder, type TextChannel } from 'discord.js';
import { Colors, RPB } from '../lib/constants.js';
import prisma from '../lib/prisma.js';

export class DailyStatsTask extends ScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, {
      ...options,
      // Run daily at 9:00 AM Paris time
      pattern: '0 9 * * *',
      timezone: 'Europe/Paris',
    });
  }

  public async run() {
    this.container.logger.info('[Task] Running daily stats report...');

    try {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // Get stats for the last 24 hours
      const [
        newUsers,
        totalUsers,
        activeTournaments,
        completedTournamentsToday,
        totalParticipations,
      ] = await Promise.all([
        prisma.user.count({
          where: {
            createdAt: { gte: yesterday },
          },
        }),
        prisma.user.count(),
        prisma.tournament.count({
          where: {
            status: { in: ['REGISTRATION_OPEN', 'UNDERWAY', 'CHECKIN'] },
          },
        }),
        prisma.tournament.count({
          where: {
            status: 'COMPLETE',
            updatedAt: { gte: yesterday },
          },
        }),
        prisma.tournamentParticipant.count(),
      ]);

      const embed = new EmbedBuilder()
        .setTitle('📊 Rapport Quotidien RPB')
        .setDescription(`Statistiques du ${now.toLocaleDateString('fr-FR')}`)
        .setColor(Colors.Info)
        .addFields(
          {
            name: '👥 Nouveaux utilisateurs (24h)',
            value: `+${newUsers}`,
            inline: true,
          },
          {
            name: '📈 Total utilisateurs',
            value: totalUsers.toString(),
            inline: true,
          },
          {
            name: '🏆 Tournois actifs',
            value: activeTournaments.toString(),
            inline: true,
          },
          {
            name: '✅ Tournois terminés (24h)',
            value: completedTournamentsToday.toString(),
            inline: true,
          },
          {
            name: '🎮 Participations totales',
            value: totalParticipations.toString(),
            inline: true,
          },
        )
        .setFooter({ text: RPB.FullName })
        .setTimestamp();

      // Send to bot channel
      const channelId = process.env.BOT_CHANNEL_ID;
      if (channelId) {
        const channel = await this.container.client.channels.fetch(channelId);
        if (channel?.isTextBased()) {
          await (channel as TextChannel).send({ embeds: [embed] });
        }
      }

      this.container.logger.info('[Task] Daily stats report sent');
    } catch (error) {
      this.container.logger.error('[Task] Daily stats error:', error);
    }
  }
}

declare module '@sapphire/plugin-scheduled-tasks' {
  interface ScheduledTasks {
    DailyStats: never;
  }
}
