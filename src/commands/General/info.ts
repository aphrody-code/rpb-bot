import { Command } from "@sapphire/framework";
import { EmbedBuilder, version as djsVersion } from "discord.js";
import { Colors, RPB } from "../../lib/constants.js";

const sapphireVersion = "5.4.0"; // @sapphire/framework version

export class InfoCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Affiche les informations du bot et du serveur",
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("info")
        .setDescription("Affiche les informations")
        .addSubcommand((sub) =>
          sub.setName("bot").setDescription("Statistiques et infos du bot"),
        )
        .addSubcommand((sub) =>
          sub.setName("serveur").setDescription("Informations sur le serveur"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("membre")
            .setDescription("Informations sur un membre")
            .addUserOption((opt) =>
              opt.setName("cible").setDescription("Le membre à afficher"),
            ),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "bot":
        return this.botInfo(interaction);
      case "serveur":
        return this.serverInfo(interaction);
      case "membre":
        return this.userInfo(interaction);
      default:
        return interaction.reply({
          content: "❌ Sous-commande inconnue.",
          ephemeral: true,
        });
    }
  }

  private async botInfo(interaction: Command.ChatInputCommandInteraction) {
    const { client } = this.container;
    const memoryUsage = process.memoryUsage();

    const embed = new EmbedBuilder()
      .setTitle("🤖 RPB Bot")
      .setColor(Colors.Primary)
      .setThumbnail(client.user?.displayAvatarURL() ?? null)
      .addFields(
        {
          name: "📊 Serveurs",
          value: `${client.guilds.cache.size}`,
          inline: true,
        },
        {
          name: "👥 Utilisateurs",
          value: `${client.users.cache.size}`,
          inline: true,
        },
        {
          name: "💬 Salons",
          value: `${client.channels.cache.size}`,
          inline: true,
        },
        { name: "📦 Discord.js", value: `v${djsVersion}`, inline: true },
        { name: "⚡ Sapphire", value: `v${sapphireVersion}`, inline: true },
        { name: "🟢 Node.js", value: process.version, inline: true },
        {
          name: "💾 Mémoire",
          value: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
          inline: true,
        },
      )
      .setFooter({ text: RPB.FullName })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  private async serverInfo(interaction: Command.ChatInputCommandInteraction) {
    const { guild } = interaction;
    if (!guild) {
      return interaction.reply({
        content: "❌ Cette commande ne peut être utilisée que sur un serveur.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🌀 ${guild.name}`)
      .setColor(Colors.Primary)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: "👑 Propriétaire", value: `<@${guild.ownerId}>`, inline: true },
        { name: "👥 Membres", value: `${guild.memberCount}`, inline: true },
        {
          name: "💬 Salons",
          value: `${guild.channels.cache.size}`,
          inline: true,
        },
        { name: "🎭 Rôles", value: `${guild.roles.cache.size}`, inline: true },
        {
          name: "😀 Emojis",
          value: `${guild.emojis.cache.size}`,
          inline: true,
        },
        {
          name: "🚀 Boosts",
          value: `Niveau ${guild.premiumTier}`,
          inline: true,
        },
        {
          name: "📅 Créé",
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
      )
      .setFooter({ text: `ID: ${guild.id}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  private async userInfo(interaction: Command.ChatInputCommandInteraction) {
    const target = interaction.options.getUser("cible") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(target.id);

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${target.displayName}`)
      .setColor(member?.displayColor ?? Colors.Primary)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🏷️ Pseudo", value: target.username, inline: true },
        { name: "🆔 ID", value: target.id, inline: true },
        { name: "🤖 Bot", value: target.bot ? "Oui" : "Non", inline: true },
        {
          name: "📅 Compte créé",
          value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
      );

    if (member) {
      embed.addFields(
        {
          name: "📥 A rejoint",
          value: member.joinedAt
            ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
            : "Inconnu",
          inline: true,
        },
        {
          name: "🎭 Rôles",
          value: `${member.roles.cache.size - 1}`,
          inline: true,
        },
      );
    }

    embed.setFooter({ text: RPB.FullName }).setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}
