import { Precondition } from "@sapphire/framework";
import type { CommandInteraction, GuildMember, Message } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

export class ModeratorOnlyPrecondition extends Precondition {
  public override async messageRun(message: Message) {
    if (!message.member) return this.error({ message: "This command can only be used in a server." });
    return this.checkModerator(message.member);
  }

  public override async chatInputRun(interaction: CommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!member) return this.error({ message: "This command can only be used in a server." });
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
      : this.error({ message: "Only moderators can use this command." });
  }
}

declare module "@sapphire/framework" {
  interface Preconditions {
    ModeratorOnly: never;
  }
}
