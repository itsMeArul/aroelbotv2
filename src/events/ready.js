const { Events, ActivityType } = require('discord.js');
const apiClient = require('../utils/apiClient');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`🚀 AroelBot V2 is ready to serve!`);

    await updateRichPresence(client);
    setInterval(() => updateRichPresence(client), 30000);

    console.log('📊 Rich presence updates enabled');
  }
};

async function updateRichPresence(client) {
  try {
    const executionCount = await apiClient.getExecutionCount();

    const activities = [
      {
        name: `${executionCount} total executions`,
        type: ActivityType.Watching
      },
      {
        name: 'best script CDID',
        type: ActivityType.Playing
      },
      {
        name: 'light, stable, and customizable script',
        type: ActivityType.Playing
      }
    ];

    const randomActivity = activities[Math.floor(Math.random() * activities.length)];

    await client.user.setActivity(randomActivity);

    console.log(`📊 Updated presence: ${randomActivity.type === ActivityType.Watching ? 'Watching' : 'Playing'} ${randomActivity.name}`);
  } catch (error) {
    console.error('❌ Error updating rich presence:', error);
  }
}