import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, ButtonBuilder, ActionRowBuilder, ButtonStyle, User as DiscordUser, Client } from 'discord.js';
import { logger } from '../../utils/logger';
import { any } from 'joi';

export const data = new SlashCommandBuilder()
  .setName('admin-battle')
  .setDescription('⚔️ Commandes d\'administration pour les batailles de mining')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('🚀 Lance une nouvelle bataille royale de mining')
      .addIntegerOption(option =>
        option.setName('temps-inscription')
          .setDescription('Temps d\'inscription en minutes (1-30)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(30)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('📊 Statut de la bataille actuelle'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('grant-permission')
      .setDescription('✅ Accorde la permission de lancer des battles à un utilisateur')
      .addUserOption(option =>
        option.setName('utilisateur')
          .setDescription('L\'utilisateur à qui accorder la permission')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('raison')
          .setDescription('Raison de l\'octroi de la permission')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('revoke-permission')
      .setDescription('❌ Révoque la permission de lancer des battles d\'un utilisateur')
      .addUserOption(option =>
        option.setName('utilisateur')
          .setDescription('L\'utilisateur à qui révoquer la permission')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list-permissions')
      .setDescription('📋 Liste tous les utilisateurs autorisés à lancer des battles'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('check-permission')
      .setDescription('🔍 Vérifie si un utilisateur peut lancer des battles')
      .addUserOption(option =>
        option.setName('utilisateur')
          .setDescription('L\'utilisateur à vérifier')
          .setRequired(true)));

// 🆕 Configuration des bots de bataille (identique à battle.ts)
const BATTLE_BOTS = [
  { id: 'bot_crypto_miner_001', username: 'CryptoMiner2077', tokens: 850.5 },
  { id: 'bot_hash_slinger_002', username: 'HashSlinger', tokens: 724.2 },
  { id: 'bot_quantum_farm_003', username: 'QuantumFarmer', tokens: 956.8 },
  { id: 'bot_rig_master_004', username: 'RigMaster9000', tokens: 632.1 },
  { id: 'bot_mining_bot_005', username: 'MiningBotAlpha', tokens: 1123.7 },
  { id: 'bot_asic_warrior_006', username: 'ASICWarrior', tokens: 445.9 },
  { id: 'bot_gpu_overlord_007', username: 'GPUOverlord', tokens: 789.3 },
  { id: 'bot_blockchain_ninja_008', username: 'BlockchainNinja', tokens: 567.4 }
];

// Événements de bataille thématiques mining/crypto/hack
const MINING_BATTLE_EVENTS = {
  // Événements d'entrée
  entry: [
    "🔌 {username} branche ses rigs et rejoint la ferme de mining !",
    "💻 {username} hack son chemin dans le réseau de la bataille !",
    "⚡ {username} overclocke ses GPUs et entre dans l'arène !",
    "🌐 {username} se connecte au pool de bataille avec un ping parfait !",
    "🔧 {username} configure ses ASICs pour la guerre totale !",
    "💾 {username} télécharge les scripts de combat... 100% complete !",
    "🎯 {username} scan le réseau et trouve une faille pour entrer !",
    "🚀 {username} déploie ses bots de mining dans la bataille !"
  ],

  // Événements de combat sérieux
  combat_serious: [
    "💥 {attacker} lance une attaque DDoS massive sur les serveurs de {defender} !",
    "⚡ {attacker} redirige toute la puissance de calcul vers {defender} et surcharge ses circuits !",
    "🎯 {attacker} exploite une faille zero-day dans les machines de {defender} !",
    "💾 {attacker} injecte un malware qui détourne les hashrates de {defender} !",
    "🔥 {attacker} déclenche un fork hostile de la blockchain de {defender} !",
    "🌪️ {attacker} effectue un double-spend attack contre {defender} !",
    "💀 {attacker} active un botnet qui spam les transactions de {defender} !",
    "⚒️ {attacker} monopolise la pool de mining, laissant {defender} sans récompenses !"
  ],

  // Événements drôles
  combat_funny: [
    "🤡 {attacker} envoie 10 000 NFTs de singes à {defender} qui plante sous le spam !",
    "🍕 {attacker} commande 50 pizzas chez {defender}, qui abandonne tout pour manger !",
    "😴 {defender} s'endort devant ses écrans... {attacker} en profite pour débrancher tout !",
    "🐱 Le chat de {defender} marche sur le clavier et delete tous ses wallets !",
    "☕ {defender} renverse son café sur ses rigs... Court-circuit catastrophique !",
    "📱 {attacker} rickroll {defender} avec 999 notifications, qui crash mentalement !",
    "🦆 {attacker} remplace tous les sons système de {defender} par des canards... Efficiency -100% !",
    "🎮 {defender} rage quit après avoir perdu 0.0001 BTC au pump and dump de {attacker} !"
  ],

  // Événements bizarres/wtf
  combat_weird: [
    "👽 Des aliens hackent les machines de {defender} pour télécharger TikTok !",
    "🔮 {attacker} utilise l'IA de ChatGPT pour prédire les mouvements de {defender} !",
    "🌙 La lune influence mystérieusement les GPUs de {defender} qui minent à l'envers !",
    "🦾 {attacker} développe une IA consciente qui se rebelle et mine pour elle-même !",
    "🕳️ Un trou noir quantique avale 50% des tokens de {defender} !",
    "🤖 Les machines de {defender} prennent conscience et demandent un salaire !",
    "📡 {attacker} contacte Elon Musk qui tweet contre {defender}, crash immédiat !",
    "🎭 {defender} découvre que toute sa fortune était en shitcoins... Dépression existentielle !",
    "🌊 Une vague de liquidations en cascade emporte {defender} vers l'abîme !",
    "🔬 {attacker} invente la fusion froide, rendant obsolètes tous les rigs de {defender} !"
  ],

  // 🆕 Événements aléatoires globaux
  apocalypse: [
    "🌋 **APOCALYPSE VOLCANIQUE !** Une éruption massive détruit plusieurs serveurs !",
    "☄️ **IMPACT DE MÉTÉORITE !** Un astéroïde crypto frappe la bataille !",
    "🌊 **TSUNAMI NUMÉRIQUE !** Une vague de données emporte tout sur son passage !",
    "⚡ **TEMPÊTE ÉLECTROMAGNÉTIQUE !** Tous les équipements grillent !",
    "🔥 **INCENDIE DE DATACENTER !** Les serveurs partent en fumée !",
    "💥 **EXPLOSION DE SUPERNOVA !** L'énergie cosmique ravage l'arène !"
  ],

  revival: [
    "✨ **RÉSURRECTION QUANTIQUE !** Des particules subatomiques ramènent les morts !",
    "🔮 **MAGIE TECHNOLOGIQUE !** Un sort de résurrection 2.0 est lancé !",
    "🧬 **CLONAGE D'URGENCE !** Les ADN numériques sont restaurés !",
    "⚡ **DÉFIBRILLATEUR NUMÉRIQUE !** Choc électrique de réanimation !",
    "🌟 **INTERVENTION DIVINE !** RNGesus décide de faire des miracles !",
    "🔄 **BACKUP RESTAURÉ !** Les sauvegardes quantiques s'activent !"
  ],

  boost: [
    "🚀 **BOOST COSMIC !** {username} reçoit les pouvoirs de l'univers !",
    "⚡ **OVERCLOCK SUPRÊME !** {username} dépasse les limites de la physique !",
    "💎 **MAIN DE DIAMANT !** {username} devient invincible !",
    "🔥 **MODE BERSERK !** {username} entre en rage pure !",
    "🌟 **ÉTOILE FILANTE !** {username} obtient des pouvoirs stellaires !",
    "🎯 **PRÉCISION ABSOLUE !** {username} ne peut plus rater ses attaques !"
  ],

  // Éliminations
  elimination: [
    "💔 {username} voit ses derniers satoshis s'évaporer dans le mempool...",
    "😵 Les machines de {username} explosent dans un nuage de fumée bleue !",
    "💸 {username} regarde impuissant ses positions se liquider une par une...",
    "🪦 {username} rejoint le cimetière des portefeuilles rekt...",
    "😭 {username} hurle 'HODL!' mais il est déjà trop tard...",
    "💀 {username} est banni du réseau pour activité suspecte...",
    "🌪️ {username} est emporté par une tempête de volatilité...",
    "🔥 Les serveurs de {username} partent en fumée, game over !",
    "⚡ Coupure de courant chez {username}, tous ses efforts réduits à néant !",
    "💻 Écran bleu de la mort pour {username}, Windows a encore frappé !"
  ],

  // Messages de victoire
  victory: [
    "🏆 {username} domine la blockchain ! Nouveau whale confirmé !",
    "👑 {username} devient le maître suprême du mining ! All hail the king !",
    "🌟 {username} atteint le consensus ultime ! Legendary performance !",
    "⚡ {username} contrôle désormais 51% du réseau ! Power overwhelming !",
    "🔥 {username} forge la genèse d'une nouvelle ère ! Epic victory !",
    "💎 {username} a les mains de diamant les plus pures ! Diamond hands supreme !",
    "🚀 {username} pump sa victoire to the moon ! Gains gravitationnels !",
    "🎯 {username} a cracké le code de la richesse ! Algorithm mastered !"
  ]
};

// État global de la bataille (une seule à la fois)
export let currentBattle: {
  id: string;
  channelId: string;
  messageId: string;
  maxPlayers: number;
  registrationEndTime: Date;
  status: 'registration' | 'starting' | 'active' | 'finished';
  participants: string[];
} | null = null;

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const databaseService = services.get('database');
    const cacheService = services.get('cache');

    if (!databaseService) {
      throw new Error('Database service not available');
    }

    switch (subcommand) {
      case 'start':
        await handleStartBattle(interaction, services);
        break;
      
      case 'status':
        await handleStatus(interaction);
        break;

      case 'grant-permission':
        await handleGrantPermission(interaction, services);
        break;

      case 'revoke-permission':
        await handleRevokePermission(interaction, services);
        break;

      case 'list-permissions':
        await handleListPermissions(interaction, services);
        break;

      case 'check-permission':
        await handleCheckPermission(interaction, services);
        break;
      
      default:
        await interaction.editReply('❌ Sous-commande non reconnue.');
    }

  } catch (error) {
    logger.error('Error in admin-battle command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('💥 Erreur Système !')
      .setDescription('Stack overflow dans le système de bataille !')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

// 🆕 Fonction pour ajouter automatiquement des bots à la bataille (identique à battle.ts)
async function addBattleBots(battleId: string, databaseService: any, battleService: any) {
  const botCount = 5 + Math.floor(Math.random() * 4); // 5-8 bots aléatoirement
  const selectedBots = BATTLE_BOTS.slice(0, botCount);
  
  logger.info(`🤖 [admin-battle] Adding ${botCount} bots to battle ${battleId}`);
  
  for (const bot of selectedBots) {
    try {
      // Vérifier si l'utilisateur bot existe déjà
      let botUser = await databaseService.client.user.findUnique({
        where: { discordId: bot.id }
      });

      // Créer le bot s'il n'existe pas
      if (!botUser) {
        botUser = await databaseService.client.user.create({
          data: {
            discordId: bot.id,
            username: bot.username,
            tokens: bot.tokens,
            dollars: 0.0
          }
        });
        logger.info(`🤖 [admin-battle] Created bot user: ${bot.username} (${bot.id})`);
      }

      // Vérifier s'il n'est pas déjà dans la bataille
      const existingEntry = await databaseService.client.battleEntry.findUnique({
        where: { 
          battleId_userId: { 
            battleId: battleId, 
            userId: botUser.id
          } 
        }
      });

      if (!existingEntry) {
        // Ajouter le bot à la bataille
        await databaseService.client.battleEntry.create({
          data: {
            battleId: battleId,
            userId: botUser.id
          }
        });

        // Mettre à jour le prize pool
        await databaseService.client.battle.update({
          where: { id: battleId },
          data: { prizePool: { increment: 5 } }
        });

        logger.info(`✅ [admin-battle] Bot ${bot.username} added to battle ${battleId}`);
      } else {
        logger.info(`⚠️ [admin-battle] Bot ${bot.username} already in battle ${battleId}`);
      }

    } catch (error) {
      logger.error(`❌ [admin-battle] Error adding bot ${bot.username} to battle:`, error);
      // Continue avec les autres bots même si un échoue
    }
  }
}

async function handleGrantPermission(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  const targetUser = interaction.options.getUser('utilisateur') as DiscordUser;
  const reason = interaction.options.getString('raison');
  
  const databaseService = services.get('database');
  const cacheService = services.get('cache');
  
  // Créer le service de permissions
  const { BattlePermissionService } = await import('../../services/battle/BattlePermissionService');
  const permissionService = new BattlePermissionService(databaseService, cacheService);
  
  const result = await permissionService.grantBattlePermission(
    targetUser.id,
    targetUser.username,
    interaction.user.id,
    reason || undefined
  );

  const embed = new EmbedBuilder()
    .setTitle(result.success ? '✅ Permission Accordée' : '❌ Échec')
    .setColor(result.success ? 0x00ff00 : 0xff0000)
    .setDescription(result.message)
    .addFields([
      {
        name: '👤 Utilisateur',
        value: `${targetUser.username} (${targetUser.id})`,
        inline: true
      },
      {
        name: '🛡️ Admin',
        value: interaction.user.username,
        inline: true
      }
    ]);

  if (reason) {
    embed.addFields([{
      name: '📝 Raison',
      value: reason,
      inline: false
    }]);
  }

  embed.setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  
  logger.info(`Admin ${interaction.user.id} granted battle permission to ${targetUser.id}`);
}

async function handleRevokePermission(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  const targetUser = interaction.options.getUser('utilisateur') as DiscordUser;
  
  const databaseService = services.get('database');
  const cacheService = services.get('cache');
  
  // Créer le service de permissions
  const { BattlePermissionService } = await import('../../services/battle/BattlePermissionService');
  const permissionService = new BattlePermissionService(databaseService, cacheService);
  
  const result = await permissionService.revokeBattlePermission(targetUser.id);

  const embed = new EmbedBuilder()
    .setTitle(result.success ? '✅ Permission Révoquée' : '❌ Échec')
    .setColor(result.success ? 0x00ff00 : 0xff0000)
    .setDescription(result.message)
    .addFields([
      {
        name: '👤 Utilisateur',
        value: `${targetUser.username} (${targetUser.id})`,
        inline: true
      },
      {
        name: '🛡️ Admin',
        value: interaction.user.username,
        inline: true
      }
    ])
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  
  logger.info(`Admin ${interaction.user.id} revoked battle permission from ${targetUser.id}`);
}

async function handleListPermissions(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  const databaseService = services.get('database');
  const cacheService = services.get('cache');
  
  // Créer le service de permissions
  const { BattlePermissionService } = await import('../../services/battle/BattlePermissionService');
  const permissionService = new BattlePermissionService(databaseService, cacheService);
  
  const result = await permissionService.listBattlePermissions();

  if (!result.success) {
    await interaction.editReply(result.message);
    return;
  }

  const permissions = result.permissions || [];
  
  const embed = new EmbedBuilder()
    .setTitle('📋 Utilisateurs Autorisés aux Battles')
    .setColor(0x3498db)
    .setDescription(
      permissions.length === 0 
        ? '🔒 Aucun utilisateur n\'a actuellement la permission de lancer des battles.\n*Seuls les admins peuvent lancer des battles.*'
        : `🎯 **${permissions.length}** utilisateur(s) autorisé(s) :`
    );

  if (permissions.length > 0) {
    const permissionList = permissions.slice(0, 10).map((perm, index) => {
      const grantedDate = new Date(perm.grantedAt).toLocaleDateString('fr-FR');
      return `**${index + 1}.** ${perm.username}\n└ 🆔 \`${perm.discordId}\`\n└ 📅 Accordé le ${grantedDate}\n└ 👤 Par <@${perm.grantedBy}>${perm.reason ? `\n└ 📝 *${perm.reason}*` : ''}`;
    }).join('\n\n');

    embed.setDescription(`🎯 **${permissions.length}** utilisateur(s) autorisé(s) :\n\n${permissionList}`);

    if (permissions.length > 10) {
      embed.setFooter({ 
        text: `... et ${permissions.length - 10} autre(s). Utilisez /admin-battle check-permission pour des vérifications spécifiques.` 
      });
    }
  }

  embed.setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleCheckPermission(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  const targetUser = interaction.options.getUser('utilisateur') as DiscordUser;
  
  const databaseService = services.get('database');
  const cacheService = services.get('cache');
  
  // Créer le service de permissions
  const { BattlePermissionService } = await import('../../services/battle/BattlePermissionService');
  const permissionService = new BattlePermissionService(databaseService, cacheService);
  
  const canStart = await permissionService.canUserStartBattle(targetUser.id);
  
  // Récupérer les détails de la permission si elle existe
  let permissionDetails = null;
  if (canStart) {
    const result = await permissionService.listBattlePermissions();
    if (result.success && result.permissions) {
      permissionDetails = result.permissions.find(p => p.discordId === targetUser.id);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Vérification des Permissions`)
    .setColor(canStart ? 0x00ff00 : 0xff0000)
    .addFields([
      {
        name: '👤 Utilisateur',
        value: `${targetUser.username}`,
        inline: true
      },
      {
        name: '🆔 Discord ID',
        value: `\`${targetUser.id}\``,
        inline: true
      },
      {
        name: '⚔️ Peut lancer des battles',
        value: canStart ? '✅ **OUI**' : '❌ **NON**',
        inline: true
      }
    ]);

  if (canStart && permissionDetails) {
    embed.addFields([
      {
        name: '📅 Permission accordée le',
        value: new Date(permissionDetails.grantedAt).toLocaleDateString('fr-FR'),
        inline: true
      },
      {
        name: '👤 Accordée par',
        value: `<@${permissionDetails.grantedBy}>`,
        inline: true
      }
    ]);

    if (permissionDetails.reason) {
      embed.addFields([{
        name: '📝 Raison',
        value: permissionDetails.reason,
        inline: false
      }]);
    }
  } else if (canStart) {
    embed.addFields([{
      name: '🛡️ Type d\'autorisation',
      value: 'Administrateur',
      inline: true
    }]);
  }

  embed.setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}


async function handleStartBattle(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  // Vérifier qu'il n'y a pas déjà une bataille
  if (currentBattle && currentBattle.status !== 'finished') {
    await interaction.editReply('❌ Une bataille est déjà en cours ! Utilisez `/admin-battle force-end` pour la terminer.');
    return;
  }

  const registrationTime = interaction.options.getInteger('temps-inscription') || 10;
  
  const databaseService = services.get('database');
  const cacheService = services.get('cache');
  
  // Créer le BattleService dynamiquement
  const { BattleService } = await import('../../services/battle/BattleService');
  const battleService = new BattleService(databaseService, cacheService);
  
  // Créer la bataille sans limite de joueurs
  const result = await battleService.createBattle(999);
  
  if (!result.success || !result.battleId) {
    await interaction.editReply('❌ Impossible de créer la bataille !');
    return;
  }

  // 🆕 CORRECTION: Ajouter automatiquement des bots à la bataille
  logger.info('🤖 [admin-battle] Adding battle bots to the newly created battle...');
  
  try {
    await addBattleBots(result.battleId, databaseService, battleService);
    logger.info('✅ [admin-battle] Battle bots added successfully');
  } catch (error) {
    logger.error('❌ [admin-battle] Error adding battle bots:', error);
    // Continue même si l'ajout des bots échoue
  }

  const registrationEndTime = new Date(Date.now() + registrationTime * 60 * 1000);
  
  // Récupérer le nombre réel de participants après l'ajout des bots
  const battleInfo = await battleService.getBattleInfo(result.battleId);
  const realParticipantCount = battleInfo?.participants || 0;
  
  // Créer l'annonce publique
  const channel = interaction.channel as TextChannel;
  
  const announceEmbed = new EmbedBuilder()
    .setTitle('⚔️ BATAILLE ROYALE DE MINING ⚔️')
    .setColor(0xff6600)
    .setDescription(`
**🎯 LA GUERRE DES HASHRATES COMMENCE !**

Dans cette arène digitale impitoyable, seul le mineur le plus malin survivra ! 
Préparez vos rigs, sharpen vos algos, et que le meilleur geek gagne !

• **🎁 Récompenses fixes** - Top 5 gagnent des tokens !
• **🎲 Événements aléatoires** - Apocalypse, résurrections, et plus !

**⏰ INSCRIPTION LIMITÉE :**
Vous avez **${registrationTime} minutes** pour rejoindre !
Cliquez sur le bouton ci-dessous pour s'inscrire à la bagarre !
    `)
    .addFields([
      {
        name: '🏆 Récompenses',
        value: '1er: 100 tokens\n2e: 50 tokens\n3e: 25 tokens\n4e: 10 tokens\n5e: 5 tokens',
        inline: true
      },
      {
        name: '👥 Participants',
        value: `${realParticipantCount} bots déjà inscrits\n+ joueurs réels`,
        inline: true
      },
      {
        name: '⏳ Fin des inscriptions',
        value: `<t:${Math.floor(registrationEndTime.getTime() / 1000)}:R>`,
        inline: true
      }
    ])
    .setImage('https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzRyNzI1c3J2bWUxc2M0eGN3Y2xrOWpkenlqdGFteTcxbXg4b3Z6NCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ggKjpRRNpquxc1DIDU/giphy.gif')
    .setFooter({ text: `Battle ID: ${result.battleId.slice(0, 8)}... | Lancée par ${interaction.user.username} | ${realParticipantCount} bots automatiquement ajoutés` })
    .setTimestamp();

  // Bouton de participation
  const joinButton = new ButtonBuilder()
    .setCustomId(`join_battle_${result.battleId}`)
    .setLabel('🔥 BAGARRE')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('⚔️');

  const infoButton = new ButtonBuilder()
    .setCustomId(`info_battle_${result.battleId}`)
    .setLabel('📊 Battle Info')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('💻');

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(joinButton, infoButton);

  const message = await channel.send({ 
    embeds: [announceEmbed],
    components: [row],
    content: '@everyone 🚨 **CYBER WAR ALERT** 🚨 Une nouvelle bataille de mining commence ! Qui sera le dernier miner debout ?'
  });

  // Stocker l'état de la bataille
  currentBattle = {
    id: result.battleId,
    channelId: channel.id,
    messageId: message.id,
    maxPlayers: 999, // Pas de limite
    registrationEndTime,
    status: 'registration',
    participants: []
  };

  // Programmer la fin des inscriptions
  const client = interaction.client;
  const channelId = interaction.channelId;

  setTimeout(async () => {
    try {
      // Passer le client et channelId comme paramètres
      await endRegistrationAndStartBattle(services, client, channelId);
    } catch (error) {
      logger.error('Error in setTimeout for battle registration:', error);
    }
  }, registrationTime * 60 * 1000);

  // Confirmation pour l'admin
  const confirmEmbed = new EmbedBuilder()
    .setTitle('✅ Bataille Lancée !')
    .setColor(0x00ff00)
    .setDescription(`
**Battle ID :** \`${result.battleId}\`
**Participants :** Illimités
**Temps d'inscription :** ${registrationTime} minutes
**Status :** En attente de participants
**Bots de test :** ${realParticipantCount} utilisateurs simulés ajoutés

La bataille a été annoncée publiquement !
    `)
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
  
  logger.info(`Admin ${interaction.user.id} started battle ${result.battleId} with unlimited players and ${realParticipantCount} bots`);
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  if (!currentBattle) {
    await interaction.editReply('📭 Aucune bataille en cours actuellement.');
    return;
  }

  const timeLeft = currentBattle.registrationEndTime.getTime() - Date.now();
  const minutesLeft = Math.max(0, Math.floor(timeLeft / 1000 / 60));

  const embed = new EmbedBuilder()
    .setTitle('📊 Status de la Bataille Actuelle')
    .setColor(0x3498db)
    .addFields([
      {
        name: '🆔 Battle ID',
        value: `\`${currentBattle.id.slice(0, 8)}...\``,
        inline: true
      },
      {
        name: '📊 Status',
        value: getStatusEmoji(currentBattle.status),
        inline: true
      },
      {
        name: '👥 Participants',
        value: `${currentBattle.participants.length} inscrits`,
        inline: true
      },
      {
        name: '⏰ Temps Restant',
        value: currentBattle.status === 'registration' ? 
               `${minutesLeft} minutes` : 
               'N/A',
        inline: true
      },
      {
        name: '📍 Canal',
        value: `<#${currentBattle.channelId}>`,
        inline: true
      },
      {
        name: '🔗 Message',
        value: `[Voir l'annonce](https://discord.com/channels/${interaction.guildId}/${currentBattle.channelId}/${currentBattle.messageId})`,
        inline: true
      }
    ])
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'registration': return '🟡 Inscriptions ouvertes';
    case 'starting': return '🟠 Démarrage imminent';
    case 'active': return '🔴 Combat en cours';
    case 'finished': return '✅ Terminée';
    default: return '❓ Inconnu';
  }
}

async function endRegistrationAndStartBattle(services: Map<string, any>, client: Client, channelId: string) {
  if (!currentBattle || currentBattle.status !== 'registration') return;

  try {
    const databaseService = services.get('database');
    const cacheService = services.get('cache');
    
    // Créer le BattleService dynamiquement
    const { BattleService } = await import('../../services/battle/BattleService');
    const battleService = new BattleService(databaseService, cacheService);
    
    // ✅ Récupérer le canal et vérifier son type
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

    // ✅ Vérifier que c'est un canal textuel
    if (!channel.isTextBased()) {
      logger.error('Channel is not text-based, cannot send messages');
      return;
    }

    // ✅ Cast en TextChannel
    const textChannel = channel as TextChannel;

    const battleInfo = await battleService.getBattleInfo(currentBattle.id);
    
    if (!battleInfo || battleInfo.participants < 2) {
      // Pas assez de participants, annuler
      const cancelEmbed = new EmbedBuilder()
        .setTitle('❌ BATAILLE ANNULÉE')
        .setColor(0xff0000)
        .setDescription(`
**Pas assez de participants !**

Il faut au minimum 2 warriors pour démarrer une bataille.
*"You can't mine alone in this cruel digital world..."*

Aucun frais à rembourser (entrée gratuite).
        `)
        .setTimestamp();

      // ✅ Utiliser textChannel
      const message = await textChannel.messages.fetch(currentBattle.messageId);
      await message.edit({ embeds: [cancelEmbed], components: [] });
      
      await battleService.cancelBattle(currentBattle.id);
      currentBattle = null;
      return;
    }

    // Démarrer la bataille !
    currentBattle.status = 'starting';
    
    const startEmbed = new EmbedBuilder()
      .setTitle('🔥 INITIALISATION DU COMBAT 🔥')
      .setColor(0xff0000)
      .setDescription(`
**⚔️ TOUS LES SYSTÈMES SONT PRÊTS !**

Les ${battleInfo.participants} warriors sont connectés au réseau de bataille.
Récompenses : Top 5 joueurs gagnent des tokens !

🚨 **DÉMARRAGE DU HACK-A-THON DE LA MORT DANS...**
      `)
      .setImage('https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif')
      .setTimestamp();

    // ✅ Utiliser textChannel
    const message = await textChannel.messages.fetch(currentBattle.messageId);
    await message.edit({ embeds: [startEmbed], components: [] });

    // Compte à rebours dramatique
    for (let i = 5; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const countdownEmbed = new EmbedBuilder()
        .setTitle(`🔥 COMBAT IMMINENT 🔥`)
        .setColor(0xff0000)
        .setDescription(`
**⚔️ TOUS LES SYSTÈMES SONT PRÊTS !**

Les ${battleInfo.participants} warriors sont connectés au réseau de bataille.
Récompenses : Top 5 joueurs gagnent des tokens !

🚨 **DÉMARRAGE DANS... ${i}**
        `)
        .setTimestamp();

      await message.edit({ embeds: [countdownEmbed] });
    }

    // GO GO GO !
    currentBattle.status = 'active';
    
    const goEmbed = new EmbedBuilder()
      .setTitle('💀 HACK OR DIE ! 💀')
      .setColor(0x00ff00)
      .setDescription(`
**🎯 LA BATAILLE A COMMENCÉ !**

*"In the digital arena, only the smartest survive..."*

Les combats vont être générés automatiquement !
Suivez les événements en temps réel...
      `)
      .setImage('https://media.giphy.com/media/YQitE4YNQNahy/giphy.gif')
      .setTimestamp();

    await message.edit({ embeds: [goEmbed] });

    // ✅ Passer textChannel au lieu de channel
    await simulateEpicBattle(currentBattle.id, textChannel, services);

  } catch (error) {
    logger.error('Error ending registration and starting battle:', error);
  }
}

interface BattleParticipant {
  id: string;
  userId: string;
  username: string;
  eliminated: boolean;
  revived: boolean;
  eliminationOrder?: number;  // 🆕 Position d'élimination
  eliminationTime?: Date;     // 🆕 Moment de l'élimination
  tokens?: number;            // 🆕 Pour afficher les stats
}

// 🆕 Configuration des récompenses
const BATTLE_REWARDS = {
  1: { tokens: 100, title: "🥇 CHAMPION SUPRÊME" },
  2: { tokens: 50, title: "🥈 VICE-CHAMPION" },
  3: { tokens: 25, title: "🥉 PODIUM" },
  4: { tokens: 10, title: "🏅 TOP 5" },
  5: { tokens: 5, title: "🏅 TOP 5" }
};

// 🆕 Fonction pour tracker les éliminations
async function trackElimination(participant: BattleParticipant, currentOrder: number) {
  participant.eliminated = true;
  participant.eliminationOrder = currentOrder;
  participant.eliminationTime = new Date();
  
  logger.info(`💀 [Battle] ${participant.username} eliminated at position ${currentOrder}`);
}

// 🆕 Fonction améliorée pour terminer la bataille avec résultats complets
async function finalizeBattleWithResults(battleId: string, channel: TextChannel, participants: BattleParticipant[], eventCount: number, services: Map<string, any>) {
  try {
    const databaseService = services.get('database');
    
    // 🏆 CALCULER LE CLASSEMENT FINAL
    const alive = participants.filter(p => !p.eliminated);
    const eliminated = participants.filter(p => p.eliminated).sort((a, b) => (b.eliminationOrder || 0) - (a.eliminationOrder || 0));
    
    // Le/les survivant(s) sont 1ers, puis les éliminés par ordre inverse d'élimination
    const finalRanking = [...alive, ...eliminated];
    
    // 🎁 DISTRIBUER LES RÉCOMPENSES
    const rewardResults = [];
    for (let i = 0; i < Math.min(5, finalRanking.length); i++) {
      const participant = finalRanking[i];
      const position = i + 1;
      const reward = BATTLE_REWARDS[position as keyof typeof BATTLE_REWARDS];
      
      if (reward) {
        // Ajouter les tokens au joueur dans la base de données
        try {
          await databaseService.client.user.update({
            where: { id: participant.userId },
            data: { tokens: { increment: reward.tokens } }
          });

          const isWin = position == 1; // Top 1 = victoire

          if (isWin) {
            await databaseService.client.user.update({
              where: { id: participant.userId },
              data: { battlesWon: { increment: 1 } }
            });
            logger.info(`📊 [Battle] ${participant.username} battle win recorded`);
          } else {
            await databaseService.client.user.update({
              where: { id: participant.userId },
              data: { battlesLost: { increment: 1 } }
            });
            logger.info(`📊 [Battle] ${participant.username} battle loss recorded`);
          }
          
          rewardResults.push({
            position,
            username: participant.username,
            reward: reward.tokens,
            title: reward.title,
            eliminated: participant.eliminated,
            eliminationOrder: participant.eliminationOrder || null
          });
          
          logger.info(`🎁 [Battle] ${participant.username} received ${reward.tokens} tokens for position ${position}`);
        } catch (error) {
          logger.error(`❌ Error rewarding ${participant.username}:`, error);
        }
      }
    }

    // 📊 CRÉER L'EMBED DE RÉSULTATS COMPLETS
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 1️⃣ Message de victoire spectaculaire
    const winner = finalRanking[0];
    const victoryMessage = MINING_BATTLE_EVENTS.victory[
      Math.floor(Math.random() * MINING_BATTLE_EVENTS.victory.length)
    ].replace('{username}', `**${winner.username}**`);

    const victoryEmbed = new EmbedBuilder()
      .setTitle('🏆 BATAILLE TERMINÉE ! 🏆')
      .setColor(0xffd700)
      .setDescription(`\n${victoryMessage}\n\n*"In the digital arena, legends are born..."*`)
      .setImage('https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif')
      .setTimestamp();

    await channel.send({ embeds: [victoryEmbed] });

    // 2️⃣ CLASSEMENT DÉTAILLÉ - TOP 5
    await new Promise(resolve => setTimeout(resolve, 2000));

    let rankingText = '';
    for (const result of rewardResults) {
      const statusEmoji = result.eliminated ? '💀' : '✨';
      const eliminationInfo = result.eliminated && result.eliminationOrder ? 
        ` (éliminé #${participants.length - result.eliminationOrder + 1})` : '';
      
      rankingText += `**${result.position}.** ${result.title}\n`;
      rankingText += `${statusEmoji} **${result.username}**${eliminationInfo}\n`;
      rankingText += `💰 **+${result.reward} tokens**\n\n`;
    }

    const rankingEmbed = new EmbedBuilder()
      .setTitle('🏅 CLASSEMENT FINAL - TOP 5')
      .setColor(0x00ff00)
      .setDescription(rankingText || "Aucun gagnant (erreur)")
      .addFields([
        {
          name: '📊 Statistiques de bataille',
          value: `• **Participants total:** ${participants.length}\n• **Événements générés:** ${eventCount}\n• **Ressuscitations:** ${participants.filter(p => p.revived).length}\n• **Durée moyenne par élimination:** ${Math.round(eventCount / Math.max(1, participants.length - alive.length))} événements`,
          inline: false
        }
      ])
      .setFooter({ text: `Battle ID: ${battleId.slice(0, 8)}... | Récompenses distribuées automatiquement` })
      .setTimestamp();

    await channel.send({ embeds: [rankingEmbed] });

    // 3️⃣ CLASSEMENT COMPLET (si plus de 5 participants)
    if (participants.length > 5) {
      await new Promise(resolve => setTimeout(resolve, 1500));

      let fullRankingText = '';
      for (let i = 5; i < Math.min(15, finalRanking.length); i++) {
        const participant = finalRanking[i];
        const position = i + 1;
        const statusEmoji = participant.eliminated ? '💀' : '⚡';
        const eliminationInfo = participant.eliminated && participant.eliminationOrder ? 
          ` (éliminé #${participants.length - participant.eliminationOrder + 1})` : '';
        
        fullRankingText += `**${position}.** ${statusEmoji} ${participant.username}${eliminationInfo}\n`;
      }

      if (finalRanking.length > 15) {
        fullRankingText += `\n*... et ${finalRanking.length - 15} autres participants*`;
      }

      const fullRankingEmbed = new EmbedBuilder()
        .setTitle('📋 Classement Complet (6e-15e)')
        .setColor(0x3498db)
        .setDescription(fullRankingText || "Aucun autre participant")
        .setFooter({ text: "💡 Seuls les 5 premiers reçoivent des récompenses en tokens" })
        .setTimestamp();

      await channel.send({ embeds: [fullRankingEmbed] });
    }



    const summaryEmbed = new EmbedBuilder()
      .setTitle('✅ Bataille Complètement Terminée')
      .setColor(0x2ecc71)
      .setDescription(`\n🎯 **Résumé:**\n• **Gagnant:** ${winner.username}\n• **Participants:** ${participants.length}\n• **Top 5 récompensés:** ${Math.min(5, participants.length)}\n• **Total tokens distribués:** ${rewardResults.reduce((sum, r) => sum + r.reward, 0)}\n\nMerci à tous les participants ! 🎮`)
      .setTimestamp();

    await channel.send({ 
      embeds: [summaryEmbed], 
      components: [] 
    });

    // 🏁 Terminer la bataille
    currentBattle = null;
    
    logger.info(`🏁 [Battle ${battleId}] Completed with full results displayed. Winner: ${winner.username}`);

  } catch (error) {
    logger.error('Error finalizing battle with results:', error);
    
    // Message d'erreur de fallback
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Erreur dans les résultats')
      .setColor(0xff0000)
      .setDescription('Une erreur est survenue lors de l\'affichage des résultats. Vérifiez les logs.')
      .setTimestamp();

    await channel.send({ embeds: [errorEmbed] });
    currentBattle = null;
  }
}


// 🆕 Fonction de simulation corrigée avec plus d'éliminations
async function simulateEpicBattle(battleId: string, channel: TextChannel, services: Map<string, any>) {
  try {
    const databaseService = services.get('database');
    
    // Récupérer les participants
    const battle = await databaseService.client.battle.findUnique({
      where: { id: battleId },
      include: { entries: { include: { user: true } } }
    });

    if (!battle) return;

    let participants = battle.entries.map((entry: any) => ({
      id: entry.id,
      userId: entry.userId,
      username: entry.user.username,
      eliminated: false,
      revived: false
    }));

    // 🔧 PARAMÈTRES AJUSTÉS pour plus d'action
    let eventCount = 0;
    const participantCount = participants.length;

    logger.info(`🎮 [Battle ${battleId}] Starting with ${participantCount} participants - Battle will continue until 1 survivor remains`);

    while (participants.filter((p: any) => !p.eliminated).length > 1) {
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

      const alive = participants.filter((p: any) => !p.eliminated);
      if (alive.length <= 1) break;

      // 🎯 LOGIQUE D'ÉLIMINATION PROGRESSIVE
      // Plus on avance, plus les éliminations sont fréquentes
      const progressRatio = Math.min(1.0, eventCount / (participantCount * 1.5)); // Basé sur nombre initial de participants
      const aliveCount = alive.length;
      
      // Force l'élimination si trop de participants restants par rapport au nombre d'événements
      const shouldForceElimination = (aliveCount > participantCount * 0.3) && (eventCount > participantCount * 0.8);
      
      const eventType = getRandomEventType(aliveCount, progressRatio);
      let eventMessage = '';
      let eliminationOccurred = false;

      if (eventType === 'apocalypse') {
        // 🌋 Événement Apocalypse - Tue PLUSIEURS participants
        const minKills = Math.max(1, Math.floor(alive.length * 0.2)); // Au moins 20%
        const maxKills = Math.max(minKills, Math.floor(alive.length * 0.5)); // Jusqu'à 50%
        const killCount = minKills + Math.floor(Math.random() * (maxKills - minKills + 1));
        
        if (killCount > 0 && alive.length > killCount) {
          const victims = [];
          for (let i = 0; i < killCount; i++) {
            if (alive.length <= 1) break;
            const randomIndex = Math.floor(Math.random() * alive.length);
            const victim = alive[randomIndex];
            victim.eliminated = true;
            victims.push(victim.username);
            alive.splice(randomIndex, 1);
          }
          
          if (victims.length > 0) {
            const apocalypseMsg = MINING_BATTLE_EVENTS.apocalypse[
              Math.floor(Math.random() * MINING_BATTLE_EVENTS.apocalypse.length)
            ];
            eventMessage = `${apocalypseMsg}\n\n💀 **VICTIMES:** ${victims.join(', ')} sont éliminés !`;
            eliminationOccurred = true;
            logger.info(`💥 [Battle ${battleId}] Apocalypse eliminated ${victims.length} participants`);
          }
        }
        
      } else if (eventType === 'revival' && progressRatio < 0.7) {
        // ✨ Résurrection (seulement en début/milieu de bataille)
        const dead = participants.filter((p: any) => p.eliminated && !p.revived);
        if (dead.length > 0) {
          const reviveCount = Math.min(2, Math.floor(Math.random() * 2) + 1); // 1-2 ressuscités max
          const revived = [];
          
          for (let i = 0; i < Math.min(reviveCount, dead.length); i++) {
            const randomIndex = Math.floor(Math.random() * dead.length);
            const revivedPlayer = dead[randomIndex];
            revivedPlayer.eliminated = false;
            revivedPlayer.revived = true;
            revived.push(revivedPlayer.username);
            dead.splice(randomIndex, 1);
          }
          
          if (revived.length > 0) {
            const revivalMsg = MINING_BATTLE_EVENTS.revival[
              Math.floor(Math.random() * MINING_BATTLE_EVENTS.revival.length)
            ];
            eventMessage = `${revivalMsg}\n\n✨ **RESSUSCITÉS:** ${revived.join(', ')} reviennent dans la bataille !`;
            logger.info(`✨ [Battle ${battleId}] Revival brought back ${revived.length} participants`);
          }
        }
        
      } else if (eventType === 'boost') {
        // 🚀 Boost - Aucune élimination mais message cool
        const boosted = alive[Math.floor(Math.random() * alive.length)];
        const boostMsg = MINING_BATTLE_EVENTS.boost[
          Math.floor(Math.random() * MINING_BATTLE_EVENTS.boost.length)
        ].replace('{username}', `**${boosted.username}**`);
        eventMessage = boostMsg;
        
      } else {
        // ⚔️ Combat normal avec élimination PLUS FRÉQUENTE
        const attacker = alive[Math.floor(Math.random() * alive.length)];
        const targets = alive.filter((p: any) => p.userId !== attacker.userId);
        if (targets.length === 0) break;
        
        const defender = targets[Math.floor(Math.random() * targets.length)];

        const combatStyle = Math.random();
        if (combatStyle < 0.3) {
          // Sérieux
          eventMessage = MINING_BATTLE_EVENTS.combat_serious[
            Math.floor(Math.random() * MINING_BATTLE_EVENTS.combat_serious.length)
          ].replace('{attacker}', `**${attacker.username}**`)
           .replace('{defender}', `**${defender.username}**`);
        } else if (combatStyle < 0.6) {
          // Drôle
          eventMessage = MINING_BATTLE_EVENTS.combat_funny[
            Math.floor(Math.random() * MINING_BATTLE_EVENTS.combat_funny.length)
          ].replace('{attacker}', `**${attacker.username}**`)
           .replace('{defender}', `**${defender.username}**`);
        } else {
          // Bizarre
          eventMessage = MINING_BATTLE_EVENTS.combat_weird[
            Math.floor(Math.random() * MINING_BATTLE_EVENTS.combat_weird.length)
          ].replace('{attacker}', `**${attacker.username}**`)
           .replace('{defender}', `**${defender.username}**`);
        }

        // 🎯 CHANCE D'ÉLIMINATION ADAPTATIVE
        let eliminationChance = 0.4; // Base 40% (augmenté)
        
        // Bonus selon le nombre de participants restants
        if (aliveCount > participantCount * 0.75) eliminationChance += 0.3; // +30% si >75% restants
        else if (aliveCount > participantCount * 0.5) eliminationChance += 0.2; // +20% si >50% restants
        else if (aliveCount > participantCount * 0.25) eliminationChance += 0.1; // +10% si >25% restants
        
        // Bonus temporel basé sur le nombre d'événements
        eliminationChance += Math.min(0.3, eventCount * 0.02); // +2% par événement, max +30%
        
        // Force l'élimination dans certains cas
        if (shouldForceElimination) eliminationChance += 0.4; // +40% si on force
        if (aliveCount <= 3) eliminationChance += 0.2; // +20% si finale proche
        
        eliminationChance = Math.min(0.9, eliminationChance); // Max 90% de chance

        if (Math.random() < eliminationChance && alive.length > 1) {
          await trackElimination(defender, participants.filter((p: any) => p.eliminated).length + 1);
          eliminationOccurred = true;
          
          const elimMessage = MINING_BATTLE_EVENTS.elimination[
            Math.floor(Math.random() * MINING_BATTLE_EVENTS.elimination.length)
          ].replace('{username}', `**${defender.username}**`);

          eventMessage += `\n\n🚨 **ÉLIMINATION !** ${elimMessage}`;
          logger.info(`💀 [Battle ${battleId}] Combat elimination: ${defender.username} (chance: ${(eliminationChance * 100).toFixed(1)}%)`);
        }
      }

      if (eventMessage) {
        const aliveCount = participants.filter((p: any) => !p.eliminated).length;
        
        const embed = new EmbedBuilder()
          .setColor(eventType === 'apocalypse' ? 0xff0000 : eventType === 'revival' ? 0x00ff00 : eventType === 'boost' ? 0xffd700 : 0xff6600)
          .setDescription(eventMessage)
          .setFooter({ 
            text: `⚔️ ${aliveCount} combattants restants | Événement ${eventCount + 1} | ${eliminationOccurred ? '💀 ÉLIMINATION' : '📊 Événement'}` 
          })
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        // 🏁 CONDITION D'ARRÊT : Un seul survivant
        if (aliveCount <= 1) {
          logger.info(`🏁 [Battle ${battleId}] Battle ended: ${aliveCount} participant(s) remaining after ${eventCount + 1} events`);
          break;
        }
      }

      eventCount++;
    }

    // 🏆 ANNONCE DU VAINQUEUR (si il y en a un)
    const winner = participants.find((p: any) => !p.eliminated);
    if (winner) {
      await finalizeBattleWithResults(battleId, channel, participants, eventCount, services);
      
      logger.info(`🏁 [Battle ${battleId}] Completed: ${winner.username} wins after ${eventCount} events (${participantCount}→1 participants)`);
    } else {
      // Cas d'erreur - ne devrait jamais arriver
      logger.error(`❌ [Battle ${battleId}] No winner found after ${eventCount} events`);
      currentBattle = null;
    }

  } catch (error) {
    logger.error('Error simulating epic battle:', error);
  }
}

// 🆕 Fonction améliorée pour choisir le type d'événement selon le contexte
function getRandomEventType(aliveCount: number, progressRatio: number): 'combat' | 'apocalypse' | 'revival' | 'boost' {
  const rand = Math.random();
  
  // FINALE (2-3 joueurs restants) - Combat intense, pas de revival
  if (aliveCount <= 3) {
    if (rand < 0.15) return 'apocalypse';    // 15% apocalypse finale
    if (rand < 0.25) return 'boost';         // 10% boost dramatique
    return 'combat';                         // 75% combat final
  }
  
  // PHASE FINALE (25% des participants restants)
  if (progressRatio > 0.7 || aliveCount <= Math.max(2, aliveCount * 0.25)) {
    if (rand < 0.20) return 'apocalypse';    // 20% apocalypse
    if (rand < 0.25) return 'boost';         // 5% boost
    return 'combat';                         // 75% combat (pas de revival)
  }
  
  // PHASE MILIEU (bataille équilibrée)
  if (progressRatio > 0.3) {
    if (rand < 0.12) return 'apocalypse';    // 12% apocalypse
    if (rand < 0.22) return 'revival';       // 10% revival
    if (rand < 0.32) return 'boost';         // 10% boost
    return 'combat';                         // 68% combat
  }
  
  // PHASE DÉBUT (plus d'événements fun)
  if (rand < 0.06) return 'apocalypse';      // 6% apocalypse
  if (rand < 0.16) return 'revival';         // 10% revival
  if (rand < 0.31) return 'boost';           // 15% boost
  return 'combat';                           // 69% combat
}

// Export pour les autres modules
export { finalizeBattleWithResults, trackElimination, BATTLE_REWARDS, MINING_BATTLE_EVENTS };