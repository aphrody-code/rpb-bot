import { Command } from "@sapphire/framework";
import { EmbedBuilder, PermissionFlagsBits, ChannelType, TextChannel, NewsChannel } from "discord.js";
import { Colors, RPB } from "../../lib/constants.js";
import { getChallongeClient } from "../../lib/challonge.js";

export class AnnounceCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Système d'annonces pour les tournois",
      preconditions: ["ModeratorOnly"],
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("annonce")
        .setDescription("Système d'annonces pour les tournois")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand((sub) =>
          sub
            .setName("tournoi")
            .setDescription("Annonce un tournoi Challonge")
            .addStringOption((opt) =>
              opt
                .setName("id")
                .setDescription("ID ou URL du tournoi Challonge (ex: B_TS1)")
                .setRequired(true),
            )
            .addChannelOption((opt) =>
              opt
                .setName("salon")
                .setDescription("Salon où envoyer l'annonce")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
            )
            .addRoleOption((opt) =>
              opt.setName("mention").setDescription("Rôle à mentionner"),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("rappel")
            .setDescription("Envoie un rappel pour un tournoi")
            .addStringOption((opt) =>
              opt
                .setName("id")
                .setDescription("ID ou URL du tournoi Challonge")
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName("message")
                .setDescription("Message personnalisé pour le rappel"),
            )
            .addChannelOption((opt) =>
              opt
                .setName("salon")
                .setDescription("Salon où envoyer le rappel")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("résultats")
            .setDescription("Annonce les résultats d'un tournoi terminé")
            .addStringOption((opt) =>
              opt
                .setName("id")
                .setDescription("ID ou URL du tournoi Challonge")
                .setRequired(true),
            )
            .addChannelOption((opt) =>
              opt
                .setName("salon")
                .setDescription("Salon où envoyer les résultats")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("custom")
            .setDescription("Envoie une annonce personnalisée")
            .addStringOption((opt) =>
              opt.setName("titre").setDescription("Titre de l'annonce").setRequired(true),
            )
            .addStringOption((opt) =>
              opt.setName("message").setDescription("Contenu de l'annonce").setRequired(true),
            )
            .addChannelOption((opt) =>
              opt
                .setName("salon")
                .setDescription("Salon où envoyer l'annonce")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
            )
            .addRoleOption((opt) =>
              opt.setName("mention").setDescription("Rôle à mentionner"),
            )
            .addStringOption((opt) =>
              opt
                .setName("couleur")
                .setDescription("Couleur de l'embed (hex)")
                .addChoices(
                  { name: "🔴 Rouge RPB", value: "dc2626" },
                  { name: "🟡 Or RPB", value: "fbbf24" },
                  { name: "🟢 Succès", value: "22c55e" },
                  { name: "🔵 Info", value: "3b82f6" },
                  { name: "🟣 Beyblade", value: "8b5cf6" },
                ),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("générer")
            .setDescription("Génère une annonce officielle style RPB")
            .addStringOption((opt) =>
              opt
                .setName("nom")
                .setDescription("Nom du tournoi (ex: Bey-Tamashii Series #2)")
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName("date")
                .setDescription("Date du tournoi (ex: Dimanche 15 février 2026)")
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName("heure")
                .setDescription("Heure de début (ex: 14h00)")
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName("lieu")
                .setDescription("Lieu du tournoi")
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName("challonge")
                .setDescription("Lien ou ID Challonge")
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName("format")
                .setDescription("Format du tournoi")
                .addChoices(
                  { name: "3on3 Double Élimination", value: "3on3 classique en Double Élimination" },
                  { name: "3on3 Simple Élimination", value: "3on3 en Simple Élimination" },
                  { name: "1on1 Double Élimination", value: "1on1 en Double Élimination" },
                  { name: "Round Robin", value: "Round Robin" },
                ),
            )
            .addIntegerOption((opt) =>
              opt
                .setName("places")
                .setDescription("Nombre de places max (ex: 64)")
                .setMinValue(8)
                .setMaxValue(256),
            )
            .addStringOption((opt) =>
              opt
                .setName("checkin")
                .setDescription("Heure d'ouverture check-in (ex: 13h00)"),
            )
            .addStringOption((opt) =>
              opt
                .setName("intro")
                .setDescription("Texte d'introduction personnalisé"),
            )
            .addChannelOption((opt) =>
              opt
                .setName("salon")
                .setDescription("Salon où envoyer")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
            )
            .addBooleanOption((opt) =>
              opt
                .setName("preview")
                .setDescription("Aperçu sans envoyer (défaut: true)"),
            ),
        ),
    );
  }

  override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "tournoi":
        return this.announceTournament(interaction);
      case "rappel":
        return this.sendReminder(interaction);
      case "résultats":
        return this.announceResults(interaction);
      case "custom":
        return this.sendCustom(interaction);
      case "générer":
        return this.generateAnnouncement(interaction);
      default:
        return interaction.reply({ content: "❌ Sous-commande inconnue.", ephemeral: true });
    }
  }

  private async announceTournament(interaction: Command.ChatInputCommandInteraction) {
    const tournamentId = interaction.options.getString("id", true);
    const channel = (interaction.options.getChannel("salon") ?? interaction.channel) as TextChannel | NewsChannel;
    const mentionRole = interaction.options.getRole("mention");

    await interaction.deferReply({ ephemeral: true });

    try {
      const challonge = getChallongeClient();
      const [tournamentRes, participantsRes] = await Promise.all([
        challonge.getTournament(tournamentId),
        challonge.listParticipants(tournamentId),
      ]);

      const t = tournamentRes.data;
      const participantCount = participantsRes.data?.length ?? t.attributes.participantsCount;

      const embed = new EmbedBuilder()
        .setTitle(`🏆 ${t.attributes.name}`)
        .setDescription(
          `${t.attributes.description ?? "Un nouveau tournoi Beyblade vous attend !"}\n\n` +
          `**🌀 Let it rip !**`
        )
        .setColor(Colors.Primary)
        .addFields(
          { name: "🎮 Jeu", value: t.attributes.gameName ?? "Beyblade X", inline: true },
          { name: "🏷️ Format", value: this.formatTournamentType(t.attributes.tournamentType), inline: true },
          { name: "👥 Inscrits", value: `${participantCount} joueur(s)`, inline: true },
        )
        .setFooter({ text: `${RPB.FullName} | ID: ${tournamentId}` })
        .setTimestamp();

      if (t.attributes.startAt) {
        const startDate = new Date(t.attributes.startAt);
        embed.addFields({
          name: "📅 Date",
          value: `<t:${Math.floor(startDate.getTime() / 1000)}:F> (<t:${Math.floor(startDate.getTime() / 1000)}:R>)`,
          inline: false,
        });
      }

      embed.addFields({
        name: "🔗 Inscription",
        value: `[S'inscrire sur Challonge](https://challonge.com/${t.attributes.url})`,
        inline: false,
      });

      const content = mentionRole ? `${mentionRole}` : undefined;

      await channel.send({ content, embeds: [embed] });

      // If it's an announcement channel, try to publish
      if ("type" in channel && channel.type === ChannelType.GuildAnnouncement) {
        try {
          const messages = await channel.messages.fetch({ limit: 1 });
          const lastMessage = messages.first();
          if (lastMessage?.crosspostable) {
            await lastMessage.crosspost();
          }
        } catch {
          // Ignore crosspost errors
        }
      }

      return interaction.editReply(`✅ Annonce envoyée dans ${channel} !`);
    } catch (error) {
      this.container.logger.error("Announce tournament error:", error);
      return interaction.editReply("❌ Erreur lors de la récupération du tournoi.");
    }
  }

  private async sendReminder(interaction: Command.ChatInputCommandInteraction) {
    const tournamentId = interaction.options.getString("id", true);
    const customMessage = interaction.options.getString("message");
    const channel = (interaction.options.getChannel("salon") ?? interaction.channel) as TextChannel | NewsChannel;

    await interaction.deferReply({ ephemeral: true });

    try {
      const challonge = getChallongeClient();
      const tournamentRes = await challonge.getTournament(tournamentId);
      const t = tournamentRes.data;

      const embed = new EmbedBuilder()
        .setTitle(`⏰ Rappel : ${t.attributes.name}`)
        .setDescription(
          customMessage ?? 
          `**Le tournoi commence bientôt !**\n\n` +
          `N'oubliez pas de vous inscrire si ce n'est pas déjà fait.\n` +
          `Préparez vos combos et soyez prêts à donner le meilleur de vous-même !`
        )
        .setColor(Colors.Warning)
        .addFields(
          { name: "👥 Inscrits", value: `${t.attributes.participantsCount} joueur(s)`, inline: true },
          { name: "📊 État", value: this.formatState(t.attributes.state), inline: true },
        )
        .setFooter({ text: RPB.FullName })
        .setTimestamp();

      if (t.attributes.startAt) {
        const startDate = new Date(t.attributes.startAt);
        embed.addFields({
          name: "📅 Début",
          value: `<t:${Math.floor(startDate.getTime() / 1000)}:R>`,
          inline: true,
        });
      }

      embed.addFields({
        name: "🔗 Lien",
        value: `[Voir le tournoi](https://challonge.com/${t.attributes.url})`,
        inline: false,
      });

      await channel.send({ embeds: [embed] });

      return interaction.editReply(`✅ Rappel envoyé dans ${channel} !`);
    } catch (error) {
      this.container.logger.error("Send reminder error:", error);
      return interaction.editReply("❌ Erreur lors de l'envoi du rappel.");
    }
  }

  private async announceResults(interaction: Command.ChatInputCommandInteraction) {
    const tournamentId = interaction.options.getString("id", true);
    const channel = (interaction.options.getChannel("salon") ?? interaction.channel) as TextChannel | NewsChannel;

    await interaction.deferReply({ ephemeral: true });

    try {
      const challonge = getChallongeClient();
      const [tournamentRes, participantsRes] = await Promise.all([
        challonge.getTournament(tournamentId),
        challonge.listParticipants(tournamentId),
      ]);

      const t = tournamentRes.data;
      const participants = participantsRes.data ?? [];

      // Sort by final rank (seed after tournament)
      const ranked = participants
        .filter((p) => p.attributes.active)
        .sort((a, b) => a.attributes.seed - b.attributes.seed);

      const podium = ranked.slice(0, 3);
      const medals = ["🥇", "🥈", "🥉"];

      const podiumText = podium
        .map((p, i) => `${medals[i]} **${p.attributes.name}**`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Résultats : ${t.attributes.name}`)
        .setDescription(`Le tournoi est terminé ! Voici les résultats :\n\n${podiumText}`)
        .setColor(Colors.Secondary)
        .addFields(
          { name: "👥 Participants", value: `${participants.length}`, inline: true },
          { name: "🏷️ Format", value: this.formatTournamentType(t.attributes.tournamentType), inline: true },
        )
        .setFooter({ text: `${RPB.FullName} | GG à tous !` })
        .setTimestamp();

      if (ranked.length > 3) {
        const top8 = ranked.slice(3, 8).map((p, i) => `${i + 4}. ${p.attributes.name}`).join("\n");
        embed.addFields({ name: "📊 Top 8", value: top8, inline: false });
      }

      embed.addFields({
        name: "🔗 Bracket complet",
        value: `[Voir sur Challonge](https://challonge.com/${t.attributes.url})`,
        inline: false,
      });

      await channel.send({ embeds: [embed] });

      return interaction.editReply(`✅ Résultats envoyés dans ${channel} !`);
    } catch (error) {
      this.container.logger.error("Announce results error:", error);
      return interaction.editReply("❌ Erreur lors de l'annonce des résultats.");
    }
  }

  private async sendCustom(interaction: Command.ChatInputCommandInteraction) {
    const title = interaction.options.getString("titre", true);
    const message = interaction.options.getString("message", true);
    const channel = (interaction.options.getChannel("salon") ?? interaction.channel) as TextChannel | NewsChannel;
    const mentionRole = interaction.options.getRole("mention");
    const colorHex = interaction.options.getString("couleur") ?? "dc2626";

    const embed = new EmbedBuilder()
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setColor(parseInt(colorHex, 16))
      .setFooter({ text: RPB.FullName })
      .setTimestamp();

    const content = mentionRole ? `${mentionRole}` : undefined;

    await channel.send({ content, embeds: [embed] });

    // Try to publish if announcement channel
    if ("type" in channel && channel.type === ChannelType.GuildAnnouncement) {
      try {
        const messages = await channel.messages.fetch({ limit: 1 });
        const lastMessage = messages.first();
        if (lastMessage?.crosspostable) {
          await lastMessage.crosspost();
        }
      } catch {
        // Ignore
      }
    }

    return interaction.reply({ content: `✅ Annonce envoyée dans ${channel} !`, ephemeral: true });
  }

  private async generateAnnouncement(interaction: Command.ChatInputCommandInteraction) {
    const nom = interaction.options.getString("nom", true);
    const date = interaction.options.getString("date", true);
    const heure = interaction.options.getString("heure", true);
    const lieu = interaction.options.getString("lieu", true);
    const challonge = interaction.options.getString("challonge", true);
    const format = interaction.options.getString("format") ?? "3on3 classique en Double Élimination";
    const places = interaction.options.getInteger("places") ?? 64;
    const checkin = interaction.options.getString("checkin");
    const customIntro = interaction.options.getString("intro");
    const channel = (interaction.options.getChannel("salon") ?? interaction.channel) as TextChannel | NewsChannel;
    const preview = interaction.options.getBoolean("preview") ?? true;

    // Générer le lien Challonge complet
    const challongeUrl = challonge.startsWith("http") 
      ? challonge 
      : `https://challonge.com/${challonge}`;

    // Intro narrative style RPB
    const defaultIntro = `La **${RPB.FullName}** continue d'écrire son histoire ! ` +
      `Après des mois d'attente et de préparation, nous sommes fiers de vous annoncer ` +
      `le prochain chapitre de notre saga...`;

    const intro = customIntro ?? defaultIntro;

    // Construction du message style RPB
    const announcement = [
      `# 🚨 ANNONCE OFFICIELLE 🚨`,
      ``,
      intro,
      ``,
      `# 🏆 ${nom}`,
      ``,
      `| 📋 | Détails |`,
      `|-----|---------|`,
      `| 📅 **Date** | ${date} |`,
      `| ⏰ **Heure** | ${heure}${checkin ? ` (Check-in dès ${checkin})` : ""} |`,
      `| 📍 **Lieu** | ${lieu} |`,
      `| 🎮 **Format** | ${format} |`,
      `| 👥 **Places** | ${places} joueurs maximum |`,
      `| 🔗 **Inscription** | [Challonge](${challongeUrl}) |`,
      ``,
      `## 💥 3, 2, 1... Hyper Vitesse !`,
      ``,
      `Préparez vos combos, affûtez vos techniques, et montrez à la communauté de quoi vous êtes capable !`,
      ``,
      `---`,
      ``,
      `📱 **Suivez-nous :**`,
      `> 💬 Discord : https://discord.gg/twdVfesrRj`,
      `> 🎵 TikTok : @rpb_beyblade`,
      `> 🐦 X/Twitter : @RPB_Beyblade`,
      ``,
      `*La suite ? Vous n'êtes pas prêts... 👀*`,
    ].join("\n");

    // Embed pour l'aperçu
    const embed = new EmbedBuilder()
      .setTitle(`📋 Aperçu : ${nom}`)
      .setDescription(
        `**Mode :** ${preview ? "Aperçu (non envoyé)" : "Envoi direct"}\n` +
        `**Salon :** ${channel}\n` +
        `**Caractères :** ${announcement.length}/2000`
      )
      .setColor(Colors.Primary)
      .addFields(
        { name: "📅 Date", value: date, inline: true },
        { name: "⏰ Heure", value: heure, inline: true },
        { name: "📍 Lieu", value: lieu, inline: true },
        { name: "🎮 Format", value: format, inline: true },
        { name: "👥 Places", value: `${places}`, inline: true },
        { name: "🔗 Challonge", value: `[Lien](${challongeUrl})`, inline: true },
      )
      .setFooter({ text: RPB.FullName })
      .setTimestamp();

    if (preview) {
      // Envoyer l'aperçu en éphémère
      await interaction.reply({
        content: `### Aperçu de l'annonce :\n\n${announcement}`,
        embeds: [embed],
        ephemeral: true,
      });
      return;
    }

    // Envoyer l'annonce dans le salon cible
    await interaction.deferReply({ ephemeral: true });

    try {
      const sentMessage = await channel.send({ content: announcement });

      // Publier si c'est un salon d'annonces
      if (channel.type === ChannelType.GuildAnnouncement && sentMessage.crosspostable) {
        try {
          await sentMessage.crosspost();
        } catch {
          // Ignore crosspost errors
        }
      }

      return interaction.editReply({
        content: `✅ Annonce envoyée dans ${channel} !\n[Voir le message](${sentMessage.url})`,
        embeds: [embed],
      });
    } catch (error) {
      this.container.logger.error("Generate announcement error:", error);
      return interaction.editReply("❌ Erreur lors de l'envoi de l'annonce.");
    }
  }

  private formatTournamentType(type: string): string {
    const types: Record<string, string> = {
      "single elimination": "Simple Élimination",
      "double elimination": "Double Élimination",
      "round robin": "Round Robin",
      swiss: "Swiss",
    };
    return types[type] ?? type;
  }

  private formatState(state: string): string {
    const states: Record<string, string> = {
      pending: "🟡 En attente",
      underway: "🟢 En cours",
      complete: "✅ Terminé",
      checking_in: "📋 Check-in",
    };
    return states[state] ?? state;
  }
}
