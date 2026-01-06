import { Command } from '@sapphire/framework';
import { EmbedBuilder, TimestampStyles, time } from 'discord.js';
import { Colors, RPB } from '../../lib/constants.js';

export class PingCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: 'Vérifie la latence du bot',
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('ping')
        .setDescription('Vérifie la latence du bot et le temps de réponse'),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const sent = await interaction.reply({
      content: '🏓 Ping en cours...',
      withResponse: true,
    });

    const roundtrip =
      (sent.resource?.message?.createdTimestamp ?? Date.now()) -
      interaction.createdTimestamp;
    const wsLatency = Math.round(this.container.client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(
        wsLatency < 100
          ? Colors.Success
          : wsLatency < 200
            ? Colors.Warning
            : Colors.Error,
      )
      .addFields(
        { name: '⏱️ Aller-retour', value: `${roundtrip}ms`, inline: true },
        { name: '💓 WebSocket', value: `${wsLatency}ms`, inline: true },
        {
          name: '🕐 En ligne depuis',
          value: time(
            new Date(Date.now() - (this.container.client.uptime ?? 0)),
            TimestampStyles.RelativeTime,
          ),
          inline: true,
        },
      )
      .setFooter({ text: RPB.FullName })
      .setTimestamp();

    return interaction.editReply({ content: null, embeds: [embed] });
  }
}
