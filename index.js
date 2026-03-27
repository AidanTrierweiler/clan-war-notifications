/*
 * Clash of Clans War Notification System
 *
 * Sends FREE notifications via Telegram bot.
 * Supports both regular wars and Clan War League (CWL) wars.
 *
 * Notifications sent:
 *   - War declared (preparation phase)
 *   - War started (battle day begins)
 *   - Every attack your clan makes
 *   - Every attack the enemy clan makes
 *   - Time warnings (60, 30, 15 min remaining)
 *   - War ended with final result (win/loss/tie)
 *
 * Environment Variables Required (.env):
 *   CLAN_TAG           - Your clan tag, e.g. #ABC123
 *   CLASH_API_TOKEN    - Token from https://developer.clashofclans.com
 *   TELEGRAM_BOT_TOKEN - Token from @BotFather on Telegram
 *   TELEGRAM_CHAT_ID   - Your chat ID (see setup instructions)
 */

require('dotenv').config();
const fetch = require('node-fetch');
const http  = require('http');

// --- Config ---
const CLAN_TAG_RAW       = (process.env.CLAN_TAG || '').trim();
const CLAN_TAG_ENCODED   = encodeURIComponent(CLAN_TAG_RAW);
const CLASH_API_TOKEN    = process.env.CLASH_API_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const POLL_INTERVAL_MS   = parseInt(process.env.POLL_INTERVAL_MS || '120000');

// --- Notification helper ---
async function sendSMS(message) {
  console.log(`[NOTIFY] ${message}`);
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
    });
    const data = await res.json();
    if (!data.ok) console.error('[NOTIFY] Telegram error:', data.description);
  } catch (err) {
    console.error('[NOTIFY] Failed to send:', err.message);
  }
}

// --- State ---
function freshState() {
  return {
    warState: null,
    warId: null,
    prepNotified: false,
    startNotified: false,
    endNotified: false,
    seenAttacks: new Set(),
    timeWarnings: { 60: false, 30: false, 15: false },
  };
}

let state = freshState();

// --- Upstash Redis state persistence ---
// Uses the REST API directly (no extra package needed)
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const STATE_KEY     = `coc-war-state-${(process.env.CLAN_TAG || '').replace('#', '')}`;

async function saveState() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    const payload = {
      warState:      state.warState,
      warId:         state.warId,
      prepNotified:  state.prepNotified,
      startNotified: state.startNotified,
      endNotified:   state.endNotified,
      seenAttacks:   [...state.seenAttacks],
      timeWarnings:  state.timeWarnings,
    };
    await fetch(`${UPSTASH_URL}/set/${STATE_KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(payload)),
    });
  } catch (err) {
    console.error('[State] Failed to save:', err.message);
  }
}

async function loadState() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    const res  = await fetch(`${UPSTASH_URL}/get/${STATE_KEY}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const data = await res.json();
    if (!data.result) return;
    const saved = JSON.parse(data.result);
    state = {
      warState:      saved.warState      ?? null,
      warId:         saved.warId         ?? null,
      prepNotified:  saved.prepNotified  ?? false,
      startNotified: saved.startNotified ?? false,
      endNotified:   saved.endNotified   ?? false,
      seenAttacks:   new Set(saved.seenAttacks || []),
      timeWarnings:  saved.timeWarnings  ?? { 60: false, 30: false, 15: false },
    };
    console.log(`[State] Restored — warId: ${state.warId}, attacks seen: ${state.seenAttacks.size}`);
  } catch (err) {
    console.error('[State] Failed to load:', err.message);
  }
}

// --- Clash API ---
async function apiGet(path) {
  const res = await fetch(`https://api.clashofclans.com/v1${path}`, {
    headers: { Authorization: `Bearer ${CLASH_API_TOKEN}` },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// Returns { war, isCWL } - tries regular war first, then CWL fallback
async function getCurrentWar() {
  // 1. Try regular war endpoint
  const { status, data } = await apiGet(`/clans/${CLAN_TAG_ENCODED}/currentwar`);

  if (status === 200 && data && data.state && data.state !== 'notInWar') {
    return { war: data, isCWL: false };
  }

  // 2. Fallback: check CWL league group
  const league = await apiGet(`/clans/${CLAN_TAG_ENCODED}/currentwar/leaguegroup`);
  if (league.status !== 200 || !league.data || !league.data.rounds) {
    // No regular war and no CWL
    return { war: { state: 'notInWar' }, isCWL: false };
  }

  const rounds = league.data.rounds || [];

  // Search rounds from newest to oldest for an active or ended war
  for (let priority = 0; priority < 2; priority++) {
    const wantedStates = priority === 0
      ? ['inWar', 'preparation']
      : ['warEnded'];

    for (let i = rounds.length - 1; i >= 0; i--) {
      for (const warTag of (rounds[i].warTags || [])) {
        if (warTag === '#0') continue;
        const { status: ws, data: wd } = await apiGet(`/clanwarleagues/wars/${encodeURIComponent(warTag)}`);
        if (ws !== 200 || !wd) continue;
        // Check if our clan is in this matchup
        const ourClanInWar = wd.clan?.tag === CLAN_TAG_RAW || wd.opponent?.tag === CLAN_TAG_RAW;
        if (ourClanInWar && wantedStates.includes(wd.state)) {
          return { war: wd, isCWL: true };
        }
      }
    }
  }

  return { war: { state: 'notInWar' }, isCWL: false };
}

// --- Utility ---
function minsRemaining(endTime) {
  if (!endTime) return null;
  const end = new Date(endTime);
  if (isNaN(end.getTime())) return null;
  return Math.floor((end - Date.now()) / 60000);
}

function starsStr(n) {
  const s = Math.max(0, Math.min(3, n || 0));
  return '\u2B50'.repeat(s) + '\u2606'.repeat(3 - s);
}

function warId(war) {
  return war.preparationStartTime || war.startTime || '';
}

// Ensure myClan is always our clan, theirClan is the opponent
function normalizeSides(war, isCWL) {
  if (!isCWL || war.clan?.tag === CLAN_TAG_RAW) {
    return { myClan: war.clan, theirClan: war.opponent };
  }
  return { myClan: war.opponent, theirClan: war.clan };
}

// --- Main poll logic ---
async function poll() {
  let war, isCWL;
  try {
    ({ war, isCWL } = await getCurrentWar());
  } catch (err) {
    console.error('[API] Error:', err.message);
    return;
  }

  if (!war || war.state === 'notInWar') {
    if (state.warState && state.warState !== 'notInWar') {
      console.log('[War] No active war - resetting state');
      state = freshState();
      state.warState = 'notInWar';
    }
    return;
  }

  const { myClan, theirClan } = normalizeSides(war, isCWL);
  const warLabel = isCWL ? ' (CWL)' : '';
  const clanName = myClan?.name || 'Your Clan';
  const oppName  = theirClan?.name || 'Enemy';
  const clanStars = myClan?.stars || 0;
  const oppStars  = theirClan?.stars || 0;
  const { state: warState, endTime, teamSize } = war;

  // Detect war transition (new war started)
  const wid = warId(war);
  if (state.warId && state.warId !== wid) {
    console.log('[War] New war detected - resetting state');
    state = freshState();
  }
  state.warId = wid;

  // --- PREPARATION PHASE ---
  if (warState === 'preparation' && !state.prepNotified) {
    state.prepNotified = true;
    await sendSMS(
      `WAR DECLARED${warLabel}!\n` +
      `${clanName} vs ${oppName}\n` +
      `${teamSize || '?'}v${teamSize || '?'} war\n` +
      `Battle day starts soon!`
    );
  }

  // --- WAR STARTED ---
  if (warState === 'inWar' && !state.startNotified) {
    state.startNotified = true;
    const mins = minsRemaining(endTime);
    const timeLeft = mins != null ? `${Math.floor(mins / 60)}h ${mins % 60}m left` : '';
    await sendSMS(
      `WAR STARTED${warLabel}!\n` +
      `${clanName} ${clanStars}* vs ${oppStars}* ${oppName}\n` +
      `${timeLeft}`
    );
  }

  // --- TIME WARNINGS ---
  if (warState === 'inWar' && endTime) {
    const mins = minsRemaining(endTime);
    if (mins != null) {
      for (const threshold of [60, 30, 15]) {
        if (!state.timeWarnings[threshold] && mins <= threshold && mins > threshold - 4) {
          state.timeWarnings[threshold] = true;
          await sendSMS(
            `${threshold} MIN LEFT!\n` +
            `${clanName} ${clanStars}* vs ${oppStars}* ${oppName}`
          );
        }
      }
    }
  }

  // --- ATTACK NOTIFICATIONS ---
  if (warState === 'inWar') {
    const myMap    = {};
    const theirMap = {};
    (myClan?.members    || []).forEach(m => { myMap[m.tag]    = m; });
    (theirClan?.members || []).forEach(m => { theirMap[m.tag] = m; });

    // Our clan's attacks
    for (const member of (myClan?.members || [])) {
      for (const attack of (member.attacks || [])) {
        const key = `${attack.attackerTag}:${attack.order}`;
        if (!state.seenAttacks.has(key)) {
          state.seenAttacks.add(key);
          const defName = theirMap[attack.defenderTag]?.name || '?';
          const pct = (attack.destructionPercentage || 0).toFixed(1);
          await sendSMS(
            `YOUR CLAN attacked!\n` +
            `${member.name} -> ${defName}\n` +
            `${starsStr(attack.stars)} ${pct}%`
          );
        }
      }
    }

    // Enemy clan's attacks
    for (const member of (theirClan?.members || [])) {
      for (const attack of (member.attacks || [])) {
        const key = `${attack.attackerTag}:${attack.order}`;
        if (!state.seenAttacks.has(key)) {
          state.seenAttacks.add(key);
          const defName = myMap[attack.defenderTag]?.name || '?';
          const pct = (attack.destructionPercentage || 0).toFixed(1);
          await sendSMS(
            `ENEMY attacked!\n` +
            `${member.name} -> ${defName}\n` +
            `${starsStr(attack.stars)} ${pct}%`
          );
        }
      }
    }
  }

  // --- WAR ENDED ---
  if (warState === 'warEnded' && !state.endNotified) {
    state.endNotified = true;
    const clanDest = (myClan?.destructionPercentage || 0).toFixed(1);
    const oppDest  = (theirClan?.destructionPercentage || 0).toFixed(1);

    let result;
    if (clanStars > oppStars) result = 'YOU WIN!';
    else if (clanStars < oppStars) result = 'YOU LOST';
    else if (parseFloat(clanDest) > parseFloat(oppDest)) result = 'YOU WIN!';
    else if (parseFloat(clanDest) < parseFloat(oppDest)) result = 'YOU LOST';
    else result = 'TIE!';

    await sendSMS(
      `WAR OVER - ${result}\n` +
      `${clanName}: ${clanStars}* ${clanDest}%\n` +
      `${oppName}: ${oppStars}* ${oppDest}%`
    );
  }

  state.warState = warState;
  await saveState();
  console.log(
    `[${new Date().toISOString()}] ${warState}${warLabel} | ` +
    `${clanName} ${clanStars}* vs ${oppStars}* ${oppName} | ` +
    `attacks seen: ${state.seenAttacks.size}`
  );
}

// --- Test sequence ---
async function runTest() {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  console.log('[Test] Sending sample notifications...');

  await sendSMS('WAR DECLARED!\nTrierweiler vs Dragon Lords\n15v15 war\nBattle day starts soon!');
  await delay(2000);

  await sendSMS('WAR STARTED!\nTrierweiler 0* vs 0* Dragon Lords\n23h 59m left');
  await delay(2000);

  await sendSMS('YOUR CLAN attacked!\nAidan -> DragonKing\n⭐⭐⭐ 100.0%');
  await delay(2000);

  await sendSMS('ENEMY attacked!\nBlazeFury -> CocWarrior\n⭐⭐☆ 78.4%');
  await delay(2000);

  await sendSMS('YOUR CLAN attacked!\nCooper -> IronShield\n⭐⭐☆ 65.2%');
  await delay(2000);

  await sendSMS('60 MIN LEFT!\nTrierweiler 45* vs 38* Dragon Lords');
  await delay(2000);

  await sendSMS('30 MIN LEFT!\nTrierweiler 72* vs 61* Dragon Lords');
  await delay(2000);

  await sendSMS('15 MIN LEFT!\nTrierweiler 80* vs 77* Dragon Lords');
  await delay(2000);

  await sendSMS('WAR OVER - YOU WIN!\nTrierweiler: 88* 99.7%\nDragon Lords: 77* 87.8%');

  console.log('[Test] Done. Starting normal polling...');
}

// --- Startup ---
async function main() {
  const missing = ['CLAN_TAG', 'CLASH_API_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
    .filter(k => !process.env[k]);

  if (missing.length) {
    console.error('Missing required env vars:', missing.join(', '));
    console.error('Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }

  console.log(`[Start] Clan: ${CLAN_TAG_RAW}`);
  console.log(`[Start] Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`[Start] Telegram chat ID: ${TELEGRAM_CHAT_ID}`);

  await loadState();

  if (process.argv.includes('--test')) {
    await runTest();
  }

  // Keep-alive HTTP server so Render doesn't spin us down
  // UptimeRobot pings this endpoint every 5 minutes for free
  const PORT = process.env.PORT || 3000;
  http.createServer((req, res) => res.end('ok')).listen(PORT, () => {
    console.log(`[Keep-alive] Listening on port ${PORT}`);
  });

  await poll();
  setInterval(poll, POLL_INTERVAL_MS);
}

main().catch(console.error);
