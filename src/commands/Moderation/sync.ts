import { Subcommand } from '@sapphire/plugin-subcommands';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { importTournament } from '../../lib/challonge-sync.js';
import { Colors, RPB } from '../../lib/constants.js';
import { prisma } from '../../lib/prisma.js';
import { ScraperService } from '../../lib/scraper/index.js';
import { TakaraTomyScraper } from '../../lib/scraper/takaratomy.js';

export class SyncCommand extends Subcommand {
  public constructor(
    context: Subcommand.LoaderContext,
    options: Subcommand.Options,
  ) {
    super(context, {
      ...options,
      description: 'Synchronise les données depuis les sources officielles',
      preconditions: ['ModeratorOnly'],
      subcommands: [
        {
          name: 'news',
          chatInputRun: 'chatInputNews',
        },
        {
          name: 'products',
          chatInputRun: 'chatInputProducts',
        },
        {
          name: 'tournament',
          chatInputRun: 'chatInputTournament',
        },
      ],
    });
  }

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('sync')
        .setDescription('Synchronise les données officielles')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((sub) =>
          sub
            .setName('news')
            .setDescription('Scrape les dernières news de Takara Tomy'),
        )
        .addSubcommand((sub) =>
          sub.setName('products').setDescription('Scrape le lineup officiel'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('tournament')
            .setDescription('Importe un tournoi Challonge')
            .addStringOption((opt) =>
              opt
                .setName('id')
                .setDescription('ID ou URL du tournoi (ex: B_TS1)')
                .setRequired(true),
            ),
        ),
    );
  }

  public async chatInputNews(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    const scraper = new ScraperService({ maxRequestsPerCrawl: 5 });
    const newsUrl = 'https://beyblade.takaratomy.co.jp/beyblade-x/news/';

    try {
      this.container.logger.info(`Starting news sync from ${newsUrl}`);
      const urls = await scraper.mapSite(newsUrl);
      const targets = urls.filter((u) => u.includes('/news/')).slice(0, 3);

      const results = await scraper.scrape(targets, 'fr');
      let created = 0;

      for (const page of results) {
        const slug =
          page.url.split('/').filter(Boolean).pop() || `news-${Date.now()}`;

        await prisma.contentBlock.upsert({
          where: { slug: `news-${slug}` },
          update: {
            title: page.title,
            content: page.translatedMarkdown || page.markdown,
            metadata: {
              url: page.url,
              image: page.metadata.image,
              type: 'news',
              lang: page.language,
            },
          },
          create: {
            slug: `news-${slug}`,
            title: page.title,
            type: 'markdown',
            content: page.translatedMarkdown || page.markdown,
            metadata: {
              url: page.url,
              image: page.metadata.image,
              type: 'news',
              lang: page.language,
            },
          },
        });
        created++;
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Synchronisation des News terminée')
        .setDescription(`${created} articles ont été mis à jour ou ajoutés.`)
        .setColor(Colors.Success)
        .setFooter({ text: RPB.Name });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error(error);
      return interaction.editReply(
        '❌ Une erreur est survenue lors de la synchronisation.',
      );
    }
  }

  public async chatInputProducts(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    const scraper = new TakaraTomyScraper(prisma);

    try {
      const { total, updated } = await scraper.syncLineup();

      const embed = new EmbedBuilder()
        .setTitle('✅ Synchronisation du Lineup Takara Tomy')
        .setDescription(
          `Synchronisation terminée avec succès.\n\n**Total détecté:** ${total}\n**Mis à jour / Créés:** ${updated}`,
        )
        .setColor(Colors.Success)
        .setFooter({ text: RPB.Name });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error(error);
      return interaction.editReply(
        '❌ Une erreur est survenue lors de la synchronisation des produits.',
      );
    }
  }

  public async chatInputTournament(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    const input = interaction.options.getString('id', true);

    // Extraire l'ID si c'est une URL
    let challongeId = input;
    if (input.includes('challonge.com/')) {
      challongeId =
        input.split('challonge.com/').pop()?.split('/').pop() || input;
      // Gérer le cas /fr/
      if (challongeId === 'fr' || input.includes('/fr/')) {
        challongeId = input.split('/').filter(Boolean).pop() || input;
      }
    }

    try {
      const result = await importTournament(challongeId);

      if (!result.success) {
        return interaction.editReply(`❌ Erreur: ${result.error}`);
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Tournoi Importé')
        .setDescription(
          `Le tournoi a été synchronisé avec succès depuis Challonge.`,
        )
        .addFields(
          { name: 'ID Challonge', value: challongeId, inline: true },
          {
            name: 'Participants synchronisés',
            value: (result.participantsCount || 0).toString(),
            inline: true,
          },
          {
            name: 'Requêtes API utilisées',
            value: result.apiRequestsUsed.toString(),
            inline: true,
          },
        )
        .setColor(Colors.Success)
        .setFooter({ text: RPB.Name });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error(error);
      return interaction.editReply(
        "❌ Une erreur fatale est survenue lors de l'import.",
      );
    }
  }
}
