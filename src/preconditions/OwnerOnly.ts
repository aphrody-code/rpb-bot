import { Precondition } from "@sapphire/framework";
import type { CommandInteraction, Message } from "discord.js";

const OWNERS = process.env.BOT_OWNERS?.split(",") ?? [];

export class OwnerOnlyPrecondition extends Precondition {
  public override async messageRun(message: Message) {
    return this.checkOwner(message.author.id);
  }

  public override async chatInputRun(interaction: CommandInteraction) {
    return this.checkOwner(interaction.user.id);
  }

  private checkOwner(userId: string) {
    return OWNERS.includes(userId)
      ? this.ok()
      : this.error({ message: "Only bot owners can use this command." });
  }
}

declare module "@sapphire/framework" {
  interface Preconditions {
    OwnerOnly: never;
  }
}
