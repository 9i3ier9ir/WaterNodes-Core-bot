import { randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  TextChannel,
} from "discord.js";

type Giveaway = {
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  winnerCount: number;
  endsAt: number;
  entrants: string[];
  ended: boolean;
};

const storeDirectory = join(process.cwd(), "data");
const storePath = join(storeDirectory, "giveaways.json");
const activeGiveaways = new Map<string, Giveaway>();
const timers = new Map<string, NodeJS.Timeout>();

function readGiveaways(): Giveaway[] {
  if (!existsSync(storePath)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(storePath, "utf8"));
    return Array.isArray(parsed) ? parsed as Giveaway[] : [];
  } catch (error) {
    console.error("Could not read giveaway store:", error);
    return [];
  }
}

function saveGiveaways(): void {
  mkdirSync(storeDirectory, { recursive: true });
  writeFileSync(storePath, JSON.stringify([...activeGiveaways.values()], null, 2));
}

export function parseDuration(input: string): number | undefined {
  const match = input.trim().match(/^(\d+)(m|h|d)$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const milliseconds = amount * (unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000);
  return milliseconds >= 60_000 && milliseconds <= 30 * 86_400_000 ? milliseconds : undefined;
}

function giveawayEmbed(giveaway: Giveaway, ended = giveaway.ended, winners: string[] = []): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(ended ? 0x747f8d : 0xe7aa3a)
    .setTitle(ended ? "Giveaway ended" : "WaterNodes Giveaway")
    .setDescription(`**Prize:** ${giveaway.prize}\n**Winners:** ${giveaway.winnerCount}\n**Entries:** ${giveaway.entrants.length}`)
    .setTimestamp(giveaway.endsAt);

  if (ended) embed.addFields({ name: "Result", value: winners.length ? winners.map((id) => `<@${id}>`).join(", ") : "No valid entries" });
  else embed.addFields({ name: "Ends", value: `<t:${Math.floor(giveaway.endsAt / 1000)}:R>` });
  return embed;
}

function giveawayRow(messageId: string, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway:enter:${messageId}`)
      .setLabel("Enter giveaway")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
  );
}

function chooseWinners(entrants: string[], count: number): string[] {
  const pool = [...entrants];
  const winnerCount = Math.min(count, pool.length);
  for (let index = 0; index < winnerCount; index += 1) {
    const swapIndex = index + randomInt(pool.length - index);
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, winnerCount);
}

async function finishGiveaway(client: Client, giveaway: Giveaway): Promise<void> {
  if (giveaway.ended) return;
  giveaway.ended = true;
  saveGiveaways();
  const winners = chooseWinners(giveaway.entrants, giveaway.winnerCount);

  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    if (!channel || channel.type !== ChannelType.GuildText) return;
    const message = await channel.messages.fetch(giveaway.messageId);
    await message.edit({ embeds: [giveawayEmbed(giveaway, true, winners)], components: [giveawayRow(giveaway.messageId, true)] });
    if (winners.length) await message.reply(`Congratulations ${winners.map((id) => `<@${id}>`).join(", ")}! You won **${giveaway.prize}**.`);
    else await message.reply(`The giveaway for **${giveaway.prize}** ended with no entries.`);
  } catch (error) {
    console.error(`Could not finish giveaway ${giveaway.messageId}:`, error);
  }
}

function scheduleGiveaway(client: Client, giveaway: Giveaway): void {
  const existing = timers.get(giveaway.messageId);
  if (existing) clearTimeout(existing);
  const delay = Math.max(0, Math.min(giveaway.endsAt - Date.now(), 2_147_000_000));
  timers.set(giveaway.messageId, setTimeout(() => {
    if (giveaway.endsAt > Date.now()) scheduleGiveaway(client, giveaway);
    else void finishGiveaway(client, giveaway);
  }, delay));
}

export function resumeGiveaways(client: Client): void {
  for (const giveaway of readGiveaways()) {
    if (giveaway.ended) continue;
    activeGiveaways.set(giveaway.messageId, giveaway);
    scheduleGiveaway(client, giveaway);
  }
}

export async function postGiveaway(
  channel: TextChannel,
  prize: string,
  winnerCount: number,
  durationMs: number,
  client: Client,
): Promise<string> {
  const giveaway: Giveaway = {
    guildId: channel.guildId,
    channelId: channel.id,
    messageId: "",
    prize,
    winnerCount,
    endsAt: Date.now() + durationMs,
    entrants: [],
    ended: false,
  };
  const message = await channel.send({ embeds: [giveawayEmbed(giveaway)], components: [giveawayRow("pending")] });
  giveaway.messageId = message.id;
  await message.edit({ components: [giveawayRow(message.id)] });
  activeGiveaways.set(message.id, giveaway);
  saveGiveaways();
  scheduleGiveaway(client, giveaway);
  return message.url;
}

export async function enterGiveaway(messageId: string, userId: string): Promise<"entered" | "already-entered" | "ended" | "missing"> {
  const giveaway = activeGiveaways.get(messageId);
  if (!giveaway) return "missing";
  if (giveaway.ended || giveaway.endsAt <= Date.now()) return "ended";
  if (giveaway.entrants.includes(userId)) return "already-entered";
  giveaway.entrants.push(userId);
  saveGiveaways();
  return "entered";
}

export async function endGiveawayNow(client: Client, messageId: string, guildId: string): Promise<boolean> {
  const giveaway = activeGiveaways.get(messageId);
  if (!giveaway || giveaway.guildId !== guildId || giveaway.ended) return false;
  const timer = timers.get(messageId);
  if (timer) clearTimeout(timer);
  await finishGiveaway(client, giveaway);
  return true;
}