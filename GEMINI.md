# Gemini Context - RPB Bot

This file provides context and guidelines for Gemini (and other AI agents) working on the RPB Bot codebase.

## Project Overview
RPB Bot is a Discord bot likely built using the Sapphire framework, designed for managing Beyblade tournaments, profiles, and general server moderation.

## Tech Stack
- **Language:** TypeScript
- **Framework:** [Sapphire Framework](https://www.sapphirejs.dev/) (Discord.js)
- **Database:** PostgreSQL (via Prisma ORM)
- **Package Manager:** pnpm
- **Task Runner:** lefthook
- **Linting/Formatting:** ESLint, Prettier

## Key Directories
- `src/commands/`: Discord slash commands categorized by function (Beyblade, General, Moderation).
- `src/listeners/`: Event listeners for Discord events.
- `src/interaction-handlers/`: Handlers for buttons, modals, and autocompletes.
- `src/lib/`: Shared utilities, API clients (Challonge), and Prisma client.
- `prisma/`: Database schema definition.

## Development Guidelines
- Follow the existing command structure using Sapphire's `Subcommand` or `Command` classes.
- Ensure all new features are properly typed.
- Use `src/lib/utils.ts` for common utility functions.
- Run `pnpm prisma generate` after modifying `prisma/schema.prisma`.
