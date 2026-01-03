import { ScheduledTask } from "@sapphire/plugin-scheduled-tasks";
import { EmbedBuilder } from "discord.js";
import { Colors, RPB } from "../lib/constants.js";
import prisma from "../lib/prisma.js";

export class TournamentReminderTask extends ScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, {
      ...options,
      // Run every hour at minute 0
      pattern: "0 * * * *",
    });
  }

  public async run() {
    this.container.logger.info("[Task] Running tournament reminder check...");

    try {
      // Find tournaments happening in the next 24 hours
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);

      const upcomingTournaments = await prisma.tournament.findMany({
        where: {
          date: {
            gte: new Date(),
            lte: tomorrow,
          },
          status: {
            in: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "UPCOMING"],
          },
        },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      });

      for (const tournament of upcomingTournaments) {
        const hoursUntil = Math.round(
          (tournament.date.getTime() - Date.now()) / (1000 * 60 * 60),
        );

        // Send reminder at 24h, 6h, and 1h before
        if (hoursUntil === 24 || hoursUntil === 6 || hoursUntil === 1) {
          await this.sendReminder(tournament, hoursUntil);
        }
      }
    } catch (error) {
      this.container.logger.error("[Task] Tournament reminder error:", error);
    }
  }

  private async sendReminder(
    tournament: {
      id: string;
      name: string;
      date: Date;
      location: string | null;
      participants: { user: { discordId: string | null } }[];
    },
    hoursUntil: number,
  ) {
    const embed = new EmbedBuilder()
      .setTitle(`⏰ Rappel Tournoi - ${tournament.name}`)
      .setDescription(
        `Le tournoi commence dans **${hoursUntil} heure(s)** !\n\n` +
          `📅 **Date:** ${tournament.date.toLocaleString("fr-FR")}\n` +
          `📍 **Lieu:** ${tournament.location ?? "En ligne"}\n` +
          `👥 **Participants:** ${tournament.participants.length}`,
      )
      .setColor(hoursUntil <= 1 ? Colors.Error : Colors.Warning)
      .setFooter({ text: `${RPB.FullName} | N'oublie pas ton check-in !` })
      .setTimestamp();

    // DM all registered participants with Discord ID
    for (const participant of tournament.participants) {
      if (!participant.user.discordId) continue;

      try {
        const discordUser = await this.container.client.users.fetch(
          participant.user.discordId,
        );
        await discordUser.send({ embeds: [embed] });
      } catch (error) {
        // User may have DMs disabled
        this.container.logger.warn(
          `Could not DM user ${participant.user.discordId}:`,
          error,
        );
      }
    }

    this.container.logger.info(
      `[Task] Sent reminder for tournament ${tournament.name} (${hoursUntil}h)`,
    );
  }
}

declare module "@sapphire/plugin-scheduled-tasks" {
  interface ScheduledTasks {
    TournamentReminder: never;
  }
}
