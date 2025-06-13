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

    if (!user) {
      // Rediriger vers l'inscription au lieu de créer automatiquement
      const notRegisteredEmbed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('💰 Portefeuille non trouvé')
        .setDescription(`**${interaction.user.displayName || interaction.user.username}**, vous n'avez pas encore de portefeuille de mineur!`)
        .addFields(
          {
            name: '🎮 Comment créer votre portefeuille?',
            value: 'Utilisez la commande `/register` pour vous inscrire et obtenir votre premier portefeuille!',
            inline: false
          },
          {
            name: '🎁 Bonus d\'inscription',
            value: '• 🔧 Machine Basic Rig gratuite\n• ⚡ 100 points d\'énergie\n• 🏠 Lieu de départ personnel\n• 💰 Prêt à commencer le minage!',
            inline: false
          },
          {
            name: '💡 Comment gagner de l\'argent?',
            value: '• **Messages Discord**: +1$ par message\n• **Réactions**: +0.5$ par réaction\n• **Vocal**: +2$/heure\n• **Minage**: Tokens automatiques avec vos machines!',
            inline: false
          }
        )
        .setFooter({ text: 'Tapez /register pour commencer votre aventure!' })
        .setTimestamp();

      await interaction.reply({ embeds: [notRegisteredEmbed], ephemeral: true });
      return;
    }

    const dollarBalance = await activityService.getUserDollarBalance(interaction.user.id);

    // Calculate approximate dollar to token exchange rate
    const exchangeRate = 10; // 10$ = 1 token
    const potentialTokens = dollarBalance / exchangeRate;

    const embed = new EmbedBuilder()
      .setColor(user.tokens > 500 ? 0xFFD700 : 0x00AE86)
      .setTitle(`💰 Portefeuille de ${user.username}`)
      .setDescription(user.tokens > 1000 ? '🤑 Riche mineur!' : '💪 En route vers la richesse!')
      .addFields(
        { name: '📍 Lieu', value: user.location || 'Chambre chez maman', inline: true },
        { name: '🪙 Tokens', value: `**${user.tokens.toFixed(2)}**`, inline: true },
        { name: '💵 Dollars', value: `**${dollarBalance.toFixed(2)}$**`, inline: true },
        { name: '📈 Valeur totale', value: `~${(user.tokens + potentialTokens).toFixed(2)} tokens`, inline: true },
        { name: '🔥 Statut', value: user.miningActive ? '⛏️ En minage' : '😴 Inactif', inline: true }
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
          value: dollarBalance >= exchangeRate ? '🔄 Utilisez `/exchange` pour convertir!' : user.tokens >= 100 ? '⛏️ Achetez une machine avec `/shop`!' : '💬 Chattez pour gagner des $!',
          inline: true
        }
      )
      .setFooter({ text: 'Utilisez /exchange pour convertir $ → tokens | /help pour toutes les commandes' })
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