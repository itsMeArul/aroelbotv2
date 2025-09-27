require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purchase')
    .setDescription('Show payment info and instructions'),

  async execute(interaction) {
    try {
      const embed1 = new EmbedBuilder()
        .setTitle('— PURCHASE')
        .setDescription(
          'Tips: Don\'t forget to check **prices** and **stock** at https://discord.com/channels/1395998086152847483/1403983937516343417 and **discounts** at https://discord.com/channels/1395998086152847483/1403984284930543676'
        )
        .setColor(16777215)
        .setFooter({
          text: '© Aroel',
          iconURL: 'https://yt3.googleusercontent.com/oKQxVI010a-oqeC-sdjYnhMf8DXqyhybw-iDc4HyxKzqKKV3SIRr2wqPGbvnhHrV-Iu3MzrdWg=s1920-c-k-c0x00ffffff-no-rj'
        })
        .setImage('https://i.imgur.com/mgPdfjp.png')
        .setAuthor({ name: 'Aroel — Service & Purchase' })
        .addFields({
          name: '— PAYMENT METHODS',
          value:
            '> QRIS (Scan the QR code below)\n > DANA \n > BANK JAGO \n > PayPal \n\nFor payment methods other than QRIS, please tag the admin.'
        })
        .setTimestamp();

      const embed2 = new EmbedBuilder()
        .setAuthor({ name: 'Aroel — Service & Purchase' })
        .setColor(16777215)
        .setTitle('— PURCHASE')
        .addFields({
          name: '',
          value:
            'EN:\nIf you have made the payment, please send the transfer receipt here.\n\nID:\nJika Anda telah melakukan pembayaran, silakan kirimkan bukti transfer ke sini.'
        })
        .setImage('https://i.imgur.com/DuHRxNx.png')
        .setFooter({
          text: '© Aroel',
          iconURL: 'https://yt3.googleusercontent.com/oKQxVI010a-oqeC-sdjYnhMf8DXqyhybw-iDc4HyxKzqKKV3SIRr2wqPGbvnhHrV-Iu3MzrdWg=s1920-c-k-c0x00ffffff-no-rj'
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed1, embed2]
      });

    } catch (error) {
      console.error('❌ Purchase command error:', error);

      if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
        return;
      }

      try {
        await interaction.reply({
          content: `❌ An error occurred: ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      } catch (replyError) {
        console.error('❌ Failed to send error reply:', replyError);
      }
    }
  }
};