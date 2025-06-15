import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder,
  ComponentType,
  StringSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction
} from 'discord.js';
import { MachineType, TransactionType } from '@prisma/client';
import { ActivityService } from '../../services/activity/ActivityService';

export const data = new SlashCommandBuilder()
  .setName('vendre')
  .setDescription('💸 Vendre une de vos machines de minage pour récupérer des dollars');

// Configuration des informations machines (reprise du shop.ts)
const machineInfo = {
  BASIC_RIG: {
    name: '🔧 BASIC RIG',
    emoji: '🔧',
    description: 'Machine d\'entrée parfaite pour débuter',
    dollarPrice: 1000
  },
  ADVANCED_RIG: {
    name: '⚡ ADVANCED RIG', 
    emoji: '⚡',
    description: 'Performance améliorée pour mineurs expérimentés',
    dollarPrice: 5000
  },
  QUANTUM_MINER: {
    name: '🌟 QUANTUM MINER',
    emoji: '🌟', 
    description: 'Technologie quantique de pointe',
    dollarPrice: 20000
  },
  FUSION_REACTOR: {
    name: '☢️ FUSION REACTOR',
    emoji: '☢️',
    description: 'Réacteur à fusion pour les mineurs d\'élite',
    dollarPrice: 100000
  },
  MEGA_FARM: {
    name: '🏭 MEGA FARM',
    emoji: '🏭',
    description: 'Complexe industriel de minage massif',
    dollarPrice: 500000
  }
};

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const databaseService = services.get('database');
    
    // Récupère l'utilisateur et ses machines
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { 
        machines: {
          orderBy: [
            { type: 'asc' },
            { createdAt: 'asc' }
          ]
        }
      }
    });

    if (!user) {
      await interaction.reply({
        content: '❌ Vous devez d\'abord créer un compte! Utilisez `/register`.',
        ephemeral: true
      });
      return;
    }

    // Vérifier qu'il a au moins 2 machines (pour pouvoir en vendre une)
    if (user.machines.length <= 1) {
      const noSaleEmbed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('❌ Vente impossible')
        .setDescription('**Vous devez garder au moins une machine!**')
        .addFields([
          {
            name: '📊 Votre situation actuelle',
            value: user.machines.length === 0 
              ? '• **0 machine** - Aucune machine à vendre\n• Achetez d\'abord des machines avec `/shop`'
              : '• **1 machine** - Impossible de vendre votre dernière machine\n• Achetez une autre machine avant de pouvoir en vendre une',
            inline: false
          },
          {
            name: '💡 Solution',
            value: '• Utilisez `/shop` pour acheter plus de machines\n• Vous pourrez alors vendre vos anciennes machines\n• Stratégie recommandée: upgrader progressivement vos équipements',
            inline: false
          }
        ])
        .setFooter({ text: 'Conservez toujours au moins une machine active!' })
        .setTimestamp();

      await interaction.reply({
        embeds: [noSaleEmbed],
        ephemeral: true
      });
      return;
    }

    // Afficher les machines disponibles à la vente
    await showMachinesForSale(interaction, user, services);

  } catch (error) {
    console.error('Error in vendre command:', error);
    
    const errorMessage = {
      content: '❌ Une erreur est survenue lors de l\'affichage des machines à vendre.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function showMachinesForSale(interaction: ChatInputCommandInteraction, user: any, services: Map<string, any>) {
  const activityService = services.get('activity') as ActivityService;
  
  // Récupérer le solde en dollars
  const dollarBalance = await activityService.getUserDollarBalance(interaction.user.id);

  // Grouper les machines par type pour l'affichage
  const machineGroups: { [key: string]: any[] } = {};
  user.machines.forEach((machine: any) => {
    if (!machineGroups[machine.type]) {
      machineGroups[machine.type] = [];
    }
    machineGroups[machine.type].push(machine);
  });

  // Calculer les prix de rachat pour chaque groupe
  const machineOptions = Object.entries(machineGroups).map(([type, typeMachines]) => {
    const machineConfig = machineInfo[type as keyof typeof machineInfo];
    const count = typeMachines.length;
    
    // Calculer l'âge moyen des machines de ce type (en jours)
    const avgAge = typeMachines.reduce((sum, machine) => {
      const ageInDays = Math.floor((Date.now() - new Date(machine.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return sum + ageInDays;
    }, 0) / count;
    
    // Calculer la durabilité moyenne
    const avgDurability = typeMachines.reduce((sum, machine) => sum + machine.durability, 0) / count;
    
    // Calculer le prix de rachat basé sur l'âge et la durabilité
    const sellPrice = calculateSellPrice(machineConfig.dollarPrice, avgAge, avgDurability);
    
    return {
      type,
      config: machineConfig,
      count,
      avgAge: Math.round(avgAge),
      avgDurability: Math.round(avgDurability),
      sellPrice,
      machines: typeMachines
    };
  });

  const sellEmbed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('💸 **VENDRE DES MACHINES** 💸')
    .setDescription(`**💵 Solde actuel**: ${dollarBalance.toFixed(2)}$\n**🏭 Machines totales**: ${user.machines.length} (minimum requis: 1)\n\n*Sélectionnez le type de machine à vendre*`)
    .addFields([
      {
        name: '📊 **VOS MACHINES DISPONIBLES**',
        value: machineOptions.map(option => {
          const depreciationPercent = Math.round(((option.config.dollarPrice - option.sellPrice) / option.config.dollarPrice) * 100);
          const condition = getConditionText(option.avgDurability);
          
          return `${option.config.emoji} **${option.config.name}** (x${option.count})\n` +
                 `├ Prix d'achat: ${option.config.dollarPrice.toLocaleString()}$\n` +
                 `├ Prix de rachat: **${option.sellPrice.toLocaleString()}$** (-${depreciationPercent}%)\n` +
                 `├ Âge moyen: ${option.avgAge} jour(s)\n` +
                 `└ État: ${condition} (${option.avgDurability}%)`;
        }).join('\n\n'),
        inline: false
      },
      {
        name: '📈 **CALCUL DU PRIX DE RACHAT**',
        value: [
          '• **Base**: 60% du prix d\'achat initial',
          '• **Âge**: -2% par jour (max -30%)',
          '• **Durabilité**: Bonus/malus selon l\'état',
          '• **Minimum**: 20% du prix d\'achat'
        ].join('\n'),
        inline: false
      }
    ])
    .setFooter({ text: 'Vous devez conserver au moins 1 machine!' })
    .setTimestamp();

  // Créer le menu de sélection
  const machineSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('sell_machine_select')
    .setPlaceholder('💸 Choisissez un type de machine à vendre...')
    .addOptions(
      machineOptions.map(option => ({
        label: `${option.config.name} (x${option.count})`,
        description: `Vendre pour ${option.sellPrice.toLocaleString()}$ chacune • État: ${Math.round(option.avgDurability)}%`,
        value: `sell_${option.type}`,
        emoji: option.config.emoji
      }))
    );

  const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(machineSelectMenu);

  const response = await interaction.reply({
    embeds: [sellEmbed],
    components: [actionRow],
    fetchReply: true
  });

  // Configurer le collector
  setupSellCollector(response, interaction, services, machineOptions);
}

function setupSellCollector(response: any, interaction: ChatInputCommandInteraction, services: Map<string, any>, machineOptions: any[]) {
  const collector = response.createMessageComponentCollector({
    time: 300000 // 5 minutes
  });

  collector.on('collect', async (componentInteraction: StringSelectMenuInteraction | ButtonInteraction) => {
    if (componentInteraction.user.id !== interaction.user.id) {
      await componentInteraction.reply({
        content: '❌ Vous ne pouvez pas utiliser cette interface de vente!',
        ephemeral: true
      });
      return;
    }

    if (componentInteraction.isStringSelectMenu()) {
      const selectInteraction = componentInteraction as StringSelectMenuInteraction;
      const machineType = selectInteraction.values[0].replace('sell_', '');
      await showIndividualMachines(selectInteraction, services, machineType, machineOptions);
    } else if (componentInteraction.isButton()) {
      const buttonInteraction = componentInteraction as ButtonInteraction;
      await handleSellButtonClick(buttonInteraction, services);
    }
  });

  collector.on('end', async () => {
    try {
      const disabledMenu = new StringSelectMenuBuilder()
        .setCustomId('sell_machine_select')
        .setPlaceholder('⏰ Session expirée')
        .setDisabled(true)
        .addOptions([{
          label: 'Session expirée',
          description: 'Utilisez /vendre pour recommencer',
          value: 'expired'
        }]);

      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(disabledMenu);

      await interaction.editReply({
        components: [disabledRow]
      });
    } catch (error) {
      // Ignore les erreurs de modification après expiration
    }
  });
}

async function showIndividualMachines(interaction: StringSelectMenuInteraction, services: Map<string, any>, machineType: string, machineOptions: any[]) {
  const databaseService = services.get('database');
  
  // Récupérer les machines de ce type spécifique
  const user = await databaseService.client.user.findUnique({
    where: { discordId: interaction.user.id },
    include: { 
      machines: {
        where: { type: machineType },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!user || user.machines.length === 0) {
    await interaction.reply({
      content: '❌ Aucune machine de ce type trouvée.',
      ephemeral: true
    });
    return;
  }

  const machineConfig = machineInfo[machineType as keyof typeof machineInfo];
  const option = machineOptions.find(opt => opt.type === machineType);

  const detailEmbed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle(`${machineConfig.emoji} **VENDRE ${machineConfig.name}** ${machineConfig.emoji}`)
    .setDescription(`**Machines disponibles**: ${user.machines.length}\n*Sélectionnez la machine spécifique à vendre*`)
    .addFields([
      {
        name: '💰 **ESTIMATION DU PRIX**',
        value: `Prix de rachat moyen: **${option.sellPrice.toLocaleString()}$** par machine`,
        inline: false
      },
      {
        name: '📋 **VOS MACHINES**',
        value: user.machines.map((machine: any, index: number) => {
          const ageInDays = Math.floor((Date.now() - new Date(machine.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          const individualSellPrice = calculateSellPrice(machineConfig.dollarPrice, ageInDays, machine.durability);
          const condition = getConditionText(machine.durability);
          
          return `**#${index + 1}** (ID: ${machine.id.substring(0, 8)})\n` +
                 `├ Niveau: ${machine.level} | Efficacité: ${Math.round(machine.efficiency)}%\n` +
                 `├ Durabilité: ${Math.round(machine.durability)}% (${condition})\n` +
                 `├ Âge: ${ageInDays} jour(s)\n` +
                 `└ **Prix de rachat: ${individualSellPrice.toLocaleString()}$**`;
        }).join('\n\n'),
        inline: false
      }
    ])
    .setFooter({ text: 'Les prix varient selon l\'âge et l\'état de chaque machine' });

  // Créer le menu de sélection des machines individuelles
  const individualMachineMenu = new StringSelectMenuBuilder()
    .setCustomId('sell_individual_machine')
    .setPlaceholder('🔧 Choisissez la machine spécifique à vendre...')
    .addOptions(
      user.machines.map((machine: any, index: number) => {
        const ageInDays = Math.floor((Date.now() - new Date(machine.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const sellPrice = calculateSellPrice(machineConfig.dollarPrice, ageInDays, machine.durability);
        const condition = getConditionText(machine.durability);
        
        return {
          label: `Machine #${index + 1} - ${sellPrice.toLocaleString()}$`,
          description: `Niv.${machine.level} • ${condition} • ${ageInDays}j • Durabilité ${Math.round(machine.durability)}%`,
          value: machine.id,
          emoji: '🔧'
        };
      })
    );

  const backButton = new ButtonBuilder()
    .setCustomId('sell_back_to_types')
    .setLabel('🔙 Retour aux types')
    .setStyle(ButtonStyle.Secondary);

  const components = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(individualMachineMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)
  ];

  await interaction.update({
    embeds: [detailEmbed],
    components
  });
}

async function handleSellButtonClick(interaction: ButtonInteraction, services: Map<string, any>) {
  if (interaction.customId === 'sell_back_to_types') {
    // Retourner à la liste des types de machines
    const databaseService = services.get('database');
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { machines: true }
    });

    if (user) {
      await showMachinesForSale(interaction as any, user, services);
    }
  } else if (interaction.customId.startsWith('confirm_sell_')) {
    await processMachineSale(interaction, services);
  } else if (interaction.customId === 'cancel_sell') {
    await interaction.update({
      content: '❌ Vente annulée.',
      embeds: [],
      components: []
    });
  }
}

async function processMachineSale(interaction: ButtonInteraction, services: Map<string, any>) {
  const machineId = interaction.customId.replace('confirm_sell_', '');
  const databaseService = services.get('database');
  const activityService = services.get('activity') as ActivityService;

  try {
    await databaseService.client.$transaction(async (tx: any) => {
      // Récupérer la machine et vérifier qu'elle appartient à l'utilisateur
      const machine = await tx.machine.findFirst({
        where: { 
          id: machineId,
          user: { discordId: interaction.user.id }
        },
        include: { user: true }
      });

      if (!machine) {
        throw new Error('Machine non trouvée ou non autorisée');
      }

      // Vérifier qu'il reste au moins 2 machines (pour pouvoir en vendre une)
      const userMachineCount = await tx.machine.count({
        where: { userId: machine.userId }
      });

      if (userMachineCount <= 1) {
        throw new Error('Impossible de vendre votre dernière machine');
      }

      // Calculer le prix de vente
      const machineConfig = machineInfo[machine.type as keyof typeof machineInfo];
      const ageInDays = Math.floor((Date.now() - new Date(machine.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const sellPrice = calculateSellPrice(machineConfig.dollarPrice, ageInDays, machine.durability);

      // Supprimer la machine
      await tx.machine.delete({
        where: { id: machineId }
      });

      // Créditer les dollars via transaction
      await tx.transaction.create({
        data: {
          userId: machine.userId,
          type: TransactionType.EXCHANGE_TOKEN_TO_DOLLAR, // Utilise ce type pour la vente
          amount: sellPrice,
          description: `Vente machine ${machineConfig.name} (${Math.round(machine.durability)}% durabilité, ${ageInDays}j)`
        }
      });

      // Mettre à jour le solde dollars de l'utilisateur (si le champ existe)
      try {
        await tx.user.update({
          where: { id: machine.userId },
          data: { dollars: { increment: sellPrice } }
        });
      } catch (error) {
        // Si le champ dollars n'existe pas, on ignore cette erreur
        console.log('Champ dollars non trouvé, transaction enregistrée uniquement');
      }

      // Succès
      const successEmbed = new EmbedBuilder()
        .setColor(0x27AE60)
        .setTitle('🎉 **VENTE RÉUSSIE** 🎉')
        .setDescription(`Votre **${machineConfig.name}** a été vendue avec succès!`)
        .addFields([
          {
            name: '💰 **DÉTAILS DE LA VENTE**',
            value: [
              `• **Machine**: ${machineConfig.emoji} ${machineConfig.name}`,
              `• **Prix de vente**: ${sellPrice.toLocaleString()}$`,
              `• **État vendu**: ${Math.round(machine.durability)}% durabilité`,
              `• **Âge**: ${ageInDays} jour(s)`,
              `• **Machines restantes**: ${userMachineCount - 1}`
            ].join('\n'),
            inline: false
          },
          {
            name: '💡 **CONSEILS**',
            value: [
              '• Utilisez vos dollars pour acheter de meilleures machines',
              '• Pensez à entretenir vos machines pour maximiser leur valeur',
              '• Gardez toujours au moins une machine active'
            ].join('\n'),
            inline: false
          }
        ])
        .setFooter({ text: 'Merci pour votre transaction!' })
        .setTimestamp();

      await interaction.update({
        embeds: [successEmbed],
        components: []
      });
    });

  } catch (error) {
    console.error('Error processing machine sale:', error);
    
    let errorMessage = 'Une erreur est survenue lors de la vente.';
    if (error instanceof Error) {
      if (error.message.includes('dernière machine')) {
        errorMessage = 'Impossible de vendre votre dernière machine!';
      } else if (error.message.includes('non trouvée')) {
        errorMessage = 'Machine non trouvée ou non autorisée.';
      }
    }

    await interaction.update({
      content: `❌ ${errorMessage}`,
      embeds: [],
      components: []
    });
  }
}

// Fonctions utilitaires

function calculateSellPrice(originalPrice: number, ageInDays: number, durability: number): number {
  // Prix de base: 60% du prix d'achat
  let sellPrice = originalPrice * 0.6;
  
  // Dépréciation par âge: -2% par jour, maximum -30%
  const ageDepreciation = Math.min(ageInDays * 0.02, 0.30);
  sellPrice *= (1 - ageDepreciation);
  
  // Bonus/malus selon la durabilité
  const durabilityModifier = (durability - 50) / 100; // -50% à +50% selon durabilité
  sellPrice *= (1 + durabilityModifier * 0.2); // Impact max ±20%
  
  // Prix minimum: 20% du prix d'achat
  const minimumPrice = originalPrice * 0.2;
  sellPrice = Math.max(sellPrice, minimumPrice);
  
  return Math.round(sellPrice);
}

function getConditionText(durability: number): string {
  if (durability >= 90) return '🟢 Excellent';
  if (durability >= 75) return '🟡 Bon';
  if (durability >= 50) return '🟠 Moyen';
  if (durability >= 25) return '🔴 Mauvais';
  return '💀 Critique';
}
