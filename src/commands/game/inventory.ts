// src/commands/game/leaderboard.ts - Version corrigée
import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType
} from 'discord.js';
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

    // Créer l'embed initial
    const embed = await createLeaderboardEmbed(type, databaseService, limit, interaction.user.id);
    
    // Créer les composants de navigation
    const components = createNavigationComponents();

    const response = await interaction.editReply({ 
      embeds: [embed], 
      components 
    });

    // 🔧 CORRECTION: Gérer les interactions avec le menu et boutons
    const collector = response.createMessageComponentCollector({ 
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: '❌ Cette interaction ne vous appartient pas.', ephemeral: true });
        return;
      }

      try {
        await i.deferUpdate();

        let newType = type;
        
        if (i.customId === 'leaderboard_navigation') {
          // 🔧 CORRECTION: Menu déroulant pour changer de classement
          newType = (i as any).values[0];
        } else if (i.customId === 'leaderboard_refresh') {
          // Actualiser le classement actuel
          newType = type;
        }

        // Générer le nouvel embed
        const newEmbed = await createLeaderboardEmbed(newType, databaseService, limit, i.user.id);
        
        await i.editReply({ 
          embeds: [newEmbed], 
          components: createNavigationComponents() 
        });

      } catch (error) {
        logger.error('Error handling leaderboard interaction:', error);
      }
    });

    collector.on('end', async () => {
      // Désactiver les composants après expiration
      try {
        const disabledComponents = createNavigationComponents(true);
        await interaction.editReply({ components: disabledComponents });
      } catch (error) {
        logger.warn('Could not disable leaderboard components:', error);
      }
    });

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

/**
 * 🏗️ Créer l'embed de classement selon le type
 */
async function createLeaderboardEmbed(type: string, databaseService: any, limit: number, userId: string): Promise<EmbedBuilder> {
  switch (type) {
    case 'tokens':
      return await showTokensLeaderboard(databaseService, limit, userId);
    case 'battles':
      return await showBattlesLeaderboard(databaseService, limit, userId);
    case 'dollars':
      return await showDollarsLeaderboard(databaseService, limit, userId);
    case 'mining':
      return await showMiningLeaderboard(databaseService, limit, userId);
    case 'global':
      return await showGlobalLeaderboard(databaseService, limit, userId);
    default:
      return await showTokensLeaderboard(databaseService, limit, userId);
  }
}

/**
 * 🪙 CLASSEMENT PAR TOKENS (Richesse)
 */
async function showTokensLeaderboard(databaseService: any, limit: number, userId: string): Promise<EmbedBuilder> {
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
    return new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle('🪙 Classement Tokens')
      .setDescription('Aucun joueur trouvé dans la base de données.')
      .setTimestamp();
  }

  const userPosition = await getUserPosition(databaseService, userId, 'tokens');
  
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🪙 **CLASSEMENT TOKENS** 🪙')
    .setDescription(`**💰 Les plus riches du serveur !**\n\n*Qui a accumulé le plus de tokens grâce au mining et aux battles ?*`)
    .addFields([
      {
        name: '🏆 **TOP PLAYERS**',
        value: topUsers.map((user: any, index: number) => {
          const medal = getMedal(index + 1);
          const isCurrentUser = user.discordId === userId;
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

  return embed;
}

/**
 * ⚔️ CLASSEMENT BATTLES (PvP) - 🔧 CORRECTION COMPLÈTE
 */
async function showBattlesLeaderboard(databaseService: any, limit: number, userId: string): Promise<EmbedBuilder> {
  try {
    // 🔧 CORRECTION: Récupérer les vraies données de bataille depuis la table BattleEntry
    const battleEntries = await databaseService.client.battleEntry.findMany({
      include: {
        user: {
          select: {
            discordId: true,
            username: true,
            tokens: true
          }
        },
        battle: {
          select: {
            status: true,
            createdAt: true
          }
        }
      },
      where: {
        user: {
          NOT: {
            discordId: {
              startsWith: 'bot_'
            }
          }
        }
      }
    });

    // Calculer les statistiques réelles par utilisateur
    const userStats = new Map();
    
    battleEntries.forEach((entry: any) => {
      const discordId = entry.user.discordId;
      const username = entry.user.username;
      
      if (!userStats.has(discordId)) {
        userStats.set(discordId, {
          discordId,
          username,
          battlesParticipated: 0,
          battlesWon: 0,
          battlesLost: 0,
          tokens: entry.user.tokens
        });
      }
      
      const stats = userStats.get(discordId);
      stats.battlesParticipated++;
      
      // 🔧 CORRECTION: Déterminer les victoires selon la position finale
      // Pour l'instant, on utilise une logique simple basée sur les tokens
      // À terme, il faudra stocker le classement final dans BattleEntry
      if (entry.finalPosition === 1) {
        stats.battlesWon++;
      } else if (entry.finalPosition > 1) {
        stats.battlesLost++;
      }
    });

    // Convertir en array et calculer les scores
    const battlers = Array.from(userStats.values())
      .filter((user: any) => user.battlesParticipated > 0)
      .map((user: any) => {
        const totalBattles = user.battlesParticipated;
        const winRate = totalBattles > 0 ? (user.battlesWon / totalBattles) * 100 : 0;
        const score = (user.battlesWon * 3) + (totalBattles * 0.5);
        
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
      return new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('⚔️ Classement Battles')
        .setDescription('Aucune bataille n\'a encore été jouée !\n\nUtilisez `/battle create` pour lancer la première guerre !')
        .setTimestamp();
    }

    const userBattleStats = battlers.find((user: any) => user.discordId === userId);

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('⚔️ **CLASSEMENT BATTLES** ⚔️')
      .setDescription(`**🎯 Les meilleurs warriors du serveur !**\n\n*Classement basé sur les victoires et la participation aux battles.*`)
      .addFields([
        {
          name: '🏆 **HALL OF FAME**',
          value: battlers.map((user: any, index: number) => {
            const medal = getMedal(index + 1);
            const isCurrentUser = user.discordId === userId;
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
          ? `Vos stats: #${battlers.findIndex((u: any) => u.discordId === userId) + 1} | ${userBattleStats.battlesWon}V-${userBattleStats.battlesLost}D (${userBattleStats.winRate.toFixed(1)}% WR)`
          : 'Participez à une battle pour apparaître dans le classement !'
      })
      .setTimestamp();

    return embed;

  } catch (error) {
    logger.error('Error in showBattlesLeaderboard:', error);
    
    return new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Erreur Battles')
      .setDescription('Impossible de charger les statistiques de bataille.')
      .setTimestamp();
  }
}

/**
 * 💵 CLASSEMENT DOLLARS (Activité Discord)
 */
async function showDollarsLeaderboard(databaseService: any, limit: number, userId: string): Promise<EmbedBuilder> {
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
    return new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle('💵 Classement Dollars')
      .setDescription('Aucun joueur trouvé.')
      .setTimestamp();
  }

  const userPosition = await getUserPosition(databaseService, userId, 'dollars');
  
  const embed = new EmbedBuilder()
    .setColor(0x27AE60)
    .setTitle('💵 **CLASSEMENT DOLLARS** 💵')
    .setDescription(`**📈 Les plus actifs sur Discord !**\n\n*Classement basé sur l'activité Discord: messages, réactions, présence vocal.*`)
    .addFields([
      {
        name: '🏆 **TOP ACTIFS**',
        value: topUsers.map((user: any, index: number) => {
          const medal = getMedal(index + 1);
          const isCurrentUser = user.discordId === userId;
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

  return embed;
}

/**
 * ⛏️ CLASSEMENT MINING (Production) - 🔧 CORRECTION DES DONNÉES
 */
async function showMiningLeaderboard(databaseService: any, limit: number, userId: string): Promise<EmbedBuilder> {
  try {
    // 🔧 CORRECTION: Calculer les vraies données de mining depuis les machines
    const usersWithMachines = await databaseService.client.user.findMany({
      where: {
        NOT: {
          discordId: {
            startsWith: 'bot_'
          }
        }
      },
      include: {
        machines: {
          select: {
            type: true,
            level: true,
            efficiency: true,
            createdAt: true
          }
        },
        transactions: {
          where: {
            type: 'MINING_REWARD'
          },
          select: {
            amount: true,
            createdAt: true
          }
        }
      },
      take: limit * 2 // Prendre plus pour filtrer après calcul
    });

    // Calculer les vraies statistiques de mining
    const minersData = usersWithMachines.map((user: any) => {
      // Calcul du hash rate total actuel
      const totalHashRate = user.machines.reduce((sum: number, machine: any) => {
        const hashRate = calculateMachineHashRate(machine);
        return sum + hashRate;
      }, 0);

      // Calcul du total miné depuis les récompenses
      const totalMined = user.transactions.reduce((sum: number, transaction: any) => {
        return sum + transaction.amount;
      }, 0);

      // Estimation des heures de mining (basé sur l'âge des machines)
      const totalMiningHours = user.machines.reduce((sum: number, machine: any) => {
        const machineAge = (Date.now() - new Date(machine.createdAt).getTime()) / (1000 * 60 * 60);
        return sum + Math.max(0, machineAge);
      }, 0);

      return {
        discordId: user.discordId,
        username: user.username,
        totalMined,
        totalMiningHours,
        currentHashRate: totalHashRate,
        machineCount: user.machines.length,
        avgHashRate: totalMiningHours > 0 ? totalMined / totalMiningHours : 0
      };
    })
    .filter((user: any) => user.totalMined > 0 || user.machineCount > 0) // Filtrer les vrais mineurs
    .sort((a: any, b: any) => b.totalMined - a.totalMined)
    .slice(0, limit);

    if (minersData.length === 0) {
      return new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle('⛏️ Classement Mining')
        .setDescription('Aucun mineur trouvé.\n\nAchetez des machines avec `/shop` pour commencer à miner !')
        .setTimestamp();
    }

    const userPosition = minersData.findIndex((u: any) => u.discordId === userId) + 1;
    const userMinerData = minersData.find((u: any) => u.discordId === userId);
    
    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle('⛏️ **CLASSEMENT MINING** ⛏️')
      .setDescription(`**🔗 Les maîtres de la blockchain !**\n\n*Classement basé sur la production totale de tokens via le mining.*`)
      .addFields([
        {
          name: '🏆 **TOP MINERS**',
          value: minersData.map((user: any, index: number) => {
            const medal = getMedal(index + 1);
            const isCurrentUser = user.discordId === userId;
            const userTag = isCurrentUser ? '**→ VOUS ←**' : '';
            
            return `${medal} **${index + 1}.** ${user.username} ${userTag}\n` +
                   `⛏️ **${user.totalMined.toFixed(2)}** tokens minés\n` +
                   `🏭 ${user.machineCount} machines | ⏱️ ${user.totalMiningHours.toFixed(1)}h | 📈 ${user.avgHashRate.toFixed(2)} T/h`;
          }).join('\n\n'),
          inline: false
        }
      ])
      .setFooter({ 
        text: userMinerData 
          ? `Votre position: #${userPosition} avec ${userMinerData.totalMined.toFixed(2)} tokens minés`
          : 'Achetez des machines avec `/shop` pour commencer à miner !'
      })
      .setTimestamp();

    return embed;

  } catch (error) {
    logger.error('Error in showMiningLeaderboard:', error);
    
    return new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Erreur Mining')
      .setDescription('Impossible de charger les statistiques de mining.')
      .setTimestamp();
  }
}

/**
 * 📊 CLASSEMENT GLOBAL (Vue d'ensemble)
 */
async function showGlobalLeaderboard(databaseService: any, limit: number, userId: string): Promise<EmbedBuilder> {
  const topUsers = await databaseService.client.user.findMany({
    where: {
      NOT: {
        discordId: {
          startsWith: 'bot_'
        }
      }
    },
    take: limit,
    include: {
      machines: {
        select: {
          type: true
        }
      },
      transactions: {
        where: {
          type: 'MINING_REWARD'
        },
        select: {
          amount: true
        }
      }
    }
  });

  // Calculer un score global pour chaque utilisateur
  const rankedUsers = topUsers.map((user: any) => {
    const totalMined = user.transactions.reduce((sum: number, t: any) => sum + t.amount, 0);
    const battlesWon = user.battlesWon || 0;
    const battlesLost = user.battlesLost || 0;
    const totalBattles = battlesWon + battlesLost;
    const winRate = totalBattles > 0 ? (battlesWon / totalBattles) : 0;
    
    // Score global combiné (pondéré)
    const tokenScore = user.tokens * 1;           // 1x tokens
    const dollarScore = user.dollars * 0.1;       // 0.1x dollars  
    const miningScore = totalMined * 2;           // 2x mining
    const battleScore = battlesWon * 50;          // 50x victoires
    const machineScore = user.machines.length * 10; // 10x machines
    
    const globalScore = tokenScore + dollarScore + miningScore + battleScore + machineScore;
    
    return {
      discordId: user.discordId,
      username: user.username,
      tokens: user.tokens,
      dollars: user.dollars,
      totalMined,
      battlesWon,
      battlesLost,
      totalBattles,
      winRate,
      globalScore,
      machineCount: user.machines.length
    };
  })
  .sort((a: any, b: any) => b.globalScore - a.globalScore);

  if (rankedUsers.length === 0) {
    return new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('📊 Classement Global')
      .setDescription('Aucun joueur trouvé.')
      .setTimestamp();
  }

  const userGlobalStats = rankedUsers.find((user: any) => user.discordId === userId);

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('📊 **CLASSEMENT GLOBAL** 📊')
    .setDescription(`**🌟 Les légendes du serveur !**\n\n*Classement combiné: Tokens + Mining + Battles + Activité*`)
    .addFields([
      {
        name: '🏆 **HALL OF LEGENDS**',
        value: rankedUsers.slice(0, Math.min(10, limit)).map((user: any, index: number) => {
          const medal = getMedal(index + 1);
          const isCurrentUser = user.discordId === userId;
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
        ? `Votre position: #${rankedUsers.findIndex((u: any) => u.discordId === userId) + 1} avec ${userGlobalStats.globalScore.toFixed(0)} points`
        : 'Participez aux activités pour apparaître dans le classement global !'
    })
    .setTimestamp();

  return embed;
}

/**
 * 🧭 Créer les composants de navigation
 */
function createNavigationComponents(disabled: boolean = false): ActionRowBuilder<any>[] {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('leaderboard_navigation')
    .setPlaceholder('🔄 Changer de classement...')
    .setDisabled(disabled)
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
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(refreshButton);

  return [row1, row2];
}

// ========================
// 🛠️ FONCTIONS UTILITAIRES
// ========================

/**
 * Calculer le hash rate d'une machine
 */
function calculateMachineHashRate(machine: any): number {
  const baseHashRates: { [key: string]: number } = {
    'BASIC_RIG': 0.1,
    'ADVANCED_RIG': 0.5,
    'QUANTUM_MINER': 2.0,
    'FUSION_REACTOR': 10.0,
    'MEGA_FARM': 50.0
  };
  
  const baseRate = baseHashRates[machine.type] || 0.1;
  const levelMultiplier = 1 + (machine.level - 1) * 0.2;
  const efficiencyMultiplier = machine.efficiency / 100;
  
  return baseRate * levelMultiplier * efficiencyMultiplier;
}

/**
 * Obtenir la position d'un utilisateur
 */
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

/**
 * Obtenir les médailles
 */
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

/**
 * 🔧 CORRECTION: Gestionnaire d'interactions pour les autres fichiers
 */
export async function handleLeaderboardInteraction(interaction: any, services: Map<string, any>) {
  const actionId = interaction.customId;
  const databaseService = services.get('database');
  
  try {
    await interaction.deferUpdate();
    
    let newType = 'tokens';
    
    if (actionId === 'leaderboard_navigation') {
      newType = interaction.values[0];
    } else if (actionId === 'leaderboard_refresh') {
      // Pour refresh, on garde le type actuel (à déterminer depuis l'embed)
      const currentEmbed = interaction.message.embeds[0];
      if (currentEmbed?.title?.includes('TOKENS')) newType = 'tokens';
      else if (currentEmbed?.title?.includes('BATTLES')) newType = 'battles';
      else if (currentEmbed?.title?.includes('DOLLARS')) newType = 'dollars';
      else if (currentEmbed?.title?.includes('MINING')) newType = 'mining';
      else if (currentEmbed?.title?.includes('GLOBAL')) newType = 'global';
    }
    
    const newEmbed = await createLeaderboardEmbed(newType, databaseService, 15, interaction.user.id);
    
    await interaction.editReply({ 
      embeds: [newEmbed], 
      components: createNavigationComponents() 
    });
    
  } catch (error) {
    logger.error('Error handling leaderboard interaction:', error);
  }
}

/**
 * 🔧 CORRECTION: Fonction pour battle.ts
 */
export async function handleBattleLeaderboard(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    await interaction.deferReply();
    
    const databaseService = services.get('database');
    const embed = await showBattlesLeaderboard(databaseService, 15, interaction.user.id);
    const components = createNavigationComponents();
    
    const response = await interaction.editReply({ 
      embeds: [embed], 
      components 
    });

    // Gérer les interactions
    const collector = response.createMessageComponentCollector({ 
      time: 300000 
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: '❌ Cette interaction ne vous appartient pas.', ephemeral: true });
        return;
      }
      
      await handleLeaderboardInteraction(i, services);
    });

  } catch (error) {
    logger.error('Error in handleBattleLeaderboard:', error);
  }
}