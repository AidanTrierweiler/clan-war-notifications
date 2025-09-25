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

// Add state tracking variables
let lastWarState = null;
let timeWarningsShown = {
  oneHour: false,
  thirtyMin: false,
  fifteenMin: false
};

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
    
    // Temporary debugging - remove this after we see what the API returns
    console.log('🔍 War timing data:', {
      state: warData.state,
      startTime: warData.startTime,
      endTime: warData.endTime,
      preparationStartTime: warData.preparationStartTime
    });
    
    return warData;
    
  } catch (err) {
    console.error('💥 Unexpected error fetching CWL war data:', err.message);
    return null;
  }
}

function formatWarMessage(war) {
  const clan = war.clan;
  const opponent = war.opponent;
  
  // Parse Clash of Clans custom time format
  function parseClashTime(clashTime) {
    if (!clashTime) return null;
    try {
      // Clash API format: 20250910T015830.000Z
      const date = new Date(clashTime);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.warn('⚠️ Error parsing clash time:', clashTime, error.message);
      return null;
    }
  }
  
  const endTime = parseClashTime(war.endTime);
  const startTime = parseClashTime(war.startTime);
  let timeInfo = '';
  
  if (endTime) {
    const now = new Date();
    const timeRemaining = endTime - now;
    
    if (war.state === 'preparation' && startTime) {
      const timeToStart = startTime - now;
      if (timeToStart > 0) {
        const hours = Math.floor(timeToStart / (1000 * 60 * 60));
        const minutes = Math.floor((timeToStart % (1000 * 60 * 60)) / (1000 * 60));
        timeInfo = `⏳ War starts in: ${hours}h ${minutes}m`;
      }
    } else if (war.state === 'inWar' && timeRemaining > 0) {
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      timeInfo = `⏰ Time remaining: ${hours}h ${minutes}m`;
      
      // Add urgency indicators for final warnings
      const totalMinutes = hours * 60 + minutes;
      if (totalMinutes <= 15) {
        timeInfo = `🚨 ${timeInfo} - FINAL PUSH!`;
      } else if (totalMinutes <= 30) {
        timeInfo = `⚠️ ${timeInfo} - Time running out!`;
      } else if (totalMinutes <= 60) {
        timeInfo = `🔔 ${timeInfo} - One hour left!`;
      }
    } else if (war.state === 'warEnded') {
      timeInfo = `✅ War ended at: ${endTime.toLocaleString()}`;
    }
  }

  let message = `⚔️ *CWL War Status*: ${war.state}\n`;
  message += `🏰 *${clan.name}* vs *${opponent.name}*\n`;

  if (war.state === 'inWar' || war.state === 'warEnded') {
    message += `⭐ ${clan.stars} - ${opponent.stars}\n`;
    message += `🔥 ${clan.destructionPercentage.toFixed(1)}% - ${opponent.destructionPercentage.toFixed(1)}%\n`;
    message += `🕒 Attacks: ${clan.attacks || 0} / ${(clan.members?.length || 15) * 2}\n`;
    
    if (timeInfo) {
      message += `${timeInfo}\n`;
    }
    
    // Show end time if we have valid data
    if (endTime) {
      message += `\n📅 War ends: ${endTime.toLocaleDateString()} at ${endTime.toLocaleTimeString()}`;
    }
  } else if (war.state === 'preparation') {
    if (timeInfo) {
      message += `${timeInfo}\n`;
    }
    if (startTime) {
      message += `📅 War starts: ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString()}`;
    }
  }

  return message;
}

async function sendWarUpdate() {
  try {
    console.log('🔄 Checking for war updates...');
    const war = await getCurrentCWLWar();
    
    if (!war) {
      console.log('❌ No war data available, skipping update check');
      return;
    }

    const shouldSendUpdate = shouldSendWarUpdate(war);
    
    if (shouldSendUpdate.send) {
      console.log(`📤 Sending update to ${subscribers.length} subscriber(s) - Reason: ${shouldSendUpdate.reason}`);
      const message = formatWarMessage(war);
      
      for (const chatId of subscribers) {
        try {
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
          if (error.response && error.response.statusCode === 403) {
            console.log(`🚫 Removing blocked subscriber: ${chatId}`);
            subscribers = subscribers.filter(id => id !== chatId);
            saveSubscribers();
          } else {
            console.error(`❌ Error sending message to ${chatId}:`, error.message);
          }
        }
      }
      
      // Update last war state
      lastWarState = {
        clanStars: war.clan.stars,
        opponentStars: war.opponent.stars,
        state: war.state,
        endTime: war.endTime
      };
    } else {
      console.log('⏭️ No significant changes, skipping update');
    }
    
  } catch (error) {
    console.error('💥 Error checking for updates:', error.message);
  }
}

// New function to determine if we should send an update
function shouldSendWarUpdate(war) {
  // Always send update if this is the first check
  if (!lastWarState) {
    return { send: true, reason: "First war check" };
  }

  // Always send if war state changed (prep -> inWar -> ended)
  if (lastWarState.state !== war.state) {
    // Reset time warnings when war state changes
    timeWarningsShown = { oneHour: false, thirtyMin: false, fifteenMin: false };
    return { send: true, reason: `War state changed to ${war.state}` };
  }

  // Send if stars changed
  const starsChanged = (
    lastWarState.clanStars !== war.clan.stars || 
    lastWarState.opponentStars !== war.opponent.stars
  );
  
  if (starsChanged) {
    return { 
      send: true, 
      reason: `Stars changed: ${lastWarState.clanStars}-${lastWarState.opponentStars} → ${war.clan.stars}-${war.opponent.stars}` 
    };
  }

  // Check for time-based warnings (only during active war)
  if (war.state === 'inWar') {
    try {
      const endTime = new Date(war.endTime);
      if (!isNaN(endTime.getTime())) {
        const now = new Date();
        const timeRemaining = endTime - now;
        const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));

        // 1 hour warning (60 minutes)
        if (minutesRemaining <= 60 && minutesRemaining > 45 && !timeWarningsShown.oneHour) {
          timeWarningsShown.oneHour = true;
          return { send: true, reason: "1 hour remaining warning" };
        }

        // 30 minute warning
        if (minutesRemaining <= 30 && minutesRemaining > 20 && !timeWarningsShown.thirtyMin) {
          timeWarningsShown.thirtyMin = true;
          return { send: true, reason: "30 minutes remaining warning" };
        }

        // 15 minute warning
        if (minutesRemaining <= 15 && minutesRemaining > 5 && !timeWarningsShown.fifteenMin) {
          timeWarningsShown.fifteenMin = true;
          return { send: true, reason: "15 minutes remaining warning" };
        }
      }
    } catch (error) {
      console.warn('⚠️ Error parsing endTime for warnings:', error.message);
    }
  }

  return { send: false, reason: "No significant changes" };
}

// Every 10 minutes
setInterval(sendWarUpdate, 10 * 60 * 1000);

console.log('🚀 Bot started successfully!');
console.log('📅 Checking for CWL war updates every 10 minutes...');
console.log('💬 Use /start to subscribe, /stop to unsubscribe, /status for current war status');

// Initial run
sendWarUpdate();
