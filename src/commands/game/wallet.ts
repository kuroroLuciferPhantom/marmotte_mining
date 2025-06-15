import { SlashCommandBuilder, EmbedBuilder, CommandInteraction } from 'discord.js';
import { TokenPriceService } from '../../services/token-price/TokenPriceService';
import { DatabaseService } from '../../services/database/DatabaseService';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('wallet')
  .setDescription('Affiche votre portefeuille avec la valeur actuelle de vos tokens $7N1');

export async function execute(interaction: CommandInteraction, services: Map<string, any>) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const tokenPriceService = services.get('tokenPrice') as TokenPriceService;
    const db = services.get('database') as DatabaseService;

    // Récupérer les données utilisateur
    const user = await db.client.user.findUnique({
      where: { discordId: userId }
    });
    if (!user) {
      await interaction.editReply('❌ Utilisateur non trouvé. Veuillez d\'abord utiliser une commande pour vous enregistrer.');
      return;
    }

    // Récupérer la valeur actuelle du token
    const priceData = await tokenPriceService.calculateTokenValue();

    // Calculer la valeur du portefeuille
    const tokenValue = user.tokens * priceData.price;
    const totalValue = user.dollars + tokenValue;

    // Préparer les emojis de tendance
    const trendEmoji = priceData.trend === 'up' ? '📈' : 
                      priceData.trend === 'down' ? '📉' : '📊';
    const changeEmoji = priceData.change24h > 0 ? '🟢' : 
                       priceData.change24h < 0 ? '🔴' : '🟡';

    // Créer l'embed du portefeuille
    const embed = new EmbedBuilder()
      .setTitle(`💰 Portefeuille de ${interaction.user.displayName}`)
      .setColor(priceData.trend === 'up' ? 0x00ff00 : 
               priceData.trend === 'down' ? 0xff0000 : 0xffff00)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields([
        {
          name: '💵 Dollars (USD)',
          value: `**$${user.dollars.toFixed(2)}**`,
          inline: true
        },
        {
          name: '🪙 Tokens $7N1',
          value: `**${user.tokens.toFixed(3)} $7N1**`,
          inline: true
        },
        {
          name: '💎 Valeur des tokens',
          value: `**$${tokenValue.toFixed(6)}**`,
          inline: true
        },
        {
          name: '📊 Cours actuel $7N1',
          value: `${trendEmoji} **$${priceData.price.toFixed(6)}**`,
          inline: true
        },
        {
          name: '📈 Variation 24h',
          value: `${changeEmoji} **${priceData.change24h > 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%**`,
          inline: true
        },
        {
          name: '💰 Valeur totale',
          value: `**$${totalValue.toFixed(6)}**`,
          inline: true
        }
      ])
      .addFields([
        {
          name: '📋 Détails du marché',
          value: [
            `• Volume 24h: $${priceData.volume24h.toFixed(2)}`,
            `• Market Cap: $${priceData.marketCap.toFixed(2)}`,
            `• Tokens détenus: ${((user.tokens / priceData.factors.totalCirculation) * 100).toFixed(2)}% du total`
          ].join('\n'),
          inline: false
        }
      ])
      .setFooter({ 
        text: `💡 Prix mis à jour • Utilisez /echanger pour convertir $ ↔ $7N1`,
        iconURL: interaction.client.user?.displayAvatarURL()
      })
      .setTimestamp();    

    await interaction.editReply({ embeds: [embed] });

    logger.info(`User ${userId} checked wallet: ${user.tokens} $7N1 worth $${tokenValue.toFixed(6)}`);

  } catch (error) {
    logger.error('Error in wallet command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Erreur')
      .setDescription('Impossible de récupérer les informations du portefeuille. Veuillez réessayer.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
