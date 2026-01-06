import { Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from 'discord.js';
import { getChallongeClient } from '../../lib/challonge.js';
import { Colors, RPB } from '../../lib/constants.js';
import prisma from '../../lib/prisma.js';

export class RegisterCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "S'inscrire ou se désinscrire d'un tournoi",
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('inscription')
        .setDescription('Gestion des inscriptions aux tournois')
        .addSubcommand((sub) =>
          sub
            .setName('rejoindre')
            .setDescription("S'inscrire à un tournoi")
            .addStringOption((opt) =>
              opt
                .setName('tournoi')
                .setDescription('ID du tournoi (ex: B_TS1)')
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName('pseudo')
                .setDescription(
                  'Ton pseudo de joueur (si différent de Discord)',
                ),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('quitter')
            .setDescription("Se désinscrire d'un tournoi")
            .addStringOption((opt) =>
              opt
                .setName('tournoi')
                .setDescription('ID du tournoi')
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('statut')
            .setDescription("Vérifie ton statut d'inscription")
            .addStringOption((opt) =>
              opt
                .setName('tournoi')
                .setDescription('ID du tournoi')
                .setRequired(true),
            ),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'rejoindre':
        return this.joinTournament(interaction);
      case 'quitter':
        return this.leaveTournament(interaction);
      case 'statut':
        return this.checkStatus(interaction);
      default:
        return interaction.reply({
          content: '❌ Sous-commande inconnue.',
          ephemeral: true,
        });
    }
  }

  private async joinTournament(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const tournamentId = interaction.options.getString('tournoi', true);
    const customName = interaction.options.getString('pseudo');
    const playerName = customName ?? interaction.user.displayName;

    await interaction.deferReply({ ephemeral: true });

    try {
      const challonge = getChallongeClient();

      // Check if tournament exists and is open
      const tournamentRes = await challonge.getTournament(tournamentId);
      const tournament = tournamentRes.data;

      if (tournament.attributes.state !== 'pending') {
        return interaction.editReply({
          content: '❌ Les inscriptions sont fermées pour ce tournoi.',
        });
      }

      // Check if already registered
      const participantsRes = await challonge.listParticipants(tournamentId);
      const existingParticipant = participantsRes.data?.find(
        (p) =>
          p.attributes.name.toLowerCase() === playerName.toLowerCase() ||
          p.attributes.misc === interaction.user.id,
      );

      if (existingParticipant) {
        return interaction.editReply({
          content: `⚠️ Tu es déjà inscrit(e) à **${tournament.attributes.name}** sous le nom **${existingParticipant.attributes.name}** !`,
        });
      }

      // Register the participant on Challonge
      await challonge.createParticipant(tournamentId, {
        name: playerName,
        misc: interaction.user.id, // Store Discord ID for reference
      });

      // Sync to database
      try {
        // Get or create user first
        const user = await prisma.user.upsert({
          where: { discordId: interaction.user.id },
          update: { discordTag: interaction.user.tag },
          create: {
            discordId: interaction.user.id,
            discordTag: interaction.user.tag,
            email: `${interaction.user.id}@discord.rpbey.fr`,
            name: playerName,
          },
        });

        // Get or create profile
        await prisma.profile.upsert({
          where: { userId: user.id },
          update: { bladerName: playerName },
          create: {
            userId: user.id,
            bladerName: playerName,
            experience: 'BEGINNER',
          },
        });

        // Get or create tournament in DB
        const dbTournament = await prisma.tournament.upsert({
          where: { challongeId: tournamentId },
          update: { name: tournament.attributes.name },
          create: {
            challongeId: tournamentId,
            name: tournament.attributes.name,
            date: tournament.attributes.startAt
              ? new Date(tournament.attributes.startAt)
              : new Date(),
            status: 'UPCOMING',
          },
        });

        // Register participant in DB
        await prisma.tournamentParticipant.upsert({
          where: {
            tournamentId_userId: {
              tournamentId: dbTournament.id,
              userId: user.id,
            },
          },
          update: {},
          create: {
            tournamentId: dbTournament.id,
            userId: user.id,
            checkedIn: false,
          },
        });
      } catch (dbError) {
        // Database sync is optional, log but don't fail
        this.container.logger.warn('DB sync failed:', dbError);
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Inscription confirmée !')
        .setDescription(
          `Tu es maintenant inscrit(e) à **${tournament.attributes.name}** !\n\n` +
            `**Pseudo:** ${playerName}\n` +
            `**Discord:** ${interaction.user.tag}`,
        )
        .setColor(Colors.Success)
        .addFields(
          {
            name: '📅 Date',
            value: tournament.attributes.startAt
              ? `<t:${Math.floor(new Date(tournament.attributes.startAt).getTime() / 1000)}:F>`
              : 'À définir',
            inline: true,
          },
          {
            name: '👥 Inscrits',
            value: `${(participantsRes.data?.length ?? 0) + 1} joueur(s)`,
            inline: true,
          },
        )
        .setFooter({ text: `${RPB.FullName} | Let it rip!` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Voir le bracket')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://challonge.com/${tournament.attributes.url}`)
          .setEmoji('🔗'),
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      this.container.logger.error('Join tournament error:', error);
      return interaction.editReply(
        "❌ Erreur lors de l'inscription. Le tournoi existe-t-il ?",
      );
    }
  }

  private async leaveTournament(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const tournamentId = interaction.options.getString('tournoi', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const challonge = getChallongeClient();

      // Get tournament info
      const tournamentRes = await challonge.getTournament(tournamentId);
      const tournament = tournamentRes.data;

      if (tournament.attributes.state !== 'pending') {
        return interaction.editReply({
          content:
            '❌ Le tournoi a déjà commencé, tu ne peux plus te désinscrire.',
        });
      }

      // Find participant by Discord ID
      const participantsRes = await challonge.listParticipants(tournamentId);
      const participant = participantsRes.data?.find(
        (p) => p.attributes.misc === interaction.user.id,
      );

      if (!participant) {
        return interaction.editReply({
          content: "⚠️ Tu n'es pas inscrit(e) à ce tournoi.",
        });
      }

      // Confirm with button
      const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirmation')
        .setDescription(
          `Es-tu sûr(e) de vouloir te désinscrire de **${tournament.attributes.name}** ?\n\n` +
            `Pseudo: **${participant.attributes.name}**`,
        )
        .setColor(Colors.Warning);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm-leave')
          .setLabel('Confirmer')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId('cancel-leave')
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌'),
      );

      const response = await interaction.editReply({
        embeds: [confirmEmbed],
        components: [row],
      });

      try {
        const confirmation = await response.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 30_000,
          filter: (i) => i.user.id === interaction.user.id,
        });

        if (confirmation.customId === 'confirm-leave') {
          await challonge.deleteParticipant(tournamentId, participant.id);

          const successEmbed = new EmbedBuilder()
            .setTitle('✅ Désinscription confirmée')
            .setDescription(
              `Tu as été retiré(e) de **${tournament.attributes.name}**.`,
            )
            .setColor(Colors.Success)
            .setTimestamp();

          await confirmation.update({ embeds: [successEmbed], components: [] });
        } else {
          const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ Annulé')
            .setDescription('Tu restes inscrit(e) au tournoi.')
            .setColor(Colors.Error);

          await confirmation.update({ embeds: [cancelEmbed], components: [] });
        }
      } catch {
        await interaction.editReply({
          content: '⏰ Temps écoulé. Désinscription annulée.',
          embeds: [],
          components: [],
        });
      }
    } catch (error) {
      this.container.logger.error('Leave tournament error:', error);
      return interaction.editReply('❌ Erreur lors de la désinscription.');
    }
  }

  private async checkStatus(interaction: Command.ChatInputCommandInteraction) {
    const tournamentId = interaction.options.getString('tournoi', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const challonge = getChallongeClient();

      const [tournamentRes, participantsRes] = await Promise.all([
        challonge.getTournament(tournamentId),
        challonge.listParticipants(tournamentId),
      ]);

      const tournament = tournamentRes.data;
      const participant = participantsRes.data?.find(
        (p) => p.attributes.misc === interaction.user.id,
      );

      if (!participant) {
        const embed = new EmbedBuilder()
          .setTitle("📋 Statut d'inscription")
          .setDescription(
            `Tu n'es **pas inscrit(e)** à **${tournament.attributes.name}**.`,
          )
          .setColor(Colors.Warning)
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("S'inscrire")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://challonge.com/${tournament.attributes.url}`)
            .setEmoji('📝'),
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      const stateEmoji = participant.attributes.checkedIn ? '✅' : '⏳';
      const embed = new EmbedBuilder()
        .setTitle("📋 Statut d'inscription")
        .setDescription(
          `Tu es **inscrit(e)** à **${tournament.attributes.name}** !`,
        )
        .setColor(Colors.Success)
        .addFields(
          {
            name: '🏷️ Pseudo',
            value: participant.attributes.name,
            inline: true,
          },
          {
            name: '🌱 Seed',
            value: `#${participant.attributes.seed}`,
            inline: true,
          },
          {
            name: `${stateEmoji} Check-in`,
            value: participant.attributes.checkedIn ? 'Fait' : 'En attente',
            inline: true,
          },
        )
        .setFooter({ text: RPB.FullName })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Check status error:', error);
      return interaction.editReply(
        '❌ Erreur lors de la vérification du statut.',
      );
    }
  }
}
