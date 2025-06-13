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
import { MachineType, AttackType, DefenseType, CardRarity, FragmentType, TransactionType } from '@prisma/client';
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

// Configuration des machines
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
    await showMainShop(interaction, user, services);

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

async function showMainShop(interaction: ChatInputCommandInteraction | ButtonInteraction, user: any, services: Map<string, any>) {
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
        name: '💡 **CONSEILS**',
        value: `💰 Commencez par une machine\n🛡️ Investissez en défenses\n⚡ Gérez votre énergie`,
        inline: true
      }
    )
    .setFooter({ text: 'Utilisez le menu ci-dessous pour naviguer' })
    .setTimestamp();

  const categoryMenu = createCategoryMenu();
  const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(categoryMenu);

  if (interaction instanceof ChatInputCommandInteraction) {
    const response = await interaction.reply({
      embeds: [mainEmbed],
      components: [actionRow],
      fetchReply: true
    });
    setupMainCollector(response, interaction, services);
  } else {
    await interaction.update({
      embeds: [mainEmbed],
      components: [actionRow]
    });
  }
}

function createCategoryMenu() {
  return new StringSelectMenuBuilder()
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
}

function setupMainCollector(response: any, interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  const collector = response.createMessageComponentCollector({
    time: 300000 // 5 minutes
  });

  collector.on('collect', async (componentInteraction: StringSelectMenuInteraction | ButtonInteraction) => {
    if (componentInteraction.user.id !== interaction.user.id) {
      await componentInteraction.reply({
        content: '❌ Vous ne pouvez pas utiliser cette boutique!',
        ephemeral: true
      });
      return;
    }

    // Récupère les données utilisateur actualisées
    interface UserWithMachines {
      id: string;
      discordId: string;
      tokens: number;
      energy: number;
      machines: any[];
      // Ajoutez d'autres propriétés utilisateur si nécessaire
    }

    const currentUser: UserWithMachines | null = await services.get('database').client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { machines: true }
    });

    if (!currentUser) {
      await componentInteraction.reply({
        content: '❌ Utilisateur introuvable.',
        ephemeral: true
      });
      return;
    }

    if (componentInteraction.isStringSelectMenu()) {
      const selectInteraction: StringSelectMenuInteraction = componentInteraction as StringSelectMenuInteraction;
      
      if (selectInteraction.customId === 'shop_category_select') {
        const category = selectInteraction.values[0] as ShopCategory;
        await handleCategorySelection(selectInteraction, currentUser, services, category);
      } else {
        await handleProductSelection(selectInteraction, currentUser, services);
      }
    } else if (componentInteraction.isButton()) {
      const buttonInteraction: ButtonInteraction = componentInteraction as ButtonInteraction;
      await handleButtonClick(buttonInteraction, currentUser, services);
    }
  });

  collector.on('end', async () => {
    try {
      const disabledMenu = createCategoryMenu().setDisabled(true);
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

async function handleCategorySelection(interaction: StringSelectMenuInteraction, user: any, services: Map<string, any>, category: ShopCategory) {
  switch (category) {
    case ShopCategory.MINING:
      await showMiningCategory(interaction, user, services);
      break;
    case ShopCategory.ATTACK_CARDS:
      await showAttackCardsCategory(interaction, user);
      break;
    case ShopCategory.DEFENSE_CARDS:
      await showDefenseCardsCategory(interaction, user);
      break;
    case ShopCategory.FRAGMENTS:
      await showFragmentsCategory(interaction, user);
      break;
    case ShopCategory.CONSUMABLES:
      await showConsumablesCategory(interaction, user);
      break;
  }
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

  const machineMenu = new StringSelectMenuBuilder()
    .setCustomId('shop_machine_select')
    .setPlaceholder('🛒 Choisissez une machine à acheter...')
    .addOptions(
      Object.entries(machineConfigs).map(([type, config]) => {
        const info = machineInfo[type as MachineType];
        return {
          label: `${info.name} - ${config.cost} tokens`,
          description: `${info.description} | ⚡${config.baseHashRate}/s`,
          value: `machine_${type}`,
          emoji: info.emoji
        };
      })
    );

  const components = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(machineMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(createBackButton())
  ];

  await interaction.update({
    embeds: [miningEmbed],
    components
  });
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

  const attackMenu = new StringSelectMenuBuilder()
    .setCustomId('shop_attack_select')
    .setPlaceholder('⚔️ Choisissez une carte d\'attaque...')
    .addOptions(
      Object.entries(attackCardInfo).map(([type, info]) => ({
        label: `${info.name} - ${info.price} tokens`,
        description: info.description,
        value: `attack_${type}`,
        emoji: info.emoji
      }))
    );

  const components = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(attackMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(createBackButton())
  ];

  await interaction.update({
    embeds: [attackEmbed],
    components
  });
}

async function showDefenseCardsCategory(interaction: StringSelectMenuInteraction, user: any) {
  const defenseEmbed = new EmbedBuilder()
    .setColor(0x27AE60)
    .setTitle('🛡️ **CARTES DE DÉFENSE** 🛡️')
    .setDescription(`**💰 Budget**: ${user.tokens.toFixed(2)} tokens\n\n*Protégez vos investissements contre les attaques!*`)
    .addFields(
      {
        name: '🔒 **DÉFENSES DISPONIBLES**',
        value: Object.entries(defenseCardInfo).map(([type, info]) => {
          const affordable = user.tokens >= info.price ? '✅' : '❌';
          return `${affordable} ${info.emoji} **${info.name}**\n💰 ${info.price} tokens\n📝 ${info.description}`;
        }).join('\n\n'),
        inline: false
      }
    )
    .setFooter({ text: '🛡️ Une bonne défense est essentielle!' });

  const defenseMenu = new StringSelectMenuBuilder()
    .setCustomId('shop_defense_select')
    .setPlaceholder('🛡️ Choisissez une carte de défense...')
    .addOptions(
      Object.entries(defenseCardInfo).map(([type, info]) => ({
        label: `${info.name} - ${info.price} tokens`,
        description: info.description,
        value: `defense_${type}`,
        emoji: info.emoji
      }))
    );

  const components = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(defenseMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(createBackButton())
  ];

  await interaction.update({
    embeds: [defenseEmbed],
    components
  });
}

async function showFragmentsCategory(interaction: StringSelectMenuInteraction, user: any) {
  const fragmentEmbed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🧩 **FRAGMENTS** 🧩')
    .setDescription(`**💰 Budget**: ${user.tokens.toFixed(2)} tokens\n\n*Collectez des fragments pour crafter des cartes puissantes!*`)
    .addFields(
      {
        name: '🔧 **MATÉRIAUX DISPONIBLES**',
        value: Object.entries(fragmentInfo).map(([type, info]) => {
          const affordable = user.tokens >= info.price ? '✅' : '❌';
          return `${affordable} ${info.emoji} **${info.name}**\n💰 ${info.price} tokens\n📝 ${info.description}`;
        }).join('\n\n'),
        inline: false
      },
      {
        name: '💡 **INFO CRAFT**',
        value: `🔴 5 fragments d'attaque = 1 carte d'attaque\n🔵 5 fragments de défense = 1 carte de défense\n🟡 Fragments rares pour objets spéciaux`,
        inline: false
      }
    )
    .setFooter({ text: '🧩 Utilisez /craft pour fabriquer des cartes!' });

  const fragmentMenu = new StringSelectMenuBuilder()
    .setCustomId('shop_fragment_select')
    .setPlaceholder('🧩 Choisissez des fragments...')
    .addOptions(
      Object.entries(fragmentInfo).map(([type, info]) => ({
        label: `${info.name} - ${info.price} tokens`,
        description: info.description,
        value: `fragment_${type}`,
        emoji: info.emoji
      }))
    );

  const components = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fragmentMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(createBackButton())
  ];

  await interaction.update({
    embeds: [fragmentEmbed],
    components
  });
}

async function showConsumablesCategory(interaction: StringSelectMenuInteraction, user: any) {
  const consumableEmbed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle('🧪 **CONSOMMABLES** 🧪')
    .setDescription(`**💰 Budget**: ${user.tokens.toFixed(2)} tokens\n**⚡ Énergie**: ${user.energy}/100\n\n*Objets à usage unique pour booster vos performances!*`)
    .addFields(
      {
        name: '💊 **POTIONS ET BOOSTS**',
        value: Object.entries(consumableInfo).map(([type, info]) => {
          const affordable = user.tokens >= info.price ? '✅' : '❌';
          return `${affordable} ${info.emoji} **${info.name}**\n💰 ${info.price} tokens\n📝 ${info.description}`;
        }).join('\n\n'),
        inline: false
      }
    )
    .setFooter({ text: '🧪 Effets temporaires mais puissants!' });

  const consumableMenu = new StringSelectMenuBuilder()
    .setCustomId('shop_consumable_select')
    .setPlaceholder('🧪 Choisissez un consommable...')
    .addOptions(
      Object.entries(consumableInfo).map(([type, info]) => ({
        label: `${info.name} - ${info.price} tokens`,
        description: info.description,
        value: `consumable_${type}`,
        emoji: info.emoji
      }))
    );

  const components = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(consumableMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(createBackButton())
  ];

  await interaction.update({
    embeds: [consumableEmbed],
    components
  });
}

function createBackButton(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId('shop_back_main')
    .setLabel('🔙 Retour')
    .setStyle(ButtonStyle.Secondary);
}

async function handleProductSelection(interaction: StringSelectMenuInteraction, user: any, services: Map<string, any>) {
  const productId = interaction.values[0];
  const [category, itemType] = productId.split('_');

  let productInfo: any;
  let price: number;

  switch (category) {
    case 'machine':
      const miningService = services.get('mining') as MiningService;
      const machineConfigs = miningService.getMachineConfigs();
      const machineConfig = machineConfigs[itemType as MachineType];
      productInfo = {
        ...machineInfo[itemType as MachineType],
        ...machineConfig
      };
      price = machineConfig.cost;
      break;
    case 'attack':
      productInfo = attackCardInfo[itemType as keyof typeof attackCardInfo];
      price = productInfo.price;
      break;
    case 'defense':
      productInfo = defenseCardInfo[itemType as keyof typeof defenseCardInfo];
      price = productInfo.price;
      break;
    case 'fragment':
      productInfo = fragmentInfo[itemType as keyof typeof fragmentInfo];
      price = productInfo.price;
      break;
    case 'consumable':
      productInfo = consumableInfo[itemType as keyof typeof consumableInfo];
      price = productInfo.price;
      break;
    default:
      await interaction.reply({
        content: '❌ Produit non reconnu.',
        ephemeral: true
      });
      return;
  }

  if (user.tokens < price) {
    await interaction.reply({
      content: `❌ Fonds insuffisants! Vous avez besoin de **${price} tokens** mais vous n'avez que **${user.tokens.toFixed(2)} tokens**.`,
      ephemeral: true
    });
    return;
  }

  // Affiche la confirmation d'achat
  const confirmEmbed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle(`${productInfo.emoji} Confirmer l'achat`)
    .setDescription(`**Produit**: ${productInfo.name}\n**Prix**: ${price} tokens\n**Description**: ${productInfo.description}`)
    .addFields(
      { name: '💰 Solde actuel', value: `${user.tokens.toFixed(2)} tokens`, inline: true },
      { name: '💰 Solde après achat', value: `${(user.tokens - price).toFixed(2)} tokens`, inline: true }
    )
    .setFooter({ text: 'Confirmez-vous cet achat?' });

  const confirmButton = new ButtonBuilder()
    .setCustomId(`confirm_purchase_${productId}`)
    .setLabel('✅ Confirmer l\'achat')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId('cancel_purchase')
    .setLabel('❌ Annuler')
    .setStyle(ButtonStyle.Danger);

  const confirmRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(confirmButton, cancelButton);

  await interaction.update({
    embeds: [confirmEmbed],
    components: [confirmRow]
  });
}

async function handleButtonClick(interaction: ButtonInteraction, user: any, services: Map<string, any>) {
  if (interaction.customId === 'shop_back_main') {
    await showMainShop(interaction, user, services);
  } else if (interaction.customId.startsWith('confirm_purchase_')) {
    await handleConfirmPurchase(interaction, user, services);
  } else if (interaction.customId === 'cancel_purchase') {
    await interaction.reply({
      content: '❌ Achat annulé.',
      ephemeral: true
    });
  }
}

async function handleConfirmPurchase(interaction: ButtonInteraction, user: any, services: Map<string, any>) {
  const productId = interaction.customId.replace('confirm_purchase_', '');
  const [category, itemType] = productId.split('_');
  
  const databaseService = services.get('database');

  try {
    let result: any;

    switch (category) {
      case 'machine':
        const miningService = services.get('mining') as MiningService;
        result = await miningService.purchaseMachine(user.id, itemType as MachineType);
        break;
      case 'attack':
        result = await purchaseAttackCard(user.id, itemType as AttackType, databaseService);
        break;
      case 'defense':
        result = await purchaseDefenseCard(user.id, itemType as DefenseType, databaseService);
        break;
      case 'fragment':
        result = await purchaseFragment(user.id, itemType as FragmentType, databaseService);
        break;
      case 'consumable':
        result = await purchaseConsumable(user.id, itemType, databaseService);
        break;
    }

    if (result?.success) {
      const successEmbed = new EmbedBuilder()
        .setColor(0x27AE60)
        .setTitle('🎉 Achat réussi!')
        .setDescription(result.message)
        .setFooter({ text: 'Bon jeu! 🎮' });

      await interaction.update({
        embeds: [successEmbed],
        components: []
      });
    } else {
      await interaction.update({
        content: `❌ ${result?.message || 'Erreur lors de l\'achat.'}`,
        embeds: [],
        components: []
      });
    }

  } catch (error) {
    console.error('Error processing purchase:', error);
    await interaction.update({
      content: '❌ Une erreur est survenue lors de l\'achat. Veuillez réessayer.',
      embeds: [],
      components: []
    });
  }
}

async function purchaseAttackCard(userId: string, cardType: AttackType, databaseService: any): Promise<{success: boolean, message: string}> {
  const cardInfo = attackCardInfo[cardType];
  const price = cardInfo.price;

  try {
    await databaseService.client.$transaction(async (tx: any) => {
      // Débite les tokens
      await tx.user.update({
        where: { id: userId },
        data: { tokens: { decrement: price } }
      });

      // Ajoute la carte d'attaque
      const existingCard = await tx.attackCard.findFirst({
        where: { userId, type: cardType, rarity: CardRarity.COMMON }
      });

      if (existingCard) {
        await tx.attackCard.update({
          where: { id: existingCard.id },
          data: { quantity: { increment: 1 } }
        });
      } else {
        await tx.attackCard.create({
          data: { userId, type: cardType, rarity: CardRarity.COMMON, quantity: 1 }
        });
      }

      // Enregistre la transaction
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.BLACK_MARKET_PURCHASE,
          amount: -price,
          description: `Achat carte d'attaque: ${cardType}`
        }
      });
    });

    return {
      success: true,
      message: `🎉 Carte d'attaque **${cardInfo.name}** achetée avec succès!`
    };

  } catch (error) {
    console.error('Error purchasing attack card:', error);
    return {
      success: false,
      message: 'Erreur lors de l\'achat de la carte d\'attaque.'
    };
  }
}

async function purchaseDefenseCard(userId: string, cardType: DefenseType, databaseService: any): Promise<{success: boolean, message: string}> {
  const cardInfo = defenseCardInfo[cardType];
  const price = cardInfo.price;

  try {
    await databaseService.client.$transaction(async (tx: any) => {
      // Débite les tokens
      await tx.user.update({
        where: { id: userId },
        data: { tokens: { decrement: price } }
      });

      // Ajoute la carte de défense
      const existingCard = await tx.defenseCard.findFirst({
        where: { userId, type: cardType, rarity: CardRarity.COMMON }
      });

      if (existingCard) {
        await tx.defenseCard.update({
          where: { id: existingCard.id },
          data: { quantity: { increment: 1 } }
        });
      } else {
        await tx.defenseCard.create({
          data: { userId, type: cardType, rarity: CardRarity.COMMON, quantity: 1 }
        });
      }

      // Enregistre la transaction
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.BLACK_MARKET_PURCHASE,
          amount: -price,
          description: `Achat carte de défense: ${cardType}`
        }
      });
    });

    return {
      success: true,
      message: `🎉 Carte de défense **${cardInfo.name}** achetée avec succès!`
    };

  } catch (error) {
    console.error('Error purchasing defense card:', error);
    return {
      success: false,
      message: 'Erreur lors de l\'achat de la carte de défense.'
    };
  }
}

async function purchaseFragment(userId: string, fragmentType: FragmentType, databaseService: any): Promise<{success: boolean, message: string}> {
  const fragmentInfo_local = fragmentInfo[fragmentType];
  const price = fragmentInfo_local.price;

  try {
    await databaseService.client.$transaction(async (tx: any) => {
      // Débite les tokens
      await tx.user.update({
        where: { id: userId },
        data: { tokens: { decrement: price } }
      });

      // Ajoute les fragments
      const existingFragment = await tx.cardFragment.findFirst({
        where: { userId, type: fragmentType }
      });

      if (existingFragment) {
        await tx.cardFragment.update({
          where: { id: existingFragment.id },
          data: { quantity: { increment: 1 } }
        });
      } else {
        await tx.cardFragment.create({
          data: { userId, type: fragmentType, quantity: 1 }
        });
      }

      // Enregistre la transaction
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.BLACK_MARKET_PURCHASE,
          amount: -price,
          description: `Achat fragment: ${fragmentType}`
        }
      });
    });

    return {
      success: true,
      message: `🎉 Fragment **${fragmentInfo_local.name}** acheté avec succès!`
    };

  } catch (error) {
    console.error('Error purchasing fragment:', error);
    return {
      success: false,
      message: 'Erreur lors de l\'achat du fragment.'
    };
  }
}

async function purchaseConsumable(userId: string, consumableType: string, databaseService: any): Promise<{success: boolean, message: string}> {
  const consumableInfo_local = consumableInfo[consumableType as keyof typeof consumableInfo];
  const price = consumableInfo_local.price;

  let effectMessage = '';
  try {
    await databaseService.client.$transaction(async (tx: any) => {
      // Débite les tokens
      await tx.user.update({
        where: { id: userId },
        data: { tokens: { decrement: price } }
      });

      // Applique l'effet du consommable immédiatement
      let effectApplied = false;

      switch (consumableType) {
        case 'ENERGY_DRINK':
          await tx.user.update({
            where: { id: userId },
            data: { energy: { increment: 25 } }
          });
          effectApplied = true;
          effectMessage = '+25 énergie';
          break;
        
        case 'MEGA_ENERGY':
          await tx.user.update({
            where: { id: userId },
            data: { energy: { increment: 50 } }
          });
          effectApplied = true;
          effectMessage = '+50 énergie';
          break;
        
        // Pour les autres consommables, on pourrait ajouter des effets temporaires
        // dans une table séparée ou des colonnes dédiées
        default:
          effectMessage = 'Effet temporaire activé';
          break;
      }

      // S'assurer que l'énergie ne dépasse pas 100
      await tx.user.updateMany({
        where: { id: userId, energy: { gt: 100 } },
        data: { energy: 100 }
      });

      // Enregistre la transaction
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.BLACK_MARKET_PURCHASE,
          amount: -price,
          description: `Achat consommable: ${consumableType}`
        }
      });
    });

    return {
      success: true,
      message: `🎉 **${consumableInfo_local.name}** utilisé avec succès! ${effectMessage ? `(${effectMessage})` : ''}`
    };

  } catch (error) {
    console.error('Error purchasing consumable:', error);
    return {
      success: false,
      message: 'Erreur lors de l\'achat du consommable.'
    };
  }
}