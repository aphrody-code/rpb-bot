import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import { Colors, RPB } from "../../lib/constants.js";

// Beyblade parts database
const parts = {
  blades: [
    "Dran Sword", "Hells Scythe", "Wizard Arrow", "Knight Shield", "Leon Claw",
    "Phoenix Wing", "Shark Edge", "Unicorn Sting", "Cobalt Drake", "Viper Tail",
  ],
  ratchets: [
    "3-60", "4-60", "5-60", "3-80", "4-80", "5-80", "9-60", "9-80",
  ],
  bits: [
    "Flat", "Ball", "Point", "Needle", "Accel", "Rush", "High Needle", "Low Flat",
    "Gear Point", "Gear Flat", "Taper", "Orb",
  ],
  types: [
    { name: "Attaque", emoji: "⚔️", color: 0xef4444 },
    { name: "Défense", emoji: "🛡️", color: 0x3b82f6 },
    { name: "Endurance", emoji: "🌀", color: 0x22c55e },
    { name: "Équilibre", emoji: "⚖️", color: 0xfbbf24 },
  ],
};

export class RandomBeyCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Génère une combinaison Beyblade aléatoire !",
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("randombey")
        .setDescription("Génère une combinaison Beyblade X aléatoire !"),
    );
  }

  override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const blade = this.random(parts.blades);
    const ratchet = this.random(parts.ratchets);
    const bit = this.random(parts.bits);
    const type = this.random(parts.types);

    const combo = `${blade} ${ratchet}${bit}`;

    // Generate random stats
    const attack = this.randomStat();
    const defense = this.randomStat();
    const stamina = this.randomStat();
    const weight = (Math.random() * 20 + 40).toFixed(1);

    const statsBar = (value: number) => {
      const filled = Math.round(value / 10);
      return "█".repeat(filled) + "░".repeat(10 - filled);
    };

    const embed = new EmbedBuilder()
      .setTitle("🎲 Combo Beyblade Aléatoire")
      .setDescription(`**${combo}**`)
      .setColor(type.color)
      .addFields(
        { name: "🔄 Blade", value: blade, inline: true },
        { name: "⚙️ Ratchet", value: ratchet, inline: true },
        { name: "💠 Bit", value: bit, inline: true },
        { name: `${type.emoji} Type`, value: type.name, inline: true },
        { name: "⚖️ Poids", value: `${weight}g`, inline: true },
        { name: "\u200B", value: "\u200B", inline: true },
        { name: "⚔️ Attaque", value: `${statsBar(attack)} ${attack}`, inline: false },
        { name: "🛡️ Défense", value: `${statsBar(defense)} ${defense}`, inline: false },
        { name: "🌀 Endurance", value: `${statsBar(stamina)} ${stamina}`, inline: false },
      )
      .setFooter({ text: `${RPB.FullName} | Let it rip!` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  private random<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private randomStat(): number {
    return Math.floor(Math.random() * 60) + 40; // 40-100
  }
}
