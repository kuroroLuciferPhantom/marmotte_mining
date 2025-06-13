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
import { MachineType, AttackType, DefenseType, CardRarity, FragmentType } from '@prisma/client';
import { MiningService } from '../../services/mining/MiningService';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('🛒 Boutique générale - Machines, cartes, objets et plus encore!');

// Types de boutique
enum ShopCategory {
  MAIN = 'main',
  MINING = 'mining',
  ATTACK_CARDS = 'attack_cards',
  DEFENSE_CARDS = 'defense_cards',
  FRAGMENTS = 'fragments',
  CONSUMABLES = 'consumables'
}

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

// Configuration des cartes d'attaque
const attackCardInfo = {
  VIRUS_Z3_MINER: {
    name: '🦠 Virus Z3-Miner',
    emoji: '🦠',
    description: 'Infecte les machines adverses (-50% hashrate, 2h)',
    price: 25
  },
  BLACKOUT_TARGETED: {
    name: '⚡ Blackout Ciblé',
    emoji: '⚡',
    description: 'Coupe l\'électricité (pause minage, 20min)',
    price: 15
  },
  FORCED_RECALIBRATION: {
    name: '🔧 Recalibrage Forcé',
    emoji: '🔧',
    description: 'Force une recalibration (-25% efficacité, 1h)',
    price: 20
  },
  DNS_HIJACKING: {
    name: '🌐 Détournement DNS',
    emoji: '🌐',
    description: 'Vole 10% du hashrate ennemi (3h)',
    price: 45
  },
  BRUTAL_THEFT: {
    name: '💀 Vol Brutal',
    emoji: '💀',
    description: 'Vol direct de tokens sans détection',
    price: 75
  }
};

// Configuration des cartes de défense
const defenseCardInfo = {
  ANTIVIRUS: {
    name: '🛡️ Antivirus',
    emoji: '🛡️',
    description: 'Annule les attaques de virus',
    price: 20
  },
  BACKUP_GENERATOR: {
    name: '🔋 Générateur de Secours',
    emoji: '🔋',
    description: 'Résiste aux coupures électriques',
    price: 30
  },
  OPTIMIZATION_SOFTWARE: {
    name: '⚙️ Logiciel d\'Optimisation',
    emoji: '⚙️',
    description: 'Réduit la durée des malus de 50%',
    price: 35
  },
  VPN_FIREWALL: {
    name: '🔒 VPN + Firewall',
    emoji: '🔒',
    description: '50% de chance d\'éviter les attaques réseau',
    price: 50
  },
  SABOTAGE_DETECTOR: {
    name: '📡 Détecteur de Sabotage',
    emoji: '📡',
    description: 'Identifie l\'attaquant et alerte',
    price: 60
  }
};

// Configuration des fragments
const fragmentInfo = {
  ATTACK_FRAGMENT: {
    name: '🔴 Fragment d\'Attaque',
    emoji: '🔴',
    description: 'Utilisé pour crafter des cartes d\'attaque',
    price: 5
  },
  DEFENSE_FRAGMENT: {
    name: '🔵 Fragment de Défense',
    emoji: '🔵',
    description: 'Utilisé pour crafter des cartes de défense',
    price: 5
  },
  RARE_FRAGMENT: {
    name: '🟡 Fragment Rare',
    emoji: '🟡',
    description: 'Fragment spécial pour objets rares',
    price: 15
  }
};

// Configuration des consommables
const consumableInfo = {
  ENERGY_DRINK: {
    name: '⚡ Boisson Énergétique',
    emoji: '⚡',
    description: 'Restaure 25 points d\'énergie',
    price: 10
  },
  MEGA_ENERGY: {
    name: '🔥 Méga Énergie',
    emoji: '🔥',
    description: 'Restaure 50 points d\'énergie',
    price: 18
  },
  LUCK_POTION: {
    name: '🍀 Potion de Chance',
    emoji: '🍀',
    description: '+20% de chance de succès missions (1h)',
    price: 30
  },
  MINING_BOOST: {
    name: '⛏️ Boost de Minage',
    emoji: '⛏️',
    description: '+50% de gains de minage (2h)',
    price: 40
  },
  PROTECTION_SHIELD: {
    name: '🛡️ Bouclier de Protection',
    emoji: '🛡️',
    description: 'Immunité totale aux attaques (30min)',
    price: 25
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

    // Affiche l'interface principale de la boutique
    await showMainShop(interaction, user);

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

async function showMainShop(interaction: ChatInputCommandInteraction, user: any) {
  const mainEmbed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('🛒 **BOUTIQUE GÉNÉRALE** 🛒')
    .setDescription(`**💰 Votre budget**: ${user.tokens.toFixed(2)} tokens\n**⚡ Votre énergie**: ${user.energy}/100\n\n*Choisissez une catégorie pour explorer nos produits*`)
    .addFields(
      {
        name: '🏗️ **ÉQUIPEMENTS DE MINAGE**',
        value: `⛏️ Machines de minage (5 modèles)\n💎 Du BASIC RIG au MEGA FARM\n💰 De 100 à 50,000 tokens`,
        inline: true
      },
      {
        name: '⚔️ **CARTES D\'ATTAQUE**',
        value: `🦠 Virus et sabotages\n⚡ Attaques électriques\n💀 Vols et piratage`,
        inline: true
      },
      {
        name: '🛡️ **CARTES DE DÉFENSE**',
        value: `🔒 Protection réseau\n🔋 Générateurs de secours\n📡 Détection d\'intrusion`,
        inline: true
      },
      {
        name: '🧩 **FRAGMENTS**',
        value: `🔴 Fragments d\'attaque\n🔵 Fragments de défense\n🟡 Fragments rares`,
        inline: true
      },
      {
        name: '🧪 **CONSOMMABLES**',
        value: `⚡ Boissons énergétiques\n🍀 Potions de chance\n⛏️ Boosts temporaires`,
        inline: true
      },
      {
        name: '💡 **NOUVEAUTÉS**',
        value: `🆕 Produits récemment ajoutés\n🔥 Offres spéciales\n⭐ Articles populaires`,
        inline: true
      }
    )
    .setFooter({ text: 'Utilisez le menu ci-dessous pour naviguer' })
    .setTimestamp();

  // Menu principal de catégories
  const categoryMenu = new StringSelectMenuBuilder()
    .setCustomId('shop_category_select')
    .setPlaceholder('🏪 Choisissez une catégorie...')
    .addOptions([
      {
        label: '⛏️ Équipements de Minage',
        description: 'Machines pour augmenter vos gains',
        value: ShopCategory.MINING,
        emoji: '⛏️'
      },
      {
        label: '⚔️ Cartes d\'Attaque',
        description: 'Sabotez vos concurrents',
        value: ShopCategory.ATTACK_CARDS,
        emoji: '⚔️'
      },
      {
        label: '🛡️ Cartes de Défense',
        description: 'Protégez-vous des attaques',
        value: ShopCategory.DEFENSE_CARDS,
        emoji: '🛡️'
      },
      {
        label: '🧩 Fragments',
        description: 'Matériaux pour le craft',
        value: ShopCategory.FRAGMENTS,
        emoji: '🧩'
      },
      {
        label: '🧪 Consommables',
        description: 'Objets à usage unique',
        value: ShopCategory.CONSUMABLES,
        emoji: '🧪'
      }
    ]);

  const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(categoryMenu);

  const response = await interaction.reply({
    embeds: [mainEmbed],
    components: [actionRow],
    fetchReply: true
  });

  // Collecteur pour les interactions du menu
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300000 // 5 minutes
  });

  collector.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
    if (selectInteraction.user.id !== interaction.user.id) {
      await selectInteraction.reply({
        content: '❌ Vous ne pouvez pas utiliser cette boutique!',
        ephemeral: true
      });
      return;
    }

    const category = selectInteraction.values[0] as ShopCategory;
    
    // Récupère les données utilisateur actualisées
    const currentUser = await selectInteraction.client.services?.get('database')?.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { machines: true }
    }) || user;

    switch (category) {
      case ShopCategory.MINING:
        await showMiningCategory(selectInteraction, currentUser, services);
        break;
      case ShopCategory.ATTACK_CARDS:
        await showAttackCardsCategory(selectInteraction, currentUser);
        break;
      case ShopCategory.DEFENSE_CARDS:
        await showDefenseCardsCategory(selectInteraction, currentUser);
        break;
      case ShopCategory.FRAGMENTS:
        await showFragmentsCategory(selectInteraction, currentUser);
        break;
      case ShopCategory.CONSUMABLES:
        await showConsumablesCategory(selectInteraction, currentUser);
        break;
    }
  });

  // Nettoyage après expiration
  collector.on('end', async () => {
    try {
      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(categoryMenu.setDisabled(true));

      await interaction.editReply({
        components: [disabledRow]
      });
    } catch (error) {
      // Ignore les erreurs de modification après expiration
    }
  });
}

async function showMiningCategory(interaction: StringSelectMenuInteraction, user: any, services: Map<string, any>) {
  const miningService = services.get('mining') as MiningService;
  const machineConfigs = miningService.getMachineConfigs();

  const miningEmbed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('⛏️ **ÉQUIPEMENTS DE MINAGE** ⛏️')
    .setDescription(`**💰 Budget**: ${user.tokens.toFixed(2)} tokens | **🏭 Machines**: ${user.machines.length}\n\n*Investissez dans des machines pour augmenter vos gains!*`)
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
    .setFooter({ text: '💡 Plus le prix est élevé, plus les gains sont importants!' });

  // Menu pour sélectionner une machine
  const machineMenu = new StringSelectMenuBuilder()
    .setCustomId('shop_machine_select')
    .setPlaceholder('🛒 Choisissez une machine à acheter...')
    .addOptions(
      Object.entries(machineConfigs).map(([type, config]) => {
        const info = machineInfo[type as MachineType];
        
        return {
          label: `${info.name} - ${config.cost} tokens`,
          description: `${info.description} | ⚡${config.baseHashRate}/s`,
          value: type,
          emoji: info.emoji
        };
      })
    );

  // Bouton retour
  const backButton = new ButtonBuilder()
    .setCustomId('shop_back_main')
    .setLabel('🔙 Retour')
    .setStyle(ButtonStyle.Secondary);

  const machineRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(machineMenu);
  
  const buttonRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(backButton);

  await interaction.update({
    embeds: [miningEmbed],
    components: [machineRow, buttonRow]
  });

  // Collecteur pour cette catégorie
  setupCategoryCollector(interaction, user, services, 'mining');
}

async function showAttackCardsCategory(interaction: StringSelectMenuInteraction, user: any) {
  const attackEmbed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('⚔️ **CARTES D\'ATTAQUE** ⚔️')
    .setDescription(`**💰 Budget**: ${user.tokens.toFixed(2)} tokens\n\n*Sabotez vos concurrents avec ces cartes redoutables!*`)
    .addFields(
      {
        name: '🦠 **ATTAQUES DISPONIBLES**',
        value: Object.entries(attackCardInfo).map(([type, info]) => {
          const affordable = user.tokens >= info.price ? '✅' : '❌';
          return `${affordable} ${info.emoji} **${info.name}**\n💰 ${info.price} tokens\n📝 ${info.description}`;
        }).join('\n\n'),
        inline: false
      }
    )
    .setFooter({ text: '⚠️ Utilisez ces cartes avec parcimonie!' });

  await showCategoryWithBack(interaction, attackEmbed, 'attack');
}