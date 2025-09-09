require('dotenv').config();
const fetch = require('node-fetch');

const clanTag = encodeURIComponent(process.env.CLAN_TAG);
const token = process.env.CLASH_API_TOKEN;

const url = `https://api.clashofclans.com/v1/clans/${clanTag}/currentwar/leaguegroup`;

fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`
  }
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ CWL Group Data:\n');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => console.error('Fetch failed:', err));
