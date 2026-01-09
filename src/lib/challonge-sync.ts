import { container } from '@sapphire/framework';
import { getChallongeClient } from './challonge.js';
import prisma from './prisma.js';

/**
 * Service de synchronisation Challonge
 *
 * Stratégie économe en requêtes API (limite 500/mois):
 * - Import initial: 2 requêtes (tournoi + participants)
 * - Sync temps réel: Activé uniquement 24h avant le tournoi
 * - Cache DB: Utiliser la DB comme source principale
 */

export interface SyncResult {
  success: boolean;
  tournamentId?: string;
  participantsCount?: number;
  error?: string;
  apiRequestsUsed: number;
}

/**
 * Importe un tournoi Challonge en base de données (2 requêtes API)
 * À utiliser une seule fois lors de l'ajout d'un tournoi
 */
export async function importTournament(
  challongeId: string,
): Promise<SyncResult> {
  const challonge = getChallongeClient();
  let apiRequestsUsed = 0;

  try {
    // 1. Récupérer les infos du tournoi (1 requête)
    const tournamentRes = await challonge.getTournament(challongeId);
    apiRequestsUsed++;
    const tournament = tournamentRes.data;

    // 2. Récupérer les participants (1 requête)
    const participantsRes = await challonge.listParticipants(challongeId);
    apiRequestsUsed++;
    const participants = participantsRes.data ?? [];

    // 3. Mapper le statut Challonge vers notre enum
    const status = mapChallongeState(tournament.attributes.state);

    // 4. Créer ou mettre à jour le tournoi en DB
    const dbTournament = await prisma.tournament.upsert({
      where: { challongeId },
      update: {
        name: tournament.attributes.name,
        description: tournament.attributes.description,
        date: tournament.attributes.startAt
          ? new Date(tournament.attributes.startAt)
          : new Date(),
        status,
        challongeUrl: `https://challonge.com/${tournament.attributes.url}`,
      },
      create: {
        challongeId,
        name: tournament.attributes.name,
        description: tournament.attributes.description,
        date: tournament.attributes.startAt
          ? new Date(tournament.attributes.startAt)
          : new Date(),
        status,
        challongeUrl: `https://challonge.com/${tournament.attributes.url}`,
        maxPlayers: 64, // Default
      },
    });

    // 5. Importer les participants
    let importedCount = 0;
    for (const p of participants) {
      // Le champ misc contient l'ID Discord si défini
      const discordId = p.attributes.misc;

      if (discordId) {
        // Trouver l'utilisateur par Discord ID
        const user = await prisma.user.findUnique({
          where: { discordId },
        });

        if (user) {
          await prisma.tournamentParticipant.upsert({
            where: {
              tournamentId_userId: {
                tournamentId: dbTournament.id,
                userId: user.id,
              },
            },
            update: {
              challongeParticipantId: p.id,
              seed: p.attributes.seed,
              checkedIn: p.attributes.checkedIn ?? false,
            },
            create: {
              tournamentId: dbTournament.id,
              userId: user.id,
              challongeParticipantId: p.id,
              seed: p.attributes.seed,
              checkedIn: p.attributes.checkedIn ?? false,
            },
          });
          importedCount++;
        }
      }
    }

    container.logger.info(
      `[Sync] Tournoi importé: ${tournament.attributes.name} (${importedCount} participants, ${apiRequestsUsed} requêtes API)`,
    );

    return {
      success: true,
      tournamentId: dbTournament.id,
      participantsCount: importedCount,
      apiRequestsUsed,
    };
  } catch (error) {
    container.logger.error('[Sync] Erreur import tournoi:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      apiRequestsUsed,
    };
  }
}

/**
 * Sync les participants d'un tournoi (1 requête API)
 * À utiliser uniquement 24h avant le tournoi
 */
export async function syncParticipants(
  challongeId: string,
): Promise<SyncResult> {
  const challonge = getChallongeClient();
  let apiRequestsUsed = 0;

  try {
    // Vérifier que le tournoi existe en DB
    const dbTournament = await prisma.tournament.findUnique({
      where: { challongeId },
    });

    if (!dbTournament) {
      return {
        success: false,
        error:
          "Tournoi non trouvé en base de données. Utilisez importTournament() d'abord.",
        apiRequestsUsed: 0,
      };
    }

    // Récupérer les participants depuis Challonge (1 requête)
    const participantsRes = await challonge.listParticipants(challongeId);
    apiRequestsUsed++;
    const participants = participantsRes.data ?? [];

    let syncedCount = 0;
    for (const p of participants) {
      const discordId = p.attributes.misc;

      if (discordId) {
        const user = await prisma.user.findUnique({
          where: { discordId },
        });

        if (user) {
          await prisma.tournamentParticipant.upsert({
            where: {
              tournamentId_userId: {
                tournamentId: dbTournament.id,
                userId: user.id,
              },
            },
            update: {
              challongeParticipantId: p.id,
              seed: p.attributes.seed,
              checkedIn: p.attributes.checkedIn ?? false,
            },
            create: {
              tournamentId: dbTournament.id,
              userId: user.id,
              challongeParticipantId: p.id,
              seed: p.attributes.seed,
              checkedIn: p.attributes.checkedIn ?? false,
            },
          });
          syncedCount++;
        }
      }
    }

    return {
      success: true,
      tournamentId: dbTournament.id,
      participantsCount: syncedCount,
      apiRequestsUsed,
    };
  } catch (error) {
    container.logger.error('[Sync] Erreur sync participants:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      apiRequestsUsed,
    };
  }
}

/**
 * Pousse un participant local vers Challonge (1 requête API)
 */
export async function pushParticipantToChallonge(
  challongeId: string,
  discordId: string,
  playerName: string,
): Promise<{ success: boolean; participantId?: string; error?: string }> {
  const challonge = getChallongeClient();

  try {
    const result = await challonge.createParticipant(challongeId, {
      name: playerName,
      misc: discordId, // Stocke l'ID Discord pour le mapping
    });

    return {
      success: true,
      participantId: result.data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

/**
 * Vérifie si un tournoi doit être synchronisé en temps réel
 * (24h avant le début)
 */
export async function shouldSyncRealtime(
  tournamentId: string,
): Promise<boolean> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) return false;

  const now = new Date();
  const tournamentDate = new Date(tournament.date);
  const hoursUntilTournament =
    (tournamentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Sync temps réel si le tournoi est dans moins de 24h et pas terminé
  return (
    hoursUntilTournament <= 24 &&
    hoursUntilTournament > -6 &&
    tournament.status !== 'COMPLETE'
  );
}

/**
 * Récupère les tournois qui nécessitent un sync temps réel
 */
export async function getTournamentsNeedingSync(): Promise<string[]> {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const tournaments = await prisma.tournament.findMany({
    where: {
      challongeId: { not: null },
      status: { not: 'COMPLETE' },
      date: {
        gte: sixHoursAgo,
        lte: in24Hours,
      },
    },
    select: { challongeId: true },
  });

  return tournaments
    .map((t) => t.challongeId)
    .filter((id): id is string => id !== null);
}

/**
 * Reporte le score d'un match sur Challonge et met à jour la DB locale
 */
export async function reportMatchScore(
  challongeTournamentId: string,
  challongeMatchId: string,
  winnerDiscordId: string,
  scoreCsv: string,
): Promise<{ success: boolean; error?: string; apiRequestsUsed: number }> {
  const challonge = getChallongeClient();
  let apiRequestsUsed = 0;

  try {
    // 1. Trouver l'utilisateur gagnant
    const user = await prisma.user.findUnique({
      where: { discordId: winnerDiscordId },
    });

    if (!user) {
      return {
        success: false,
        error: 'Gagnant non trouvé dans la base de données.',
        apiRequestsUsed: 0,
      };
    }

    // 2. Trouver le participant correspondant dans le tournoi
    const dbTournament = await prisma.tournament.findUnique({
      where: { challongeId: challongeTournamentId },
    });

    if (!dbTournament) {
      return {
        success: false,
        error: 'Tournoi non trouvé en base de données.',
        apiRequestsUsed: 0,
      };
    }

    const participant = await prisma.tournamentParticipant.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId: dbTournament.id,
          userId: user.id,
        },
      },
    });

    if (!participant || !participant.challongeParticipantId) {
      return {
        success: false,
        error: "Le gagnant n'est pas un participant valide de ce tournoi.",
        apiRequestsUsed: 0,
      };
    }

    // 3. Envoyer à Challonge (1 requête)
    await challonge.updateMatch(challongeTournamentId, challongeMatchId, {
      winnerId: participant.challongeParticipantId,
      scoresCsv: scoreCsv,
    });
    apiRequestsUsed++;

    // 4. Mettre à jour la DB locale (si le match existe)
    await prisma.tournamentMatch.updateMany({
      where: {
        tournamentId: dbTournament.id,
        challongeMatchId: challongeMatchId,
      },
      data: {
        winnerId: user.id,
        score: scoreCsv,
        state: 'complete',
      },
    });

    return {
      success: true,
      apiRequestsUsed,
    };
  } catch (error) {
    container.logger.error('[Sync] Erreur report score:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      apiRequestsUsed,
    };
  }
}

/**
 * Mappe l'état Challonge vers notre enum TournamentStatus
 */ function mapChallongeState(
  state: string,
):
  | 'UPCOMING'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'CHECKIN'
  | 'UNDERWAY'
  | 'COMPLETE'
  | 'CANCELLED' {
  switch (state) {
    case 'pending':
      return 'REGISTRATION_OPEN';
    case 'checking_in':
      return 'CHECKIN';
    case 'underway':
    case 'in_progress':
      return 'UNDERWAY';
    case 'complete':
    case 'ended':
      return 'COMPLETE';
    default:
      return 'UPCOMING';
  }
}

/**
 * Estimation du nombre de requêtes API restantes ce mois
 * (À implémenter avec un compteur en DB si nécessaire)
 */
export function getApiRequestsRemaining(): number {
  // TODO: Implémenter un compteur en DB
  // Pour l'instant, on suppose 500 - estimations
  return 500;
}
