import {
  ActionRowBuilder,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  PermissionsBitField,
  REST,
  Routes,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
} from "discord.js";
import { createPlanEmbeds, Currency } from "./catalog.js";
import { config, ensureBotToken, updateStoredServerConfig } from "./config.js";
import { commands } from "./commands.js";
import { endGiveawayNow, enterGiveaway, parseDuration, postGiveaway, resumeGiveaways } from "./giveaways.js";

const ticketTypes = [
  { label: "Billing Support", value: "billing", description: "Payments, invoices, or plan questions" },
  { label: "Regular Support", value: "support", description: "Help with a WaterNodes service" },
  { label: "Reward Support", value: "reward", description: "Questions about rewards or ticket giveaways" },
  { label: "Other Problems", value: "other", description: "Anything else you need help with" },
] as const;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function isAdmin(interaction: { memberPermissions: Readonly<PermissionsBitField> | null }): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

function ticketPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x168a78)
    .setTitle("WaterNodes Support")
    .setDescription("Choose a topic below to open a private support ticket. A team member will reply as soon as possible.");
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket:create")
    .setPlaceholder("Select a ticket type")
    .addOptions(ticketTypes.map((type) => new StringSelectMenuOptionBuilder()
      .setLabel(type.label)
      .setValue(type.value)
      .setDescription(type.description)));
  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] };
}

async function createTicket(interaction: import("discord.js").StringSelectMenuInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "Tickets can only be opened in a server.", ephemeral: true });
    return;
  }
  const type = ticketTypes.find((ticketType) => ticketType.value === interaction.values[0]);
  if (!type) {
    await interaction.reply({ content: "That ticket type is not available.", ephemeral: true });
    return;
  }

  const existing = await interaction.guild.channels.fetch();
  const openTicket = existing.find((channel) =>
    channel?.type === ChannelType.GuildText && channel.topic?.includes(`ticket-owner:${interaction.user.id};`),
  );
  if (openTicket) {
    await interaction.reply({ content: `You already have an open ticket: ${openTicket}.`, ephemeral: true });
    return;
  }

  if (!config.ticketCategoryId) {
    await interaction.reply({ content: "This server is not configured for ticket categories yet. An admin must run /set-ticket-category first.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const safeUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 24) || "user";
    const channel = await interaction.guild.channels.create({
      name: `ticket-${type.value}-${safeUsername}`,
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      topic: `ticket-owner:${interaction.user.id};type:${type.value}`,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: config.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.guild.members.me!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ],
    });

    const closeButton = new ActionRowBuilder<import("discord.js").ButtonBuilder>().addComponents(
      new (await import("discord.js")).ButtonBuilder()
        .setCustomId("ticket:close")
        .setLabel("Close ticket")
        .setStyle((await import("discord.js")).ButtonStyle.Danger),
    );
    await channel.send({
      content: `<@${interaction.user.id}> <@&${config.supportRoleId}>`,
      embeds: [new EmbedBuilder().setColor(0x168a78).setTitle(type.label).setDescription("Please describe what you need help with. A support team member will be with you shortly.")],
      components: [closeButton],
    });
    await interaction.editReply({ content: `Your ${type.label.toLowerCase()} ticket is ready: ${channel}.` });
  } catch (error) {
    console.error("Could not create ticket:", error);
    await interaction.editReply({ content: "I could not create your ticket. Please contact a server moderator." });
  }
}

async function closeTicket(interaction: import("discord.js").ButtonInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild || interaction.channel?.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "This button must be used inside a ticket channel.", ephemeral: true });
    return;
  }
  const channel = interaction.channel as TextChannel;
  const ownerId = channel.topic?.match(/ticket-owner:(\d+);/)?.[1];
  if (!ownerId) {
    await interaction.reply({ content: "This channel is not an active ticket.", ephemeral: true });
    return;
  }
  const isOwner = interaction.user.id === ownerId;
  const isSupport = !!config.supportRoleId && (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
    || interaction.guild.members.cache.get(interaction.user.id)?.roles.cache.has(config.supportRoleId)
  );
  if (!isOwner && !isSupport) {
    await interaction.reply({ content: "Only the ticket owner or support team can close this ticket.", ephemeral: true });
    return;
  }

  await interaction.deferReply();
  try {
    await channel.permissionOverwrites.edit(ownerId, { SendMessages: false });
    if (config.closedTicketCategoryId) await channel.setParent(config.closedTicketCategoryId);
    await channel.setName(`closed-${channel.name.replace(/^ticket-/, "")}`.slice(0, 100));
    await channel.setTopic(`${channel.topic};closed-by:${interaction.user.id}`);
    await interaction.editReply(`Ticket closed by <@${interaction.user.id}>.`);
  } catch (error) {
    console.error("Could not close ticket:", error);
    await interaction.editReply("I could not close this ticket. Please check my channel permissions.");
  }
}

async function registerGuildCommands(guildId: string): Promise<void> {
  if (!client.user?.id) return;
  const rest = new REST({ version: "10" }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
}

client.once("ready", async (readyClient) => {
  console.log(`WaterNodes Core is online as ${readyClient.user.tag}.`);
  await Promise.all([...readyClient.guilds.cache.keys()].map((guildId) => registerGuildCommands(guildId)));
  resumeGiveaways(client);
});

client.on("guildCreate", (guild) => {
  void registerGuildCommands(guild.id);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (!isAdmin(interaction)) {
        await interaction.reply({ content: "You need the Manage Server permission to use this command.", ephemeral: true });
        return;
      }

      if (interaction.commandName === "plans") {
        const currency = interaction.options.getString("currency", true) as Currency;
        const responseChannel = interaction.channel && interaction.channel.isTextBased() ? interaction.channel : null;
        if (responseChannel && "send" in responseChannel) {
          await responseChannel.send({ embeds: createPlanEmbeds(currency) });
        }
        await interaction.reply({ content: `${currency} plans posted.`, ephemeral: true });
      } else if (interaction.commandName === "ticket-panel") {
        const overrideChannel = interaction.options.getChannel("channel");
        const target = overrideChannel && overrideChannel.type === ChannelType.GuildText ? overrideChannel : (config.ticketPanelChannelId ? interaction.guild?.channels.cache.get(config.ticketPanelChannelId) : undefined);
        const responseChannel = (target && target.type === ChannelType.GuildText ? target : (interaction.channel && interaction.channel.isTextBased() ? interaction.channel : null));
        if (responseChannel && "send" in responseChannel) {
          await responseChannel.send(ticketPanel());
          await interaction.reply({ content: `Ticket panel posted in ${responseChannel}.`, ephemeral: true });
          return;
        }
        await interaction.reply({ content: "Set a ticket panel channel first or run this command in a text channel.", ephemeral: true });
      } else if (interaction.commandName === "set-support-role") {
        const role = interaction.options.getRole("role", true);
        updateStoredServerConfig({ supportRoleId: role.id });
        await interaction.reply({ content: `Support role set to <@&${role.id}>.`, ephemeral: true });
      } else if (interaction.commandName === "set-ticket-category") {
        const category = interaction.options.getChannel("category", true);
        if (category.type !== ChannelType.GuildCategory) {
          await interaction.reply({ content: "Please choose a category channel.", ephemeral: true });
          return;
        }
        updateStoredServerConfig({ ticketCategoryId: category.id });
        await interaction.reply({ content: `Ticket category set to ${category}.`, ephemeral: true });
      } else if (interaction.commandName === "set-closed-ticket-category") {
        const category = interaction.options.getChannel("category", true);
        if (category.type !== ChannelType.GuildCategory) {
          await interaction.reply({ content: "Please choose a category channel.", ephemeral: true });
          return;
        }
        updateStoredServerConfig({ closedTicketCategoryId: category.id });
        await interaction.reply({ content: `Closed ticket category set to ${category}.`, ephemeral: true });
      } else if (interaction.commandName === "set-ticket-panel-channel") {
        const channel = interaction.options.getChannel("channel", true);
        if (channel.type !== ChannelType.GuildText) {
          await interaction.reply({ content: "Please choose a text channel.", ephemeral: true });
          return;
        }
        updateStoredServerConfig({ ticketPanelChannelId: channel.id });
        await interaction.reply({ content: `Ticket panel channel set to ${channel}.`, ephemeral: true });
      } else if (interaction.commandName === "config-status") {
        const status = [
          `Support role: ${config.supportRoleId ? `<@&${config.supportRoleId}>` : "not set"}`,
          `Ticket category: ${config.ticketCategoryId ? `<#${config.ticketCategoryId}>` : "not set"}`,
          `Closed ticket category: ${config.closedTicketCategoryId ? `<#${config.closedTicketCategoryId}>` : "not set"}`,
          `Ticket panel channel: ${config.ticketPanelChannelId ? `<#${config.ticketPanelChannelId}>` : "not set"}`,
        ].join("\n");
        await interaction.reply({ content: `Current configuration:\n${status}`, ephemeral: true });
      } else if (interaction.commandName === "giveaway-start") {
        const duration = parseDuration(interaction.options.getString("duration", true));
        if (!duration) {
          await interaction.reply({ content: "Use a duration from 1 minute to 30 days, such as 30m, 12h, or 7d.", ephemeral: true });
          return;
        }
        const target = interaction.options.getChannel("channel") ?? interaction.channel;
        const targetChannel = target && target.type === ChannelType.GuildText ? (target as TextChannel) : null;
        if (!targetChannel) {
          await interaction.reply({ content: "Choose a text channel for the giveaway.", ephemeral: true });
          return;
        }
        const url = await postGiveaway(targetChannel, interaction.options.getString("prize", true), interaction.options.getInteger("winners") ?? 1, duration, client);
        await interaction.reply({ content: `Giveaway posted: ${url}`, ephemeral: true });
      } else if (interaction.commandName === "giveaway-end") {
        const ended = await endGiveawayNow(client, interaction.options.getString("message_id", true), interaction.guildId ?? "");
        await interaction.reply({ content: ended ? "Giveaway ended and winners drawn." : "No active giveaway found with that message ID.", ephemeral: true });
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "ticket:create") {
      await createTicket(interaction);
    } else if (interaction.isButton() && interaction.customId === "ticket:close") {
      await closeTicket(interaction);
    } else if (interaction.isButton() && interaction.customId.startsWith("giveaway:enter:")) {
      const result = await enterGiveaway(interaction.customId.slice("giveaway:enter:".length), interaction.user.id);
      const messages = {
        entered: "You are entered in the giveaway.",
        "already-entered": "You are already entered.",
        ended: "This giveaway has ended.",
        missing: "This giveaway is no longer available.",
      };
      await interaction.reply({ content: messages[result], ephemeral: true });
    }
  } catch (error) {
    console.error("Interaction failed:", error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Something went wrong while handling that request.", ephemeral: true }).catch(() => undefined);
    }
  }
});

try {
  ensureBotToken();
  void client.login(config.token);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Missing DISCORD_TOKEN");
  process.exit(1);
}