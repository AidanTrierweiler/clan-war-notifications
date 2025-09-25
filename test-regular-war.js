// Test file with mock regular war data for development
// This simulates different war states without needing an active war

console.log('🧪 Testing Regular War Bot Logic with Mock Data\n');

// Mock war data for different scenarios
const mockWarData = {
  preparation: {
    state: "preparation",
    teamSize: 15,
    attacksPerMember: 2,
    startTime: "2025-09-25T18:00:00.000Z",
    endTime: "2025-09-26T18:00:00.000Z", 
    preparationStartTime: "2025-09-25T06:00:00.000Z",
    clan: {
      tag: "#2Y9L0VVL0",
      name: "Test Clan",
      badgeUrls: {
        small: "https://api-assets.clashofclans.com/badges/70/badge.png"
      },
      clanLevel: 15,
      attacks: 0,
      stars: 0,
      destructionPercentage: 0.0,
      members: [
        {
          tag: "#PLAYER1",
          name: "Player 1",
          townhallLevel: 15,
          mapPosition: 1,
          attacks: [],
          opponentAttacks: 0,
          bestOpponentAttack: null
        }
      ]
    },
    opponent: {
      tag: "#OPPONENT",
      name: "Enemy Clan",
      badgeUrls: {
        small: "https://api-assets.clashofclans.com/badges/70/badge2.png"
      },
      clanLevel: 14,
      attacks: 0,
      stars: 0,
      destructionPercentage: 0.0,
      members: [
        {
          tag: "#ENEMY1",
          name: "Enemy 1",
          townhallLevel: 14,
          mapPosition: 1,
          attacks: [],
          opponentAttacks: 0,
          bestOpponentAttack: null
        }
      ]
    }
  },
  
  inWar: {
    state: "inWar",
    teamSize: 15,
    attacksPerMember: 2,
    startTime: "2025-09-25T18:00:00.000Z",
    endTime: "2025-09-26T18:00:00.000Z",
    preparationStartTime: "2025-09-25T06:00:00.000Z",
    clan: {
      tag: "#2Y9L0VVL0",
      name: "Test Clan",
      badgeUrls: {
        small: "https://api-assets.clashofclans.com/badges/70/badge.png"
      },
      clanLevel: 15,
      attacks: 5,
      stars: 12,
      destructionPercentage: 65.5,
      members: [
        {
          tag: "#PLAYER1",
          name: "Player 1",
          townhallLevel: 15,
          mapPosition: 1,
          attacks: [
            {
              attackerTag: "#PLAYER1",
              defenderTag: "#ENEMY1",
              stars: 3,
              destructionPercentage: 100,
              order: 1
            }
          ],
          opponentAttacks: 0,
          bestOpponentAttack: null
        }
      ]
    },
    opponent: {
      tag: "#OPPONENT",
      name: "Enemy Clan",
      badgeUrls: {
        small: "https://api-assets.clashofclans.com/badges/70/badge2.png"
      },
      clanLevel: 14,
      attacks: 3,
      stars: 8,
      destructionPercentage: 45.2,
      members: [
        {
          tag: "#ENEMY1",
          name: "Enemy 1",
          townhallLevel: 14,
          mapPosition: 1,
          attacks: [],
          opponentAttacks: 1,
          bestOpponentAttack: {
            attackerTag: "#PLAYER1",
            defenderTag: "#ENEMY1", 
            stars: 3,
            destructionPercentage: 100,
            order: 1
          }
        }
      ]
    }
  },

  warEnded: {
    state: "warEnded",
    teamSize: 15,
    attacksPerMember: 2,
    startTime: "2025-09-24T18:00:00.000Z",
    endTime: "2025-09-25T18:00:00.000Z",
    preparationStartTime: "2025-09-24T06:00:00.000Z",
    clan: {
      tag: "#2Y9L0VVL0",
      name: "Test Clan",
      badgeUrls: {
        small: "https://api-assets.clashofclans.com/badges/70/badge.png"
      },
      clanLevel: 15,
      attacks: 30,
      stars: 42,
      destructionPercentage: 89.7,
      members: []
    },
    opponent: {
      tag: "#OPPONENT",
      name: "Enemy Clan", 
      badgeUrls: {
        small: "https://api-assets.clashofclans.com/badges/70/badge2.png"
      },
      clanLevel: 14,
      attacks: 28,
      stars: 38,
      destructionPercentage: 82.3,
      members: []
    }
  }
};

// Test function to simulate bot logic
function testWarState(stateName, warData) {
  console.log(`\n🔥 Testing ${stateName.toUpperCase()} state:`);
  console.log(`War State: ${warData.state}`);
  console.log(`Team Size: ${warData.teamSize}`);
  console.log(`Our Clan: ${warData.clan.name} (${warData.clan.attacks} attacks, ${warData.clan.stars} stars)`);
  console.log(`Enemy Clan: ${warData.opponent.name} (${warData.opponent.attacks} attacks, ${warData.opponent.stars} stars)`);
  
  if (warData.state === 'preparation') {
    console.log('📅 War starts at:', new Date(warData.startTime).toLocaleString());
  } else if (warData.state === 'inWar') {
    console.log('⚔️  War is active! Ends at:', new Date(warData.endTime).toLocaleString());
  } else if (warData.state === 'warEnded') {
    const ourStars = warData.clan.stars;
    const enemyStars = warData.opponent.stars;
    const result = ourStars > enemyStars ? 'WON' : ourStars < enemyStars ? 'LOST' : 'TIED';
    console.log(`🏆 War ended - We ${result}! (${ourStars} vs ${enemyStars} stars)`);
  }
}

// Run tests for all war states
Object.keys(mockWarData).forEach(state => {
  testWarState(state, mockWarData[state]);
});

console.log('\n✅ Mock war data testing complete!');

module.exports = { mockWarData };