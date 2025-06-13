import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Affiche votre inventaire complet classé par catégories');

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const databaseService = services.get('database');
    
    // Get user data with all relations
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { 
        machines: true,
        // TODO: Add other inventory relations when implemented
        // infrastructures: true,
        // energySources: true,
        // modules: true,
        // items: true
      }
    });

    if (!user) {
      await interaction.reply({
        content: '❌ Vous devez d\'abord créer votre profil avec `/register`',
        ephemeral: true
      });
      return;
    }

    // Create main embed
    const embed = new EmbedBuilder()
      .setColor(0x8B4513) // Brown color for inventory
      .setTitle(`📦 Inventaire de ${user.username}`)
      .setDescription('Voici tous vos équipements et objets classés par catégories')
      .setTimestamp();

    // 🏭 INFRASTRUCTURES ET EMPLACEMENTS
    const infrastructureText = await getInfrastructureText(user);
    embed.addFields({
      name: '🏭 Infrastructures et Emplacements',
      value: infrastructureText,
      inline: false
    });

    // ⛏️ MACHINES DE MINAGE
    const machinesText = getMachinesText(user.machines);
    embed.addFields({
      name: '⛏️ Machines de Minage',
      value: machinesText,
      inline: false
    });

    // ⚡ SOURCES D'ÉNERGIE
    const energyText = await getEnergySourcesText(user);
    embed.addFields({
      name: '⚡ Sources d\'Énergie',
      value: energyText,
      inline: false
    });

    // 🔧 AMÉLIORATIONS ET MODULES
    const modulesText = await getModulesText(user);
    embed.addFields({
      name: '🔧 Améliorations et Modules',
      value: modulesText,
      inline: false
    });

    // 🎒 OBJETS ET CONSOMMABLES
    const itemsText = await getItemsText(user);
    embed.addFields({
      name: '🎒 Objets et Consommables',
      value: itemsText,
      inline: false
    });

    // Summary footer
    const totalValue = calculateTotalInventoryValue(user);
    embed.setFooter({
      text: `💰 Valeur estimée: ${totalValue.toFixed(0)} tokens • Utilisez /shop pour acheter plus d'équipements`
    });

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in inventory command:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors de l\'affichage de votre inventaire.',
      ephemeral: true
    });
  }
}

/**
 * Get infrastructure text for display
 */
async function getInfrastructureText(user: any): Promise<string> {
  // TODO: Implement when infrastructure system is added
  // For now, show basic capacity based on user level/tokens
  
  const baseCapacity = 3; // Garage Personnel
  let currentCapacity = baseCapacity;
  let infrastructureLevel = 'Garage Personnel';
  
  // Determine infrastructure level based on tokens/machines
  if (user.tokens >= 20000 || user.machines.length > 25) {
    infrastructureLevel = 'Méga Datacenter';
    currentCapacity = 100;
  } else if (user.tokens >= 5000 || user.machines.length > 10) {
    infrastructureLevel = 'Complexe Minier';
    currentCapacity = 25;
  } else if (user.tokens >= 1000 || user.machines.length > 3) {
    infrastructureLevel = 'Entrepôt Industriel';
    currentCapacity = 10;
  }

  const usedSlots = user.machines.length;
  const progressBar = createProgressBar(usedSlots, currentCapacity);

  return `📍 **${infrastructureLevel}**\n` +
         `└ Capacité: ${usedSlots}/${currentCapacity} machines ${progressBar}\n\n` +
         `🔮 **Prochaine amélioration:**\n` +
         `└ ${getNextInfrastructureUpgrade(infrastructureLevel)}`;
}

/**
 * Get machines text for display
 */
function getMachinesText(machines: any[]): string {
  if (machines.length === 0) {
    return `💡 **Aucune machine**\n` +
           `└ Visitez la boutique avec \`/shop\` pour acheter votre première machine!`;
  }

  // Group machines by type
  const machineGroups: { [key: string]: any[] } = {};
  machines.forEach(machine => {
    if (!machineGroups[machine.type]) {
      machineGroups[machine.type] = [];
    }
    machineGroups[machine.type].push(machine);
  });

  let text = '';
  
  Object.entries(machineGroups).forEach(([type, typeMachines]) => {
    const machineInfo = getMachineInfo(type);
    const count = typeMachines.length;
    const avgLevel = Math.round(typeMachines.reduce((sum, m) => sum + m.level, 0) / count);
    const avgEfficiency = Math.round(typeMachines.reduce((sum, m) => sum + m.efficiency, 0) / count);
    const avgDurability = Math.round(typeMachines.reduce((sum, m) => sum + m.durability, 0) / count);
    
    text += `${machineInfo.emoji} **${machineInfo.name}** (x${count})\n`;
    text += `└ Niveau moyen: ${avgLevel} | Efficacité: ${avgEfficiency}% | Durabilité: ${avgDurability}%\n`;
  });

  return text;
}

/**
 * Get energy sources text
 */
async function getEnergySourcesText(user: any): Promise<string> {
  // TODO: Implement when energy system is added
  return `⚡ **Réseau Électrique** (Gratuit)\n` +
         `└ Coût énergétique: Standard\n\n` +
         `🔮 **Sources disponibles:**\n` +
         `└ Panneaux Solaires (-20% coût) - 1,500 tokens\n` +
         `└ Éolienne (-30% coût) - 3,000 tokens\n` +
         `└ Centrale Nucléaire (-50% coût) - 15,000 tokens`;
}

/**
 * Get modules text
 */
async function getModulesText(user: any): Promise<string> {
  // TODO: Implement when modules system is added
  return `🔧 **Aucun module installé**\n\n` +
         `🔮 **Modules disponibles:**\n` +
         `└ Système de Refroidissement (+15% efficacité)\n` +
         `└ Kit d'Overclocking (+25% hash rate)\n` +
         `└ IA d'Optimisation (+10% rendement global)\n` +
         `└ Maintenance Auto (-50% coût maintenance)`;
}

/**
 * Get items text
 */
async function getItemsText(user: any): Promise<string> {
  // TODO: Implement when items system is added
  return `🎒 **Inventaire vide**\n\n` +
         `🔮 **Objets disponibles:**\n` +
         `└ Kit de Réparation (Restaure 100% durabilité)\n` +
         `└ Booster Temporaire 1h (x2 rendement)\n` +
         `└ Token de Protection (Immunité battle royale)\n` +
         `└ Cristal d'Énergie (Énergie gratuite 24h)`;
}

/**
 * Calculate total inventory value
 */
function calculateTotalInventoryValue(user: any): number {
  let totalValue = 0;
  
  // Calculate machines value
  user.machines.forEach((machine: any) => {
    const machineInfo = getMachineInfo(machine.type);
    const baseValue = machineInfo.cost;
    const levelMultiplier = machine.level * 0.5; // Each level adds 50% value
    totalValue += baseValue * (1 + levelMultiplier);
  });
  
  // TODO: Add value for other items when implemented
  
  return totalValue;
}

/**
 * Get machine information
 */
function getMachineInfo(type: string) {
  const machines: { [key: string]: any } = {
    'BASIC_RIG': {
      name: 'Basic Rig',
      emoji: '🔧',
      cost: 100,
      hashRate: 0.1
    },
    'ADVANCED_RIG': {
      name: 'Advanced Rig',
      emoji: '⚙️',
      cost: 500,
      hashRate: 0.5
    },
    'QUANTUM_MINER': {
      name: 'Quantum Miner',
      emoji: '🔬',
      cost: 2000,
      hashRate: 2.0
    },
    'FUSION_REACTOR': {
      name: 'Fusion Reactor',
      emoji: '⚛️',
      cost: 10000,
      hashRate: 10.0
    },
    'MEGA_FARM': {
      name: 'Mega Farm',
      emoji: '🏭',
      cost: 50000,
      hashRate: 50.0
    }
  };
  
  return machines[type] || {
    name: type,
    emoji: '❓',
    cost: 0,
    hashRate: 0
  };
}

/**
 * Get next infrastructure upgrade
 */
function getNextInfrastructureUpgrade(current: string): string {
  const upgrades: { [key: string]: string } = {
    'Garage Personnel': 'Entrepôt Industriel (1,000 tokens)',
    'Entrepôt Industriel': 'Complexe Minier (5,000 tokens)',
    'Complexe Minier': 'Méga Datacenter (20,000 tokens)',
    'Méga Datacenter': 'Campus Technologique (100,000 tokens)'
  };
  
  return upgrades[current] || 'Niveau maximum atteint!';
}

/**
 * Create a progress bar
 */
function createProgressBar(current: number, max: number, length: number = 10): string {
  const percentage = Math.min(current / max, 1);
  const filledLength = Math.round(length * percentage);
  const emptyLength = length - filledLength;
  
  const filled = '█'.repeat(filledLength);
  const empty = '░'.repeat(emptyLength);
  
  return `[${filled}${empty}]`;
}