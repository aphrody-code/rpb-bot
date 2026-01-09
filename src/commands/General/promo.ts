import { Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { Colors, RPB } from '../../lib/constants.js';

export class PromoCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: 'Affiche les codes promo et partenariats RPB',
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('promo')
        .setDescription('Affiche les codes promo et partenariats RPB'),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const embed = new EmbedBuilder()
      .setTitle('🏷️ Codes Promo & Partenaires')
      .setDescription('Voici les offres exclusives pour la communauté RPB !')
      .setColor(Colors.Primary)
      .addFields({
        name: 'feedmy.fr',
        value:
          "Le spécialiste de l'importation japonaise (Beyblade X, etc.)\n" +
          '**-10%** sur tout le site avec le code **`RPB10`**',
        inline: false,
      })
      .setFooter({ text: RPB.FullName })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Utiliser le code FeedMy')
        .setURL('https://feedmy.fr/discount/RPB10')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🛍️'),
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
}
