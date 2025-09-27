require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const apiClient = require('../utils/apiClient');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('extend')
    .setDescription('Extend a user\'s license key duration')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to extend license for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('days')
        .setDescription('Additional days to add')
        .setMinValue(1)
        .setMaxValue(365)
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      if (interaction.user.id !== process.env.OWNER_ID) {
        return interaction.reply({
          content: '❌ You do not have permission to use this command.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply();

      const user = interaction.options.getUser('user');
      const additionalDays = interaction.options.getInteger('days');

      const existingKey = await apiClient.getUserKey(user.id);
      if (!existingKey) {
        return interaction.editReply({
          content: `❌ ${user} does not have a license key to extend. Use /whitelist first.`
        });
      }

      const extensionResult = await apiClient.extendLicense({
        keyValue: existingKey.key,
        additionalDays,
        userId: user.id
      });

      if (!extensionResult.success) {
        return interaction.editReply({
          content: `❌ Failed to extend license: ${extensionResult.error}`
        });
      }

      const privateEmbed = new EmbedBuilder()
        .setTitle('⏰ License Extended!')
        .setDescription(`Your AroelHub license has been successfully extended!`)
        .setColor(0x0099ff)
        .setThumbnail('https://i.imgur.com/DuHRxNx.png')
        .addFields(
          { name: '🔑 License Key', value: `\`${existingKey.key}\``, inline: false },
          { name: '➕ Days Added', value: `${additionalDays} days`, inline: true },
          { name: '📆 New Expiry', value: extensionResult.newExpiryDate, inline: true },
          { name: '⏰ Total Duration', value: `${extensionResult.totalDays} days`, inline: true }
        )
        .setFooter({ text: '© Aroel - Premium Service' })
        .setTimestamp();

      await user.send({ embeds: [privateEmbed] }).catch(() => {});

      await interaction.editReply({
        content: `✅ Successfully extended ${user}'s license by ${additionalDays} days! ⏰`
      });

      console.log(`✅ Extended license for ${user.tag} (${user.id}) by ${additionalDays} days`);

    } catch (error) {
      console.error('❌ Extend command error:', error);

      try {
        await interaction.editReply({
          content: `❌ An error occurred: ${error.message}`
        });
      } catch (replyError) {
        console.error('❌ Failed to send error reply:', replyError);
      }
    }
  }
};