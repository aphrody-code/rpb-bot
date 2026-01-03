import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { AutocompleteInteraction } from "discord.js";
import { getChallongeClient } from "../lib/challonge.js";
import prisma from "../lib/prisma.js";

export class TournamentAutocompleteHandler extends InteractionHandler {
  public constructor(context: InteractionHandler.LoaderContext) {
    super(context, {
      interactionHandlerType: InteractionHandlerTypes.Autocomplete,
    });
  }

  public override parse(interaction: AutocompleteInteraction) {
    // Handle autocomplete for tournament commands
    const commandName = interaction.commandName;
    const focusedOption = interaction.options.getFocused(true);

    // Only handle specific options
    if (
      commandName === "tournoi" &&
      (focusedOption.name === "id" || focusedOption.name === "tournoi")
    ) {
      return this.some({ type: "tournament", query: focusedOption.value });
    }

    if (
      (commandName === "profil" || commandName === "stats") &&
      focusedOption.name === "joueur"
    ) {
      return this.some({ type: "player", query: focusedOption.value });
    }

    return this.none();
  }

  public async run(
    interaction: AutocompleteInteraction,
    { type, query }: { type: string; query: string },
  ) {
    switch (type) {
      case "tournament":
        return this.autocompleteTournaments(interaction, query);
      case "player":
        return this.autocompletePlayers(interaction, query);
      default:
        return interaction.respond([]);
    }
  }

  private async autocompleteTournaments(
    interaction: AutocompleteInteraction,
    query: string,
  ) {
    try {
      // Try local DB first
      const localTournaments = await prisma.tournament.findMany({
        where: {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        take: 15,
        orderBy: { date: "desc" },
      });

      if (localTournaments.length > 0) {
        return interaction.respond(
          localTournaments.map((t) => ({
            name: `${t.name} (${t.date.toLocaleDateString("fr-FR")})`,
            value: t.id,
          })),
        );
      }

      // Fallback to Challonge API
      const challonge = getChallongeClient();
      const response = await challonge.listTournaments({ per_page: 15 });

      const filtered = response.data
        .filter((t) =>
          t.attributes.name.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 25);

      return interaction.respond(
        filtered.map((t) => ({
          name: t.attributes.name.slice(0, 100),
          value: t.attributes.url,
        })),
      );
    } catch (error) {
      this.container.logger.error("Tournament autocomplete error:", error);
      return interaction.respond([]);
    }
  }

  private async autocompletePlayers(
    interaction: AutocompleteInteraction,
    query: string,
  ) {
    try {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { discordTag: { contains: query, mode: "insensitive" } },
            {
              profile: {
                bladerName: { contains: query, mode: "insensitive" },
              },
            },
          ],
        },
        include: { profile: true },
        take: 25,
      });

      return interaction.respond(
        users.map((u) => ({
          name:
            u.profile?.bladerName ??
            u.name ??
            u.discordTag ??
            "Utilisateur inconnu",
          value: u.id,
        })),
      );
    } catch (error) {
      this.container.logger.error("Player autocomplete error:", error);
      return interaction.respond([]);
    }
  }
}
