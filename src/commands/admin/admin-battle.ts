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
      .setName('force-end')
      .setDescription('🛑 Force la fin de la bataille en cours'))
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
      
      case 'force-end':
        await handleForceEnd(interaction, services);
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

// ============ NOUVELLES FONCTIONS DE GESTION DES PERMISSIONS ============

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

// ============ FONCTIONS EXISTANTES (START, FORCE-END, STATUS) ============

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

  const registrationEndTime = new Date(Date.now() + registrationTime * 60 * 1000);
  
  // Créer l'annonce publique
  const channel = interaction.channel as TextChannel;
  
  const announceEmbed = new EmbedBuilder()
    .setTitle('⚔️ BATAILLE ROYALE DE MINING ⚔️')
    .setColor(0xff6600)
    .setDescription(`
**🎯 LA GUERRE DES HASHRATES COMMENCE !**

Dans cette arène digitale impitoyable, seul le mineur le plus malin survivra ! 
Préparez vos rigs, sharpen vos algos, et que le meilleur geek gagne !

**💻 NOUVELLES RÈGLES :**
• **🆓 ENTRÉE GRATUITE** - Plus de frais d'inscription !
• **♾️ PLACES ILLIMITÉES** - Tout le monde peut participer !
• **🎁 Récompenses fixes** - Top 5 gagnent des tokens !
• **🎲 Événements aléatoires** - Apocalypse, résurrections, et plus !

**⏰ INSCRIPTION LIMITÉE :**
Vous avez **${registrationTime} minutes** pour rejoindre !
Cliquez sur le bouton ci-dessous pour enter the matrix !
    `)
    .addFields([
      {
        name: '🏆 Récompenses',
        value: '1er: 100 tokens\n2e: 50 tokens\n3e: 25 tokens\n4e: 10 tokens\n5e: 5 tokens',
        inline: true
      },
      {
        name: '👥 Participants',
        value: '5 bots déjà inscrits\n+ joueurs réels',
        inline: true
      },
      {
        name: '⏳ Fin des inscriptions',
        value: `<t:${Math.floor(registrationEndTime.getTime() / 1000)}:R>`,
        inline: true
      }
    ])
    .setImage('https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif')
    .setFooter({ text: `Battle ID: ${result.battleId.slice(0, 8)}... | Lancée par ${interaction.user.username} | 5 bots de test inclus` })
    .setTimestamp();

  // Bouton de participation
  const joinButton = new ButtonBuilder()
    .setCustomId(`join_battle_${result.battleId}`)
    .setLabel('🔥 ENTER THE MATRIX')
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
**Bots de test :** 5 utilisateurs simulés ajoutés

La bataille a été annoncée publiquement !
    `)
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
  
  logger.info(`Admin ${interaction.user.id} started battle ${result.battleId} with unlimited players`);
}

async function handleForceEnd(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  if (!currentBattle) {
    await interaction.editReply('❌ Aucune bataille en cours !');
    return;
  }

  const databaseService = services.get('database');
  const cacheService = services.get('cache');
  
  // Créer le BattleService dynamiquement
  const { BattleService } = await import('../../services/battle/BattleService');
  const battleService = new BattleService(databaseService, cacheService);
  
  const result = await battleService.cancelBattle(currentBattle.id);
  
  // Mettre à jour le message d'annonce
  try {
    const channel = await interaction.client.channels.fetch(currentBattle.channelId) as TextChannel;
    const message = await channel.messages.fetch(currentBattle.messageId);
    
    const cancelledEmbed = new EmbedBuilder()
      .setTitle('🛑 BATAILLE ANNULÉE')
      .setColor(0xff0000)
      .setDescription(`
**La bataille a été interrompue par un admin !**

${result.success ? '✅ Bataille annulée avec succès.' : '❌ Erreur lors de l\'annulation.'}

*"Sometimes the only winning move is not to play..." - WarGames*
      `)
      .setTimestamp();

    await message.edit({ embeds: [cancelledEmbed], components: [] });
  } catch (error) {
    logger.error('Error updating cancelled battle message:', error);
  }

  currentBattle = null;
  
  const embed = new EmbedBuilder()
    .setTitle('🛑 Bataille Terminée')
    .setColor(0xff0000)
    .setDescription(`
**Action :** Bataille forcée à terminer
**Résultat :** ${result.success ? 'Bataille annulée' : 'Échec'}

${result.message}
    `)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  
  logger.info(`Admin ${interaction.user.id} force-ended current battle`);
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
    
    // Récupérer le client Discord depuis les services
    const client = services.get('client') || services.get('discord');
    
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

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

      const message = await channel.messages.fetch(currentBattle.messageId);
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

    const message = await channel.messages.fetch(currentBattle.messageId);
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

    // Lancer la simulation de combat
    await simulateEpicBattle(currentBattle.id, channel, services);

  } catch (error) {
    logger.error('Error ending registration and starting battle:', error);
  }
}

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

    // Générer des événements de combat épiques avec événements aléatoires
    let eventCount = 0;
    const maxEvents = 20 + Math.floor(Math.random() * 15); // 20-35 événements pour plus de fun

    while (participants.filter((p: any) => !p.eliminated).length > 1 && eventCount < maxEvents) {
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000)); // 2-5 secondes

      const alive = participants.filter((p: any) => !p.eliminated);
      if (alive.length <= 1) break;

      const eventType = getRandomEventType();
      let eventMessage = '';

      if (eventType === 'apocalypse') {
        // 🆕 Événement Apocalypse - Tue plusieurs participants
        const killCount = Math.floor(alive.length * (0.3 + Math.random() * 0.3)); // 30-60%
        if (killCount > 0 && alive.length > 2) {
          const victims = [];
          for (let i = 0; i < Math.min(killCount, alive.length - 1); i++) {
            const randomIndex = Math.floor(Math.random() * alive.length);
            const victim = alive[randomIndex];
            if (!victim.eliminated) {
              victim.eliminated = true;
              victims.push(victim.username);
              alive.splice(randomIndex, 1);
            }
          }
          
          if (victims.length > 0) {
            const apocalypseMsg = MINING_BATTLE_EVENTS.apocalypse[
              Math.floor(Math.random() * MINING_BATTLE_EVENTS.apocalypse.length)
            ];
            eventMessage = `${apocalypseMsg}\n\n💀 **VICTIMES:** ${victims.join(', ')} sont éliminés !`;
          }
        }
      } else if (eventType === 'revival') {
        // 🆕 Événement Résurrection - Ranime des participants
        const dead = participants.filter((p: any) => p.eliminated && !p.revived);
        if (dead.length > 0) {
          const reviveCount = Math.min(3, Math.floor(Math.random() * 3) + 1);
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
          }
        }
      } else if (eventType === 'boost') {
        // 🆕 Événement Boost - Boost un joueur
        const boosted = alive[Math.floor(Math.random() * alive.length)];
        const boostMsg = MINING_BATTLE_EVENTS.boost[
          Math.floor(Math.random() * MINING_BATTLE_EVENTS.boost.length)
        ].replace('{username}', `**${boosted.username}**`);
        eventMessage = boostMsg;
      } else {
        // Combat normal
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

        // Chance d'élimination normale (réduite car il y a les événements apocalypse)
        const eliminationChance = 0.2 + (eventCount / maxEvents) * 0.3;
        if (Math.random() < eliminationChance && alive.length > 2) {
          defender.eliminated = true;
          
          const elimMessage = MINING_BATTLE_EVENTS.elimination[
            Math.floor(Math.random() * MINING_BATTLE_EVENTS.elimination.length)
          ].replace('{username}', `**${defender.username}**`);

          eventMessage += `\n\n🚨 **ÉLIMINATION !** ${elimMessage}`;
        }
      }

      if (eventMessage) {
        const embed = new EmbedBuilder()
          .setColor(eventType === 'apocalypse' ? 0xff0000 : eventType === 'revival' ? 0x00ff00 : eventType === 'boost' ? 0xffd700 : 0xff6600)
          .setDescription(eventMessage)
          .setFooter({ text: `⚔️ ${participants.filter((p: any) => !p.eliminated).length} combattants restants | Événement ${eventCount + 1}/${maxEvents}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }

      eventCount++;
    }

    // Annoncer le vainqueur
    const winner = participants.find((p: any) => !p.eliminated);
    if (winner) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const victoryMessage = MINING_BATTLE_EVENTS.victory[
        Math.floor(Math.random() * MINING_BATTLE_EVENTS.victory.length)
      ].replace('{username}', `**${winner.username}**`);

      const finalStats = participants.filter((p: any) => !p.eliminated).length;
      const totalParticipants = participants.length;

      const victoryEmbed = new EmbedBuilder()
        .setTitle('🏆 VICTOIRE ÉPIQUE ! 🏆')
        .setColor(0xffd700)
        .setDescription(`
${victoryMessage}

**🎯 BATAILLE TERMINÉE !**
*"In the matrix of mining, ${winner.username} found the ultimate algorithm..."*

**📊 STATISTIQUES FINALES:**
• **Total participants:** ${totalParticipants}
• **Survivants:** ${finalStats}
• **Événements déclenchés:** ${eventCount}
• **Ressuscitations:** ${participants.filter((p: any) => p.revived).length}

Les récompenses sont en cours de distribution...
        `)
        .setImage('https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif')
        .setTimestamp();

      await channel.send({ embeds: [victoryEmbed] });

      // Terminer la bataille dans le service
      currentBattle = null;
    }

  } catch (error) {
    logger.error('Error simulating epic battle:', error);
  }
}

function getRandomEventType(): 'combat' | 'apocalypse' | 'revival' | 'boost' {
  const rand = Math.random();
  if (rand < 0.1) return 'apocalypse';      // 10% chance d'apocalypse
  if (rand < 0.2) return 'revival';         // 10% chance de résurrection  
  if (rand < 0.35) return 'boost';          // 15% chance de boost
  return 'combat';                          // 65% combat normal
}

// Export pour les autres modules
export { MINING_BATTLE_EVENTS };