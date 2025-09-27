require('dotenv').config();
const { Events, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const apiClient = require('../utils/apiClient');

// Timeout wrapper for editReply operations
async function withTimeout(promise, timeoutMs = 30000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
  );

  return Promise.race([promise, timeoutPromise]);
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    }
  }
};

async function handleCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ No command matching ${interaction.commandName} was found.`);
    return;
  }

  const { cooldowns } = interaction.client;

  if (!cooldowns.has(command.data.name)) {
    cooldowns.set(command.data.name, new Map());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.data.name);
  const cooldownAmount = (command.cooldown || 3) * 1000;

  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

    if (now < expirationTime) {
      const expiredTimestamp = Math.round(expirationTime / 1000);
      return interaction.reply({
        content: `⏰ Please wait, you are on cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }

  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing ${interaction.commandName}:`, error);

    if (interaction.replied || interaction.deferred) {
      try {
        await interaction.followUp({
          content: '❌ There was an error while executing this command!',
          flags: MessageFlags.Ephemeral
        });
      } catch (followUpError) {
        console.error('❌ Failed to send follow-up error:', followUpError);
      }
    } else {
      try {
        await interaction.reply({
          content: '❌ There was an error while executing this command!',
          flags: MessageFlags.Ephemeral
        });
      } catch (replyError) {
        console.error('❌ Failed to send error reply:', replyError);
      }
    }
  }
}

async function handleButton(interaction) {
  const { customId } = interaction;

  try {
    switch (customId) {
      case 'getscript':
        await handleGetScript(interaction);
        break;
      case 'resethwid':
        await handleResetHWID(interaction);
        break;
      case 'getstats':
        await handleGetStats(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown button interaction.',
          flags: MessageFlags.Ephemeral
        });
    }
  } catch (error) {
    console.error(`❌ Error handling button ${customId}:`, error);

    try {
      await interaction.reply({
        content: '❌ There was an error handling this button!',
        flags: MessageFlags.Ephemeral
      });
    } catch (replyError) {
      console.error('❌ Failed to send button error reply:', replyError);
    }
  }
}

async function handleGetScript(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const keyData = await withTimeout(apiClient.getUserKey(interaction.user.id));
    if (!keyData) {
      return await withTimeout(interaction.editReply({
        content: '❌ No license key found for you. Please contact an administrator to get whitelisted!'
      }));
    }

    const script = `script_key = "${keyData.key}"\nloadstring(game:HttpGet("https://pandadevelopment.net/virtual/file/bbdc6394c2d24216"))()`;

    await withTimeout(interaction.editReply({
      content: `🔑 **Your Script:**\n\`\`\`lua\n${script}\n\`\`\`\n\n **Instructions:**\n1. Copy the entire script\n2. Paste it into your executor\n3. Run and enjoy! 🎉`
    }));

    console.log(`📜 Script provided to ${interaction.user.tag} (${interaction.user.id})`);
  } catch (error) {
    console.error('❌ Get script error:', error);

    try {
      if (error.message === 'Operation timed out') {
        await interaction.editReply({
          content: '❌ Request timed out. Please try again shortly.'
        });
      } else {
        await interaction.editReply({
          content: '❌ Failed to fetch your script. Please try again later.'
        });
      }
    } catch (editError) {
      console.error('❌ Failed to edit reply:', editError);
    }
  }
}

async function handleResetHWID(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const keyData = await withTimeout(apiClient.getUserKey(interaction.user.id));
    if (!keyData) {
      return await withTimeout(interaction.editReply({
        content: '❌ No license key found for you.'
      }));
    }

    const result = await withTimeout(apiClient.resetHWID(keyData.key));

    if (result.cooldown) {
      return await withTimeout(interaction.editReply({
        content: `⏰ HWID reset is on cooldown! Please wait ${result.cooldownText}.`
      }));
    }

    await withTimeout(interaction.editReply({
      content: '✅ HWID reset successfully! You can now use the script on any device. 🎮'
    }));

    console.log(`🔄 HWID reset for ${interaction.user.tag} (${interaction.user.id})`);
  } catch (error) {
    console.error('❌ HWID reset error:', error);

    try {
      if (error.message === 'Operation timed out') {
        await interaction.editReply({
          content: '❌ Request timed out. Please try again shortly.'
        });
      } else {
        await interaction.editReply({
          content: '❌ Failed to reset HWID. Please contact an administrator.'
        });
      }
    } catch (editError) {
      console.error('❌ Failed to edit reply:', editError);
    }
  }
}

async function handleGetStats(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const keyData = await withTimeout(apiClient.getUserKey(interaction.user.id));
    if (!keyData) {
      return await withTimeout(interaction.editReply({
        content: '❌ No license key found for you.'
      }));
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Your License Statistics')
      .setColor(16777215)
      .addFields(
        { name: '🔑 License Key', value: `\`${keyData.key}\``, inline: false },
        { name: '👤 User ID', value: keyData.userId, inline: true },
        { name: '⭐ Premium', value: keyData.isPremium ? '✅ Yes' : '❌ No', inline: true },
        { name: '📅 Created', value: keyData.createdAt || 'Unknown', inline: true },
        { name: '📆 Expires', value: keyData.expiresAt || 'Unknown', inline: true },
        { name: '🔒 HWID Locked', value: keyData.hwid ? '✅ Yes' : '❌ No', inline: true }
      )
      .setFooter({ text: '© Aroel — Service & Purchase' })
      .setTimestamp();

    await withTimeout(interaction.editReply({ embeds: [embed] }));

    console.log(`📊 Stats viewed by ${interaction.user.tag} (${interaction.user.id})`);
  } catch (error) {
    console.error('❌ Get stats error:', error);

    try {
      if (error.message === 'Operation timed out') {
        await interaction.editReply({
          content: '❌ Request timed out. Please try again shortly.'
        });
      } else {
        await interaction.editReply({
          content: '❌ Failed to fetch your statistics.'
        });
      }
    } catch (editError) {
      console.error('❌ Failed to edit reply:', editError);
    }
  }
}