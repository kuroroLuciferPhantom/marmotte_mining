import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ButtonBuilder, 
  ActionRowBuilder, 
  ComponentType, 
  ButtonStyle 
} from 'discord.js';
import { logger } from '../../utils/logger';

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
    await interaction.deferReply({ ephemeral: true });

    const databaseService = services.get('database');
    if (!databaseService) {
      throw new Error('Service de base de données non disponible');
    }

    const action = interaction.options.getString('action') || 'view';

    // 🔧 CORRECTION: Récupérer les données utilisateur directement depuis la DB
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: {
        defenseCards: true,
        cardFragments: {
          where: {
            type: 'DEFENSE_FRAGMENT'
          }
        }
      }
    });

    if (!user) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Utilisateur non trouvé')
        .setDescription('Vous devez vous enregistrer avec `/register` pour accéder aux défenses.');
      
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (action === 'view') {
      await handleViewDefenses(interaction, user);
    } else if (action === 'toggle') {
      await handleToggleDefense(interaction, user, databaseService);
    } else if (action === 'recycle') {
      await handleRecycleCard(interaction, user, databaseService);
    }

  } catch (error) {
    logger.error('Error in defense command:', error);
    
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
}

/**
 * 👀 Afficher les défenses de l'utilisateur
 */
async function handleViewDefenses(interaction: ChatInputCommandInteraction, user: any) {
  const defenseCards = user.defenseCards || [];
  const activeDefenses = defenseCards.filter((card: any) => card.isActive);
  
  const embed = new EmbedBuilder()
    .setColor(0x4169E1)
    .setTitle('🛡️ Système de Défense')
    .setDescription('Gérez vos protections contre les attaques de sabotage')
    .addFields(
      {
        name: '🛡️ Défenses Actives',
        value: activeDefenses.length > 0 ? 
          activeDefenses.map((d: any) => `✅ ${getDefenseDisplayName(d.type)}`).join('\n') :
          'Aucune défense active',
        inline: true
      },
      {
        name: '📦 Cartes Disponibles',
        value: defenseCards.length > 0 ? 
          `${defenseCards.length} cartes de défense` :
          'Aucune carte de défense',
        inline: true
      },
      {
        name: '🧩 Fragments',
        value: user.cardFragments.length > 0 ?
          `${user.cardFragments.reduce((sum: number, f: any) => sum + f.quantity, 0)} fragments` :
          'Aucun fragment',
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

  if (defenseCards.length > 0) {
    const buttons = [];
    
    for (let i = 0; i < defenseCards.length && i < 5; i++) {
      const card = defenseCards[i];
      const rarityEmoji = getRarityEmoji(card.rarity);

      embed.addFields({
        name: `${rarityEmoji} ${getDefenseDisplayName(card.type)}`,
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

    // Bouton pour afficher plus de cartes si nécessaire
    if (defenseCards.length > 5) {
      const viewMoreButton = new ButtonBuilder()
        .setCustomId('view_more_defenses')
        .setLabel(`Voir ${defenseCards.length - 5} carte(s) de plus`)
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary);
      
      buttons.push(viewMoreButton);
    }

    const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(buttons.slice(i, i + 5));
      buttonRows.push(row);
    }

    await interaction.editReply({ 
      embeds: [embed], 
      components: buttonRows
    });

    // 🎯 Gérer les interactions avec les boutons
    const filter = (i: any) => i.user.id === interaction.user.id;
    const collector = interaction.channel?.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    if (collector) {
      collector.on('collect', async (buttonInteraction) => {
        await buttonInteraction.deferUpdate();

        if (buttonInteraction.customId.startsWith('toggle_')) {
          const defenseId = buttonInteraction.customId.replace('toggle_', '');
          await handleToggleDefenseById(buttonInteraction, defenseId, interaction.user.id);
        } else if (buttonInteraction.customId === 'view_more_defenses') {
          await showAllDefenses(buttonInteraction, defenseCards);
        }
      });

      collector.on('end', async () => {
        try {
          const disabledRows = buttonRows.map(row => {
            const newRow = new ActionRowBuilder<ButtonBuilder>();
            row.components.forEach(component => {
              if (component instanceof ButtonBuilder) {
                newRow.addComponents(
                  ButtonBuilder.from(component).setDisabled(true)
                );
              }
            });
            return newRow;
          });
          
          await interaction.editReply({ components: disabledRows });
        } catch (error) {
          // Message probablement déjà modifié
          logger.warn('Could not disable defense buttons:', error);
        }
      });
    }

  } else {
    embed.setFooter({ text: 'Obtenez des cartes de défense via /mission ou /marche_noir' });
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * 🔄 Gérer l'activation/désactivation d'une défense
 */
async function handleToggleDefense(interaction: ChatInputCommandInteraction, user: any, databaseService: any) {
  const defenseCards = user.defenseCards || [];
  
  if (defenseCards.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xFF8C00)
      .setTitle('📦 Aucune Carte de Défense')
      .setDescription('Vous n\'avez aucune carte de défense à activer.\n\nObtenez-en via `/mission` ou `/marche_noir`');
    
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Afficher la liste avec boutons pour toggle
  await handleViewDefenses(interaction, user);
}

/**
 * 🔄 Basculer une défense spécifique par ID
 */
async function handleToggleDefenseById(buttonInteraction: any, defenseId: string, userId: string) {
  try {
    // 🔧 CORRECTION: Implémentation simple du toggle sans service externe
    const databaseService = buttonInteraction.client.services?.get('database');
    if (!databaseService) {
      throw new Error('Service de base de données non disponible');
    }

    // Récupérer la carte de défense
    const defenseCard = await databaseService.client.defenseCard.findFirst({
      where: {
        id: defenseId,
        user: {
          discordId: userId
        }
      }
    });

    if (!defenseCard) {
      throw new Error('Carte de défense non trouvée');
    }

    // Basculer le statut
    const updatedCard = await databaseService.client.defenseCard.update({
      where: { id: defenseId },
      data: { isActive: !defenseCard.isActive }
    });

    const resultEmbed = new EmbedBuilder()
      .setColor(updatedCard.isActive ? 0x00FF00 : 0xFF8C00)
      .setTitle(updatedCard.isActive ? '✅ Défense Activée' : '🔓 Défense Désactivée')
      .setDescription(`**${getDefenseDisplayName(updatedCard.type)}** est maintenant ${updatedCard.isActive ? 'active' : 'inactive'}.`)
      .setFooter({ text: 'Défenses mises à jour' })
      .setTimestamp();

    await buttonInteraction.followUp({ 
      embeds: [resultEmbed], 
      ephemeral: true 
    });

  } catch (error: any) {
    logger.error('Error toggling defense:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Erreur de Défense')
      .setDescription(error.message || 'Impossible de modifier la défense.');

    await buttonInteraction.followUp({ 
      embeds: [errorEmbed], 
      ephemeral: true 
    });
  }
}

/**
 * ♻️ Gérer le recyclage de cartes
 */
async function handleRecycleCard(interaction: ChatInputCommandInteraction, user: any, databaseService: any) {
  const defenseCards = user.defenseCards || [];
  
  if (defenseCards.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xFF8C00)
      .setTitle('📦 Aucune Carte à Recycler')
      .setDescription('Vous n\'avez aucune carte de défense à recycler.');
    
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x8B4513)
    .setTitle('♻️ Recyclage de Cartes de Défense')
    .setDescription('Sélectionnez une carte à recycler pour obtenir des fragments')
    .setFooter({ text: 'Le recyclage détruit la carte définitivement' });

  const buttons = [];

  for (let i = 0; i < defenseCards.length && i < 10; i++) {
    const card = defenseCards[i];
    const rarityEmoji = getRarityEmoji(card.rarity);
    
    embed.addFields({
      name: `${rarityEmoji} ${getDefenseDisplayName(card.type)}`,
      value: `**Quantité:** ${card.quantity}\n` +
             `**Fragments obtenus:** ${getRecycleValue(card.rarity)}`,
      inline: true
    });

    const button = new ButtonBuilder()
      .setCustomId(`recycle_${card.id}`)
      .setLabel(`${getDefenseDisplayName(card.type)}`)
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

  await interaction.editReply({ 
    embeds: [embed], 
    components: buttonRows
  });

  // 🎯 Gérer le recyclage
  const filter = (i: any) => i.user.id === interaction.user.id;
  const collector = interaction.channel?.createMessageComponentCollector({
    filter,
    componentType: ComponentType.Button,
    time: 300000 // 5 minutes
  });

  if (collector) {
    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId.startsWith('recycle_')) {
        const cardId = buttonInteraction.customId.replace('recycle_', '');
        await buttonInteraction.deferUpdate();
        await handleRecycleCardById(buttonInteraction, cardId, databaseService);
      }
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch (error) {
        logger.warn('Could not clear recycle buttons:', error);
      }
    });
  }
}

/**
 * ♻️ Recycler une carte spécifique
 */
async function handleRecycleCardById(buttonInteraction: any, cardId: string, databaseService: any) {
  try {
    // Récupérer la carte
    const card = await databaseService.client.defenseCard.findUnique({
      where: { id: cardId },
      include: {
        user: true
      }
    });

    if (!card) {
      throw new Error('Carte non trouvée');
    }

    if (card.quantity <= 0) {
      throw new Error('Cette carte n\'est plus disponible');
    }

    const fragmentsObtained = getRecycleValue(card.rarity);

    // Transaction pour recycler la carte
    await databaseService.client.$transaction(async (prisma: any) => {
      // Réduire la quantité de la carte ou la supprimer
      if (card.quantity > 1) {
        await prisma.defenseCard.update({
          where: { id: cardId },
          data: { quantity: card.quantity - 1 }
        });
      } else {
        await prisma.defenseCard.delete({
          where: { id: cardId }
        });
      }

      // Ajouter les fragments
      const existingFragment = await prisma.cardFragment.findFirst({
        where: {
          userId: card.userId,
          type: 'DEFENSE_FRAGMENT'
        }
      });

      if (existingFragment) {
        await prisma.cardFragment.update({
          where: { id: existingFragment.id },
          data: { quantity: existingFragment.quantity + fragmentsObtained }
        });
      } else {
        await prisma.cardFragment.create({
          data: {
            userId: card.userId,
            type: 'DEFENSE_FRAGMENT',
            quantity: fragmentsObtained
          }
        });
      }
    });

    const resultEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('♻️ Recyclage Réussi')
      .setDescription(`**${getDefenseDisplayName(card.type)}** recyclée avec succès !`)
      .addFields({
        name: '🧩 Fragments Obtenus',
        value: `${fragmentsObtained}x Fragments de Défense`,
        inline: true
      })
      .setFooter({ text: 'Fragments ajoutés à votre inventaire' })
      .setTimestamp();

    await buttonInteraction.followUp({ 
      embeds: [resultEmbed], 
      ephemeral: true 
    });

  } catch (error: any) {
    logger.error('Error recycling card:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Erreur de Recyclage')
      .setDescription(error.message || 'Impossible de recycler cette carte.');

    await buttonInteraction.followUp({ 
      embeds: [errorEmbed], 
      ephemeral: true 
    });
  }
}

/**
 * 📋 Afficher toutes les défenses (pagination)
 */
async function showAllDefenses(buttonInteraction: any, defenseCards: any[]) {
  const embed = new EmbedBuilder()
    .setColor(0x4169E1)
    .setTitle('🛡️ Toutes vos Défenses')
    .setDescription(`Vous avez **${defenseCards.length}** cartes de défense au total :`);

  defenseCards.forEach((card: any, index: number) => {
    const rarityEmoji = getRarityEmoji(card.rarity);
    const statusEmoji = card.isActive ? '✅' : '❌';
    
    embed.addFields({
      name: `${index + 1}. ${rarityEmoji} ${getDefenseDisplayName(card.type)}`,
      value: `${statusEmoji} **Statut:** ${card.isActive ? 'Active' : 'Inactive'}\n**Quantité:** ${card.quantity}\n**Rareté:** ${card.rarity}`,
      inline: true
    });
  });

  await buttonInteraction.followUp({ 
    embeds: [embed], 
    ephemeral: true 
  });
}

// ========================
// 🛠️ FONCTIONS UTILITAIRES
// ========================

/**
 * 🔧 CORRECTION: Fonction utilitaire pour les valeurs de recyclage
 */
function getRecycleValue(rarity: string): number {
  const values: { [key: string]: number } = {
    'COMMON': 2,
    'UNCOMMON': 3,
    'RARE': 5,
    'EPIC': 8,
    'LEGENDARY': 12
  };
  
  return values[rarity] || 2;
}

/**
 * 🎨 Obtenir l'emoji de rareté
 */
function getRarityEmoji(rarity: string): string {
  const emojis: { [key: string]: string } = {
    'COMMON': '⚪',
    'UNCOMMON': '🟢',
    'RARE': '🔵',
    'EPIC': '🟣',
    'LEGENDARY': '🟡'
  };
  
  return emojis[rarity] || '⚪';
}

/**
 * 📝 Obtenir le nom d'affichage d'une défense
 */
function getDefenseDisplayName(type: string): string {
  const names: { [key: string]: string } = {
    'ANTIVIRUS': 'Antivirus',
    'BACKUP_GENERATOR': 'Générateur de Secours',
    'OPTIMIZATION_SOFTWARE': 'Logiciel d\'Optimisation',
    'VPN_FIREWALL': 'VPN + Firewall',
    'SABOTAGE_DETECTOR': 'Détecteur de Sabotage'
  };
  
  return names[type] || type;
}