# RPB Bot

Bot Discord pour le serveur **RPB** - [Rejoindre le serveur](https://discord.gg/twdVfesrRj)

## Tech Stack

- **Runtime**: Node.js 24+ avec pnpm
- **Framework**: [Sapphire](https://sapphirejs.dev/) + discord.js
- **Language**: TypeScript (ESM)
- **Deployment**: Docker / Coolify

## Installation

```bash
pnpm install
```

## Configuration

Créez un fichier `.env` à la racine :

```env
DISCORD_TOKEN="votre-token-bot"
```

Obtenez votre token sur le [Discord Developer Portal](https://discord.com/developers/applications).

## Développement

```bash
pnpm start        # Lancer le bot
pnpm lint         # Vérifier le code
pnpm format       # Formater le code
```

## Ajouter une commande

Créez un fichier dans `src/commands/` :

```typescript
import { Command } from "@sapphire/framework";

export class MaCommande extends Command {
  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName("macommande").setDescription("Description"),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    return interaction.reply("Hello!");
  }
}
```

## Déploiement Docker

```bash
# Build
docker build -t rpb-bot .

# Run
docker run -dt -e DISCORD_TOKEN=$DISCORD_TOKEN rpb-bot
```

## Structure

```
src/
├── commands/     # Commandes slash
├── listeners/    # Event listeners
└── index.ts      # Point d'entrée
```

## Ressources

- [Sapphire Docs](https://sapphirejs.dev/docs/General/Welcome)
- [discord.js Guide](https://discordjs.guide/)
- [Discord Developer Portal](https://discord.com/developers/docs/)
