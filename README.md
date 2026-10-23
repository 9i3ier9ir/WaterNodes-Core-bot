# WaterNodes Core

Discord bot for WaterNodes plan posts, private support tickets, and ticket/prize giveaways.

## Requirements

- Node.js 20.18.0 or newer
- A Discord application and bot added to your server with `applications.commands` and `bot` scopes
- Bot permissions: Manage Channels, View Channels, Send Messages, Embed Links, Read Message History, and Use Application Commands

## Configure

1. Run `npm install`.
2. Copy `.env.example` to `.env` and fill in only the Discord bot token.
3. Enable the bot's server installation and make sure its role is above any roles/channels it needs to manage.
4. Start the bot with `npm run dev` or `npm run build && npm start`.
5. In Discord, use the admin commands below to set:
   - support role
   - ticket category
   - closed ticket category
   - default ticket panel channel

The bot registers its slash commands automatically when it joins or loads a guild, so the runtime setup does not require hard-coded environment values for server IDs, support roles, or ticket categories.

Keep `.env` private. Giveaway entries and end times are saved in `data/giveaways.json`; keep that file on persistent storage when hosting the bot.

## Commands

- `/plans currency:USD|INR` posts the hardware baseline and monthly, yearly, and lifetime prices.
- `/ticket-panel [channel]` posts the ticket selector panel. If a channel is provided, it uses that override; otherwise it uses the configured default panel channel.
- `/set-support-role role` sets the support role that gets mentioned in new tickets.
- `/set-ticket-category category` sets the category that new ticket channels are created under.
- `/set-closed-ticket-category category` sets the category where closed tickets are moved.
- `/set-ticket-panel-channel channel` sets the default channel for the ticket panel.
- `/config-status` shows the current configured IDs and channels.
- `/giveaway-start prize duration winners channel` posts an entry button, then randomly selects the requested number of unique entrants when it ends. Durations range from `1m` to `30d`. Only administrators can manage giveaways.
- `/giveaway-end message_id` ends an active giveaway early.

Members can have one open ticket at a time. The ticket owner or support team can close it. When a closed ticket category is configured, closed tickets move there; otherwise they stay in place with the owner unable to send messages.

The bot manages one configured server. It does not process payments; plan posts are informational.