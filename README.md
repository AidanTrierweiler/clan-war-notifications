# Clash of Clans War Notification Bot

A free, always-on bot that sends Telegram notifications for everything that happens during a Clash of Clans war. The game only notifies you when a war starts and ends — this fills in everything in between.

## What It Notifies You About

- War declared (preparation phase begins)
- War started (battle day begins)
- Every attack your clan makes
- Every attack the enemy clan makes
- Time warnings at 60, 30, and 15 minutes remaining
- War ended with final result (win / loss / tie) and stats

Supports both regular wars and Clan War League (CWL).

## How It Works

The bot polls the official Clash of Clans API every 2 minutes. It tracks the war state and every attack it has already seen, so it only sends a notification when something new happens. Notifications are sent via the Telegram Bot API to your personal Telegram account.

It runs as a web service on Render (free tier), and UptimeRobot pings it every 5 minutes to prevent Render from spinning it down.

## Tech Stack

- **Node.js** — runtime
- **Clash of Clans API** — war data source
- **Telegram Bot API** — notifications
- **Render** — free 24/7 hosting
- **UptimeRobot** — free keep-alive pinger

## Environment Variables

Set these in your Render dashboard (not in a .env file when deployed):

| Variable | Description |
|---|---|
| `CLAN_TAG` | Your clan tag e.g. `#ABC123` |
| `CLASH_API_TOKEN` | API token from developer.clashofclans.com |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather on Telegram |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID |
| `POLL_INTERVAL_MS` | How often to poll in ms (default `120000` = 2 min) |

## Local Setup

1. Clone the repo
2. Run `npm install`
3. Create a `.env` file and fill in the variables above
4. Run `node index.js`

To send a test notification sequence showing all message types:
```
node index.js --test
```

## Deployment (Render + UptimeRobot)

1. Push repo to GitHub
2. Create a free Web Service on [render.com](https://render.com) pointed at the repo
   - Build command: `npm install`
   - Start command: `npm start`
3. Add all environment variables in the Render dashboard
4. Create a free monitor on [uptimerobot.com](https://uptimerobot.com) pointing at your Render URL, interval set to 5 minutes

## Getting Your Credentials

- **Clash API token:** [developer.clashofclans.com](https://developer.clashofclans.com) — create a key and set the allowed IP to your Render service's outbound IP
- **Telegram bot token:** Message @BotFather on Telegram, send `/newbot`
- **Telegram chat ID:** Message your bot, then visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` and find the `id` field
