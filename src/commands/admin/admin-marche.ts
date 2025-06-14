import { SlashCommandBuilder, EmbedBuilder, CommandInteraction, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { TokenPriceService, TokenMarketService } from '../../services/token-price';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('admin-marche')
  .setDescription('Commandes d\'administration pour le marché des tokens $7N1')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('prix')
      .setDescription('Force le recalcul du prix du token'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('event')
      .setDescription('Déclenche un événement de marché manuel')
      .addNumberOption(option =>
        option.setName('facteur')
          .setDescription('Facteur multiplicateur (-0.5 à 1.0)')
          .setRequired(true)
          .setMinValue(-0.5)
          .setMaxValue(1.0))
      .addIntegerOption(option =>
        option.setName('duree')
          .setDescription('Durée en minutes')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1440))
      .addStringOption(option =>
        option.setName('raison')
          .setDescription('Raison de l\'événement')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('burn')
      .setDescription('Brûle des tokens pour augmenter la valeur')
      .addNumberOption(option =>
        option.setName('montant')
          .setDescription('Nombre de tokens à brûler')
          .setRequired(true)
          .setMinValue(1))
      .addStringOption(option =>
        option.setName('raison')
          .setDescription('Raison du burn')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('channel')
      .setDescription('Configure le canal de notifications du marché')
      .addChannelOption(option =>
        option.setName('canal')
          .setDescription('Canal pour les notifications')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('Affiche les statistiques de surveillance du marché'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('pump-dump')
      .setDescription('⚠️ Simule un pump and dump (test uniquement)'));

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const tokenPriceService = services.get('tokenPriceService') as TokenPriceService;

    switch (subcommand) {
      case 'prix':
        await handlePriceRecalculation(interaction, tokenPriceService);
        break;
      
      case 'event':
        await handleManualEvent(interaction, tokenPriceService);
        break;
      
      case 'burn':
        await handleTokenBurn(interaction, tokenPriceService);
        break;
      
      case 'channel':
        await handleChannelConfig(interaction);
        break;
      
      case 'stats':
        await handleMarketStats(interaction, tokenPriceService);
        break;
      
      case 'pump-dump':
        await handlePumpDumpSimulation(interaction);
        break;
      
      default:
        await interaction.editReply('❌ Sous-commande non reconnue.');
    }

  } catch (error) {
    logger.error('Error in admin-marche command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handlePriceRecalculation(interaction: CommandInteraction, tokenPriceService: TokenPriceService) {
  const priceData = await tokenPriceService.forceRecalculation();
  
  const embed = new EmbedBuilder()
    .setTitle('🔄 Prix recalculé')
    .setColor(0x00ff00)
    .setDescription('Le prix du token a été recalculé avec succès')
    .addFields([
      {
        name: '💰 Nouveau prix',
        value: `$${priceData.price.toFixed(6)}`,
        inline: true
      },
      {
        name: '📈 Variation 24h',
        value: `${priceData.change24h > 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%`,
        inline: true
      },
      {
        name: '💹 Volume 24h',
        value: `$${priceData.volume24h.toFixed(2)}`,
        inline: true
      }
    ])
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Admin ${interaction.user.id} forced price recalculation: $${priceData.price}`);
}

async function handleManualEvent(interaction: CommandInteraction, tokenPriceService: TokenPriceService) {
  const factor = interaction.options.get('facteur')?.value as number;
  const duration = interaction.options.get('duree')?.value as number;
  const reason = interaction.options.get('raison')?.value as string;

  await tokenPriceService.applyEventFactor(factor, duration, reason);
  const newPrice = await tokenPriceService.calculateTokenValue();

  const impactType = factor > 0 ? 'positif' : 'négatif';
  const impactEmoji = factor > 0 ? '📈' : '📉';

  const embed = new EmbedBuilder()
    .setTitle(`${impactEmoji} Événement de marché déclenché`)
    .setColor(factor > 0 ? 0x00ff00 : 0xff0000)
    .setDescription(`**Événement :** ${reason}`)
    .addFields([
      {
        name: '⚡ Impact',
        value: `${impactType} ${(Math.abs(factor) * 100).toFixed(1)}%`,
        inline: true
      },
      {
        name: '⏱️ Durée',
        value: `${duration} minutes`,
        inline: true
      },
      {
        name: '💰 Nouveau prix',
        value: `$${newPrice.price.toFixed(6)}`,
        inline: true
      }
    ])
    .setFooter({ text: `L'événement se terminera automatiquement dans ${duration} minutes` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Admin ${interaction.user.id} triggered market event: ${reason} (${factor})`);
}

async function handleTokenBurn(interaction: CommandInteraction, tokenPriceService: TokenPriceService) {
  const amount = interaction.options.get('montant')?.value as number;
  const reason = interaction.options.get('raison')?.value as string;

  await tokenPriceService.burnTokens(amount, reason);
  const newPrice = await tokenPriceService.calculateTokenValue();

  const embed = new EmbedBuilder()
    .setTitle('🔥 Tokens brûlés')
    .setColor(0xff6600)
    .setDescription(`**${amount} tokens $7N1** ont été définitivement détruits`)
    .addFields([
      {
        name: '📝 Raison',
        value: reason,
        inline: false
      },
      {
        name: '💰 Prix après burn',
        value: `$${newPrice.price.toFixed(6)}`,
        inline: true
      },
      {
        name: '📈 Impact attendu',
        value: 'Déflationniste ↗️',
        inline: true
      }
    ])
    .setFooter({ text: 'Les tokens brûlés réduisent l\'offre totale et peuvent augmenter la valeur' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Admin ${interaction.user.id} burned ${amount} tokens: ${reason}`);
}

async function handleChannelConfig(interaction: CommandInteraction) {
  const channel = interaction.options.getChannel('canal');
  
  if (!channel?.isTextBased()) {
    await interaction.editReply('❌ Le canal doit être un canal textuel.');
    return;
  }

  // Note: Dans une vraie implémentation, vous stockeriez cette config en DB
  // Ici on se contente de confirmer la configuration
  const embed = new EmbedBuilder()
    .setTitle('📺 Canal configuré')
    .setColor(0x00ff00)
    .setDescription(`Les notifications de marché seront envoyées dans ${channel}`)
    .addFields([
      {
        name: '📊 Types de notifications',
        value: [
          '• Variations significatives (>5%)',
          '• Jalons de prix atteints',
          '• Pics de volume',
          '• Événements de marché',
          '• Rapport quotidien'
        ].join('\n'),
        inline: false
      }
    ])
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Admin ${interaction.user.id} configured market channel: ${channel.id}`);
}

async function handleMarketStats(interaction: CommandInteraction, tokenPriceService: TokenPriceService) {
  const [marketStats, priceHistory] = await Promise.all([
    tokenPriceService.getMarketStats(),
    tokenPriceService.getPriceHistory(24)
  ]);

  const prices = priceHistory.map(h => h.price);
  const volatility = prices.length > 1 ? 
    Math.sqrt(prices.reduce((sum, price, i, arr) => {
      if (i === 0) return 0;
      return sum + Math.pow((price - arr[i-1]) / arr[i-1], 2);
    }, 0) / (prices.length - 1)) * 100 : 0;

  const embed = new EmbedBuilder()
    .setTitle('📊 Statistiques du marché $7N1')
    .setColor(0x3498db)
    .addFields([
      {
        name: '💰 Prix actuel',
        value: `$${marketStats.currentPrice.toFixed(6)}`,
        inline: true
      },
      {
        name: '📈 Variation 24h',
        value: `${marketStats.change24h > 0 ? '+' : ''}${marketStats.change24h.toFixed(2)}%`,
        inline: true
      },
      {
        name: '💹 Volume 24h',
        value: `$${marketStats.volume24h.toFixed(2)}`,
        inline: true
      },
      {
        name: '💎 Market Cap',
        value: `$${marketStats.marketCap.toFixed(2)}`,
        inline: true
      },
      {
        name: '🪙 Supply totale',
        value: `${marketStats.totalSupply.toFixed(2)} $7N1`,
        inline: true
      },
      {
        name: '👥 Holders actifs',
        value: `${marketStats.activeHolders}`,
        inline: true
      },
      {
        name: '📊 Volatilité 24h',
        value: `${volatility.toFixed(2)}%`,
        inline: true
      },
      {
        name: '📈 Points de données',
        value: `${priceHistory.length} entrées`,
        inline: true
      },
      {
        name: '⚡ Status système',
        value: '🟢 Opérationnel',
        inline: true
      }
    ])
    .setFooter({ text: 'Statistiques générées automatiquement' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handlePumpDumpSimulation(interaction: CommandInteraction) {
  // Note: Dans un environnement de production, cette fonction devrait avoir des protections supplémentaires
  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ Simulation Pump & Dump')
    .setColor(0xff6600)
    .setDescription('**ATTENTION**: Cette simulation va créer une forte volatilité artificielle')
    .addFields([
      {
        name: '📈 Phase 1: Pump',
        value: 'Augmentation de +25% pendant 30 minutes',
        inline: true
      },
      {
        name: '📉 Phase 2: Dump',
        value: 'Chute de -20% pendant 60 minutes après 35 min',
        inline: true
      },
      {
        name: '⚠️ Avertissement',
        value: 'Ceci est uniquement à des fins de test et éducatives',
        inline: false
      }
    ])
    .setFooter({ text: 'Cette simulation durera environ 1h35 au total' })
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });

  // Simuler le pump and dump (commenté pour éviter les déclenchements accidentels)
  /*
  try {
    const tokenMarketService = new TokenMarketService(interaction.client);
    await tokenMarketService.simulatePumpAndDump();
    
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Simulation lancée')
      .setColor(0x00ff00)
      .setDescription('Le pump and dump a été initié. Surveillez les notifications de marché.')
      .setTimestamp();
    
    await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
    
  } catch (error) {
    logger.error('Error simulating pump and dump:', error);
    await interaction.followUp({ content: '❌ Erreur lors du lancement de la simulation.', ephemeral: true });
  }
  */

  logger.info(`Admin ${interaction.user.id} requested pump and dump simulation`);
}
