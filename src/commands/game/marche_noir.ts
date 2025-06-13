import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ComponentType, ButtonStyle } from 'discord.js';
import { BlackMarketService } from '../../services/sabotage/BlackMarketService';

export const data = new SlashCommandBuilder()
  .setName('marche_noir')
  .setDescription('🕴️ Accédez au marché noir pour acheter des cartes rares')
  .addStringOption(option =>
    option
      .setName('action')
      .setDescription('Action à effectuer')
      .addChoices(
        { name: '🛒 Voir les offres', value: 'view' },
        { name: '📊 Statistiques', value: 'stats' },
        { name: '📜 Historique', value: 'history' }
      )
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const blackMarketService = services.get('blackmarket') as BlackMarketService;
    const action = interaction.options.getString('action') || 'view';

    if (action === 'stats') {
      const stats = await blackMarketService.getMarketStats();
      
      const embed = new EmbedBuilder()
        .setColor(0x2F3136)
        .setTitle('📊 Statistiques du Marché Noir')
        .setDescription('Données de l\'activité commerciale clandestine')
        .addFields(
          {
            name: '📈 Dernières 24h',
            value: `**Achats:** ${stats.last24h.totalPurchases}\n` +
                   `**Volume total:** ${stats.last24h.totalValue} $7N1\n` +
                   `**Prix moyen:** ${Math.floor(stats.last24h.averagePrice || 0)} $7N1`,
            inline: true
          },
          {
            name: '🔄 Cycle Actuel',
            value: `**Achats:** ${stats.currentCycle.purchases}\n` +
                   `**Offres dispo:** ${stats.currentCycle.availableOffers}`,
            inline: true
          },
          {
            name: '⏱️ Prochain Refresh',
            value: `<t:${Math.floor(stats.nextRefresh.getTime() / 1000)}:R>`,
            inline: true
          }
        )
        .setFooter({ text: 'Marché noir • Refresh toutes les 12h • 1 achat par cycle' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (action === 'history') {
      const history = await blackMarketService.getUserPurchaseHistory(interaction.user.id, 10);
      
      const embed = new EmbedBuilder()
        .setColor(0x2F3136)
        .setTitle('📜 Votre Historique d\'Achats')
        .setDescription(history.length > 0 ? 
          'Vos derniers achats sur le marché noir' : 
          'Vous n\'avez encore rien acheté sur le marché noir.')
        .setFooter({ text: `${history.length}/10 derniers achats affichés` });

      if (history.length > 0) {
        for (const purchase of history) {
          embed.addFields({
            name: `${purchase.rarityEmoji} ${purchase.offer.cardType}`,
            value: `**Prix:** ${purchase.price} $7N1\n` +
                   `**Date:** <t:${Math.floor(purchase.timestamp.getTime() / 1000)}:R>\n` +
                   `**Rareté:** ${purchase.offer.rarity}`,
            inline: true
          });
        }
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Action par défaut: voir les offres
    const offers = await blackMarketService.getCurrentOffers();
    
    const embed = new EmbedBuilder()
      .setColor(0x2F3136)
      .setTitle('🕴️ Marché Noir - Offres Actuelles')
      .setDescription('*Des cartes rares et puissantes, sans poser de questions...*\n\n' +
                     '⚠️ **Limite:** 1 achat par cycle de 12h')
      .setFooter({ text: 'Les prix fluctuent selon l\'offre et la demande' });

    if (offers.length === 0) {
      embed.addFields({
        name: '📦 Stock Vide',
        value: 'Aucune offre disponible pour le moment.\nRevenez après le prochain refresh.',
        inline: false
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Créer les boutons d'achat
    const buttons = [];
    const buttonRows = [];

    for (let i = 0; i < offers.length && i < 5; i++) {
      const offer = offers[i];
      const timeRemaining = Math.max(0, offer.timeRemaining);
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

      embed.addFields({
        name: `${offer.rarityEmoji} ${offer.cardType}`,
        value: `${offer.description}\n\n` +
               `**Prix:** ${offer.price} $7N1\n` +
               `**Rareté:** ${offer.rarity}\n` +
               `**Stock:** ${offer.stock}\n` +
               `**Expire dans:** ${hours}h ${minutes}m`,
        inline: true
      });

      const button = new ButtonBuilder()
        .setCustomId(`buy_${offer.id}`)
        .setLabel(`${offer.price} $7N1`)
        .setEmoji(offer.rarityEmoji)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(offer.stock <= 0);

      buttons.push(button);
    }

    // Organiser les boutons en rangées (max 5 par rangée)
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(buttons.slice(i, i + 5));
      buttonRows.push(row);
    }

    const response = await interaction.reply({ 
      embeds: [embed], 
      components: buttonRows,
      ephemeral: true 
    });

    // Collecteur pour les achats
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: '❌ Vous ne pouvez pas utiliser les boutons d\'un autre utilisateur !',
          ephemeral: true
        });
        return;
      }

      const offerId = buttonInteraction.customId.replace('buy_', '');
      await buttonInteraction.deferUpdate();

      try {
        const purchaseResult = await blackMarketService.purchaseCard(interaction.user.id, offerId);

        const resultEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Achat Réussi !')
          .setDescription(purchaseResult.message)
          .addFields(
            {
              name: '🃏 Carte Achetée',
              value: `${purchaseResult.cardType} (${purchaseResult.rarity})`,
              inline: true
            },
            {
              name: '💰 Prix Payé',
              value: `${purchaseResult.price} $7N1`,
              inline: true
            }
          )
          .setFooter({ text: 'Carte ajoutée à votre inventaire' })
          .setTimestamp();

        await buttonInteraction.editReply({ 
          embeds: [resultEmbed], 
          components: [] 
        });

      } catch (error) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Achat Impossible')
          .setDescription(error.message || 'Une erreur inattendue s\'est produite.')
          .setFooter({ text: 'Vérifiez votre solde et les limites d\'achat' });

        await buttonInteraction.editReply({ 
          embeds: [errorEmbed], 
          components: [] 
        });
      }
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch (error) {
        // Message probablement déjà modifié ou supprimé
      }
    });

  } catch (error) {
    console.error('Error in marche_noir command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Erreur du Marché Noir')
      .setDescription('Le marché noir est temporairement inaccessible.')
      .setFooter({ text: 'Réessayez plus tard' });

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}