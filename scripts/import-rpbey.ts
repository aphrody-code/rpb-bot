import { importTournament } from '../src/lib/challonge-sync.js';
import { prisma } from '../src/lib/prisma.js';

async function run() {
  const challongeId = 'rpbey';
  console.log(`🚀 Tentative d'import du tournoi: ${challongeId}`);
  
  try {
    const result = await importTournament(challongeId);
    
    if (result.success) {
      console.log('✅ Succès !');
      console.log(`ID Tournoi: ${result.tournamentId}`);
      console.log(`Participants: ${result.participantsCount}`);
    } else {
      console.error(`❌ Échec: ${result.error}`);
    }
  } catch (err) {
    console.error('💥 Erreur fatale:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
