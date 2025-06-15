import { SlashCommandBuilder, EmbedBuilder, CommandInteraction } from 'discord.js';
import { TokenPriceService } from '../../services/token-price/TokenPriceService';
import { DatabaseService } from '../../services/database/DatabaseService';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('echanger')
  .setDescription('Échange des dollars contre des tokens $7N1 ou vice versa')
  .addStringOption(option =>
    option.setName('direction')
      .setDescription('Direction de l\'échange')
      .setRequired(true)
      .addChoices(
        { name: '💵 → 🪙 Dollars vers $7N1', value: 'dollars_to_tokens' },
        { name: '🪙 → 💵 $7N1 vers Dollars', value: 'tokens_to_dollars' }
      ))
  .addNumberOption(option =>
    option.setName('montant')
      .setDescription('Montant à échanger')
      .setRequired(true)
      .setMinValue(0.01));

export async function execute(interaction: CommandInteraction, services: Map<string, any>) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const direction = interaction.options.get('direction')?.value as string;
    const amount = interaction.options.get('montant')?.value as number;

    // Get services from dependency injection
    const tokenPriceService = services.get('tokenPrice') as TokenPriceService;
    const db = services.get('database') as DatabaseService;

    // Récupérer l'utilisateur
    const user = await db.getUser(userId);
    if (!user) {
      await interaction.editReply('❌ Utilisateur non trouvé. Veuillez d\'abord utiliser une commande pour vous enregistrer.');
      return;
    }

    // Récupérer le prix actuel du token
    const priceData = await tokenPriceService.calculateTokenValue();

    let embed: EmbedBuilder;
    let newDollars: number;
    let newTokens: number;
    let exchangedAmount: number;
    let exchangeRate: string;

    if (direction === 'dollars_to_tokens') {
      // Dollars vers tokens
      if (user.dollars < amount) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Solde insuffisant')
          .setDescription(`Vous n'avez que **$${user.dollars.toFixed(2)}** disponibles.`)
          .addFields([
            {
              name: '💡 Comment gagner des dollars ?',
              value: [
                '• Participer aux discussions Discord',
                '• Réagir aux messages',
                '• Passer du temps en vocal',
                '• Connexion quotidienne avec bonus streak'
              ].join('\n')
            }
          ])
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Calculer les tokens reçus
      exchangedAmount = amount / priceData.price;
      newDollars = user.dollars - amount;
      newTokens = user.tokens + exchangedAmount;
      exchangeRate = `$${priceData.price.toFixed(6)} par $7N1`;

      // Créer l'embed de confirmation
      embed = new EmbedBuilder()
        .setTitle('✅ Échange réussi : $ → $7N1')
        .setColor(0x00ff00)
        .setDescription(`Vous avez échangé **$${amount.toFixed(2)}** contre **${exchangedAmount.toFixed(6)} $7N1**`)
        .addFields([
          {
            name: '💱 Taux de change',
            value: exchangeRate,
            inline: true
          },
          {
            name: '💵 Nouveau solde $',
            value: `$${newDollars.toFixed(2)}`,
            inline: true
          },
          {
            name: '🪙 Nouveau solde $7N1',
            value: `${newTokens.toFixed(6)} $7N1`,
            inline: true
          }
        ]);

    } else {
      // Tokens vers dollars
      if (user.tokens < amount) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Solde insuffisant')
          .setDescription(`Vous n'avez que **${user.tokens.toFixed(6)} $7N1** disponibles.`)
          .addFields([
            {
              name: '💡 Comment gagner des tokens ?',
              value: [
                '• Acheter des machines de minage',
                '• Miner activement des tokens',
                '• Participer aux battles royales',
                '• Échanger des dollars contre des tokens'
              ].join('\n')
            }
          ])
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Calculer les dollars reçus (avec une petite commission de 1%)
      const commission = 0.01; // 1% de commission
      exchangedAmount = (amount * priceData.price) * (1 - commission);
      newDollars = user.dollars + exchangedAmount;
      newTokens = user.tokens - amount;
      exchangeRate = `$${priceData.price.toFixed(6)} par $7N1 (commission 1%)`;

      // Créer l'embed de confirmation
      embed = new EmbedBuilder()
        .setTitle('✅ Échange réussi : $7N1 → $')
        .setColor(0x00ff00)
        .setDescription(`Vous avez échangé **${amount.toFixed(6)} $7N1** contre **$${exchangedAmount.toFixed(6)}**`)
        .addFields([
          {
            name: '💱 Taux de change',
            value: exchangeRate,
            inline: true
          },
          {
            name: '🪙 Nouveau solde $7N1',
            value: `${newTokens.toFixed(6)} $7N1`,
            inline: true
          },
          {
            name: '💵 Nouveau solde $',
            value: `$${newDollars.toFixed(2)}`,
            inline: true
          }
        ]);
    }

    // Ajouter des infos sur le marché
    const trendEmoji = priceData.trend === 'up' ? '📈' : 
                      priceData.trend === 'down' ? '📉' : '📊';
    const changeEmoji = priceData.change24h > 0 ? '🟢' : 
                       priceData.change24h < 0 ? '🔴' : '🟡';

    embed.addFields([
      {
        name: '📊 État du marché',
        value: [
          `${trendEmoji} Prix: $${priceData.price.toFixed(6)}`,
          `${changeEmoji} 24h: ${priceData.change24h > 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%`,
          `💹 Volume: $${priceData.volume24h.toFixed(2)}`
        ].join('\n'),
        inline: false
      }
    ]);

    embed.setFooter({ 
      text: `💡 Le prix du $7N1 fluctue selon l'offre et la demande`,
      iconURL: interaction.client.user?.displayAvatarURL()
    }).setTimestamp();

    // Mettre à jour la base de données
    await db.updateUser(userId, {
      dollars: newDollars,
      tokens: newTokens
    });

    // Enregistrer la transaction
    const transactionType = direction === 'dollars_to_tokens' ? 'DOLLAR_EXCHANGE' : 'TOKEN_PURCHASE';
    const transactionAmount = direction === 'dollars_to_tokens' ? exchangedAmount : -amount;
    const transactionDescription = direction === 'dollars_to_tokens' ? 
      `Échange $${amount} → ${exchangedAmount.toFixed(6)} $7N1` :
      `Échange ${amount.toFixed(6)} $7N1 → $${exchangedAmount.toFixed(6)}`;

    await db.getClient().transaction.create({
      data: {
        userId,
        type: transactionType,
        amount: transactionAmount,
        description: transactionDescription,
        metadata: {
          exchangeRate: priceData.price,
          direction,
          originalAmount: amount,
          commission: direction === 'tokens_to_dollars' ? amount * priceData.price * 0.01 : 0
        }
      }
    });

    await interaction.editReply({ embeds: [embed] });

    logger.info(`User ${userId} exchanged ${direction}: ${amount} at rate ${priceData.price}`);

  } catch (error) {
    logger.error('Error in echanger command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Erreur')
      .setDescription('Impossible d\'effectuer l\'échange. Veuillez réessayer.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
