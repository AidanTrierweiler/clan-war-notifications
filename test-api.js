require('dotenv').config();
const fetch = require('node-fetch');

const clanTag = process.env.CLAN_TAG;
const token = process.env.CLASH_API_TOKEN;

// Note: different endpoint for current war vs CWL
const url = `https://api.clashofclans.com/v1/clans/${clanTag}/currentwar`;

fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`
  }
})
  .then(res => {
    if (!res.ok) {
      if (res.status === 404) {
        console.log('⚠️  Clan is not currently in war');
        return null;
      }
      console.error(`Error (${res.status}): ${res.statusText}`);
      return res.text().then(text => {
        console.error(text);
      });
    }
    return res.json();
  })
  .then(data => {
    if (data) {
      console.log('✅ Current War API Response:\n');
      console.log('War State:', data.state);
      console.log('Team Size:', data.teamSize);
      console.log('Start Time:', data.startTime);
      console.log('End Time:', data.endTime);
      console.log('Preparation Start:', data.preparationStartTime);
      console.log('\nFull response:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('No current war data available');
    }
  })
  .catch(err => console.error('Fetch failed:', err));