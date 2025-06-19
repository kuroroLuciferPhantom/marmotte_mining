// src/services/leaderboard/LeaderboardInteractionHandler.ts
import { StringSelectMenuInteraction, ButtonInteraction, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger';

export class LeaderboardInteractionHandler {
  private databaseService: any;

  constructor(databaseService: any) {
    this.databaseService = databaseService;
  }

  async handleLeaderboardInteraction(interaction: StringSelectMenuInteraction | ButtonInteraction): Promise<void> {
    try {

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'leaderboard_navigation') {
        const selectedType = interaction.values[0];
        await this.switchLeaderboardType(interaction, selectedType);
      } else if (interaction.isButton() && interaction.customId === 'leaderboard_refresh') {
        await this.refreshCurrentLeaderboard(interaction);
      }
    } catch (error) {
      logger.error('Error handling leaderboard interaction:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('💥 Erreur !')
        .setDescription('Une erreur s\'est produite lors de la mise à jour du classement.')
        .setTimestamp();

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  private async switchLeaderboardType(interaction: StringSelectMenuInteraction, type: string) {
   
    const limit = 15; // Valeur par défaut
    
    switch (type) {
      case 'tokens':
        await this.showTokensLeaderboard(interaction, limit);
        break;
      case 'battles':
        await this.showBattlesLeaderboard(interaction, limit);
        break;
      case 'dollars':
        await this.showDollarsLeaderboard(interaction, limit);
        break;
      case 'mining':
        await this.showMiningLeaderboard(interaction, limit);
        break;
      case 'global':
        await this.showGlobalLeaderboard(interaction, limit);
        break;
    }
  }

  private async refreshCurrentLeaderboard(interaction: ButtonInteraction) {    
    // Détecter le type actuel depuis le titre de l'embed
    const currentEmbed = interaction.message.embeds[0];
    const title = currentEmbed?.title || '';
    
    let type = 'tokens'; // Par défaut
    if (title.includes('BATTLES')) type = 'battles';
    else if (title.includes('DOLLARS')) type = 'dollars';
    else if (title.includes('MINING')) type = 'mining';
    else if (title.includes('GLOBAL')) type = 'global';
    
    await this.switchLeaderboardType(interaction as any, type);
  }

  // Copier toutes les fonctions de leaderboard.ts ici avec adaptation pour les interactions
  private async showTokensLeaderboard(interaction: StringSelectMenuInteraction, limit: number) {
    const topUsers = await this.databaseService.client.user.findMany({
      where: {
        NOT: {
          discordId: {
            startsWith: 'bot_'
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

    const userPosition = await this.getUserPosition(interaction.user.id, 'tokens');
    
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🪙 **CLASSEMENT TOKENS** 🪙')
      .setDescription(`**💰 Les plus riches du serveur !**\n\n*Qui a accumulé le plus de tokens grâce au mining et aux battles ?*`)
      .addFields([
        {
          name: '🏆 **TOP PLAYERS**',
          value: topUsers.map((user: any, index: number) => {
            const medal = this.getMedal(index + 1);
            const isCurrentUser = user.discordId === interaction.user.id;
            const userTag = isCurrentUser ? '**→ VOUS ←**' : '';
            
            return `${medal} **${index + 1}.** ${user.username} ${userTag}\n💰 **${user.tokens.toFixed(2)}** tokens`;
          }).join('\n\n'),
          inline: false
        }
      ])
      .setFooter({ 
        text: userPosition 
          ? `Votre position: #${userPosition.position} avec ${userPosition.tokens.toFixed(2)} tokens | Mis à jour`
          : 'Vous n\'êtes pas encore classé | Mis à jour'
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async showBattlesLeaderboard(interaction: StringSelectMenuInteraction, limit: number) {
    const battleStats = await this.databaseService.client.user.findMany({
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

    const battlers = battleStats
      .filter((user: any) => (user.battlesWon + user.battlesLost) > 0)
      .map((user: any) => {
        const totalBattles = user.battlesWon + user.battlesLost;
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
            const medal = this.getMedal(index + 1);
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
          ? `Vos stats: #${battlers.findIndex((u: any) => u.discordId === interaction.user.id) + 1} | ${userBattleStats.battlesWon}V-${userBattleStats.battlesLost}D (${userBattleStats.winRate.toFixed(1)}% WR) | Mis à jour`
          : 'Participez à une battle pour apparaître dans le classement ! | Mis à jour'
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async showDollarsLeaderboard(interaction: StringSelectMenuInteraction, limit: number) {
    const topUsers = await this.databaseService.client.user.findMany({
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

    const userPosition = await this.getUserPosition(interaction.user.id, 'dollars');
    
    const embed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle('💵 **CLASSEMENT DOLLARS** 💵')
      .setDescription(`**📈 Les plus actifs sur Discord !**\n\n*Classement basé sur l'activité Discord: messages, réactions, présence vocal.*`)
      .addFields([
        {
          name: '🏆 **TOP ACTIFS**',
          value: topUsers.map((user: any, index: number) => {
            const medal = this.getMedal(index + 1);
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
          ? `Votre position: #${userPosition.position} avec ${userPosition.dollars.toFixed(2)}$ | Mis à jour`
          : 'Soyez actif sur Discord pour apparaître dans le classement ! | Mis à jour'
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async showMiningLeaderboard(interaction: StringSelectMenuInteraction, limit: number) {
    const topMiners = await this.databaseService.client.user.findMany({
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

    const userPosition = await this.getUserPosition(interaction.user.id, 'totalMined');
    
    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle('⛏️ **CLASSEMENT MINING** ⛏️')
      .setDescription(`**🔗 Les maîtres de la blockchain !**\n\n*Classement basé sur la production totale de tokens via le mining.*`)
      .addFields([
        {
          name: '🏆 **TOP MINERS**',
          value: topMiners.map((user: any, index: number) => {
            const medal = this.getMedal(index + 1);
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
          ? `Votre position: #${userPosition.position} avec ${userPosition.totalMined.toFixed(2)} tokens minés | Mis à jour`
          : 'Achetez des machines avec `/shop` pour commencer à miner ! | Mis à jour'
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async showGlobalLeaderboard(interaction: StringSelectMenuInteraction, limit: number) {
    const topUsers = await this.databaseService.client.user.findMany({
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

    const rankedUsers = topUsers.map((user: any) => {
      const totalBattles = user.battlesWon + user.battlesLost;
      const winRate = totalBattles > 0 ? (user.battlesWon / totalBattles) : 0;
      
      const tokenScore = user.tokens * 1;
      const dollarScore = user.dollars * 0.1;
      const miningScore = user.totalMined * 2;
      const battleScore = user.battlesWon * 50;
      const machineScore = user.machines.length * 10;
      
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
            const medal = this.getMedal(index + 1);
            const isCurrentUser = user.discordId === interaction.user.id;
            const userTag = isCurrentUser ? '**→ VOUS ←**' : '';
            
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
          ? `Votre position: #${rankedUsers.findIndex((u: any) => u.discordId === interaction.user.id) + 1} avec ${userGlobalStats.globalScore.toFixed(0)} points | Mis à jour`
          : 'Participez aux activités pour apparaître dans le classement global ! | Mis à jour'
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async getUserPosition(discordId: string, field: string) {
    try {
      const user = await this.databaseService.client.user.findUnique({
        where: { discordId },
        select: {
          [field]: true
        }
      });

      if (!user) return null;

      const usersAbove = await this.databaseService.client.user.count({
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

  private getMedal(position: number): string {
    switch (position) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      case 4:
      case 5: return '🏅';
      default: return '📊';
    }
  }
}

// Export pour utilisation dans le CommandManager
export async function handleLeaderboardButtonInteraction(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  databaseService: any
): Promise<void> {
  const handler = new LeaderboardInteractionHandler(databaseService);
  await handler.handleLeaderboardInteraction(interaction);
}