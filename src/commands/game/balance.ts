import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ActivityService } from '../../services/activity/ActivityService';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Affiche votre solde en tokens et dollars');

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const activityService = services.get('activity') as ActivityService;
    const databaseService = services.get('database');
    
    // Get user data
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id }
    });

    const dollarBalance = await activityService.getUserDollarBalance(interaction.user.id);

    if (!user) {
      // Create user if doesn't exist
      await databaseService.client.user.create({
        data: {
          discordId: interaction.user.id,
          username: interaction.user.displayName || interaction.user.username,
          tokens: 100.0
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('💰 Votre Portefeuille')
        .setDescription('Nouveau compte créé!')
        .addFields(
          { name: '🪙 Tokens', value: '100.00', inline: true },
          { name: '💵 Dollars', value: `${dollarBalance.toFixed(2)}$`, inline: true },
          { name: '📊 Total', value: `100.00 tokens + ${dollarBalance.toFixed(2)}$`, inline: false }
        )
        .addFields({
          name: '💡 Comment gagner?',
          value: '• **Messages**: +1$ par message\n• **Réactions**: +0.5$ par réaction\n• **Vocal**: +2$/heure\n• **Minage**: Achetez des machines avec vos tokens!',
          inline: false
        })
        .setFooter({ text: 'Bientôt: Échange de dollars contre tokens!' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Calculate approximate dollar to token exchange rate
    const exchangeRate = 10; // 10$ = 1 token (exemple)
    const potentialTokens = dollarBalance / exchangeRate;

    const embed = new EmbedBuilder()
      .setColor(user.tokens > 500 ? 0xFFD700 : 0x00AE86)
      .setTitle(`💰 Portefeuille de ${user.username}`)
      .setDescription(user.tokens > 1000 ? '🤑 Riche mineur!' : '💪 En route vers la richesse!')
      .addFields(
        { name: '🪙 Tokens', value: `**${user.tokens.toFixed(2)}**`, inline: true },
        { name: '💵 Dollars', value: `**${dollarBalance.toFixed(2)}$**`, inline: true },
        { name: '📈 Valeur totale', value: `~${(user.tokens + potentialTokens).toFixed(2)} tokens`, inline: true }
      )
      .addFields(
        { 
          name: '🔄 Taux d\'échange', 
          value: `${exchangeRate}$ = 1 token\nVous pouvez obtenir ~${potentialTokens.toFixed(2)} tokens`, 
          inline: false 
        },
        {
          name: '📊 Répartition',
          value: `🪙 Tokens: ${((user.tokens / (user.tokens + potentialTokens)) * 100 || 0).toFixed(1)}%\n💵 Dollars: ${((potentialTokens / (user.tokens + potentialTokens)) * 100 || 0).toFixed(1)}%`,
          inline: true
        },
        {
          name: '💡 Prochaines étapes',
          value: user.tokens >= 100 ? '⛏️ Achetez une machine!' : '💬 Chattez pour gagner des $!',
          inline: true
        }
      )
      .setFooter({ text: 'Utilisez /help pour voir toutes les commandes' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in balance command:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors de l\'affichage de votre solde.',
      ephemeral: true
    });
  }
}