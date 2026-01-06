import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { Colors, RPB } from '../../lib/constants.js';

export class SatrCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: 'Affiche les informations du partenaire SATR',
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('satr')
        .setDescription('Obtenir le lien du serveur partenaire SATR'),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const partner = RPB.Partners.SATR;
    const embed = new EmbedBuilder()
      .setTitle(`🤝 Partenaire : ${partner.Name}`)
      .setDescription(
        `${partner.Description}\n\n🔗 **[Rejoindre le serveur](${partner.Invite})**`,
      )
      .setColor(Colors.Secondary)
      .setFooter({ text: RPB.FullName })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}
