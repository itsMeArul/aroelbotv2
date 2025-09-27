require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { PelindaJS } = require('pelindajs');
const apiClient = require('../utils/apiClient');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Whitelist a user and generate a license key')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to whitelist')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('plan')
        .setDescription('Plan type: weekly or monthly')
        .addChoices(
          { name: 'Weekly (7 days)', value: 'weekly' },
          { name: 'Monthly (30 days)', value: 'monthly' }
        )
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('duration')
        .setDescription('Custom duration in days')
        .setMinValue(1)
        .setMaxValue(365)
        .setRequired(false)
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
      const plan = interaction.options.getString('plan');
      const duration = interaction.options.getInteger('duration');

      let days, planName;

      if (plan === 'weekly') {
        days = 7;
        planName = 'Weekly Plan';
      } else if (plan === 'monthly') {
        days = 30;
        planName = 'Monthly Plan';
      } else if (duration) {
        days = duration;
        planName = `${duration} days (Custom)`;
      } else {
        return interaction.editReply({
          content: '❌ You must specify a plan or custom duration.'
        });
      }

      const existingKey = await apiClient.getUserKey(user.id);
      if (existingKey) {
        return interaction.editReply({
          content: `❌ ${user} already has a license key: \`${existingKey.key}\``
        });
      }

      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + days);

      const generatedKey = await apiClient.generateLicenseKey({
        userId: user.id,
        expireDate: expireDate.toISOString().split('T')[0],
        days,
        planName
      });

      if (!generatedKey.success) {
        return interaction.editReply({
          content: `❌ Failed to generate license key: ${generatedKey.error}`
        });
      }

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (member && process.env.CUSTOMER_ROLE_ID) {
        await member.roles.add(process.env.CUSTOMER_ROLE_ID).catch(console.error);
      }

      const privateEmbed = new EmbedBuilder()
        .setTitle('🎉 You Have Been Whitelisted!')
        .setDescription('Your AroelHub license has been successfully activated!')
        .setColor(0x00ff00)
        .setThumbnail('https://i.imgur.com/DuHRxNx.png')
        .addFields(
          { name: '🔑 License Key', value: `\`${generatedKey.key}\``, inline: false },
          { name: '📅 Plan', value: planName, inline: true },
          { name: '⏰ Duration', value: `${days} days`, inline: true },
          { name: '📆 Expires', value: expireDate.toLocaleDateString(), inline: true },
          { name: '📖 Guide', value:
            '1. Go to the script channel\n' +
            '2. Click **Get Script** button\n' +
            '3. Copy and run the script',
            inline: false
          }
        )
        .setFooter({ text: '© Aroel - Premium Service' })
        .setTimestamp();

      await user.send({ embeds: [privateEmbed] }).catch(() => {});

      await interaction.editReply({
        content: `✅ ${user} has been whitelisted with ${planName}! 🎉`
      });

      console.log(`✅ Whitelisted ${user.tag} (${user.id}) with ${planName}`);

    } catch (error) {
      console.error('❌ Whitelist command error:', error);

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