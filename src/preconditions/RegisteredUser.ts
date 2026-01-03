import { Precondition } from "@sapphire/framework";
import type { CommandInteraction, Message, User } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "../lib/prisma.js";

export class RegisteredUserPrecondition extends Precondition {
  public override async messageRun(message: Message) {
    return this.checkRegistration(message.author);
  }

  public override async chatInputRun(interaction: CommandInteraction) {
    return this.checkRegistration(interaction.user);
  }

  private async checkRegistration(user: User) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { discordId: user.id },
        include: { profile: true },
      });

      if (!dbUser) {
        const embed = new EmbedBuilder()
          .setColor(0xdc2626)
          .setTitle("🔒 Inscription requise")
          .setDescription(
            "Tu dois créer un compte RPB pour utiliser cette commande.\n\n" +
              "Connecte-toi sur le dashboard pour lier ton compte Discord !",
          )
          .setThumbnail("https://rpbey.fr/logo.png")
          .addFields({
            name: "💡 Comment faire ?",
            value:
              "1. Clique sur le bouton ci-dessous\n2. Connecte-toi avec Discord\n3. Reviens ici et utilise la commande !",
          })
          .setFooter({ text: "République Populaire du Beyblade" });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Créer mon compte RPB")
            .setURL("https://rpbey.fr/sign-in")
            .setStyle(ButtonStyle.Link)
            .setEmoji("🎯"),
        );

        return this.error({
          message: "Tu dois être inscrit sur RPB pour utiliser cette commande.",
          context: { embed, row },
        });
      }

      // Store user in context for commands to use
      return this.ok();
    } catch (error) {
      this.container.logger.error("RegisteredUser precondition error:", error);
      return this.error({
        message:
          "Une erreur est survenue lors de la vérification de ton compte.",
      });
    }
  }
}

declare module "@sapphire/framework" {
  interface Preconditions {
    RegisteredUser: never;
  }
}
