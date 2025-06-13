import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder,
  ComponentType,
  StringSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { MachineType } from '@prisma/client';
import { MiningService } from '../../services/mining/MiningService';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('🛒 Boutique de machines de minage - Achetez vos équipements!');

// Configuration des machines avec emojis et descriptions
const machineInfo = {
  BASIC_RIG: {
    name: '🔧 BASIC RIG',
    emoji: '🔧',
    description: 'Machine d\'entrée parfaite pour débuter',
    details: 'Robuste et économique, idéale pour les nouveaux mineurs'
  },
  ADVANCED_RIG: {
    name: '⚡ ADVANCED RIG', 
    emoji: '⚡',
    description: 'Performance améliorée pour mineurs expérimentés',
    details: 'Hashrate 5x supérieur avec efficacité optimisée'
  },
  QUANTUM_MINER: {
    name: '🌟 QUANTUM MINER',
    emoji: '🌟', 
    description: 'Technologie quantique de pointe',
    details: 'Puissance de calcul révolutionnaire avec algorithmes avancés'
  },
  FUSION_REACTOR: {
    name: '☢️ FUSION REACTOR',
    emoji: '☢️',
    description: 'Réacteur à fusion pour les mineurs d\'élite',
    details: 'Énergie nucléaire pour un hashrate extraordinaire'
  },
  MEGA_FARM: {
    name: '🏭 MEGA FARM',
    emoji: '🏭',
    description: 'Complexe industriel de minage massif',
    details: 'La solution ultime pour dominer le réseau'
  }
};

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const miningService = services.get('mining') as MiningService;
    const databaseService = services.get('database');
    
    // Récupère l'utilisateur actuel
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { machines: true }
    });

    if (!user) {
      await interaction.reply({
        content: '❌ Vous devez d\'abord créer un compte! Utilisez `/profile` ou `/balance`.',
        ephemeral: true
      });
      return;
    }

    // Obtient les configurations des machines
    const machineConfigs = miningService.getMachineConfigs();

    // Crée l'embed principal de la boutique
    const shopEmbed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('🛒 **BOUTIQUE DE MINAGE** 🛒')
      .setDescription(`**💰 Votre budget**: ${user.tokens.toFixed(2)} tokens\n**⛏️ Machines possédées**: ${user.machines.length}\n\n*Sélectionnez une machine ci-dessous pour l'acheter*`)
      .addFields(
        {
          name: '📊 **CATALOGUE DES MACHINES**',
          value: Object.entries(machineConfigs).map(([type, config]) => {
            const info = machineInfo[type as MachineType];
            const affordable = user.tokens >= config.cost ? '✅' : '❌';
            return `${affordable} ${info.emoji} **${info.name}**\n💰 ${config.cost} tokens | ⚡ ${config.baseHashRate}/s | 🔋 ${config.powerConsumption}W`;
          }).join('\n\n'),
          inline: false
        }
      )
      .setFooter({ text: '💡 Plus le prix est élevé, plus les gains sont importants!' })
      .setTimestamp();

    // Crée le menu déroulant pour sélectionner une machine
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('shop_select_machine')
      .setPlaceholder('🛒 Choisissez une machine à acheter...')
      .addOptions(
        Object.entries(machineConfigs).map(([type, config]) => {
          const info = machineInfo[type as MachineType];
          const affordable = user.tokens >= config.cost;
          
          return {
            label: `${info.name} - ${config.cost} tokens`,
            description: `${info.description} | ⚡${config.baseHashRate}/s | 🔋${config.powerConsumption}W`,
            value: type,
            emoji: info.emoji,
            default: false
          };
        })
      );

    // Bouton de rafraîchissement
    const refreshButton = new ButtonBuilder()
      .setCustomId('shop_refresh')
      .setLabel('🔄 Actualiser')
      .setStyle(ButtonStyle.Secondary);

    const actionRow1 = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);
    
    const actionRow2 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(refreshButton);

    const response = await interaction.reply({
      embeds: [shopEmbed],
      components: [actionRow1, actionRow2],
      fetchReply: true
    });

    // Collecteur pour les interactions du menu
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300000 // 5 minutes
    });

    const buttonCollector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000
    });

    // Gestion de la sélection de machine
    collector.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
      if (selectInteraction.user.id !== interaction.user.id) {
        await selectInteraction.reply({
          content: '❌ Vous ne pouvez pas utiliser cette boutique!',
          ephemeral: true
        });
        return;
      }

      const selectedMachine = selectInteraction.values[0] as MachineType;
      const config = machineConfigs[selectedMachine];
      const info = machineInfo[selectedMachine];

      // Vérifier si l'utilisateur a assez de tokens
      const currentUser = await databaseService.client.user.findUnique({
        where: { discordId: interaction.user.id }
      });

      if (!currentUser || currentUser.tokens < config.cost) {
        await selectInteraction.reply({
          content: `❌ Fonds insuffisants! Vous avez besoin de **${config.cost} tokens** mais vous n'avez que **${currentUser?.tokens.toFixed(2) || 0} tokens**.`,
          ephemeral: true
        });
        return;
      }

      // Crée l'embed de confirmation
      const confirmEmbed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle(`${info.emoji} Confirmer l'achat`)
        .setDescription(`**Machine**: ${info.name}\n**Prix**: ${config.cost} tokens\n**Description**: ${info.details}`)
        .addFields(
          { name: '⚡ Hash Rate', value: `${config.baseHashRate}/s`, inline: true },
          { name: '🔋 Consommation', value: `${config.powerConsumption}W`, inline: true },
          { name: '🔧 Maintenance', value: `${config.maintenanceCost} tokens`, inline: true },
          { name: '💰 Solde actuel', value: `${currentUser.tokens.toFixed(2)} tokens`, inline: true },
          { name: '💰 Solde après achat', value: `${(currentUser.tokens - config.cost).toFixed(2)} tokens`, inline: true },
          { name: '📈 Estimation gains', value: `~${(config.baseHashRate * 3600).toFixed(2)} tokens/h`, inline: true }
        )
        .setFooter({ text: 'Confirmez-vous cet achat?' });

      // Boutons de confirmation
      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_purchase_${selectedMachine}`)
        .setLabel('✅ Confirmer l\'achat')
        .setStyle(ButtonStyle.Success);

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_purchase')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger);

      const confirmRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirmButton, cancelButton);

      await selectInteraction.update({
        embeds: [confirmEmbed],
        components: [confirmRow]
      });
    });

    // Gestion du bouton de rafraîchissement
    buttonCollector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: '❌ Vous ne pouvez pas utiliser cette boutique!',
          ephemeral: true
        });
        return;
      }

      if (buttonInteraction.customId === 'shop_refresh') {
        // Recharge les données utilisateur
        const refreshedUser = await databaseService.client.user.findUnique({
          where: { discordId: interaction.user.id },
          include: { machines: true }
        });

        if (refreshedUser) {
          const refreshedEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🛒 **BOUTIQUE DE MINAGE** 🛒')
            .setDescription(`**💰 Votre budget**: ${refreshedUser.tokens.toFixed(2)} tokens\n**⛏️ Machines possédées**: ${refreshedUser.machines.length}\n\n*Sélectionnez une machine ci-dessous pour l'acheter*`)
            .addFields(
              {
                name: '📊 **CATALOGUE DES MACHINES**',
                value: Object.entries(machineConfigs).map(([type, config]) => {
                  const info = machineInfo[type as MachineType];
                  const affordable = refreshedUser.tokens >= config.cost ? '✅' : '❌';
                  return `${affordable} ${info.emoji} **${info.name}**\n💰 ${config.cost} tokens | ⚡ ${config.baseHashRate}/s | 🔋 ${config.powerConsumption}W`;
                }).join('\n\n'),
                inline: false
              }
            )
            .setFooter({ text: '💡 Plus le prix est élevé, plus les gains sont importants!' })
            .setTimestamp();

          await buttonInteraction.update({
            embeds: [refreshedEmbed],
            components: [actionRow1, actionRow2]
          });
        }
      } else if (buttonInteraction.customId.startsWith('confirm_purchase_')) {
        // Traite l'achat confirmé
        const machineType = buttonInteraction.customId.replace('confirm_purchase_', '') as MachineType;
        const purchaseResult = await miningService.purchaseMachine(currentUser.id, machineType);

        if (purchaseResult.success) {
          const successEmbed = new EmbedBuilder()
            .setColor(0x27AE60)
            .setTitle('🎉 Achat réussi!')
            .setDescription(purchaseResult.message)
            .addFields(
              { name: '🆕 Machine ajoutée', value: `${machineInfo[machineType].emoji} ${machineInfo[machineType].name}`, inline: true },
              { name: '💡 Conseil', value: 'Utilisez `/inventory` pour voir vos machines\nUtilisez `/mine start` pour commencer à miner!', inline: false }
            )
            .setFooter({ text: 'Bon minage! ⛏️' });

          await buttonInteraction.update({
            embeds: [successEmbed],
            components: []
          });
        } else {
          await buttonInteraction.update({
            content: `❌ ${purchaseResult.message}`,
            embeds: [],
            components: []
          });
        }
      } else if (buttonInteraction.customId === 'cancel_purchase') {
        // Retour à la boutique
        await buttonInteraction.update({
          embeds: [shopEmbed],
          components: [actionRow1, actionRow2]
        });
      }
    });

    // Nettoyage après expiration
    collector.on('end', async () => {
      try {
        const disabledRow1 = new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(selectMenu.setDisabled(true));
        
        const disabledRow2 = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(refreshButton.setDisabled(true));

        await interaction.editReply({
          components: [disabledRow1, disabledRow2]
        });
      } catch (error) {
        // Ignore les erreurs de modification après expiration
      }
    });

  } catch (error) {
    console.error('Error in shop command:', error);
    
    const errorMessage = {
      content: '❌ Une erreur est survenue lors de l\'affichage de la boutique.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}