import { SlashCommandBuilder, EmbedBuilder, CommandInteraction, PermissionFlagsBits, TextChannel, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { DatabaseService } from '../../services/database/DatabaseService';
import { RedisService } from '../../services/cache/RedisService';
import { BattleService } from '../../services/battle/BattleService';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('admin-battle')
  .setDescription('⚔️ Commandes d\'administration pour les batailles de mining')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('🚀 Lance une nouvelle bataille royale de mining')
      .addIntegerOption(option =>
        option.setName('max-joueurs')
          .setDescription('Nombre maximum de participants (2-20)')
          .setRequired(true)
          .setMinValue(2)
          .setMaxValue(20))
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
      .setDescription('📊 Statut de la bataille actuelle'));

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
      
      case 'status':
        await handleStatus(interaction);
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

async function handleStartBattle(interaction: CommandInteraction, battleService: BattleService) {
  // Vérifier qu'il n'y a pas déjà une bataille
  if (currentBattle && currentBattle.status !== 'finished') {
    await interaction.editReply('❌ Une bataille est déjà en cours ! Utilisez `/admin-battle force-end` pour la terminer.');
    return;
  }

  const maxPlayers = interaction.options.get('max-joueurs')?.value as number;
  const registrationTime = interaction.options.get('temps-inscription')?.value as number;
  
  const result = await battleService.createBattle(maxPlayers);
  
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

**💻 RÈGLES DU JEU :**
• **${maxPlayers} slots disponibles** - First come, first served !
• **Frais d'entrée :** Votre niveau × 5 tokens (min. 10)
• **Rewards :** 50% au winner, 25% au runner-up, 15% au 3ème

**⏰ INSCRIPTION LIMITÉE :**
Vous avez **${registrationTime} minutes** pour rejoindre !
Cliquez sur le bouton ci-dessous pour enter the matrix !
    `)
    .addFields([
      {
        name: '🏆 Prize Pool',
        value: '0 tokens (augmente avec chaque participant)',
        inline: true
      },
      {
        name: '👥 Participants',
        value: `0 / ${maxPlayers}`,
        inline: true
      },
      {
        name: '⏳ Fin des inscriptions',
        value: `<t:${Math.floor(registrationEndTime.getTime() / 1000)}:R>`,
        inline: true
      }
    ])
    .setImage('https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif')
    .setFooter({ text: `Battle ID: ${result.battleId.slice(0, 8)}... | Lancée par ${interaction.user.username}` })
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
    maxPlayers,
    registrationEndTime,
    status: 'registration',
    participants: []
  };

  // Programmer la fin des inscriptions
  setTimeout(async () => {
    await endRegistrationAndStartBattle(battleService);
  }, registrationTime * 60 * 1000);

  // Confirmation pour l'admin
  const confirmEmbed = new EmbedBuilder()
    .setTitle('✅ Bataille Lancée !')
    .setColor(0x00ff00)
    .setDescription(`
**Battle ID :** \`${result.battleId}\`
**Participants max :** ${maxPlayers}
**Temps d'inscription :** ${registrationTime} minutes
**Status :** En attente de participants

La bataille a été annoncée publiquement !
    `)
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
  
  logger.info(`Admin ${interaction.user.id} started battle ${result.battleId}`);
}

async function handleForceEnd(interaction: CommandInteraction, battleService: BattleService) {
  if (!currentBattle) {
    await interaction.editReply('❌ Aucune bataille en cours !');
    return;
  }

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

${result.success ? '✅ Tous les participants ont été remboursés.' : '❌ Erreur lors du remboursement.'}

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
**Résultat :** ${result.success ? 'Participants remboursés' : 'Échec'}

${result.message}
    `)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  
  logger.info(`Admin ${interaction.user.id} force-ended current battle`);
}

async function handleStatus(interaction: CommandInteraction) {
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
        value: `${currentBattle.participants.length}/${currentBattle.maxPlayers}`,
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

async function endRegistrationAndStartBattle(battleService: BattleService) {
  if (!currentBattle || currentBattle.status !== 'registration') return;

  try {
    const channel = await battleService.client?.channels.fetch(currentBattle.channelId) as TextChannel;
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

Les frais d'inscription ont été remboursés.
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
Cagnotte totale : **${battleInfo.prizePool} tokens**

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
Cagnotte totale : **${battleInfo.prizePool} tokens**

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
    await simulateEpicBattle(currentBattle.id, channel, battleService);

  } catch (error) {
    logger.error('Error ending registration and starting battle:', error);
  }
}

async function simulateEpicBattle(battleId: string, channel: TextChannel, battleService: BattleService) {
  try {
    // Récupérer les participants
    const battle = await battleService.database.client.battle.findUnique({
      where: { id: battleId },
      include: { entries: { include: { user: true } } }
    });

    if (!battle) return;

    let participants = battle.entries.map(entry => ({
      id: entry.id,
      userId: entry.userId,
      username: entry.user.username,
      eliminated: false
    }));

    // Générer des événements de combat épiques
    let eventCount = 0;
    const maxEvents = 15 + Math.floor(Math.random() * 10); // 15-25 événements

    while (participants.filter(p => !p.eliminated).length > 1 && eventCount < maxEvents) {
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 4000)); // 3-7 secondes

      const alive = participants.filter(p => !p.eliminated);
      if (alive.length <= 1) break;

      const eventType = getRandomEventType();
      let eventMessage = '';

      if (eventType === 'combat') {
        const attacker = alive[Math.floor(Math.random() * alive.length)];
        const targets = alive.filter(p => p.userId !== attacker.userId);
        const defender = targets[Math.floor(Math.random() * targets.length)];

        const combatStyle = Math.random();
        if (combatStyle < 0.4) {
          // Sérieux
          eventMessage = MINING_BATTLE_EVENTS.combat_serious[
            Math.floor(Math.random() * MINING_BATTLE_EVENTS.combat_serious.length)
          ].replace('{attacker}', `**${attacker.username}**`)
           .replace('{defender}', `**${defender.username}**`);
        } else if (combatStyle < 0.7) {
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

        // Chance d'élimination (plus probable vers la fin)
        const eliminationChance = 0.3 + (eventCount / maxEvents) * 0.4;
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
          .setColor(0xff6600)
          .setDescription(eventMessage)
          .setFooter({ text: `⚔️ ${alive.length} combattants restants` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }

      eventCount++;
    }

    // Annoncer le vainqueur
    const winner = participants.find(p => !p.eliminated);
    if (winner) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const victoryMessage = MINING_BATTLE_EVENTS.victory[
        Math.floor(Math.random() * MINING_BATTLE_EVENTS.victory.length)
      ].replace('{username}', `**${winner.username}**`);

      const victoryEmbed = new EmbedBuilder()
        .setTitle('🏆 VICTOIRE ÉPIQUE ! 🏆')
        .setColor(0xffd700)
        .setDescription(`
${victoryMessage}

**🎯 BATAILLE TERMINÉE !**
*"In the matrix of mining, ${winner.username} found the ultimate algorithm..."*

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

function getRandomEventType(): 'combat' | 'special' {
  return Math.random() < 0.8 ? 'combat' : 'special';
}

// Export pour les autres modules
export { MINING_BATTLE_EVENTS };
