import { Precondition } from "@sapphire/framework";
import type { CommandInteraction, Message, User } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { prisma } from "../lib/prisma.js";

// Blacklisted users stored in database or env
const BLACKLISTED_IDS = new Set(
  process.env.BLACKLISTED_USERS?.split(",").filter(Boolean) ?? [],
);

export class NotBlacklistedPrecondition extends Precondition {
  public override async messageRun(message: Message) {
    return this.checkBlacklist(message.author);
  }

  public override async chatInputRun(interaction: CommandInteraction) {
    return this.checkBlacklist(interaction.user);
  }

  private async checkBlacklist(user: User) {
    try {
      // Check env-based blacklist first (immediate ban)
      if (BLACKLISTED_IDS.has(user.id)) {
        return this.createBlacklistError();
      }

      // Check database for user role
      const dbUser = await prisma.user.findUnique({
        where: { discordId: user.id },
        select: { role: true },
      });

      if (dbUser?.role === "banned") {
        return this.createBlacklistError();
      }

      return this.ok();
    } catch (error) {
      this.container.logger.error("NotBlacklisted precondition error:", error);
      // On error, allow the command (fail open for non-critical check)
      return this.ok();
    }
  }

  private createBlacklistError() {
    const embed = new EmbedBuilder()
      .setColor(0x1f2937)
      .setTitle("⛔ Accès refusé")
      .setDescription(
        "Tu as été banni de la communauté RPB et ne peux plus utiliser le bot.\n\n" +
          "Si tu penses que c'est une erreur, contacte un administrateur.",
      )
      .setFooter({ text: "République Populaire du Beyblade" });

    return this.error({
      message: "Tu es banni de RPB.",
      context: { embed },
    });
  }
}

declare module "@sapphire/framework" {
  interface Preconditions {
    NotBlacklisted: never;
  }
}
