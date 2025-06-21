import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ButtonBuilder, 
  ActionRowBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType
} from 'discord.js';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('📦 Affiche votre inventaire complet avec détails et actions')
  .addStringOption(option =>
    option.setName('filtre')
      .setDescription('Filtrer par catégorie')
      .setRequired(false)
      .addChoices(
        { name: '⛏️ Machines uniquement', value: 'machines' },
        { name: '🔧 Modules et améliorations', value: 'modules' },
        { name: '⚡ Énergie et infrastructures', value: 'energy' },
        { name: '🎒 Objets et consommables', value: 'items' },
        { name: '💰 Valeur et statistiques', value: 'stats' }
      )
  )
  .addStringOption(option =>
    option.setName('tri')
      .setDescription('Trier par')
      .setRequired(false)
      .addChoices(
        { name: 'Niveau (croissant)', value: 'level_asc' },
        { name: 'Niveau (décroissant)', value: 'level_desc' },
        { name: 'Efficacité (croissant)', value: 'efficiency_asc' },
        { name: 'Efficacité (décroissant)', value: 'efficiency_desc' },
        { name: 'Durabilité (croissant)', value: 'durability_asc' },
        { name: 'Durabilité (décroissant)', value: 'durability_desc' },
        { name: 'Valeur (croissant)', value: 'value_asc' },
        { name: 'Valeur (décroissant)', value: 'value_desc' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    await interaction.deferReply();
    
    const databaseService = services.get('database');
    const cacheService = services.get('cache');
    
    if (!databaseService) {
      throw new Error('Service de base de données non disponible');
    }

    // 🔍 Récupérer les données utilisateur complètes
    // 🔧 CORRECTION: Retirer l'orderBy problématique sur createdAt
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { 
        machines: true, // 🔧 CORRECTION: Tri simple sans orderBy problématique
        transactions: {
          where: {
            type: {
              in: ['MACHINE_PURCHASE', 'MACHINE_UPGRADE', 'MACHINE_REPAIR']
            }
          },
          take: 5, // 🔧 CORRECTION: Limiter pour éviter les surcharges
          orderBy: { timestamp: 'desc' } // 🔧 CORRECTION: Utiliser 'timestamp' au lieu de 'createdAt'
        }
      }
    });

    if (!user) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Profil Introuvable')
        .setDescription('Vous devez d\'abord créer votre profil avec `/register`');
      
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // 📊 Paramètres de filtrage et tri
    const filterType = interaction.options.getString('filtre');
    const sortType = interaction.options.getString('tri') || 'level_desc';

    // 🎮 Créer l'affichage principal
    const inventoryData = await buildInventoryData(user, filterType, sortType, databaseService);
    const { embeds, components } = await createInventoryDisplay(inventoryData, user, filterType);

    const response = await interaction.editReply({ 
      embeds, 
      components 
    });

    // 🎯 Gérer les interactions avec les boutons
    const collector = response.createMessageComponentCollector({ 
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: '❌ Cette interaction ne vous appartient pas.', ephemeral: true });
        return;
      }

      await handleInventoryAction(i, user, services);
    });

    collector.on('end', async () => {
      // Désactiver les boutons après expiration
      const disabledComponents = components.map(row => {
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

      try {
        await interaction.editReply({ components: disabledComponents });
      } catch (error) {
        // Message peut-être supprimé, ignorer l'erreur
        logger.warn('Could not disable inventory buttons:', error);
      }
    });

  } catch (error) {
    logger.error('Error in inventory command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('💥 Erreur Système')
      .setDescription('Une erreur est survenue lors de l\'affichage de votre inventaire.')
      .addFields([
        {
          name: '🔧 Solution',
          value: 'Réessayez dans quelques instants ou contactez un administrateur.',
          inline: false
        }
      ])
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * 🏗️ Construire les données d'inventaire
 */
async function buildInventoryData(user: any, filterType: string | null, sortType: string, databaseService: any) {
  const data: {
    user: any,
    machines: any[],
    totalValue: number,
    totalHashRate: number,
    avgEfficiency: number,
    avgDurability: number,
    repairNeeded: any[],
    upgradeAvailable: any[],
    recentTransactions: any[],
    energyConsumption: number,
    dailyProduction: number
  } = {
    user,
    machines: [...(user.machines || [])], // 🔧 CORRECTION: Vérifier que machines existe
    totalValue: 0,
    totalHashRate: 0,
    avgEfficiency: 0,
    avgDurability: 0,
    repairNeeded: [] as any[],
    upgradeAvailable: [] as any[],
    recentTransactions: user.transactions || [], // 🔧 CORRECTION: Fallback pour transactions
    energyConsumption: 0,
    dailyProduction: 0
  };

  // 📊 Calculer les statistiques des machines
  if (data.machines.length > 0) {
    // Trier les machines selon le critère
    data.machines = sortMachines(data.machines, sortType);
    
    // Calculer les totaux
    data.totalValue = data.machines.reduce((sum, machine) => sum + calculateMachineValue(machine), 0);
    data.totalHashRate = data.machines.reduce((sum, machine) => sum + calculateMachineHashRate(machine), 0);
    data.avgEfficiency = data.machines.reduce((sum, machine) => sum + machine.efficiency, 0) / data.machines.length;
    data.avgDurability = data.machines.reduce((sum, machine) => sum + machine.durability, 0) / data.machines.length;
    data.energyConsumption = data.machines.reduce((sum, machine) => sum + calculateEnergyConsumption(machine), 0);
    data.dailyProduction = calculateDailyProduction(data.machines);
    
    // Identifier les machines nécessitant attention
    data.repairNeeded = data.machines.filter(machine => machine.durability < 50);
    data.upgradeAvailable = data.machines.filter(machine => machine.level < 10);
  }

  return data;
}

/**
 * 🎨 Créer l'affichage de l'inventaire
 */
async function createInventoryDisplay(data: any, user: any, filterType: string | null) {
  const embeds = [];
  const components = [];

  if (!filterType || filterType === 'machines') {
    const machineEmbed = createMachinesEmbed(data);
    embeds.push(machineEmbed);
  }

  if (!filterType || filterType === 'stats') {
    const statsEmbed = createStatsEmbed(data);
    embeds.push(statsEmbed);
  }

  if (!filterType || filterType === 'energy') {
    const energyEmbed = createEnergyEmbed(data);
    embeds.push(energyEmbed);
  }

  // 🔄 Boutons de navigation et filtres
  const navigationButtons = createNavigationButtons();
  components.push(navigationButtons);

  return { embeds, components };
}

/**
 * ⛏️ Créer l'embed des machines
 */
function createMachinesEmbed(data: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x8B4513)
    .setTitle('⛏️ Machines de Minage')
    .setTimestamp();

  if (data.machines.length === 0) {
    embed.setDescription('🔍 **Aucune machine dans votre inventaire**\n\n💡 Visitez la boutique avec `/shop` pour acheter votre première machine!');
    return embed;
  }

  // Grouper par type
  const machineGroups = groupMachinesByType(data.machines);
  let description = `📊 **${data.machines.length} machine(s) au total**\n\n`;

  Object.entries(machineGroups).forEach(([type, machines]: [string, any[]]) => {
    const machineInfo = getMachineTypeInfo(type);
    const count = machines.length;
    const avgLevel = Math.round(machines.reduce((sum, m) => sum + m.level, 0) / count);
    const avgEfficiency = Math.round(machines.reduce((sum, m) => sum + m.efficiency, 0) / count);
    const avgDurability = Math.round(machines.reduce((sum, m) => sum + m.durability, 0) / count);
    const totalHashRate = machines.reduce((sum, m) => sum + calculateMachineHashRate(m), 0);
    
    description += `${machineInfo.emoji} **${machineInfo.name}** (×${count})\n`;
    description += `├ Niveau moy: ${avgLevel} | Hash: ${totalHashRate.toFixed(2)}/s\n`;
    description += `├ Efficacité: ${avgEfficiency}% | Durabilité: ${avgDurability}%\n`;
    
    // Alertes
    const needRepair = machines.filter(m => m.durability < 50).length;
    const canUpgrade = machines.filter(m => m.level < 10).length;
    
    if (needRepair > 0 || canUpgrade > 0) {
      description += `└ `;
      if (needRepair > 0) description += `🔧 ${needRepair} à réparer `;
      if (canUpgrade > 0) description += `⬆️ ${canUpgrade} améliorables`;
      description += `\n`;
    } else {
      description += `└ ✅ Toutes en bon état\n`;
    }
    
    description += `\n`;
  });

  embed.setDescription(description);
  
  // Détails des machines individuelles (top 5)
  if (data.machines.length > 0) {
    const topMachines = data.machines.slice(0, 5);
    let machineDetails = '';

    topMachines.forEach((machine: any, index: number) => {
      const machineInfo = getMachineTypeInfo(machine.type);
      const hashRate = calculateMachineHashRate(machine);
      
      const statusEmoji = machine.durability < 30 ? '🔴' : machine.durability < 70 ? '🟡' : '🟢';
      
      machineDetails += `**${index + 1}.** ${machineInfo.emoji} Niv.${machine.level} | `;
      machineDetails += `${hashRate.toFixed(2)}/s | ${statusEmoji} ${machine.durability}%\n`;
    });
    
    embed.addFields([
      {
        name: '🏆 Top 5 Machines',
        value: machineDetails || 'Aucune machine',
        inline: false
      }
    ]);
  }

  return embed;
}

/**
 * 📊 Créer l'embed des statistiques
 */
function createStatsEmbed(data: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('📊 Statistiques d\'Inventaire')
    .setTimestamp();

  const valueFormatted = data.totalValue.toLocaleString('fr-FR');
  const dailyTokens = (data.dailyProduction * 24).toFixed(2);
  const weeklyTokens = (data.dailyProduction * 24 * 7).toFixed(2);
  
  embed.addFields([
    {
      name: '💰 Valeurs',
      value: `**Inventaire total:** ${valueFormatted} tokens\n**Portefeuille:** ${data.user.tokens.toFixed(2)} tokens\n**Fortune totale:** ${(data.totalValue + data.user.tokens).toLocaleString('fr-FR')} tokens`,
      inline: true
    },
    {
      name: '⚡ Production',
      value: `**Hash rate total:** ${data.totalHashRate.toFixed(2)}/s\n**Production/jour:** ${dailyTokens} tokens\n**Production/semaine:** ${weeklyTokens} tokens`,
      inline: true
    },
    {
      name: '🔧 État Général',
      value: `**Efficacité moyenne:** ${data.avgEfficiency.toFixed(1)}%\n**Durabilité moyenne:** ${data.avgDurability.toFixed(1)}%\n**Consommation:** ${data.energyConsumption.toFixed(1)} kW/h`,
      inline: true
    }
  ]);

  // Alertes et recommandations
  let alerts = '';
  if (data.repairNeeded.length > 0) {
    alerts += `🔧 **${data.repairNeeded.length} machine(s)** nécessitent une réparation\n`;
  }
  if (data.upgradeAvailable.length > 0) {
    alerts += `⬆️ **${data.upgradeAvailable.length} machine(s)** peuvent être améliorées\n`;
  }
  if (data.avgEfficiency < 80) {
    alerts += `⚠️ Efficacité globale faible (${data.avgEfficiency.toFixed(1)}%)\n`;
  }
  if (data.energyConsumption > 100) {
    alerts += `⚡ Consommation énergétique élevée (${data.energyConsumption.toFixed(1)} kW/h)\n`;
  }

  if (alerts) {
    embed.addFields([
      {
        name: '⚠️ Alertes et Recommandations',
        value: alerts,
        inline: false
      }
    ]);
  }

  // Transactions récentes
  if (data.recentTransactions.length > 0) {
    let transactionText = '';
    data.recentTransactions.slice(0, 3).forEach((transaction: any) => {
      // 🔧 CORRECTION: Utiliser 'timestamp' au lieu de 'createdAt'
      const date = new Date(transaction.timestamp).toLocaleDateString('fr-FR');
      const typeEmoji = getTransactionEmoji(transaction.type);
      transactionText += `${typeEmoji} ${transaction.type.replace('_', ' ').toLowerCase()} - ${date}\n`;
    });
    
    embed.addFields([
      {
        name: '📋 Transactions Récentes',
        value: transactionText,
        inline: false
      }
    ]);
  }

  return embed;
}

/**
 * ⚡ Créer l'embed de l'énergie
 */
function createEnergyEmbed(data: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('⚡ Énergie et Infrastructure')
    .setTimestamp();

  const energyCost = data.energyConsumption * 0.1; // 0.1 token/kW/h
  const infrastructure = calculateInfrastructureLevel(data.user);
  
  embed.addFields([
    {
      name: '🏭 Infrastructure Actuelle',
      value: `**Niveau:** ${infrastructure.name}\n**Capacité:** ${data.machines.length}/${infrastructure.capacity} machines\n**Coût d'exploitation:** ${energyCost.toFixed(2)} tokens/h`,
      inline: true
    },
    {
      name: '⚡ Consommation Énergétique',
      value: `**Actuelle:** ${data.energyConsumption.toFixed(1)} kW/h\n**Coût journalier:** ${(energyCost * 24).toFixed(2)} tokens\n**Efficacité:** ${calculateEnergyEfficiency(data.machines).toFixed(1)}%`,
      inline: true
    },
    {
      name: '🔮 Améliorations Possibles',
      value: getEnergyUpgradeRecommendations(data),
      inline: false
    }
  ]);

  return embed;
}

/**
 * 🧭 Créer les boutons de navigation
 */
function createNavigationButtons(): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('inventory_refresh')
      .setLabel('🔄 Actualiser')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔄'),
  );

  return row;
}

/**
 * 🎯 Gérer les actions d'inventaire
 */
async function handleInventoryAction(interaction: any, user: any, services: Map<string, any>) {
  const actionId = interaction.customId;
  
  try {
    await interaction.deferUpdate();
    
    switch (actionId) {
      case 'inventory_refresh':
        // Recharger l'inventaire
        const refreshedData = await buildInventoryData(user, null, 'level_desc', services.get('database'));
        const { embeds, components } = await createInventoryDisplay(refreshedData, user, null);
        await interaction.editReply({ embeds, components });
        break;
        
      default:
        logger.warn(`Unknown inventory action: ${actionId}`);
    }
    
  } catch (error) {
    logger.error('Error handling inventory action:', error);
  }
}

// ========================
// 🛠️ FONCTIONS UTILITAIRES
// ========================

function sortMachines(machines: any[], sortType: string): any[] {
  return machines.sort((a, b) => {
    switch (sortType) {
      case 'level_asc': return a.level - b.level;
      case 'level_desc': return b.level - a.level;
      case 'efficiency_asc': return a.efficiency - b.efficiency;
      case 'efficiency_desc': return b.efficiency - a.efficiency;
      case 'durability_asc': return a.durability - b.durability;
      case 'durability_desc': return b.durability - a.durability;
      case 'value_asc': return calculateMachineValue(a) - calculateMachineValue(b);
      case 'value_desc': return calculateMachineValue(b) - calculateMachineValue(a);
      default: return b.level - a.level;
    }
  });
}

function groupMachinesByType(machines: any[]): { [key: string]: any[] } {
  return machines.reduce((groups, machine) => {
    if (!groups[machine.type]) {
      groups[machine.type] = [];
    }
    groups[machine.type].push(machine);
    return groups;
  }, {});
}

function getMachineTypeInfo(type: string) {
  const types: { [key: string]: any } = {
    'BASIC_RIG': { name: 'Basic Rig', emoji: '🔧', baseCost: 100, baseHashRate: 0.1 },
    'ADVANCED_RIG': { name: 'Advanced Rig', emoji: '⚙️', baseCost: 500, baseHashRate: 0.5 },
    'QUANTUM_MINER': { name: 'Quantum Miner', emoji: '🔬', baseCost: 2000, baseHashRate: 2.0 },
    'FUSION_REACTOR': { name: 'Fusion Reactor', emoji: '⚛️', baseCost: 10000, baseHashRate: 10.0 },
    'MEGA_FARM': { name: 'Mega Farm', emoji: '🏭', baseCost: 50000, baseHashRate: 50.0 }
  };
  
  return types[type] || { name: type, emoji: '❓', baseCost: 0, baseHashRate: 0 };
}

function calculateMachineValue(machine: any): number {
  const typeInfo = getMachineTypeInfo(machine.type);
  const levelMultiplier = 1 + (machine.level - 1) * 0.5;
  const efficiencyMultiplier = machine.efficiency / 100;
  const durabilityMultiplier = machine.durability / 100;
  
  return typeInfo.baseCost * levelMultiplier * efficiencyMultiplier * durabilityMultiplier;
}

function calculateMachineHashRate(machine: any): number {
  const typeInfo = getMachineTypeInfo(machine.type);
  const levelMultiplier = 1 + (machine.level - 1) * 0.2;
  const efficiencyMultiplier = machine.efficiency / 100;
  
  return typeInfo.baseHashRate * levelMultiplier * efficiencyMultiplier;
}

function calculateEnergyConsumption(machine: any): number {
  const typeInfo = getMachineTypeInfo(machine.type);
  return typeInfo.baseHashRate * machine.level * 0.5;
}

function calculateDailyProduction(machines: any[]): number {
  return machines.reduce((total, machine) => {
    return total + calculateMachineHashRate(machine);
  }, 0);
}

function calculateInfrastructureLevel(user: any) {
  const machineCount = user.machines?.length || 0;
  const tokens = user.tokens || 0;
  
  if (machineCount >= 50 || tokens >= 100000) {
    return { name: 'Méga Datacenter', capacity: 100 };
  } else if (machineCount >= 25 || tokens >= 20000) {
    return { name: 'Complexe Minier', capacity: 50 };
  } else if (machineCount >= 10 || tokens >= 5000) {
    return { name: 'Entrepôt Industriel', capacity: 25 };
  } else if (machineCount >= 3 || tokens >= 1000) {
    return { name: 'Atelier Pro', capacity: 10 };
  } else {
    return { name: 'Garage Personnel', capacity: 5 };
  }
}

function calculateEnergyEfficiency(machines: any[]): number {
  if (machines.length === 0) return 100;
  
  const totalEfficiency = machines.reduce((sum, machine) => sum + machine.efficiency, 0);
  return totalEfficiency / machines.length;
}

function getEnergyUpgradeRecommendations(data: any): string {
  const recommendations = [];
  
  if (data.energyConsumption > 50) {
    recommendations.push('⚡ Panneaux Solaires (-20% coût énergie)');
  }
  
  if (data.energyConsumption > 100) {
    recommendations.push('🌪️ Éolienne (-30% coût énergie)');
  }
  
  if (data.energyConsumption > 200) {
    recommendations.push('⚛️ Centrale Nucléaire (-50% coût énergie)');
  }
  
  if (data.machines.length >= 10) {
    recommendations.push('🔧 Système de Refroidissement (+15% efficacité)');
  }
  
  if (data.avgEfficiency < 80) {
    recommendations.push('🤖 IA d\'Optimisation (+10% rendement global)');
  }
  
  if (recommendations.length === 0) {
    return '✅ Infrastructure optimale pour votre niveau actuel';
  }
  
  return recommendations.slice(0, 3).join('\n');
}

function getTransactionEmoji(type: string): string {
  const emojis: { [key: string]: string } = {
    'MACHINE_PURCHASE': '🛒',
    'MACHINE_UPGRADE': '⬆️',
    'MACHINE_REPAIR': '🔧',
    'MACHINE_SALE': '💰',
    'MINING_REWARD': '⛏️'
  };
  
  return emojis[type] || '📋';
}