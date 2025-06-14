// src/commands/game/cours.ts - Version corrigée
import { SlashCommandBuilder, EmbedBuilder, CommandInteraction } from 'discord.js';
import { TokenPriceService } from '../../services/token-price/TokenPriceService';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('cours')
  .setDescription('Affiche le cours actuel du token $7N1 avec historique et tendances')
  .addStringOption(option =>
    option.setName('periode')
      .setDescription('Période d\'historique à afficher')
      .addChoices(
        { name: '1 heure', value: '1' },
        { name: '6 heures', value: '6' },
        { name: '24 heures', value: '24' },
        { name: '7 jours', value: '168' }
      ));

export async function execute(interaction: CommandInteraction, services: Map<string, any>) {
  try {
    await interaction.deferReply();

    const period = parseInt(interaction.options.get('periode')?.value as string || '24');
    
    // Utiliser le service depuis la map des services au lieu de créer une nouvelle instance
    const tokenPriceService = services.get('tokenPrice') as TokenPriceService;
    
    if (!tokenPriceService) {
      throw new Error('TokenPriceService not available');
    }

    // Récupérer les données actuelles du token
    const [priceData, marketStats, priceHistory] = await Promise.all([
      tokenPriceService.calculateTokenValue(),
      tokenPriceService.getMarketStats(),
      tokenPriceService.getPriceHistory(period)
    ]);

    // Calculer les statistiques d'historique
    const prices = priceHistory.map(h => h.price);
    const highPrice = prices.length > 0 ? Math.max(...prices) : priceData.price;
    const lowPrice = prices.length > 0 ? Math.min(...prices) : priceData.price;
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : priceData.price;

    // Préparer les emojis et couleurs
    const trendEmoji = priceData.trend === 'up' ? '📈' : 
                      priceData.trend === 'down' ? '📉' : '📊';
    const changeEmoji = priceData.change24h > 0 ? '🟢' : 
                       priceData.change24h < 0 ? '🔴' : '🟡';
    
    const embedColor = priceData.trend === 'up' ? 0x00ff00 : 
                      priceData.trend === 'down' ? 0xff0000 : 0xffff00;

    // Créer le graphique ASCII simple
    const chartData = priceHistory.slice(-10); // 10 derniers points
    let miniChart = '';
    if (chartData.length > 1) {
      const minPrice = Math.min(...chartData.map(d => d.price));
      const maxPrice = Math.max(...chartData.map(d => d.price));
      const range = maxPrice - minPrice || 1;
      
      miniChart = chartData.map(data => {
        const normalized = (data.price - minPrice) / range;
        const height = Math.floor(normalized * 5);
        return ['▁', '▂', '▃', '▄', '▅', '▆'][height] || '▁';
      }).join('');
    }

    // Créer l'embed principal
    const embed = new EmbedBuilder()
      .setTitle(`📊 Cours du Token $7N1`)
      .setColor(embedColor)
      .setDescription(`${trendEmoji} **Prix actuel: $${priceData.price.toFixed(6)}**`)
      .addFields([
        {
          name: '📈 Variation 24h',
          value: `${changeEmoji} **${priceData.change24h > 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%**`,
          inline: true
        },
        {
          name: '💹 Volume 24h',
          value: `**$${priceData.volume24h.toFixed(2)}**`,
          inline: true
        },
        {
          name: '💎 Market Cap',
          value: `**$${priceData.marketCap.toFixed(2)}**`,
          inline: true
        }
      ]);

    // Ajouter les statistiques de période
    embed.addFields([
      {
        name: `📊 Statistiques ${period}h`,
        value: [
          `🔴 Plus haut: $${highPrice.toFixed(6)}`,
          `🟢 Plus bas: $${lowPrice.toFixed(6)}`,
          `📊 Moyenne: $${avgPrice.toFixed(6)}`
        ].join('\n'),
        inline: true
      },
      {
        name: '📈 Données du marché',
        value: [
          `🪙 Supply: ${marketStats.totalSupply.toFixed(2)} $7N1`,
          `👥 Holders: ${marketStats.activeHolders}`,
          `💰 Prix moyen: $${avgPrice.toFixed(6)}`
        ].join('\n'),
        inline: true
      },
      {
        name: '🎯 Facteurs de prix',
        value: [
          `📊 Tokens détenus: ${priceData.factors.totalHeld.toFixed(2)}`,
          `⛏️ Minés 24h: ${priceData.factors.totalMined24h.toFixed(2)}`,
          `🔥 Bonus actuel: ${(priceData.factors.bonusFactor * 100).toFixed(1)}%`
        ].join('\n'),
        inline: false
      }
    ]);

    // Ajouter le mini graphique si disponible
    if (miniChart) {
      embed.addFields([
        {
          name: `📈 Tendance ${period}h`,
          value: `\`${miniChart}\``,
          inline: false
        }
      ]);
    }

    // Ajouter des informations sur la formule de calcul
    embed.addFields([
      {
        name: '🧮 Formule de calcul',
        value: [
          '`Prix = Base × (1 + Hold/Total) × (1 - Mined/Total) × (1 + Bonus)`',
          '',
          '• **Hold Factor**: Plus de tokens détenus = prix plus élevé',
          '• **Mining Factor**: Plus de minage récent = pression baissière',
          '• **Bonus Factor**: Événements et facteurs spéciaux'
        ].join('\n'),
        inline: false
      }
    ]);

    // Analyser la tendance et donner des conseils
    let advice = '';
    if (priceData.change24h > 5) {
      advice = '🚀 **Forte hausse** - Moment favorable pour vendre !';
    } else if (priceData.change24h < -5) {
      advice = '📉 **Forte baisse** - Opportunité d\'achat !';
    } else if (priceData.trend === 'up') {
      advice = '📈 **Tendance haussière** - Croissance stable';
    } else if (priceData.trend === 'down') {
      advice = '📉 **Tendance baissière** - Prudence conseillée';
    } else {
      advice = '📊 **Marché stable** - Période de consolidation';
    }

    embed.addFields([
      {
        name: '💡 Analyse de marché',
        value: advice,
        inline: false
      }
    ]);

    embed.setFooter({ 
      text: `💰 Dernière mise à jour • Utilisez /wallet pour voir votre portefeuille`,
      iconURL: interaction.client.user?.displayAvatarURL()
    }).setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`User ${interaction.user.id} checked token price: $${priceData.price} (${priceData.change24h}%)`);

  } catch (error) {
    logger.error('Error in cours command:', error);
    
    // Message d'erreur plus détaillé pour le debug
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Service Temporairement Indisponible')
      .setDescription([
        'Le service de cours des tokens est en cours de configuration.',
        '',
        '💡 **Systèmes disponibles** :',
        '• `/profile` - Votre profil',
        '• `/balance` - Vos soldes',
        '• `/salaire` - Salaire hebdomadaire',
        '• `/help` - Guide complet'
      ].join('\n'))
      .addFields([
        {
          name: '🔧 Information technique',
          value: `Erreur: ${errorMessage}`,
          inline: false
        }
      ])
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}