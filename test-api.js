require('dotenv').config();
const fetch = require('node-fetch');

const clanTag = process.env.CLAN_TAG;
const token = process.env.CLASH_API_TOKEN;

const url = `https://api.clashofclans.com/v1/clans/${clanTag}`;

fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`
  }
})
  .then(res => {
    if (!res.ok) {
      console.error(`Error (${res.status}): ${res.statusText}`);
      return res.text().then(text => {
        console.error(text);
      });
    }
    return res.json();
  })
  .then(data => {
    if (data) {
      console.log('✅ API Response:\n');
      console.log(JSON.stringify(data, null, 2));
    }
  })
  .catch(err => console.error('Fetch failed:', err));