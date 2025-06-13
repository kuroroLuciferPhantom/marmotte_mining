import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ComponentType, ButtonStyle } from 'discord.js';
import { CardService } from '../../services/sabotage/CardService';

export const data = new SlashCommandBuilder()
  .setName('defense')
  .setDescription('🛡️ Gérez vos cartes de défense contre les attaques')
  .addStringOption(option =>
    option
      .setName('action')
      .setDescription('Action à effectuer')
      .addChoices(
        { name: '👀 Voir mes défenses', value: 'view' },
        { name: '🔄 Activer/Désactiver', value: 'toggle' },
        { name: '♻️ Recycler une carte', value: 'recycle' }
      )
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const cardService = services.get('cards') as CardService;
    const action = interaction.options.getString('action') || 'view';

    const inventory = await cardService.getUserInventory(interaction.user.id);

    if (action === 'view') {
      const embed = new EmbedBuilder()
        .setColor(0x4169E1)
        .setTitle('🛡️ Système de Défense')
        .setDescription('Gérez vos protections contre les attaques de sabotage')
        .addFields(
          {
            name: '⚡ Énergie',
            value: `${inventory.energy}/100`,
            inline: true
          },
          {
            name: '🛡️ Défenses Actives',
            value: inventory.activeDefenses.length > 0 ? 
              inventory.activeDefenses.map(d => `✅ ${d.type}`).join('\n') :
              'Aucune défense active',
            inline: true
          },
          {
            name: '📦 Cartes Disponibles',
            value: inventory.defenseCards.length > 0 ? 
              `${inventory.defenseCards.length} cartes de défense` :
              'Aucune carte de défense',
            inline: true
          }
        );

      // Descriptions des défenses
      embed.addFields(
        {
          name: '📖 Types de Défenses Disponibles',
          value: '🦠 **Antivirus** - Bloque les virus informatiques\n' +
                 '⚡ **Générateur Secours** - Empêche les coupures électriques\n' +
                 '🔧 **Logiciel Optimisation** - Réduit la durée des malus de 50%\n' +
                 '🌐 **VPN + Firewall** - 50% de chance d\'éviter les attaques réseau\n' +
                 '🔍 **Détecteur Sabotage** - Révèle l\'identité des attaquants',
          inline: false
        }
      );

      if (inventory.defenseCards.length > 0) {
        // Créer les boutons pour activer/désactiver les défenses
        const buttons = [];
        
        for (let i = 0; i < inventory.defenseCards.length && i < 5; i++) {
          const card = inventory.defenseCards[i];
          const rarityEmojis = {
            'COMMON': '⚪',
            'UNCOMMON': '🟢',
            'RARE': '🔵',
            'EPIC': '🟣',
            'LEGENDARY': '🟡'
          };

          embed.addFields({
            name: `${rarityEmojis[card.rarity]} ${card.type}`,
            value: `**Quantité:** ${card.quantity}\n` +
                   `**Statut:** ${card.isActive ? '✅ Active' : '❌ Inactive'}\n` +
                   `**Rareté:** ${card.rarity}`,
            inline: true
          });

          const button = new ButtonBuilder()
            .setCustomId(`toggle_${card.id}`)
            .setLabel(card.isActive ? 'Désactiver' : 'Activer')
            .setEmoji(card.isActive ? '❌' : '✅')
            .setStyle(card.isActive ? ButtonStyle.Danger : ButtonStyle.Success);

          buttons.push(button);
        }

        const buttonRows = [];
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

        // Collecteur pour les boutons
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

          const defenseId = buttonInteraction.customId.replace('toggle_', '');
          await buttonInteraction.deferUpdate();

          try {
            const result = await cardService.toggleDefense(interaction.user.id, defenseId);

            const resultEmbed = new EmbedBuilder()
              .setColor(result.isActive ? 0x00FF00 : 0xFF8C00)
              .setTitle(result.isActive ? '✅ Défense Activée' : '🔓 Défense Désactivée')
              .setDescription(result.message)
              .setFooter({ text: 'Défenses mises à jour' })
              .setTimestamp();

            await buttonInteraction.editReply({ 
              embeds: [resultEmbed], 
              components: [] 
            });

          } catch (error) {
            const errorEmbed = new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle('❌ Erreur de Défense')
              .setDescription(error.message || 'Impossible de modifier la défense.');

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
            // Message probablement déjà modifié
          }
        });

      } else {
        embed.setFooter({ text: 'Obtenez des cartes de défense via /mission ou /marche_noir' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      return;
    }

    if (action === 'recycle') {
      if (inventory.defenseCards.length === 0) {
        await interaction.reply({
          content: '❌ Vous n\'avez aucune carte de défense à recycler !',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x8B4513)
        .setTitle('♻️ Recyclage de Cartes de Défense')
        .setDescription('Sélectionnez une carte à recycler pour obtenir des fragments')
        .setFooter({ text: 'Le recyclage détruit la carte définitivement' });

      const buttons = [];
      const rarityEmojis = {
        'COMMON': '⚪',
        'UNCOMMON': '🟢',
        'RARE': '🔵',
        'EPIC': '🟣',
        'LEGENDARY': '🟡'
      };

      for (let i = 0; i < inventory.defenseCards.length && i < 10; i++) {
        const card = inventory.defenseCards[i];
        
        embed.addFields({
          name: `${rarityEmojis[card.rarity]} ${card.type}`,
          value: `**Quantité:** ${card.quantity}\n` +
                 `**Fragments obtenus:** ${this.getRecycleValue(card.rarity)}`,
          inline: true
        });

        const button = new ButtonBuilder()
          .setCustomId(`recycle_${card.id}`)
          .setLabel(`${card.type}`)
          .setEmoji('♻️')
          .setStyle(ButtonStyle.Secondary);

        buttons.push(button);
      }

      const buttonRows = [];
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

      // Collecteur pour le recyclage
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

        const cardId = buttonInteraction.customId.replace('recycle_', '');
        await buttonInteraction.deferUpdate();

        try {
          const result = await cardService.recycleCard(interaction.user.id, cardId, 'defense');

          const resultEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('♻️ Recyclage Réussi')
            .setDescription(result.message)
            .addFields({
              name: '🧩 Fragments Obtenus',
              value: `${result.fragmentsObtained}x ${result.fragmentType.replace('_', ' ')}`,
              inline: true
            })
            .setFooter({ text: 'Fragments ajoutés à votre inventaire' })
            .setTimestamp();

          await buttonInteraction.editReply({ 
            embeds: [resultEmbed], 
            components: [] 
          });

        } catch (error) {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Erreur de Recyclage')
            .setDescription(error.message || 'Impossible de recycler cette carte.');

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
          // Message probablement déjà modifié
        }
      });

      return;
    }

  } catch (error) {
    console.error('Error in defense command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Erreur de Défense')
      .setDescription('Impossible d\'accéder au système de défense.')
      .setFooter({ text: 'Réessayez plus tard' });

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }

  // Méthode helper pour calculer la valeur de recyclage
  private getRecycleValue(rarity: string): number {
    const values = {
      'COMMON': 2,
      'UNCOMMON': 3,
      'RARE': 5,
      'EPIC': 8,
      'LEGENDARY': 12
    };
    
    return values[rarity] || 2;
  }
}