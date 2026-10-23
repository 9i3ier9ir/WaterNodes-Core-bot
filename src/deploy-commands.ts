import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";
import { config, ensureBotToken } from "./config.js";

async function registerCommands(): Promise<void> {
  ensureBotToken();

  const clientId = process.env.DISCORD_CLIENT_ID || config.clientId;
  const guildId = process.env.DISCORD_GUILD_ID || config.guildId;

  if (!clientId || !guildId) {
    console.error("Missing DISCORD_CLIENT_ID or DISCORD_GUILD_ID. Set them in the environment or pass them in the shell before running this command.");
    process.exitCode = 1;
    return;
  }

  const rest = new REST({ version: "10" }).setToken(config.token);

  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Registered ${commands.length} guild slash commands.`);
  } catch (error) {
    console.error("Could not register slash commands:", error);
    process.exitCode = 1;
  }
}

void registerCommands();