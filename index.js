/*
 * Clash of Clans CWL War Notification Bot
 * 
 * 📊 Project Overview:
 * This Node.js bot fetches Clash of Clans Clan War League (CWL) war info using the 
 * official Clash of Clans API and sends periodic updates via Telegram.
 * 
 * 🎯 Features:
 * - Automatically runs every 10 minutes
 * - Works specifically with CWL wars (not regular wars)
 * - Only sends messages to subscribed users (/start command)
 * - Runs locally with environment variables from .env file
 * 
 * 🔧 Dependencies:
 * - node-fetch: HTTP requests to Clash of Clans API
 * - node-telegram-bot-api: Telegram Bot interactions
 * - dotenv: Load secrets from .env file
 * - fs: Store subscribers in local JSON file
 * 
 * 📡 API Endpoints:
 * - CWL Group: GET /v1/clans/{clanTag}/currentwar/leaguegroup
 * - CWL War: GET /v1/clanwarleagues/wars/{warTag}
 * 
 * 🛠️ Environment Variables Required:
 * - TELEGRAM_BOT_TOKEN: Your Telegram bot token
 * - CLASH_API_TOKEN: Your Clash of Clans API token
 * - CLAN_TAG: Your clan tag (with or without #)
 */

const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'CLASH_API_TOKEN', 'CLAN_TAG'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Log loaded environment variables (excluding sensitive tokens)
console.log('✅ Environment variables loaded:');
console.log(`CLAN_TAG: ${process.env.CLAN_TAG}`);
console.log(`TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '[SET]' : '[MISSING]'}`);
console.log(`CLASH_API_TOKEN: ${process.env.CLASH_API_TOKEN ? '[SET]' : '[MISSING]'}`);

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const clashApiToken = process.env.CLASH_API_TOKEN;
const clanTag = process.env.CLAN_TAG;

const subscribersFile = './subscribers.json';
let subscribers = [];

if (fs.existsSync(subscribersFile)) {
  subscribers = JSON.parse(fs.readFileSync(subscribersFile));
}

function saveSubscribers() {
  fs.writeFileSync(subscribersFile, JSON.stringify(subscribers, null, 2));
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!subscribers.includes(chatId)) {
    subscribers.push(chatId);
    saveSubscribers();
    bot.sendMessage(chatId, '🎉 You have been subscribed to CWL war notifications!');
    console.log(`📱 New subscriber added: ${chatId}`);
  } else {
    bot.sendMessage(chatId, '✅ You are already subscribed to war notifications.');
  }
});

bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;
  const index = subscribers.indexOf(chatId);
  if (index > -1) {
    subscribers.splice(index, 1);
    saveSubscribers();
    bot.sendMessage(chatId, '👋 You have been unsubscribed from war notifications.');
    console.log(`📱 Subscriber removed: ${chatId}`);
  } else {
    bot.sendMessage(chatId, '❌ You are not currently subscribed.');
  }
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const war = await getCurrentCWLWar();
  if (war) {
    const message = formatWarMessage(war);
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, '❌ No CWL war data available at the moment.');
  }
});

async function getCurrentCWLWar() {
  try {
    console.log(`🔍 Fetching CWL data for clan: ${clanTag}`);
    
    const encodedTag = encodeURIComponent(clanTag);
    const groupRes = await fetch(`https://api.clashofclans.com/v1/clans/${encodedTag}/currentwar/leaguegroup`, {
      headers: {
        Authorization: `Bearer ${clashApiToken}`
      }
    });

    if (!groupRes.ok) {
      const errorData = await groupRes.json();
      console.error(`❌ Error fetching CWL group (${groupRes.status}):`, errorData.message || groupRes.statusText);
      
      if (groupRes.status === 404) {
        console.log("🔍 Clan is not currently in a CWL war.");
      }
      return null;
    }

    const groupData = await groupRes.json();

    if (!groupData.rounds) {
      console.log("⚠️  No CWL rounds found - clan may not be in an active CWL season.");
      return null;
    }

    // Try to get the most recent war tag (e.g. Day 7 of CWL)
    const latestWarTag = groupData.rounds.flatMap(r => r.warTags).reverse().find(tag => tag !== '#0');

    if (!latestWarTag) {
      console.log("❌ No valid CWL war tags found in rounds.");
      return null;
    }

    console.log(`🎯 Fetching war details for: ${latestWarTag}`);
    
    const encodedWarTag = encodeURIComponent(latestWarTag);
    const warRes = await fetch(`https://api.clashofclans.com/v1/clanwarleagues/wars/${encodedWarTag}`, {
      headers: {
        Authorization: `Bearer ${clashApiToken}`
      }
    });

    if (!warRes.ok) {
      const err = await warRes.json();
      console.error(`❌ Error fetching CWL war (${warRes.status}):`, err.message || warRes.statusText);
      return null;
    }

    const warData = await warRes.json();
    console.log(`✅ Successfully fetched CWL war data - Status: ${warData.state}`);
    return warData;
    
  } catch (err) {
    console.error('💥 Unexpected error fetching CWL war data:', err.message);
    return null;
  }
}

function formatWarMessage(war) {
  const status = war.state;
  const clan = war.clan.name;
  const opponent = war.opponent.name;

  let message = `⚔️ *CWL War Status*: ${status}\n`;
  message += `🏰 *${clan}* vs *${opponent}*\n`;

  if (status === 'inWar' || status === 'warEnded') {
    message += `⭐ ${war.clan.stars} - ${war.opponent.stars}\n`;
    message += `🔥 ${war.clan.destructionPercentage.toFixed(1)}% - ${war.opponent.destructionPercentage.toFixed(1)}%\n`;
    message += `🕒 Attacks: ${war.clan.attacks || 0} / ${war.clan.members * 2}`;
  }

  return message;
}

async function sendWarUpdate() {
  const war = await getCurrentCWLWar();
  if (!war) {
    console.log("⏸️  No war data available - skipping update.");
    return;
  }

  const message = formatWarMessage(war);
  console.log(`📤 Sending update to ${subscribers.length} subscriber(s)`);
  
  for (const chatId of subscribers) {
    try {
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(`❌ Failed to send message to ${chatId}:`, err.message);
      // Consider removing invalid chat IDs
      if (err.code === 'ETELEGRAM' && err.response?.statusCode === 403) {
        console.log(`🚫 Removing blocked subscriber: ${chatId}`);
        const index = subscribers.indexOf(chatId);
        if (index > -1) {
          subscribers.splice(index, 1);
          saveSubscribers();
        }
      }
    }
  }
}

// Every 10 minutes
setInterval(sendWarUpdate, 10 * 60 * 1000);

console.log('🚀 Bot started successfully!');
console.log('📅 Checking for CWL war updates every 10 minutes...');
console.log('💬 Use /start to subscribe, /stop to unsubscribe, /status for current war status');

// Initial run
sendWarUpdate();
