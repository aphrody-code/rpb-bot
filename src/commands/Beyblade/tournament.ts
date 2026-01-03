import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getChallongeClient } from "../../lib/challonge.js";
import { Colors, RPB } from "../../lib/constants.js";

export class TournamentCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Gestion des tournois Beyblade via Challonge",
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("tournoi")
        .setDescription("Gestion des tournois Beyblade")
        .addSubcommand((sub) =>
          sub
            .setName("liste")
            .setDescription("Affiche la liste des tournois actifs"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("info")
            .setDescription("Affiche les infos d'un tournoi")
            .addStringOption((opt) =>
              opt
                .setName("id")
                .setDescription("ID ou URL du tournoi Challonge")
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("participants")
            .setDescription("Liste les participants d'un tournoi")
            .addStringOption((opt) =>
              opt
                .setName("id")
                .setDescription("ID ou URL du tournoi Challonge")
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("matches")
            .setDescription("Liste les matches d'un tournoi")
            .addStringOption((opt) =>
              opt
                .setName("id")
                .setDescription("ID ou URL du tournoi Challonge")
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName("état")
                .setDescription("Filtrer par état")
                .addChoices(
                  { name: "🟡 En attente", value: "pending" },
                  { name: "🟢 En cours", value: "open" },
                  { name: "✅ Terminé", value: "complete" },
                ),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("règles")
            .setDescription("Affiche les règles des tournois RPB"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("créer")
            .setDescription("Créer un nouveau tournoi (Admin)")
            .addStringOption((opt) =>
              opt
                .setName("nom")
                .setDescription("Nom du tournoi")
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName("type")
                .setDescription("Type de bracket")
                .addChoices(
                  { name: "Single Elimination", value: "single elimination" },
                  { name: "Double Elimination", value: "double elimination" },
                  { name: "Round Robin", value: "round robin" },
                  { name: "Swiss", value: "swiss" },
                ),
            )
            .addStringOption((opt) =>
              opt
                .setName("description")
                .setDescription("Description du tournoi"),
            ),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "liste":
        return this.listTournaments(interaction);
      case "info":
        return this.showTournament(interaction);
      case "participants":
        return this.listParticipants(interaction);
      case "matches":
        return this.listMatches(interaction);
      case "règles":
        return this.showRules(interaction);
      case "créer":
        return this.createTournament(interaction);
      default:
        return interaction.reply({
          content: "❌ Sous-commande inconnue.",
          ephemeral: true,
        });
    }
  }

  private async listTournaments(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      const challonge = getChallongeClient();
      const response = await challonge.listTournaments({ per_page: 10 });

      if (!response.data || response.data.length === 0) {
        return interaction.editReply("📭 Aucun tournoi trouvé.");
      }

      const embed = new EmbedBuilder()
        .setTitle("🏆 Tournois RPB")
        .setColor(Colors.Secondary)
        .setDescription("Liste des tournois sur Challonge")
        .setFooter({ text: RPB.FullName })
        .setTimestamp();

      for (const tournament of response.data.slice(0, 10)) {
        const stateEmoji = this.getStateEmoji(tournament.attributes.state);
        embed.addFields({
          name: `${stateEmoji} ${tournament.attributes.name}`,
          value:
            `📊 ${tournament.attributes.participantsCount} participants\n` +
            `🔗 [Voir sur Challonge](https://challonge.com/${tournament.attributes.url})`,
          inline: true,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Challonge API error:", error);
      return interaction.editReply(
        "❌ Erreur lors de la récupération des tournois. Vérifie la clé API.",
      );
    }
  }

  private async showTournament(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const tournamentId = interaction.options.getString("id", true);
    await interaction.deferReply();

    try {
      const challonge = getChallongeClient();
      const response = await challonge.getTournament(tournamentId);
      const t = response.data;

      const stateEmoji = this.getStateEmoji(t.attributes.state);
      const embed = new EmbedBuilder()
        .setTitle(`${stateEmoji} ${t.attributes.name}`)
        .setColor(Colors.Primary)
        .setDescription(t.attributes.description ?? "Pas de description")
        .addFields(
          {
            name: "📊 Participants",
            value: `${t.attributes.participantsCount}`,
            inline: true,
          },
          {
            name: "🎮 Jeu",
            value: t.attributes.gameName ?? "Beyblade",
            inline: true,
          },
          { name: "🏷️ Type", value: t.attributes.tournamentType, inline: true },
          { name: "📅 État", value: t.attributes.state, inline: true },
        )
        .setFooter({ text: `ID: ${t.id}` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Voir sur Challonge")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://challonge.com/${t.attributes.url}`)
          .setEmoji("🔗"),
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      this.container.logger.error("Challonge API error:", error);
      return interaction.editReply("❌ Tournoi non trouvé ou erreur API.");
    }
  }

  private async listParticipants(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const tournamentId = interaction.options.getString("id", true);
    await interaction.deferReply();

    try {
      const challonge = getChallongeClient();
      const response = await challonge.listParticipants(tournamentId);

      if (!response.data || response.data.length === 0) {
        return interaction.editReply("📭 Aucun participant inscrit.");
      }

      const participants = response.data
        .sort((a, b) => a.attributes.seed - b.attributes.seed)
        .map(
          (p, i) =>
            `${i + 1}. **${p.attributes.name}** ${p.attributes.checkedIn ? "✅" : ""}`,
        )
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle("👥 Participants")
        .setColor(Colors.Info)
        .setDescription(participants.slice(0, 4000))
        .addFields({
          name: "📊 Total",
          value: `${response.data.length} participant(s)`,
        })
        .setFooter({ text: RPB.FullName })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Challonge API error:", error);
      return interaction.editReply(
        "❌ Erreur lors de la récupération des participants.",
      );
    }
  }

  private async listMatches(interaction: Command.ChatInputCommandInteraction) {
    const tournamentId = interaction.options.getString("id", true);
    const state = interaction.options.getString("état") as
      | "open"
      | "pending"
      | "complete"
      | null;
    await interaction.deferReply();

    try {
      const challonge = getChallongeClient();
      const [matchesRes, participantsRes] = await Promise.all([
        challonge.listMatches(tournamentId, state ? { state } : undefined),
        challonge.listParticipants(tournamentId),
      ]);

      if (!matchesRes.data || matchesRes.data.length === 0) {
        return interaction.editReply("📭 Aucun match trouvé.");
      }

      // Create participant ID to name map
      const participantMap = new Map<string, string>();
      for (const p of participantsRes.data) {
        participantMap.set(p.id, p.attributes.name);
      }

      const matches = matchesRes.data.slice(0, 15).map((m) => {
        const p1 = participantMap.get(m.attributes.player1Id ?? "") ?? "TBD";
        const p2 = participantMap.get(m.attributes.player2Id ?? "") ?? "TBD";
        const stateEmoji = this.getMatchStateEmoji(m.attributes.state);
        const score = m.attributes.scores || "vs";
        return `${stateEmoji} **${p1}** ${score} **${p2}** (Round ${m.attributes.round})`;
      });

      const embed = new EmbedBuilder()
        .setTitle("⚔️ Matches")
        .setColor(Colors.Primary)
        .setDescription(matches.join("\n").slice(0, 4000))
        .setFooter({
          text: `${matchesRes.data.length} match(es) | ${RPB.FullName}`,
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Challonge API error:", error);
      return interaction.editReply(
        "❌ Erreur lors de la récupération des matches.",
      );
    }
  }

  private async createTournament(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    // Check admin permissions
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        content: "❌ Seuls les administrateurs peuvent créer des tournois.",
        ephemeral: true,
      });
    }

    const name = interaction.options.getString("nom", true);
    const type = interaction.options.getString("type") as
      | "single elimination"
      | "double elimination"
      | "round robin"
      | "swiss"
      | null;
    const description = interaction.options.getString("description");

    await interaction.deferReply();

    try {
      const challonge = getChallongeClient();
      const response = await challonge.createTournament({
        name,
        tournamentType: type ?? "single elimination",
        description: description ?? `Tournoi organisé par ${RPB.FullName}`,
        gameName: "Beyblade",
        openSignup: true,
      });

      const t = response.data;
      const embed = new EmbedBuilder()
        .setTitle("🎉 Tournoi créé !")
        .setColor(Colors.Success)
        .setDescription(`**${t.attributes.name}** a été créé avec succès !`)
        .addFields(
          { name: "🏷️ Type", value: t.attributes.tournamentType, inline: true },
          {
            name: "🔗 URL",
            value: `https://challonge.com/${t.attributes.url}`,
            inline: false,
          },
        )
        .setFooter({ text: RPB.FullName })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Gérer sur Challonge")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://challonge.com/${t.attributes.url}`)
          .setEmoji("⚙️"),
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      this.container.logger.error("Challonge API error:", error);
      return interaction.editReply("❌ Erreur lors de la création du tournoi.");
    }
  }

  private async showRules(interaction: Command.ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle("📜 Règles des Tournois RPB")
      .setColor(Colors.Info)
      .addFields(
        {
          name: "1️⃣ Format Standard",
          value:
            "• Match en **Best of 3** (2 victoires)\n" +
            "• Points: Burst Finish = 2pts, Over/Spin = 1pt\n" +
            "• Premier à 3 points gagne",
          inline: false,
        },
        {
          name: "2️⃣ Équipement",
          value:
            "• Seules les toupies **officielles Takara Tomy/Hasbro** sont autorisées\n" +
            "• Pas de modifications\n" +
            "• Stadium officiel requis",
          inline: false,
        },
        {
          name: "3️⃣ Comportement",
          value:
            "• Respect des adversaires et arbitres\n" +
            "• Pas de triche ou comportement antisportif\n" +
            "• Fun avant tout ! 🎉",
          inline: false,
        },
        {
          name: "4️⃣ X-Treme Finish (Beyblade X)",
          value:
            "• Éjection via le rail X-treme = **3 points**\n" +
            "• Finit immédiatement le match !",
          inline: false,
        },
      )
      .setFooter({ text: `${RPB.FullName} | Let it rip!` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  private getStateEmoji(state: string): string {
    switch (state) {
      case "pending":
        return "🟡";
      case "underway":
      case "in_progress":
        return "🟢";
      case "complete":
      case "ended":
        return "✅";
      default:
        return "⚪";
    }
  }

  private getMatchStateEmoji(state: string): string {
    switch (state) {
      case "pending":
        return "⏳";
      case "open":
        return "🟢";
      case "complete":
        return "✅";
      default:
        return "⚪";
    }
  }
}
