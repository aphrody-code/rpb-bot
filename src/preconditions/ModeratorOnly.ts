import { Precondition } from "@sapphire/framework";
import type { CommandInteraction, GuildMember, Message } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

export class ModeratorOnlyPrecondition extends Precondition {
  public override async messageRun(message: Message) {
    if (!message.member)
      return this.error({
        message: "Cette commande ne peut être utilisée que sur un serveur.",
      });
    return this.checkModerator(message.member);
  }

  public override async chatInputRun(interaction: CommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!member)
      return this.error({
        message: "Cette commande ne peut être utilisée que sur un serveur.",
      });
    return this.checkModerator(member);
  }

  private checkModerator(member: GuildMember) {
    const hasModPermissions = member.permissions.has([
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
    ]);

    return hasModPermissions
      ? this.ok()
      : this.error({
          message: "Seuls les modérateurs peuvent utiliser cette commande.",
        });
  }
}

declare module "@sapphire/framework" {
  interface Preconditions {
    ModeratorOnly: never;
  }
}
