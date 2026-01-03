import { ScheduledTask } from "@sapphire/plugin-scheduled-tasks";
import {
  getTournamentsNeedingSync,
  syncParticipants,
} from "../lib/challonge-sync.js";

/**
 * Tâche de synchronisation pré-tournoi
 *
 * S'exécute toutes les heures et synchronise UNIQUEMENT les tournois
 * qui commencent dans les 24 prochaines heures.
 *
 * Coût: ~1 requête API par tournoi nécessitant un sync
 * Fréquence: Maximum 1 sync/heure/tournoi pendant 24h = ~24 requêtes/tournoi
 */
export class PreTournamentSyncTask extends ScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, {
      ...options,
      // Exécuter toutes les heures
      pattern: "0 * * * *",
      timezone: "Europe/Paris",
    });
  }

  public async run() {
    this.container.logger.info(
      "[Task] Vérification des tournois à synchroniser...",
    );

    try {
      // Récupérer les tournois qui nécessitent un sync (dans les 24h)
      const tournamentsToSync = await getTournamentsNeedingSync();

      if (tournamentsToSync.length === 0) {
        this.container.logger.info("[Task] Aucun tournoi à synchroniser");
        return;
      }

      this.container.logger.info(
        `[Task] ${tournamentsToSync.length} tournoi(s) à synchroniser`,
      );

      let totalRequests = 0;

      for (const challongeId of tournamentsToSync) {
        const result = await syncParticipants(challongeId);
        totalRequests += result.apiRequestsUsed;

        if (result.success) {
          this.container.logger.info(
            `[Task] Sync ${challongeId}: ${result.participantsCount} participants`,
          );
        } else {
          this.container.logger.warn(
            `[Task] Échec sync ${challongeId}: ${result.error}`,
          );
        }

        // Attendre 1 seconde entre chaque requête pour éviter le rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      this.container.logger.info(
        `[Task] Sync terminé. ${totalRequests} requêtes API utilisées.`,
      );
    } catch (error) {
      this.container.logger.error("[Task] Erreur sync pré-tournoi:", error);
    }
  }
}

declare module "@sapphire/plugin-scheduled-tasks" {
  interface ScheduledTasks {
    PreTournamentSync: never;
  }
}
