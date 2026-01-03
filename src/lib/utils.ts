import { Duration, DurationFormatter } from "@sapphire/duration";
import { EmbedBuilder } from "discord.js";
import { Colors, RPB } from "./constants.js";

/**
 * Create a standardized embed for the bot
 */
export function createEmbed(options: {
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: string | null;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(options.color ?? Colors.Primary)
    .setTitle(options.title ?? null)
    .setDescription(options.description ?? null)
    .setThumbnail(options.thumbnail ?? null)
    .setFooter({ text: RPB.Name })
    .setTimestamp();
}

/**
 * Create a success embed
 */
export function successEmbed(title: string, description?: string): EmbedBuilder {
  return createEmbed({ title: `✅ ${title}`, description, color: Colors.Success });
}

/**
 * Create an error embed
 */
export function errorEmbed(title: string, description?: string): EmbedBuilder {
  return createEmbed({ title: `❌ ${title}`, description, color: Colors.Error });
}

/**
 * Create a warning embed
 */
export function warningEmbed(title: string, description?: string): EmbedBuilder {
  return createEmbed({ title: `⚠️ ${title}`, description, color: Colors.Warning });
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  const formatter = new DurationFormatter();
  return formatter.format(ms);
}

/**
 * Parse a duration string to milliseconds
 */
export function parseDuration(input: string): number | null {
  try {
    const duration = new Duration(input);
    return duration.offset;
  } catch {
    return null;
  }
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number, suffix = "..."): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Escape markdown in a string
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[*_`~|\\]/g, "\\$&");
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
