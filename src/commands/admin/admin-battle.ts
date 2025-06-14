import { SlashCommandBuilder, EmbedBuilder, CommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import { DatabaseService } from '../../services/database/DatabaseService';
import { RedisService } from '../../services/cache/RedisService';
import { BattleService } from '../../services/battle/BattleService';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('admin-battle')
  .setDescription('🎯 Commandes d\'administration pour les batailles royales épiques!')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('🚀 Lance une nouvelle bataille royale avec un thème épique!')
      .addIntegerOption(option =>
        option.setName('max-joueurs')
          .setDescription('Nombre maximum de participants (2-20)')
          .setRequired(false)
          .setMinValue(2)
          .setMaxValue(20))
      .addStringOption(option =>
        option.setName('theme')
          .setDescription('Thème de la bataille pour le roleplay')
          .setRequired(false)
          .addChoices(
            { name: '⚔️ Gladiateurs du Mining', value: 'gladiator' },
            { name: '🏴‍☠️ Pirates des 7 Blockchains', value: 'pirate' },
            { name: '🤖 Guerre des Robots Mineurs', value: 'robot' },
            { name: '🧙‍♂️ Sorciers du Hash', value: 'wizard' },
            { name: '🦄 Licornes Cryptographiques', value: 'unicorn' },
            { name: '🐸 Grenouilles de la Degen Pool', value: 'frog' },
            { name: '🔥 Dragons du Token Burn', value: 'dragon' },
            { name: '🚀 Astronautes vers la Lune', value: 'moon' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('force-end')
      .setDescription('🛑 Force la fin d\'une bataille en cours')
      .addStringOption(option =>
        option.setName('battle-id')
          .setDescription('ID de la bataille à terminer')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('set-moderator')
      .setDescription('👑 Nomme un modérateur de bataille')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('Utilisateur à nommer modérateur')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove-moderator')
      .setDescription('👑 Retire les droits de modérateur')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('Utilisateur à qui retirer les droits')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('📊 Statistiques complètes des batailles'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('cleanup')
      .setDescription('🧹 Nettoie les anciennes batailles'));

// Interface pour les thèmes de bataille
interface BattleTheme {
  name: string;
  emoji: string;
  startMessage: string;
  winMessage: string;
  loseMessage: string;
  arena: string;
  commentary: string[];
}

// Thèmes de bataille avec roleplay
const BATTLE_THEMES: Record<string, BattleTheme> = {
  gladiator: {
    name: "Gladiateurs du Mining",
    emoji: "⚔️",
    startMessage: "Les grilles du Colisée s'ouvrent ! Que les hash rates les plus puissants gagnent !",
    winMessage: "triomphe dans l'arène ! La foule en délire crie son nom !",
    loseMessage: "tombe face contre terre, ses miners fumant de défaite...",
    arena: "🏛️ **Colisée du Hash** - Les gradins résonnent de cris de guerre !",
    commentary: [
      "💥 Un coup de hash dévastateur !",
      "🛡️ Parade magistrale avec un antivirus !",
      "⚡ Overclocking critique ! Les machines surchauffent !",
      "🔥 Combo ravageur ! Mining pool en fusion !"
    ]
  },
  pirate: {
    name: "Pirates des 7 Blockchains",
    emoji: "🏴‍☠️",
    startMessage: "Hissez les voiles moussaillons ! La chasse au trésor commence !",
    winMessage: "accoste avec un butin légendaire ! Yo ho ho et une bouteille de tokens !",
    loseMessage: "coule dans les abysses, ses bitcoins perdus à jamais...",
    arena: "🏴‍☠️ **Océan Décentralisé** - Les vagues de volatilité font rage !",
    commentary: [
      "🏴‍☠️ Abordage ! Vol de hash power !",
      "⚓ Ancrage solide sur la blockchain !",
      "🌊 Tempête de sell orders ! Tous aux canots !",
      "💎 Trésor découvert ! Pump inattendu !"
    ]
  },
  robot: {
    name: "Guerre des Robots Mineurs",
    emoji: "🤖",
    startMessage: "INITIALISATION... BATAILLE.EXE LANCÉ ! EXTERMINER LA CONCURRENCE !",
    winMessage: "domine le champ de bataille ! VICTOIRE.EXE COMPLETÉ !",
    loseMessage: "subit un dysfonctionnement critique... ERREUR 404: TOKENS NOT FOUND",
    arena: "🤖 **Usine Cybernétique** - Étincelles et vapeur métallique !",
    commentary: [
      "⚡ OVERCLOCKING DETECTED ! TEMPÉRATURE CRITIQUE !",
      "🔧 RÉPARATION D'URGENCE ! NANOBOTS DÉPLOYÉS !",
      "💾 HACK SUCCESSFUL ! DONNÉES CORROMPUES !",
      "🚨 SYSTÈME EN SURCHAUFFE ! COOLANT NÉCESSAIRE !"
    ]
  },
  wizard: {
    name: "Sorciers du Hash",
    emoji: "🧙‍♂️",
    startMessage: "Par les barbes de Satoshi ! Que la magie du mining commence !",
    winMessage: "brandit sa baguette mining victorieuse ! Un sort de richesse l'enveloppe !",
    loseMessage: "voit sa magie se retourner contre lui... Ses sorts ont échoué !",
    arena: "🏰 **Tour des Algorithmes** - Cristaux magiques et runes brillantes !",
    commentary: [
      "✨ Sort de multiplication ! Les tokens pleuvent !",
      "🔮 Vision prophétique ! Bull run prédit !",
      "⚡ Éclair de hash ! Dégâts magiques massifs !",
      "🧪 Potion de boost ! Efficacité doublée !"
    ]
  },
  unicorn: {
    name: "Licornes Cryptographiques",
    emoji: "🦄",
    startMessage: "Dans un nuage d'arc-en-ciel et de paillettes, les licornes s'affrontent !",
    winMessage: "galope vers la victoire sur un arc-en-ciel de profits ! Magical !",
    loseMessage: "perd sa corne magique... Plus jamais de tokens rainbow...",
    arena: "🌈 **Vallée Enchantée** - Paillettes de stardust et mining pools dorés !",
    commentary: [
      "🌟 Corne magique ! Perçage de résistance !",
      "🌈 Rainbow bridge ! Connexion interdimensionnelle !",
      "✨ Paillettes toxiques ! Aveuglement temporaire !",
      "🦄 Charge fantastique ! Dégâts purs et magiques !"
    ]
  },
  frog: {
    name: "Grenouilles de la Degen Pool",
    emoji: "🐸",
    startMessage: "REEEEEEE ! Les grenouilles sortent du marais pour un combat légendaire !",
    winMessage: "fait un pump épique ! WAGMI mon pote ! 🚀",
    loseMessage: "croak tristement... Rugged par la life... F dans le chat",
    arena: "🐸 **Marais DeFi** - Bulles de gaz fee et nénuphars yield farming !",
    commentary: [
      "🐸 REEEEE ! Cri de guerre degen !",
      "💎 DIAMOND HANDS ! Hodl jusqu'au bout !",
      "📈 PUMP IT ! To the moon baby !",
      "💀 RUG PULL ! Tout le monde court !"
    ]
  },
  dragon: {
    name: "Dragons du Token Burn",
    emoji: "🔥",
    startMessage: "Les dragons ouvrent leurs gueules ! Place au brasier purificateur !",
    winMessage: "domine de ses flammes ! Ses ennemis ne sont plus que cendres !",
    loseMessage: "s'éteint lentement... Ses dernières braises disparaissent...",
    arena: "🌋 **Volcan des Burns** - Lave incandescente et fumée de tokens !",
    commentary: [
      "🔥 BURN MASSIF ! L'offre diminue !",
      "🐉 Souffle de dragon ! Incinération totale !",
      "🌋 Éruption volcanique ! Chaos sur le marché !",
      "💀 Cendres à cendres, tokens à tokens..."
    ]
  },
  moon: {
    name: "Astronautes vers la Lune",
    emoji: "🚀",
    startMessage: "3... 2... 1... DÉCOLLAGE ! Direction : Alpha Centauri !",
    winMessage: "plante le drapeau sur la lune ! Houston, nous avons un millionnaire !",
    loseMessage: "s'écrase au décollage... Mission aborted, repeat, mission aborted !",
    arena: "🚀 **Rampe de Lancement** - Fumée de propulseur et étoiles brillantes !",
    commentary: [
      "🚀 IGNITION ! Propulsion au maximum !",
      "🌙 MOON LANDING ! Objectif atteint !",
      "💥 EXPLOSION ! Échec critique du lancement !",
      "👨‍🚀 Contact perdu ! Astronaute à la dérive !"
    ]
  }
};

export async function execute(interaction: CommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const databaseService = new DatabaseService();
    const redisService = new RedisService();
    const battleService = new BattleService(databaseService, redisService);

    switch (subcommand) {
      case 'start':
        await handleStartBattle(interaction, battleService);
        break;
      
      case 'force-end':
        await handleForceEnd(interaction, battleService);
        break;
      
      case 'set-moderator':
        await handleSetModerator(interaction, databaseService);
        break;
      
      case 'remove-moderator':
        await handleRemoveModerator(interaction, databaseService);
        break;
      
      case 'stats':
        await handleBattleStats(interaction, battleService);
        break;
      
      case 'cleanup':
        await handleCleanup(interaction, battleService);
        break;
      
      default:
        await interaction.editReply('❌ Sous-commande non reconnue.');
    }

  } catch (error) {
    logger.error('Error in admin-battle command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('💥 Erreur Critique !')
      .setDescription('Houston, nous avons un problème ! Une erreur est survenue.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleStartBattle(interaction: CommandInteraction, battleService: BattleService) {
  const maxPlayers = interaction.options.get('max-joueurs')?.value as number || 10;
  const themeKey = interaction.options.get('theme')?.value as string || 'gladiator';
  const theme = BATTLE_THEMES[themeKey];
  
  const result = await battleService.createBattle(maxPlayers);
  
  if (!result.success || !result.battleId) {
    await interaction.editReply('❌ Impossible de créer la bataille !');
    return;
  }

  // Annonce publique de la bataille
  const channel = interaction.channel as TextChannel;
  
  const announceEmbed = new EmbedBuilder()
    .setTitle(`${theme.emoji} ${theme.name.toUpperCase()} ${theme.emoji}`)
    .setColor(0xff6600)
    .setDescription(`
**🎭 BATAILLE ROYALE COMMENCE !**

${theme.startMessage}

${theme.arena}

**💰 Règles de la fortune :**
• Frais d'entrée : Votre niveau × 5 tokens (minimum 10)
• Récompenses : 50% pour le 1er, 25% pour le 2e, 15% pour le 3e
• Places limitées : **${maxPlayers} guerriers maximum**
• Combat automatique dans 2-5 minutes une fois plein !

**🎮 Pour participer :** \`/battle join\`
    `)
    .addFields([
      {
        name: '🏆 Cagnotte Progressive',
        value: 'Augmente à chaque participant !',
        inline: true
      },
      {
        name: '⚡ Status',
        value: '🟢 Inscriptions ouvertes',
        inline: true
      },
      {
        name: '👥 Participants',
        value: `0 / ${maxPlayers}`,
        inline: true
      }
    ])
    .setImage('https://media.giphy.com/media/l0HlFZ3c4NENSLQRi/giphy.gif') // GIF epic battle
    .setFooter({ 
      text: `Battle ID: ${result.battleId} | Lancée par ${interaction.user.username}` 
    })
    .setTimestamp();

  await channel.send({ 
    embeds: [announceEmbed],
    content: '@everyone 🎯 **BATAILLE ROYALE ÉPIQUE** ! Qui sera le dernier debout ? 🏆'
  });

  // Confirmation privée pour l'admin
  const confirmEmbed = new EmbedBuilder()
    .setTitle('✅ Bataille Royale Lancée !')
    .setColor(0x00ff00)
    .setDescription(`
**Bataille ID :** \`${result.battleId}\`
**Thème :** ${theme.name}
**Participants max :** ${maxPlayers}
**Status :** En attente de participants

La bataille a été annoncée publiquement !
    `)
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
  
  logger.info(`Admin ${interaction.user.id} started battle ${result.battleId} with theme ${themeKey}`);
}

async function handleForceEnd(interaction: CommandInteraction, battleService: BattleService) {
  const battleId = interaction.options.get('battle-id')?.value as string;
  
  const battleInfo = await battleService.getBattleInfo(battleId);
  
  if (!battleInfo) {
    await interaction.editReply('❌ Bataille non trouvée !');
    return;
  }

  if (battleInfo.status === 'FINISHED') {
    await interaction.editReply('❌ Cette bataille est déjà terminée !');
    return;
  }

  // Force la fin via la méthode private (on doit l'exposer)
  const result = await battleService.cancelBattle(battleId);
  
  const embed = new EmbedBuilder()
    .setTitle('🛑 Bataille Forcée à Terminer')
    .setColor(0xff0000)
    .setDescription(`
**Bataille ID :** \`${battleId}\`
**Action :** ${result.success ? 'Bataille terminée et participants remboursés' : 'Échec'}
**Raison :** Intervention administrative

${result.success ? '✅' : '❌'} ${result.message}
    `)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  
  logger.info(`Admin ${interaction.user.id} force-ended battle ${battleId}`);
}

async function handleSetModerator(interaction: CommandInteraction, databaseService: DatabaseService) {
  const targetUser = interaction.options.getUser('user');
  
  if (!targetUser) {
    await interaction.editReply('❌ Utilisateur non trouvé !');
    return;
  }

  // Stockage simple dans cache Redis pour les modérateurs (ou en DB si préféré)
  // Pour simplifier, on utilise un système de cache
  const redisService = new RedisService();
  await redisService.hSet('battle:moderators', targetUser.id, 'true');
  
  const embed = new EmbedBuilder()
    .setTitle('👑 Nouveau Modérateur de Bataille !')
    .setColor(0xffd700)
    .setDescription(`
**Utilisateur :** ${targetUser.username}
**Nouvelles permissions :**
• Lancer des batailles avec \`/battle start\`
• Annuler des batailles en attente
• Voir les statistiques avancées

**🎭 Message RP :** *${targetUser.username} reçoit l'épée dorée du Maître de Guerre ! Les pouvoirs de l'arène lui sont accordés !*
    `)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  
  logger.info(`Admin ${interaction.user.id} set ${targetUser.id} as battle moderator`);
}

async function handleRemoveModerator(interaction: CommandInteraction, databaseService: DatabaseService) {
  const targetUser = interaction.options.getUser('user');
  
  if (!targetUser) {
    await interaction.editReply('❌ Utilisateur non trouvé !');
    return;
  }

  const redisService = new RedisService();
  await redisService.hDel('battle:moderators', targetUser.id);
  
  const embed = new EmbedBuilder()
    .setTitle('👑 Modérateur Démis !')
    .setColor(0x808080)
    .setDescription(`
**Utilisateur :** ${targetUser.username}
**Permissions retirées :** Modération des batailles

**🎭 Message RP :** *L'épée dorée disparaît dans un nuage de fumée... ${targetUser.username} retourne parmi les simples combattants.*
    `)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  
  logger.info(`Admin ${interaction.user.id} removed ${targetUser.id} as battle moderator`);
}

async function handleBattleStats(interaction: CommandInteraction, battleService: BattleService) {
  const activeBattles = await battleService.getActiveBattles();
  
  // Statistiques générales (simulées pour l'exemple)
  const totalBattlesThisWeek = 47; // À récupérer de la DB
  const totalPrizePoolToday = 1250.50; // À calculer
  const topWarrior = 'CryptoSlayer#1337'; // À récupérer du leaderboard
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Empire des Batailles - Statistiques')
    .setColor(0x3498db)
    .setDescription('**Rapport du Maître de Guerre**')
    .addFields([
      {
        name: '⚔️ Batailles Actives',
        value: `${activeBattles.length} en cours`,
        inline: true
      },
      {
        name: '📈 Cette Semaine',
        value: `${totalBattlesThisWeek} batailles`,
        inline: true
      },
      {
        name: '💰 Cagnotte du Jour',
        value: `${totalPrizePoolToday} tokens`,
        inline: true
      },
      {
        name: '🏆 Champion Actuel',
        value: topWarrior,
        inline: true
      },
      {
        name: '👥 Participants Uniques',
        value: '156 guerriers', // À calculer
        inline: true
      },
      {
        name: '🎭 Thème Favori',
        value: '🐸 Grenouilles Degen',
        inline: true
      }
    ])
    .setTimestamp();

  if (activeBattles.length > 0) {
    const battlesList = activeBattles.map(battle => 
      `• **${battle.id.slice(0, 8)}...** - ${battle.participants}/${battle.maxPlayers} joueurs - ${battle.prizePool}$ tokens`
    ).slice(0, 5).join('\n');
    
    embed.addFields([{
      name: '🎯 Batailles en Cours',
      value: battlesList || 'Aucune bataille active',
      inline: false
    }]);
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleCleanup(interaction: CommandInteraction, battleService: BattleService) {
  await battleService.cleanupOldBattles();
  
  const embed = new EmbedBuilder()
    .setTitle('🧹 Nettoyage Effectué !')
    .setColor(0x00ff00)
    .setDescription(`
**🗑️ Batailles anciennes supprimées**
**📊 Cache Redis nettoyé**  
**⚡ Performances optimisées**

*Les annales des batailles d'hier ont été archivées dans les cryptes de l'Histoire !*
    `)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  
  logger.info(`Admin ${interaction.user.id} performed battle cleanup`);
}

// Fonction utilitaire pour vérifier si un utilisateur est modérateur
export async function isBattleModerator(userId: string): Promise<boolean> {
  try {
    const redisService = new RedisService();
    const isMod = await redisService.hGet('battle:moderators', userId);
    return isMod === 'true';
  } catch (error) {
    logger.error('Error checking battle moderator status:', error);
    return false;
  }
}

export { BATTLE_THEMES };
