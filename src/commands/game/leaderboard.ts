// src/commands/game/leaderboard.ts - Nouvelle commande dédiée
import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('🏆 Affiche les classements et statistiques des joueurs')
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Type de classement à afficher')
      .setRequired(false)
      .addChoices(
        { name: '🪙 Tokens (Richesse)', value: 'tokens' },
        { name: '⚔️ Battles (PvP)', value: 'battles' },
        { name: '💵 Dollars (Activité)', value: 'dollars' },
        { name: '⛏️ Mining (Production)', value: 'mining' },
        { name: '📊 Global (Général)', value: 'global' }
      ))
  .addIntegerOption(option =>
    option.setName('limite')
      .setDescription('Nombre de joueurs à afficher (5-50)')
      .setRequired(false)
      .setMinValue(5)
      .setMaxValue(50));

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    await interaction.deferReply();

    const databaseService = services.get('database');
    if (!databaseService) {
      throw new Error('Database service not available');
    }

    const type = interaction.options.getString('type') || 'tokens';
    const limit = interaction.options.getInteger('limite') || 15;

    switch (type) {
      case 'tokens':
        await showTokensLeaderboard(interaction, databaseService, limit);
        break;
      case 'battles':
        await showBattlesLeaderboard(interaction, databaseService, limit);
        break;
      case 'dollars':
        await showDollarsLeaderboard(interaction, databaseService, limit);
        break;
      case 'mining':
        await showMiningLeaderboard(interaction, databaseService, limit);
        break;
      case 'global':
        await showGlobalLeaderboard(interaction, databaseService, limit);
        break;
      default:
        await showTokensLeaderboard(interaction, databaseService, limit);
    }

    // Ajouter le menu de navigation
    await addNavigationMenu(interaction);

  } catch (error) {
    logger.error('Error in leaderboard command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('💥 Erreur !')
      .setDescription('Une erreur s\'est produite lors de l\'affichage du classement.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

// 🪙 CLASSEMENT PAR TOKENS (Richesse)
async function showTokensLeaderboard(interaction: ChatInputCommandInteraction, databaseService: any, limit: number) {
  const topUsers = await databaseService.client.user.findMany({
    where: {
      NOT: {
        discordId: {
          startsWith: 'bot_' // Exclure les bots du classement
        }
      }
    },
    orderBy: {
      tokens: 'desc'
    },
    take: limit,
    select: {
      discordId: true,
      username: true,
      tokens: true,
      createdAt: true
    }
  });

  if (topUsers.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle('🪙 Classement Tokens')
      .setDescription('Aucun joueur trouvé dans la base de données.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const userPosition = await getUserPosition(databaseService, interaction.user.id, 'tokens');
  
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🪙 **CLASSEMENT TOKENS** 🪙')
    .setDescription(`**💰 Les plus riches du serveur !**\n\n*Qui a accumulé le plus de tokens grâce au mining et aux battles ?*`)
    .addFields([
      {
        name: '🏆 **TOP PLAYERS**',
        value: topUsers.map((user: any, index: number) => {
          const medal = getMedal(index + 1);
          const isCurrentUser = user.discordId === interaction.user.id;
          const userTag = isCurrentUser ? '**→ VOUS ←**' : '';
          
          return `${medal} **${index + 1}.** ${user.username} ${userTag}\n💰 **${user.tokens.toFixed(2)}** tokens`;
        }).join('\n\n'),
        inline: false
      }
    ])
    .setFooter({ 
      text: userPosition 
        ? `Votre position: #${userPosition.position} avec ${userPosition.tokens.toFixed(2)} tokens`
        : 'Vous n\'êtes pas encore classé'
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ⚔️ CLASSEMENT BATTLES (PvP)
async function showBattlesLeaderboard(interaction: ChatInputCommandInteraction, databaseService: any, limit: number) {
  // Calculer les statistiques de bataille pour chaque utilisateur
  const battleStats = await databaseService.client.user.findMany({
    where: {
      NOT: {
        discordId: {
          startsWith: 'bot_'
        }
      }
    },
    select: {
      discordId: true,
      username: true,
      battlesWon: true,
      battlesLost: true,
      tokens: true
    }
  });

  // Filtrer les joueurs qui ont participé à des battles et calculer stats
  const battlers = battleStats
    .filter((user: any) => (user.battlesWon + user.battlesLost) > 0)
    .map((user: any) => {
      const totalBattles = user.battlesWon + user.battlesLost;
      const winRate = totalBattles > 0 ? (user.battlesWon / totalBattles) * 100 : 0;
      const score = (user.battlesWon * 3) + (totalBattles * 0.5); // Score: 3pts par victoire + 0.5pt par participation
      
      return {
        ...user,
        totalBattles,
        winRate,
        score
      };
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);

  if (battlers.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('⚔️ Classement Battles')
      .setDescription('Aucune bataille n\'a encore été jouée !\n\nUtilisez `/battle create` pour lancer la première guerre !')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const userBattleStats = battlers.find((user: any) => user.discordId === interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('⚔️ **CLASSEMENT BATTLES** ⚔️')
    .setDescription(`**🎯 Les meilleurs warriors du serveur !**\n\n*Classement basé sur les victoires et la participation aux battles.*`)
    .addFields([
      {
        name: '🏆 **HALL OF FAME**',
        value: battlers.map((user: any, index: number) => {
          const medal = getMedal(index + 1);
          const isCurrentUser = user.discordId === interaction.user.id;
          const userTag = isCurrentUser ? '**→ VOUS ←**' : '';
          
          return `${medal} **${index + 1}.** ${user.username} ${userTag}\n` +
                 `🏆 ${user.battlesWon}V | 💀 ${user.battlesLost}D | 📊 ${user.winRate.toFixed(1)}% WR\n` +
                 `⭐ Score: ${user.score.toFixed(1)}`;
        }).join('\n\n'),
        inline: false
      },
      {
        name: '📊 **LÉGENDE**',
        value: 'V = Victoires | D = Défaites | WR = Win Rate\nScore = (Victoires × 3) + (Participations × 0.5)',
        inline: false
      }
    ])
    .setFooter({ 
      text: userBattleStats 
        ? `Vos stats: #${battlers.findIndex((u: any) => u.discordId === interaction.user.id) + 1} | ${userBattleStats.battlesWon}V-${userBattleStats.battlesLost}D (${userBattleStats.winRate.toFixed(1)}% WR)`
        : 'Participez à une battle pour apparaître dans le classement !'
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// 💵 CLASSEMENT DOLLARS (Activité Discord)
async function showDollarsLeaderboard(interaction: ChatInputCommandInteraction, databaseService: any, limit: number) {
  const topUsers = await databaseService.client.user.findMany({
    where: {
      NOT: {
        discordId: {
          startsWith: 'bot_'
        }
      }
    },
    orderBy: {
      dollars: 'desc'
    },
    take: limit,
    select: {
      discordId: true,
      username: true,
      dollars: true,
      loginStreak: true
    }
  });

  if (topUsers.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle('💵 Classement Dollars')
      .setDescription('Aucun joueur trouvé.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const userPosition = await getUserPosition(databaseService, interaction.user.id, 'dollars');
  
  const embed = new EmbedBuilder()
    .setColor(0x27AE60)
    .setTitle('💵 **CLASSEMENT DOLLARS** 💵')
    .setDescription(`**📈 Les plus actifs sur Discord !**\n\n*Classement basé sur l'activité Discord: messages, réactions, présence vocal.*`)
    .addFields([
      {
        name: '🏆 **TOP ACTIFS**',
        value: topUsers.map((user: any, index: number) => {
          const medal = getMedal(index + 1);
          const isCurrentUser = user.discordId === interaction.user.id;
          const userTag = isCurrentUser ? '**→ VOUS ←**' : '';
          const streakEmoji = user.loginStreak > 7 ? '🔥' : user.loginStreak > 3 ? '⚡' : '';
          
          return `${medal} **${index + 1}.** ${user.username} ${userTag}\n💵 **${user.dollars.toFixed(2)}$** ${streakEmoji} Streak: ${user.loginStreak}j`;
        }).join('\n\n'),
        inline: false
      },
      {
        name: '💡 **COMMENT GAGNER DES DOLLARS**',
        value: '• Messages Discord (+1$)\n• Réactions (+0.5$)\n• Présence vocale (+2$/h)\n• Connexion quotidienne (+10$ + bonus streak)\n• Salaire hebdomadaire (`/salaire`)',
        inline: false
      }
    ])
    .setFooter({ 
      text: userPosition 
        ? `Votre position: #${userPosition.position} avec ${userPosition.dollars.toFixed(2)}$`
        : 'Soyez actif sur Discord pour apparaître dans le classement !'
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ⛏️ CLASSEMENT MINING (Production)
async function showMiningLeaderboard(interaction: ChatInputCommandInteraction, databaseService: any, limit: number) {
  const topMiners = await databaseService.client.user.findMany({
    where: {
      NOT: {
        discordId: {
          startsWith: 'bot_'
        }
      }
    },
    orderBy: {
      totalMined: 'desc'
    },
    take: limit,
    select: {
      discordId: true,
      username: true,
      totalMined: true,
      totalMiningHours: true,
      machines: {
        select: {
          type: true,
          level: true
        }
      }
    }
  });

  if (topMiners.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle('⛏️ Classement Mining')
      .setDescription('Aucun mineur trouvé.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const userPosition = await getUserPosition(databaseService, interaction.user.id, 'totalMined');
  
  const embed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('⛏️ **CLASSEMENT MINING** ⛏️')
    .setDescription(`**🔗 Les maîtres de la blockchain !**\n\n*Classement basé sur la production totale de tokens via le mining.*`)
    .addFields([
      {
        name: '🏆 **TOP MINERS**',
        value: topMiners.map((user: any, index: number) => {
          const medal = getMedal(index + 1);
          const isCurrentUser = user.discordId === interaction.user.id;
          const userTag = isCurrentUser ? '**→ VOUS ←**' : '';
          const machineCount = user.machines.length;
          const avgRate = user.totalMiningHours > 0 ? (user.totalMined / user.totalMiningHours).toFixed(2) : '0.00';
          
          return `${medal} **${index + 1}.** ${user.username} ${userTag}\n` +
                 `⛏️ **${user.totalMined.toFixed(2)}** tokens minés\n` +
                 `🏭 ${machineCount} machines | ⏱️ ${user.totalMiningHours.toFixed(1)}h | 📈 ${avgRate} T/h`;
        }).join('\n\n'),
        inline: false
      }
    ])
    .setFooter({ 
      text: userPosition 
        ? `Votre position: #${userPosition.position} avec ${userPosition.totalMined.toFixed(2)} tokens minés`
        : 'Achetez des machines avec `/shop` pour commencer à miner !'
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// 📊 CLASSEMENT GLOBAL (Vue d'ensemble)
async function showGlobalLeaderboard(interaction: ChatInputCommandInteraction, databaseService: any, limit: number) {
  const topUsers = await databaseService.client.user.findMany({
    where: {
      NOT: {
        discordId: {
          startsWith: 'bot_'
        }
      }
    },
    take: limit,
    select: {
      discordId: true,
      username: true,
      tokens: true,
      dollars: true,
      totalMined: true,
      battlesWon: true,
      battlesLost: true,
      machines: {
        select: {
          type: true
        }
      }
    }
  });

  // Calculer un score global pour chaque utilisateur
  const rankedUsers = topUsers.map((user: any) => {
    const totalBattles = user.battlesWon + user.battlesLost;
    const winRate = totalBattles > 0 ? (user.battlesWon / totalBattles) : 0;
    
    // Score global combiné (pondéré)
    const tokenScore = user.tokens * 1;           // 1x tokens
    const dollarScore = user.dollars * 0.1;       // 0.1x dollars  
    const miningScore = user.totalMined * 2;      // 2x mining
    const battleScore = user.battlesWon * 50;     // 50x victoires
    const machineScore = user.machines.length * 10; // 10x machines
    
    const globalScore = tokenScore + dollarScore + miningScore + battleScore + machineScore;
    
    return {
      ...user,
      totalBattles,
      winRate,
      globalScore,
      machineCount: user.machines.length
    };
  })
  .sort((a: any, b: any) => b.globalScore - a.globalScore);

  if (rankedUsers.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('📊 Classement Global')
      .setDescription('Aucun joueur trouvé.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const userGlobalStats = rankedUsers.find((user: any) => user.discordId === interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('📊 **CLASSEMENT GLOBAL** 📊')
    .setDescription(`**🌟 Les légendes du serveur !**\n\n*Classement combiné: Tokens + Mining + Battles + Activité*`)
    .addFields([
      {
        name: '🏆 **HALL OF LEGENDS**',
        value: rankedUsers.slice(0, Math.min(10, limit)).map((user: any, index: number) => {
          const medal = getMedal(index + 1);
          const isCurrentUser = user.discordId === interaction.user.id;
          const userTag = isCurrentUser ? '**→ VOUS ←**' : '';
          
          // Badges selon les stats
          let badges = '';
          if (user.tokens > 1000) badges += '💰';
          if (user.battlesWon > 5) badges += '⚔️';
          if (user.totalMined > 500) badges += '⛏️';
          if (user.machineCount > 3) badges += '🏭';
          
          return `${medal} **${index + 1}.** ${user.username} ${badges} ${userTag}\n` +
                 `⭐ Score: **${user.globalScore.toFixed(0)}** pts\n` +
                 `💰 ${user.tokens.toFixed(0)}T | ⚔️ ${user.battlesWon}V | ⛏️ ${user.totalMined.toFixed(0)}M`;
        }).join('\n\n'),
        inline: false
      },
      {
        name: '🏅 **CALCUL DU SCORE**',
        value: 'Tokens (×1) + Dollars (×0.1) + Mining (×2) + Victoires (×50) + Machines (×10)',
        inline: false
      }
    ])
    .setFooter({ 
      text: userGlobalStats 
        ? `Votre position: #${rankedUsers.findIndex((u: any) => u.discordId === interaction.user.id) + 1} avec ${userGlobalStats.globalScore.toFixed(0)} points`
        : 'Participez aux activités pour apparaître dans le classement global !'
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// Fonction utilitaire pour obtenir la position d'un utilisateur
async function getUserPosition(databaseService: any, discordId: string, field: string) {
  try {
    const user = await databaseService.client.user.findUnique({
      where: { discordId },
      select: {
        [field]: true
      }
    });

    if (!user) return null;

    const usersAbove = await databaseService.client.user.count({
      where: {
        [field]: {
          gt: user[field]
        },
        NOT: {
          discordId: {
            startsWith: 'bot_'
          }
        }
      }
    });

    return {
      position: usersAbove + 1,
      [field]: user[field]
    };
  } catch (error) {
    logger.error('Error getting user position:', error);
    return null;
  }
}

// Fonction pour obtenir les médailles
function getMedal(position: number): string {
  switch (position) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    case 4:
    case 5: return '🏅';
    default: return '📊';
  }
}

// Ajouter le menu de navigation
async function addNavigationMenu(interaction: ChatInputCommandInteraction) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('leaderboard_navigation')
    .setPlaceholder('🔄 Changer de classement...')
    .addOptions([
      {
        label: '🪙 Classement Tokens',
        description: 'Les plus riches du serveur',
        value: 'tokens',
        emoji: '🪙'
      },
      {
        label: '⚔️ Classement Battles',
        description: 'Les meilleurs warriors PvP',
        value: 'battles',
        emoji: '⚔️'
      },
      {
        label: '💵 Classement Dollars',
        description: 'Les plus actifs sur Discord',
        value: 'dollars',
        emoji: '💵'
      },
      {
        label: '⛏️ Classement Mining',
        description: 'Les maîtres de la production',
        value: 'mining',
        emoji: '⛏️'
      },
      {
        label: '📊 Classement Global',
        description: 'Vue d\'ensemble combinée',
        value: 'global',
        emoji: '📊'
      }
    ]);

  const refreshButton = new ButtonBuilder()
    .setCustomId('leaderboard_refresh')
    .setLabel('🔄 Actualiser')
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(refreshButton);

  const currentReply = await interaction.fetchReply();
  await interaction.editReply({
    embeds: currentReply.embeds,
    components: [row1, row2]
  });
}

// ===== MISE À JOUR DE LA FONCTION handleLeaderboard dans battle.ts =====

// Remplacer la fonction handleLeaderboard existante dans battle.ts par:
export async function handleBattleLeaderboard(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  // Simplement rediriger vers le classement battles de la nouvelle commande
  const databaseService = services.get('database');
  await showBattlesLeaderboard(interaction, databaseService, 15);
}