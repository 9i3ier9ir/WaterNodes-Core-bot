import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const adminPermissions = PermissionFlagsBits.ManageGuild;

export const commands = [
  new SlashCommandBuilder()
    .setName("plans")
    .setDescription("Post the WaterNodes Core payment plans")
    .setDefaultMemberPermissions(adminPermissions)
    .addStringOption((option) => option
      .setName("currency")
      .setDescription("Choose the displayed pricing currency")
      .setRequired(true)
      .addChoices({ name: "USD", value: "USD" }, { name: "INR", value: "INR" })),
  new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Post the WaterNodes support ticket panel")
    .setDefaultMemberPermissions(adminPermissions)
    .addChannelOption((option) => option.setName("channel").setDescription("Optional override channel for this panel").addChannelTypes(ChannelType.GuildText)),
  new SlashCommandBuilder()
    .setName("set-support-role")
    .setDescription("Set the role that receives support ticket mentions")
    .setDefaultMemberPermissions(adminPermissions)
    .addRoleOption((option) => option.setName("role").setDescription("Support role").setRequired(true)),
  new SlashCommandBuilder()
    .setName("set-ticket-category")
    .setDescription("Set the category where new ticket channels are created")
    .setDefaultMemberPermissions(adminPermissions)
    .addChannelOption((option) => option.setName("category").setDescription("Ticket category").setRequired(true).addChannelTypes(ChannelType.GuildCategory)),
  new SlashCommandBuilder()
    .setName("set-closed-ticket-category")
    .setDescription("Set the category where closed tickets are moved")
    .setDefaultMemberPermissions(adminPermissions)
    .addChannelOption((option) => option.setName("category").setDescription("Closed ticket category").setRequired(true).addChannelTypes(ChannelType.GuildCategory)),
  new SlashCommandBuilder()
    .setName("set-ticket-panel-channel")
    .setDescription("Set the default channel for the ticket panel")
    .setDefaultMemberPermissions(adminPermissions)
    .addChannelOption((option) => option.setName("channel").setDescription("Ticket panel channel").setRequired(true).addChannelTypes(ChannelType.GuildText)),
  new SlashCommandBuilder()
    .setName("config-status")
    .setDescription("Show the current WaterNodes bot configuration")
    .setDefaultMemberPermissions(adminPermissions),
  new SlashCommandBuilder()
    .setName("giveaway-start")
    .setDescription("Start a ticket or other prize giveaway")
    .setDefaultMemberPermissions(adminPermissions)
    .addStringOption((option) => option.setName("prize").setDescription("What the winner receives").setRequired(true).setMaxLength(100))
    .addStringOption((option) => option.setName("duration").setDescription("Duration, for example 30m, 12h, or 7d").setRequired(true))
    .addIntegerOption((option) => option.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(20))
    .addChannelOption((option) => option.setName("channel").setDescription("Where to post the giveaway")),
  new SlashCommandBuilder()
    .setName("giveaway-end")
    .setDescription("End an active giveaway and draw winners")
    .setDefaultMemberPermissions(adminPermissions)
    .addStringOption((option) => option.setName("message_id").setDescription("ID of the giveaway post").setRequired(true)),
].map((command) => command.toJSON());