import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { logger } from '../../utils/logger';

// Import du currentBattle depuis admin-battle (on va corriger l'export)
// Pour l'instant on le déclare ici temporairement
let currentBattle: {
  id: string;
  channelId: string;
  messageId: string;
  maxPlayers: number;
  registrationEndTime: Date;
  status: 'registration' | 'starting' | 'active' | 'finished';
  participants: string[];
} | null = null;

// Fonction pour accéder au currentBattle depuis admin-battle
function getCurrentBattle() {
  try {
    const adminBattle = require('../admin/admin-battle');
    return adminBattle.currentBattle || null;
  } catch {
    return currentBattle;
  }
}

export const data = new SlashCommandBuilder()
  .setName('battle')
  .setDescription('⚔️ Commandes de bataille royale')
  .addSubcommand(subcommand =>
    subcommand
      .setName('join')
      .setDescription('🎯 Rejoindre la bataille en cours'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('📊 Voir le statut de la bataille actuelle'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('🏆 Tes statistiques de combat personnelles'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('leaderboard')
      .setDescription('👑 Classement des meilleurs miners'));

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const subcommand = interaction.options.getSubcommand();
    const databaseService = services.get('database');
    const cacheService = services.get('cache');

    if (!databaseService) {
      throw new Error('Database service not available');
    }

    // Vérification de l'utilisateur en base (version adaptée)
    await ensureUserExists(databaseService, interaction.user.id, interaction.user.username);

    switch (subcommand) {
      case 'join':
        await handleJoinBattle(interaction, databaseService, cacheService);
        break;
      
      case 'status':
        await handleBattleStatus(interaction, databaseService);
        break;
      
      case 'stats':
        await handleUserStats(interaction, databaseService);
        break;
      
      case 'leaderboard':
        await handleLeaderboard(interaction, databaseService);
        break;
      
      default:
        await interaction.reply({ content: '❌ Sous-commande non reconnue.', ephemeral: true });
    }

  } catch (error) {
    logger.error('Error in battle command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('💥 Stack Overflow !')
      .setDescription('Erreur 500 : Tes neurones ont surchauffé ! Redémarre ton cerveau et réessaie.')
      .addFields([
        {
          name: '🔧 Debug Info',
          value: 'try { restart(); } catch(e) { drink_coffee(); }',
          inline: false
        }
      ])
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

// Fonction adaptée pour créer/vérifier l'utilisateur
async function ensureUserExists(databaseService: any, discordId: string, username: string) {
  try {
    let user = await databaseService.client.user.findUnique({
      where: { discordId }
    });

    if (!user) {
      user = await databaseService.client.user.create({
        data: {
          discordId,
          username,
          tokens: 100.0,
          dollars: 0.0
        }
      });
      logger.info(`Created new user: ${username} (${discordId})`);
    }

    return user;
  } catch (error) {
    logger.error('Error ensuring user exists:', error);
    throw error;
  }
}

async function handleJoinBattle(interaction: ChatInputCommandInteraction, databaseService: any, cacheService: any) {
  await interaction.deferReply();

  const currentBattle = getCurrentBattle();

  // Vérifier s'il y a une bataille en cours
  if (!currentBattle || currentBattle.status !== 'registration') {
    const noBattleEmbed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('🚫 Aucune Bataille Disponible')
      .setDescription(`
**No war zone detected !**

${!currentBattle ? 
  'Aucune bataille n\'est lancée actuellement.' : 
  'Les inscriptions sont fermées pour la bataille en cours.'}

*"Patience, young padawan. The next battle will come..."*

📢 **Pour lancer une bataille :** Demande à un admin d'utiliser \`/admin-battle start\`
      `)
      .setImage('https://media.giphy.com/media/l0HlKrFTXpK7Pxheg/giphy.gif')
      .setTimestamp();

    await interaction.editReply({ embeds: [noBattleEmbed] });
    return;
  }

  // Vérifier si déjà inscrit
  if (currentBattle.participants.includes(interaction.user.id)) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle('⚠️ Déjà Dans la Matrix !')
        .setDescription(`Tu es déjà connecté à cette bataille, ${interaction.user.username} !\n\n*"There is no spoon... but there is no double registration either."*`)
        .setTimestamp()]
    });
    return;
  }

  // Créer le BattleService dynamiquement
  const { BattleService } = await import('../../services/battle/BattleService');
  const battleService = new BattleService(databaseService, cacheService);

  // Rejoindre la bataille
  const result = await battleService.joinBattle(interaction.user.id, currentBattle.id);

  if (!result.success) {
    const failEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('🚫 Accès Refusé !')
      .setDescription(`**Connection failed !**\n\n${result.message}`)
      .addFields([
        {
          name: '💡 Solutions Possibles',
          value: '• Check ton solde de tokens\n• Attends la fin du cooldown\n• Upgrade ton setup de mining',
          inline: false
        },
        {
          name: '📊 Debug Info',
          value: 'Error code: INSUFFICIENT_RESOURCES',
          inline: false
        }
      ])
      .setTimestamp();

    await interaction.editReply({ embeds: [failEmbed] });
    return;
  }

  // Succès ! Ajouter aux participants
  currentBattle.participants.push(interaction.user.id);

  // Messages d'entrée thématiques
  const entryMessages = [
    `🔌 **${interaction.user.username}** branche ses rigs et rejoint la ferme de mining !`,
    `💻 **${interaction.user.username}** hack son chemin dans le réseau de la bataille !`,
    `⚡ **${interaction.user.username}** overclocke ses GPUs et entre dans l'arène !`,
    `🌐 **${interaction.user.username}** se connecte au pool de bataille avec un ping parfait !`,
    `🔧 **${interaction.user.username}** configure ses ASICs pour la guerre totale !`,
    `💾 **${interaction.user.username}** télécharge les scripts de combat... 100% complete !`,
    `🎯 **${interaction.user.username}** scan le réseau et trouve une faille pour entrer !`,
    `🚀 **${interaction.user.username}** déploie ses bots de mining dans la bataille !`
  ];

  const entryMessage = entryMessages[Math.floor(Math.random() * entryMessages.length)];

  const battleInfo = result.battleInfo!;
  const successEmbed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Connection Established !')
    .setDescription(`
${entryMessage}

**🎮 Welcome to the battlefield !**
${result.message}

*"You are now part of the resistance..."*
    `)
    .addFields([
      {
        name: '🏟️ Battle Node',
        value: `\`${battleInfo.id.slice(0, 8)}...\``,
        inline: true
      },
      {
        name: '👥 Connected Users',
        value: `${battleInfo.participants}/${battleInfo.maxPlayers}`,
        inline: true
      },
      {
        name: '💰 Total Rewards',
        value: `${battleInfo.prizePool} tokens`,
        inline: true
      }
    ])
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  // Message d'attente si pas encore plein
  if (battleInfo.participants < battleInfo.maxPlayers) {
    const waitingMessages = [
      `😎 ${interaction.user.username} check ses configs en attendant les autres...`,
      `🎵 ${interaction.user.username} écoute de la synthwave pour se motiver...`,
      `🍿 ${interaction.user.username} regarde les cours crypto en grignotant...`,
      `⚙️ ${interaction.user.username} optimise ses algorithmes pour le combat...`,
      `💭 ${interaction.user.username} médite sur les mystères de SHA-256...`,
      `🔧 ${interaction.user.username} fait du fine-tuning sur ses machines...`,
      `📊 ${interaction.user.username} analyse les patterns de marché...`,
      `🎮 ${interaction.user.username} teste ses réflexes avec Snake en console...`
    ];

    const waitingMessage = waitingMessages[Math.floor(Math.random() * waitingMessages.length)];
    
    successEmbed.addFields([
      {
        name: '⏳ Standby Mode...',
        value: `${waitingMessage}\n\n*Auto-start when ${battleInfo.maxPlayers - battleInfo.participants} more user(s) connect !*`,
        inline: false
      }
    ]);
  } else {
    successEmbed.addFields([
      {
        name: '🚨 SYSTEM READY !',
        value: '🔥 **Le serveur est plein ! Initialisation du combat imminente !**',
        inline: false
      }
    ]);
  }

  await interaction.editReply({ embeds: [successEmbed] });

  // Mettre à jour le message principal dans le canal
  try {
    const channel = await interaction.client.channels.fetch(currentBattle.channelId) as TextChannel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(currentBattle.messageId);
      
      // Mettre à jour l'embed principal
      const originalEmbed = message.embeds[0];
      if (originalEmbed) {
        const updatedEmbed = new EmbedBuilder(originalEmbed.toJSON())
          .setFields(
            {
              name: '🏆 Prize Pool',
              value: `${battleInfo.prizePool} tokens`,
              inline: true
            },
            {
              name: '👥 Participants',
              value: `${battleInfo.participants}/${battleInfo.maxPlayers}`,
              inline: true
            },
            {
              name: '⏳ Fin des inscriptions',
              value: `<t:${Math.floor(currentBattle.registrationEndTime.getTime() / 1000)}:R>`,
              inline: true
            }
          );

        await message.edit({ embeds: [updatedEmbed], components: message.components });

        // Annoncer la nouvelle inscription
        const announceEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setDescription(`${entryMessage}\n\n*Un nouveau warrior entre dans la matrix !*`)
          .setTimestamp();

        await channel.send({ embeds: [announceEmbed] });
      }
    }
  } catch (error) {
    logger.error('Error updating main battle message:', error);
  }

  logger.info(`User ${interaction.user.id} joined battle ${currentBattle.id}`);
}

async function handleBattleStatus(interaction: ChatInputCommandInteraction, databaseService: any) {
  await interaction.deferReply();

  const currentBattle = getCurrentBattle();

  if (!currentBattle) {
    const noActiveEmbed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('📭 Network Quiet')
      .setDescription(`
**No active operations detected.**

Le réseau de bataille est actuellement en veille.
*"In the calm before the storm, warriors sharpen their skills..."*

📊 **Pour voir l'historique :** Use \`/battle leaderboard\`
      `)
      .setImage('https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif')
      .setTimestamp();

    await interaction.editReply({ embeds: [noActiveEmbed] });
    return;
  }

  const timeLeft = currentBattle.registrationEndTime.getTime() - Date.now();
  const minutesLeft = Math.max(0, Math.floor(timeLeft / 1000 / 60));
  const secondsLeft = Math.max(0, Math.floor((timeLeft / 1000) % 60));

  const statusEmojis: Record<string, string> = {
    'registration': '🟡 Inscriptions ouvertes',
    'starting': '🟠 Démarrage imminent',
    'active': '🔴 Combat en cours',
    'finished': '✅ Terminée'
  };

  const embed = new EmbedBuilder()
    .setTitle('📊 Battle Network Status')
    .setColor(0x3498db)
    .setDescription('**Current warfare operations:**')
    .addFields([
      {
        name: '🆔 Battle ID',
        value: `\`${currentBattle.id.slice(0, 8)}...\``,
        inline: true
      },
      {
        name: '🎯 Status',
        value: statusEmojis[currentBattle.status] || '❓ Unknown',
        inline: true
      },
      {
        name: '👥 Connected',
        value: `${currentBattle.participants.length}/${currentBattle.maxPlayers}`,
        inline: true
      }
    ])
    .setTimestamp();

  if (currentBattle.status === 'registration' && timeLeft > 0) {
    embed.addFields([
      {
        name: '⏰ Registration Ends',
        value: `${minutesLeft}m ${secondsLeft}s`,
        inline: true
      },
      {
        name: '🔗 Join Command',
        value: '`/battle join`',
        inline: true
      },
      {
        name: '💡 Quick Tips',
        value: 'Assure-toi d\'avoir assez de tokens !',
        inline: true
      }
    ]);
  } else if (currentBattle.status === 'active') {
    embed.addFields([
      {
        name: '⚔️ Combat Status',
        value: 'Battle royale en cours !',
        inline: true
      },
      {
        name: '📺 Watch Live',
        value: `<#${currentBattle.channelId}>`,
        inline: true
      },
      {
        name: '🎪 Entertainment',
        value: 'Grab some popcorn! 🍿',
        inline: true
      }
    ]);
  }

  // Participants list si pas trop long
  if (currentBattle.participants.length > 0 && currentBattle.participants.length <= 10) {
    try {
      const participantNames = await Promise.all(
        currentBattle.participants.map(async (userId: string) => {
          try {
            const user = await interaction.client.users.fetch(userId);
            return `• ${user.username}`;
          } catch {
            return `• Unknown User`;
          }
        })
      );

      embed.addFields([{
        name: '👨‍💻 Connected Warriors',
        value: participantNames.join('\n') || 'Loading...',
        inline: false
      }]);
    } catch (error) {
      logger.error('Error fetching participant names:', error);
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleUserStats(interaction: ChatInputCommandInteraction, databaseService: any) {
  await interaction.deferReply();

  try {
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: {
        battleEntries: {
          include: { battle: true },
          orderBy: { joinedAt: 'desc' },
          take: 5
        }
      }
    });

    if (!user) {
      await interaction.editReply('❌ User not found in database !');
      return;
    }

    // Calcul des statistiques
    const totalBattles = user.battleEntries.length;
    const wins = user.battleEntries.filter((entry: any) => entry.position === 1).length;
    const top3 = user.battleEntries.filter((entry: any) => entry.position && entry.position <= 3).length;
    const winRate = totalBattles > 0 ? ((wins / totalBattles) * 100).toFixed(1) : '0';
    const top3Rate = totalBattles > 0 ? ((top3 / totalBattles) * 100).toFixed(1) : '0';

    // Titre de warrior basé sur les performances
    let warriorTitle = '🤖 Script Kiddie';
    let titleColor = 0x808080;
    
    if (wins >= 10) {
      warriorTitle = '👑 Blockchain Emperor';
      titleColor = 0xffd700;
    } else if (wins >= 5) {
      warriorTitle = '⚡ Hash Rate Legend';
      titleColor = 0xff6600;
    } else if (wins >= 2) {
      warriorTitle = '🔥 Mining Veteran';
      titleColor = 0xff0000;
    } else if (totalBattles >= 5) {
      warriorTitle = '💻 Persistent Coder';
      titleColor = 0x3498db;
    } else if (totalBattles >= 1) {
      warriorTitle = '🎯 Digital Warrior';
      titleColor = 0x9966cc;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${warriorTitle}`)
      .setColor(titleColor)
      .setDescription(`**Profile.exe - ${interaction.user.username}**\n*"Your journey through the digital battlefield..."*`)
      .addFields([
        {
          name: '🏆 Victory Count',
          value: `${wins} battles won`,
          inline: true
        },
        {
          name: '📊 Win Rate',
          value: `${winRate}%`,
          inline: true
        },
        {
          name: '🥇 Top 3 Ratio',
          value: `${top3}/${totalBattles} (${top3Rate}%)`,
          inline: true
        },
        {
          name: '⚔️ Total Battles',
          value: `${totalBattles} participated`,
          inline: true
        },
        {
          name: '💰 Current Tokens',
          value: `${user.tokens.toFixed(2)}`,
          inline: true
        },
        {
          name: '💵 Current Dollars',
          value: `$${user.dollars.toFixed(2)}`,
          inline: true
        }
      ])
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    // Historique récent
    if (user.battleEntries.length > 0) {
      const recentBattles = user.battleEntries.slice(0, 5).map((entry: any) => {
        const positionEmoji = entry.position === 1 ? '🥇' : 
                             entry.position === 2 ? '🥈' : 
                             entry.position === 3 ? '🥉' : 
                             entry.position ? '💀' : '⏳';
        const daysAgo = Math.floor((Date.now() - entry.joinedAt.getTime()) / (1000 * 60 * 60 * 24));
        
        return `${positionEmoji} ${entry.position ? `#${entry.position} place` : 'In progress'} - ${daysAgo}d ago`;
      });

      embed.addFields([{
        name: '📜 Recent Battle Log',
        value: recentBattles.join('\n'),
        inline: false
      }]);
    }

    // Messages motivationnels personnalisés
    const motivationalMessages: Record<string, string[]> = {
      'noob': [
        "💪 Every master was once a disaster !",
        "🎯 Practice makes perfect, keep grinding !",
        "🔥 Your first victory is coming soon !"
      ],
      'beginner': [
        "⚡ You're getting the hang of it !",
        "🌟 Consistency is key to greatness !",
        "🎮 Level up your strategies !"
      ],
      'veteran': [
        "👑 You're becoming a legend !",
        "🔥 Other players fear your username !",
        "⚡ Your reign has just begun !"
      ],
      'legend': [
        "🏆 You ARE the matrix !",
        "👑 Bow before the mining emperor !",
        "🌟 Your name will echo through eternity !"
      ]
    };

    let messageType = 'noob';
    if (wins >= 10) messageType = 'legend';
    else if (wins >= 5) messageType = 'veteran';
    else if (totalBattles >= 3) messageType = 'beginner';

    const motivationArray = motivationalMessages[messageType];
    const randomMotivation = motivationArray[Math.floor(Math.random() * motivationArray.length)];

    embed.setFooter({ text: randomMotivation });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.error('Error getting user battle stats:', error);
    await interaction.editReply('❌ Database error ! Try again later.');
  }
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction, databaseService: any) {
  await interaction.deferReply();

  try {
    // Récupération des top warriors avec calculs
    const topWarriors = await databaseService.client.user.findMany({
      include: {
        battleEntries: {
          where: { position: { not: null } },
          include: { battle: { select: { prizePool: true } } }
        }
      },
      take: 100 // Plus large pour calculer les stats
    });

    // Calcul et tri des statistiques
    const leaderboardData = topWarriors.map((user: any) => {
      const battles = user.battleEntries;
      const totalBattles = battles.length;
      const wins = battles.filter((b: any) => b.position === 1).length;
      const top3 = battles.filter((b: any) => b.position! <= 3).length;
      const totalRewards = battles
        .filter((b: any) => b.position! <= 3)
        .reduce((sum: number, battle: any) => {
          const position = battle.position!;
          if (position === 1) return sum + (battle.battle.prizePool * 0.5);
          if (position === 2) return sum + (battle.battle.prizePool * 0.25);
          if (position === 3) return sum + (battle.battle.prizePool * 0.15);
          return sum;
        }, 0);

      return {
        username: user.username,
        discordId: user.discordId,
        tokens: user.tokens,
        wins,
        totalBattles,
        top3,
        winRate: totalBattles > 0 ? (wins / totalBattles) * 100 : 0,
        totalRewards,
        score: wins * 100 + top3 * 25 + totalBattles * 5 // Score composite
      };
    })
    .filter((user: any) => user.totalBattles > 0)
    .sort((a: any, b: any) => {
      // Tri par victoires d'abord, puis par score composite
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.score - a.score;
    })
    .slice(0, 10);

    if (leaderboardData.length === 0) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x808080)
          .setTitle('🏆 Hall of Fame - Empty')
          .setDescription('No warriors have entered the arena yet!\n\n*"Be the first to make history..."*')
          .setTimestamp()]
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('👑 Hall of Fame - Mining Legends')
      .setColor(0xffd700)
      .setDescription('**The greatest warriors of the digital battlefield !**')
      .setTimestamp();

    const leaderboardText = leaderboardData.map((warrior: any, index: number) => {
      const rankEmoji = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const winRateStr = warrior.winRate.toFixed(1);
      
      return `${rankEmoji} **${warrior.username}**\n` +
             `   🏆 ${warrior.wins} wins | 🥇 ${warrior.top3} podiums | 📊 ${winRateStr}%\n` +
             `   💰 ${warrior.totalRewards.toFixed(0)} tokens earned | ⚔️ ${warrior.totalBattles} battles`;
    }).join('\n\n');

    embed.addFields([{
      name: '🏛️ Eternal Rankings',
      value: leaderboardText,
      inline: false
    }]);

    // Stats globales
    const totalBattlesGlobal = leaderboardData.reduce((sum: number, w: any) => sum + w.totalBattles, 0);
    const totalRewardsDistributed = leaderboardData.reduce((sum: number, w: any) => sum + w.totalRewards, 0);

    embed.addFields([{
      name: '📈 Global Statistics',
      value: `🎯 ${totalBattlesGlobal} battles fought\n💰 ${totalRewardsDistributed.toFixed(0)} tokens distributed\n⚔️ ${leaderboardData.length} warriors ranked`,
      inline: false
    }]);

    // Position de l'utilisateur actuel
    const userPosition = leaderboardData.findIndex((w: any) => w.discordId === interaction.user.id);
    if (userPosition !== -1) {
      const userData = leaderboardData[userPosition];
      embed.addFields([{
        name: '📍 Your Position',
        value: `🏅 **Rank #${userPosition + 1}** with ${userData.wins} victories !`,
        inline: false
      }]);
    } else {
      embed.addFields([{
        name: '📍 Your Position',
        value: '🎯 Not ranked yet ! Join battles to enter the leaderboard !',
        inline: false
      }]);
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.error('Error getting battle leaderboard:', error);
    await interaction.editReply('❌ Database query failed ! Try again later.');
  }
}