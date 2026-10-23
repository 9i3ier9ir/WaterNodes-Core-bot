import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type StoredServerConfig = {
  supportRoleId?: string;
  ticketCategoryId?: string;
  ticketPanelChannelId?: string;
  closedTicketCategoryId?: string;
};

let configStorePath = join(process.cwd(), "data", "config.json");

export function setConfigStorePathForTests(path: string): void {
  configStorePath = path;
}

export function readStoredConfig(): StoredServerConfig {
  if (!existsSync(configStorePath)) return {};

  try {
    const raw = readFileSync(configStorePath, "utf8");
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as Partial<StoredServerConfig>;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch (error) {
    console.error("Could not read stored server config:", error);
    return {};
  }
}

export function saveStoredConfig(updates: Partial<StoredServerConfig>): void {
  mkdirSync(dirname(configStorePath), { recursive: true });
  const merged = { ...readStoredConfig(), ...updates };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === "") delete merged[key as keyof StoredServerConfig];
  }
  writeFileSync(configStorePath, JSON.stringify(merged, null, 2));
}

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function required(name: string): string {
  const value = envValue(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const storedConfig = readStoredConfig();

export const config = {
  token: envValue("DISCORD_TOKEN") || "",
  clientId: envValue("DISCORD_CLIENT_ID") || "",
  guildId: envValue("DISCORD_GUILD_ID") || "",
  supportRoleId: envValue("SUPPORT_ROLE_ID") || storedConfig.supportRoleId || "",
  ticketCategoryId: envValue("TICKET_CATEGORY_ID") || storedConfig.ticketCategoryId || "",
  ticketPanelChannelId: envValue("TICKET_PANEL_CHANNEL_ID") || storedConfig.ticketPanelChannelId || "",
  closedTicketCategoryId: envValue("CLOSED_TICKET_CATEGORY_ID") || storedConfig.closedTicketCategoryId || "",
};

export function ensureBotToken(): string {
  const token = envValue("DISCORD_TOKEN");
  if (!token) {
    throw new Error("Missing required environment variable: DISCORD_TOKEN");
  }
  config.token = token;
  return token;
}

export function updateStoredServerConfig(updates: Partial<StoredServerConfig>): void {
  saveStoredConfig(updates);
  const next = readStoredConfig();
  config.supportRoleId = envValue("SUPPORT_ROLE_ID") || next.supportRoleId || config.supportRoleId || "";
  config.ticketCategoryId = envValue("TICKET_CATEGORY_ID") || next.ticketCategoryId || config.ticketCategoryId || "";
  config.ticketPanelChannelId = envValue("TICKET_PANEL_CHANNEL_ID") || next.ticketPanelChannelId || config.ticketPanelChannelId || "";
  config.closedTicketCategoryId = envValue("CLOSED_TICKET_CATEGORY_ID") || next.closedTicketCategoryId || config.closedTicketCategoryId || "";
  if (updates.supportRoleId) config.supportRoleId = updates.supportRoleId;
  if (updates.ticketCategoryId) config.ticketCategoryId = updates.ticketCategoryId;
  if (updates.ticketPanelChannelId) config.ticketPanelChannelId = updates.ticketPanelChannelId;
  if (updates.closedTicketCategoryId) config.closedTicketCategoryId = updates.closedTicketCategoryId;
}