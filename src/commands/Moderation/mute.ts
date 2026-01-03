import { Command } from "@sapphire/framework";
import { ChannelType, EmbedBuilder, PermissionFlagsBits } from "discord.js";

// Salon visible pour les utilisateurs mutés
const MUTED_CHANNEL_ID = process.env.MUTED_CHANNEL_ID ?? "1456761597245784260";
const MUTED_ROLE_NAME = "Muted";

export class MuteCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Mute un membre (ne peut voir qu'un seul salon)",
      preconditions: ["ModeratorOnly"],
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("mute")
        .setDescription("Gérer le mute d'un membre")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(0)
        .addSubcommand((sub) =>
          sub
            .setName("ajouter")
            .setDescription("Mute un membre (ne peut voir qu'un seul salon)")
            .addUserOption((opt) =>
              opt
                .setName("membre")
                .setDescription("Le membre à mute")
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt.setName("raison").setDescription("Raison du mute"),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("retirer")
            .setDescription("Retire le mute d'un membre")
            .addUserOption((opt) =>
              opt
                .setName("membre")
                .setDescription("Le membre à unmute")
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("setup")
            .setDescription(
              "Configure le rôle Muted et les permissions des salons",
            ),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "ajouter":
        return this.muteUser(interaction);
      case "retirer":
        return this.unmuteUser(interaction);
      case "setup":
        return this.setupMutedRole(interaction);
      default:
        return interaction.reply({
          content: "❌ Sous-commande inconnue.",
          ephemeral: true,
        });
    }
  }

  /**
   * Mute un utilisateur en lui attribuant le rôle Muted
   */
  private async muteUser(interaction: Command.ChatInputCommandInteraction) {
    const target = interaction.options.getUser("membre", true);
    const reason =
      interaction.options.getString("raison") ?? "Aucune raison fournie";
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: "❌ Cette commande doit être utilisée sur un serveur.",
        ephemeral: true,
      });
    }

    const member = guild.members.cache.get(target.id);
    if (!member) {
      return interaction.reply({
        content: "❌ Membre introuvable sur ce serveur.",
        ephemeral: true,
      });
    }

    // Vérifier si le rôle Muted existe
    const mutedRole = guild.roles.cache.find((r) => r.name === MUTED_ROLE_NAME);

    if (!mutedRole) {
      return interaction.reply({
        content:
          "❌ Le rôle **Muted** n'existe pas. Utilisez `/mute setup` d'abord.",
        ephemeral: true,
      });
    }

    // Vérifier si l'utilisateur est déjà mute
    if (member.roles.cache.has(mutedRole.id)) {
      return interaction.reply({
        content: "⚠️ Ce membre est déjà mute.",
        ephemeral: true,
      });
    }

    try {
      await member.roles.add(
        mutedRole,
        `Mute par ${interaction.user.tag}: ${reason}`,
      );

      const embed = new EmbedBuilder()
        .setTitle("🔇 Membre mute")
        .setColor(0xff6b00)
        .addFields(
          {
            name: "Membre",
            value: `${target.tag} (${target.id})`,
            inline: true,
          },
          { name: "Modérateur", value: interaction.user.tag, inline: true },
          { name: "Raison", value: reason },
          {
            name: "Salon accessible",
            value: `<#${MUTED_CHANNEL_ID}>`,
            inline: true,
          },
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      // DM l'utilisateur
      try {
        await target.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🔇 Vous avez été mute")
              .setColor(0xff6b00)
              .setDescription(
                `Vous avez été mute sur **${guild.name}**.\n\n` +
                  `**Raison:** ${reason}\n\n` +
                  `Vous pouvez uniquement accéder au salon <#${MUTED_CHANNEL_ID}>.`,
              )
              .setTimestamp(),
          ],
        });
      } catch {
        // L'utilisateur a peut-être les DMs fermés
      }

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Mute command error:", error);
      return interaction.reply({
        content: "❌ Échec du mute. Vérifiez mes permissions.",
        ephemeral: true,
      });
    }
  }

  /**
   * Retire le mute d'un utilisateur
   */
  private async unmuteUser(interaction: Command.ChatInputCommandInteraction) {
    const target = interaction.options.getUser("membre", true);
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: "❌ Cette commande doit être utilisée sur un serveur.",
        ephemeral: true,
      });
    }

    const member = guild.members.cache.get(target.id);
    if (!member) {
      return interaction.reply({
        content: "❌ Membre introuvable sur ce serveur.",
        ephemeral: true,
      });
    }

    const mutedRole = guild.roles.cache.find((r) => r.name === MUTED_ROLE_NAME);

    if (!mutedRole || !member.roles.cache.has(mutedRole.id)) {
      return interaction.reply({
        content: "⚠️ Ce membre n'est pas mute.",
        ephemeral: true,
      });
    }

    try {
      await member.roles.remove(
        mutedRole,
        `Unmute par ${interaction.user.tag}`,
      );

      const embed = new EmbedBuilder()
        .setTitle("🔊 Membre unmute")
        .setColor(0x00ff00)
        .addFields(
          {
            name: "Membre",
            value: `${target.tag} (${target.id})`,
            inline: true,
          },
          { name: "Modérateur", value: interaction.user.tag, inline: true },
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      // DM l'utilisateur
      try {
        await target.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🔊 Vous avez été unmute")
              .setColor(0x00ff00)
              .setDescription(
                `Votre mute sur **${guild.name}** a été levé.\n` +
                  `Vous pouvez à nouveau accéder à tous les salons.`,
              )
              .setTimestamp(),
          ],
        });
      } catch {
        // L'utilisateur a peut-être les DMs fermés
      }

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Unmute command error:", error);
      return interaction.reply({
        content: "❌ Échec du unmute. Vérifiez mes permissions.",
        ephemeral: true,
      });
    }
  }

  /**
   * Configure le rôle Muted et les permissions de tous les salons
   */
  private async setupMutedRole(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: "❌ Cette commande doit être utilisée sur un serveur.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      // Créer ou récupérer le rôle Muted
      const existingRole = guild.roles.cache.find(
        (r) => r.name === MUTED_ROLE_NAME,
      );

      const mutedRole =
        existingRole ??
        (await guild.roles.create({
          name: MUTED_ROLE_NAME,
          color: 0x808080,
          reason: "Rôle pour les utilisateurs mutes",
          permissions: [], // Aucune permission
        }));

      if (!existingRole) {
        this.container.logger.info(`Rôle ${MUTED_ROLE_NAME} créé`);
      }

      // Configurer les permissions pour chaque salon
      const channels = guild.channels.cache.filter(
        (c) =>
          c.type === ChannelType.GuildText ||
          c.type === ChannelType.GuildVoice ||
          c.type === ChannelType.GuildForum ||
          c.type === ChannelType.GuildCategory,
      );

      let updated = 0;
      let errors = 0;

      for (const [, channel] of channels) {
        try {
          if (channel.id === MUTED_CHANNEL_ID) {
            // Salon accessible aux mutés : autoriser View + Send
            await channel.permissionOverwrites.edit(mutedRole, {
              ViewChannel: true,
              SendMessages: true,
              AddReactions: false,
              AttachFiles: false,
              EmbedLinks: false,
            });
          } else {
            // Autres salons : refuser View
            await channel.permissionOverwrites.edit(mutedRole, {
              ViewChannel: false,
              SendMessages: false,
            });
          }
          updated++;
        } catch (err) {
          errors++;
          this.container.logger.warn(
            `Impossible de modifier les permissions de ${channel.name}:`,
            err,
          );
        }
      }

      const embed = new EmbedBuilder()
        .setTitle("✅ Configuration du rôle Muted terminée")
        .setColor(0x00ff00)
        .addFields(
          { name: "Rôle", value: `<@&${mutedRole.id}>`, inline: true },
          {
            name: "Salon accessible",
            value: `<#${MUTED_CHANNEL_ID}>`,
            inline: true,
          },
          {
            name: "Salons configurés",
            value: `${updated} salons`,
            inline: true,
          },
        )
        .setDescription(
          "Les utilisateurs avec le rôle **Muted** ne peuvent voir que le salon désigné.",
        )
        .setTimestamp();

      if (errors > 0) {
        embed.addFields({
          name: "⚠️ Erreurs",
          value: `${errors} salon(s) n'ont pas pu être configurés (permissions insuffisantes)`,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error("Setup muted role error:", error);
      return interaction.editReply({
        content:
          "❌ Échec de la configuration. Vérifiez que j'ai la permission de gérer les rôles et les salons.",
      });
    }
  }
}
