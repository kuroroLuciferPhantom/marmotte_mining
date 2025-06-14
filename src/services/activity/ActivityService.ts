// src/services/activity/ActivityService.ts - Version sans vocal + salaire hebdomadaire
import { ActivityType, TransactionType } from '@prisma/client';
import { DatabaseService } from '../database/DatabaseService';
import { logger } from '../../utils/logger';

interface ActivityReward {
  amount: number;
  type: ActivityType;
  multiplier: number;
}

interface DailyStats {
  messagesCount: number;
  reactionsCount: number;
  lastActivity: Date;
  streakDays: number;
  lastSalaryDate: Date | null;
}

export class ActivityService {
  private database: DatabaseService;
  
  // Cache en mémoire pour les stats du jour
  private todayStatsCache: Map<string, DailyStats> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  // Configuration des récompenses (en dollars fictifs)
  private rewardRates = {
    message: 1.0,           // 1$ par message
    reaction: 0.5,          // 0.5$ par réaction
    dailyLogin: 10.0,       // 10$ pour la connexion quotidienne
    streakBonus: 5.0,       // 5$ supplémentaires par jour de streak
    weeklySalary: 250.0     // 250$ de salaire hebdomadaire
  };

  // Limites quotidiennes
  private dailyLimits = {
    messages: 50,     // Max 50$ par jour via messages
    reactions: 20     // Max 10$ par jour via réactions (20 réactions)
  };

  constructor(database: DatabaseService) {
    this.database = database;
    
    // Nettoyage du cache toutes les heures
    setInterval(() => this.cleanupCache(), 60 * 60 * 1000);
  }

  /**
   * Récompense un utilisateur pour un message
   */
  async rewardMessage(userId: string, messageContent: string): Promise<ActivityReward | null> {
    try {
      await this.ensureUserExists(userId);

      const todayStats = await this.getTodayStatsOptimized(userId);
      if (todayStats.messagesCount >= this.dailyLimits.messages) {
        return null; // Limite atteinte
      }

      // Calcule la récompense (bonus pour messages longs et de qualité)
      let baseReward = this.rewardRates.message;
      const multiplier = this.calculateMessageMultiplier(messageContent);
      const finalReward = baseReward * multiplier;

      // Transaction atomique
      await this.database.client.$transaction(async (tx) => {
        // Enregistrer la récompense
        await tx.activityReward.create({
          data: {
            userId,
            type: ActivityType.MESSAGE,
            amount: finalReward,
            multiplier
          }
        });

        // Mettre à jour les stats quotidiennes
        const today = new Date().toISOString().split('T')[0];
        await tx.dailyStats.upsert({
          where: {
            userId_date: {
              userId,
              date: today
            }
          },
          update: {
            messagesCount: { increment: 1 },
            lastActivity: new Date()
          },
          create: {
            userId,
            date: today,
            messagesCount: 1,
            reactionsCount: 0,
            lastActivity: new Date(),
            streakDays: 0,
            lastSalaryDate: null
          }
        });
      });

      // Mettre à jour le cache
      this.updateCachedStats(userId, 'messages', 1);

      logger.debug(`User ${userId} earned ${finalReward}$ for message activity`);
      
      return {
        amount: finalReward,
        type: ActivityType.MESSAGE,
        multiplier
      };

    } catch (error) {
      logger.error('Error rewarding message activity:', error);
      return null;
    }
  }

  /**
   * Récompense pour une réaction
   */
  async rewardReaction(userId: string, emoji: string): Promise<ActivityReward | null> {
    try {
      await this.ensureUserExists(userId);

      const todayStats = await this.getTodayStatsOptimized(userId);
      if (todayStats.reactionsCount >= this.dailyLimits.reactions) {
        return null;
      }

      let baseReward = this.rewardRates.reaction;
      const multiplier = this.calculateReactionMultiplier(emoji);
      const finalReward = baseReward * multiplier;

      await this.database.client.$transaction(async (tx) => {
        await tx.activityReward.create({
          data: {
            userId,
            type: ActivityType.REACTION,
            amount: finalReward,
            multiplier
          }
        });

        const today = new Date().toISOString().split('T')[0];
        await tx.dailyStats.upsert({
          where: {
            userId_date: {
              userId,
              date: today
            }
          },
          update: {
            reactionsCount: { increment: 1 },
            lastActivity: new Date()
          },
          create: {
            userId,
            date: today,
            messagesCount: 0,
            reactionsCount: 1,
            lastActivity: new Date(),
            streakDays: 0,
            lastSalaryDate: null
          }
        });
      });

      this.updateCachedStats(userId, 'reactions', 1);

      return {
        amount: finalReward,
        type: ActivityType.REACTION,
        multiplier
      };

    } catch (error) {
      logger.error('Error rewarding reaction activity:', error);
      return null;
    }
  }

  /**
   * 💰 NOUVEAU : Récupérer le salaire hebdomadaire
   */
  async claimWeeklySalary(userId: string): Promise<{ success: boolean; amount?: number; nextAvailable?: Date; error?: string }> {
    try {
      await this.ensureUserExists(userId);

      // Vérifier la dernière fois que le salaire a été récupéré
      const lastSalary = await this.database.client.activityReward.findFirst({
        where: {
          userId,
          type: ActivityType.WEEKLY_SALARY
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Vérifier si une semaine s'est écoulée
      if (lastSalary && lastSalary.createdAt > oneWeekAgo) {
        const nextAvailable = new Date(lastSalary.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        return {
          success: false,
          nextAvailable,
          error: `Salaire déjà récupéré cette semaine. Prochain salaire disponible le ${nextAvailable.toLocaleDateString('fr-FR')}`
        };
      }

      // Calculer le bonus basé sur l'activité de la semaine
      const weeklyStats = await this.getWeeklyActivityStats(userId);
      const activityBonus = this.calculateActivityBonus(weeklyStats);
      const totalSalary = this.rewardRates.weeklySalary + activityBonus;

      // Enregistrer le salaire
      await this.database.client.activityReward.create({
        data: {
          userId,
          type: ActivityType.WEEKLY_SALARY,
          amount: totalSalary,
          multiplier: activityBonus > 0 ? 1 + (activityBonus / this.rewardRates.weeklySalary) : 1.0
        }
      });

      logger.info(`User ${userId} claimed weekly salary: ${totalSalary}$ (base: ${this.rewardRates.weeklySalary}$, bonus: ${activityBonus}$)`);

      return {
        success: true,
        amount: totalSalary
      };

    } catch (error) {
      logger.error('Error claiming weekly salary:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération du salaire'
      };
    }
  }

  /**
   * Obtient les statistiques d'activité de la semaine passée
   */
  private async getWeeklyActivityStats(userId: string): Promise<{ messages: number; reactions: number; activeDays: number }> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

      const weeklyStats = await this.database.client.dailyStats.findMany({
        where: {
          userId,
          date: {
            gte: oneWeekAgoStr
          }
        }
      });

      const totalMessages = weeklyStats.reduce((sum, day) => sum + day.messagesCount, 0);
      const totalReactions = weeklyStats.reduce((sum, day) => sum + day.reactionsCount, 0);
      const activeDays = weeklyStats.filter(day => day.messagesCount > 0 || day.reactionsCount > 0).length;

      return {
        messages: totalMessages,
        reactions: totalReactions,
        activeDays
      };
    } catch (error) {
      logger.error('Error getting weekly stats:', error);
      return { messages: 0, reactions: 0, activeDays: 0 };
    }
  }

  /**
   * Calcule le bonus d'activité pour le salaire
   */
  private calculateActivityBonus(stats: { messages: number; reactions: number; activeDays: number }): number {
    let bonus = 0;

    // Bonus pour les jours actifs (max 50$ pour 7 jours)
    bonus += Math.min(stats.activeDays * 7, 50);

    // Bonus pour l'activité (messages + réactions)
    const totalActivity = stats.messages + (stats.reactions * 2); // Les réactions valent 2x
    if (totalActivity >= 100) bonus += 25;  // 25$ bonus pour 100+ activités
    if (totalActivity >= 200) bonus += 25;  // 50$ total pour 200+ activités
    if (totalActivity >= 350) bonus += 50;  // 100$ total pour 350+ activités

    return Math.min(bonus, 100); // Bonus maximum de 100$
  }

  /**
   * Vérifie si le salaire est disponible
   */
  async canClaimSalary(userId: string): Promise<{ canClaim: boolean; nextAvailable?: Date }> {
    try {
      const lastSalary = await this.database.client.activityReward.findFirst({
        where: {
          userId,
          type: ActivityType.WEEKLY_SALARY
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!lastSalary) {
        return { canClaim: true };
      }

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      if (lastSalary.createdAt <= oneWeekAgo) {
        return { canClaim: true };
      }

      const nextAvailable = new Date(lastSalary.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { canClaim: false, nextAvailable };

    } catch (error) {
      logger.error('Error checking salary availability:', error);
      return { canClaim: false };
    }
  }

  /**
 * 💰 NOUVEAU : Débite des dollars du compte d'un utilisateur
 */
async deductDollars(userId: string, amount: number): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    await this.ensureUserExists(userId);

    // Vérifier le solde actuel
    const currentBalance = await this.getUserDollarBalance(userId);
    
    if (currentBalance < amount) {
      return {
        success: false,
        error: `Solde insuffisant. Disponible: ${currentBalance.toFixed(2)}$, Requis: ${amount}$`
      };
    }

    // Créer une transaction de débit
    await this.database.client.activityReward.create({
      data: {
        userId,
        type: ActivityType.WEEKLY_SALARY, // Réutiliser ce type ou créer DEDUCTION
        amount: -amount, // Montant négatif pour débit
        multiplier: 1.0
      }
    });

    const newBalance = currentBalance - amount;
    
    logger.info(`User ${userId} debited ${amount}$ (new balance: ${newBalance}$)`);
    
    return {
      success: true,
      newBalance
    };

  } catch (error) {
    logger.error('Error deducting dollars:', error);
    return {
      success: false,
      error: 'Erreur lors de la déduction'
    };
  }
}

async creditDollars(userId: string, amount: number, description: string = 'Crédit manuel'): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    await this.ensureUserExists(userId);

    // Créer une transaction de crédit
    await this.database.client.activityReward.create({
      data: {
        userId,
        type: ActivityType.WEEKLY_SALARY, // Réutiliser ce type
        amount: amount, // Montant positif pour crédit
        multiplier: 1.0
      }
    });

    const newBalance = await this.getUserDollarBalance(userId);
    
    logger.info(`User ${userId} credited ${amount}$ (new balance: ${newBalance}$) - ${description}`);
    
    return {
      success: true,
      newBalance
    };

  } catch (error) {
    logger.error('Error crediting dollars:', error);
    return {
      success: false,
      error: 'Erreur lors du crédit'
    };
  }
}

  // === Méthodes existantes (inchangées) ===

  /**
   * Obtient les stats du jour (avec cache)
   */
  private async getTodayStatsOptimized(userId: string): Promise<DailyStats> {
    const cacheKey = `${userId}:${new Date().toISOString().split('T')[0]}`;
    
    const cached = this.todayStatsCache.get(cacheKey);
    const expiry = this.cacheExpiry.get(cacheKey);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    const today = new Date().toISOString().split('T')[0];
    const stats = await this.database.client.dailyStats.findUnique({
      where: {
        userId_date: {
          userId,
          date: today
        }
      }
    });

    const result: DailyStats = {
      messagesCount: stats?.messagesCount || 0,
      reactionsCount: stats?.reactionsCount || 0,
      lastActivity: stats?.lastActivity || new Date(),
      streakDays: stats?.streakDays || 0,
      lastSalaryDate: stats?.lastSalaryDate || null
    };

    this.todayStatsCache.set(cacheKey, result);
    this.cacheExpiry.set(cacheKey, Date.now() + 5 * 60 * 1000);

    return result;
  }

  private updateCachedStats(userId: string, type: 'messages' | 'reactions', increment: number): void {
    const cacheKey = `${userId}:${new Date().toISOString().split('T')[0]}`;
    const cached = this.todayStatsCache.get(cacheKey);
    
    if (cached) {
      if (type === 'messages') cached.messagesCount += increment;
      if (type === 'reactions') cached.reactionsCount += increment;
      cached.lastActivity = new Date();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.todayStatsCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  async getUserDollarBalance(userId: string): Promise<number> {
    try {
      const rewards = await this.database.client.activityReward.aggregate({
        where: { userId },
        _sum: { amount: true }
      });

      return rewards._sum.amount || 0;
    } catch (error) {
      logger.error('Error getting user dollar balance:', error);
      return 0;
    }
  }

  private async ensureUserExists(discordId: string): Promise<void> {
    try {
      const existingUser = await this.database.client.user.findUnique({
        where: { discordId }
      });

      if (!existingUser) {
        await this.database.client.user.create({
          data: {
            discordId,
            username: `User_${discordId.slice(-4)}`,
            tokens: 100.0
          }
        });
        logger.info(`Created new user: ${discordId}`);
      }
    } catch (error) {
      logger.error('Error ensuring user exists:', error);
    }
  }

  private calculateMessageMultiplier(content: string): number {
    let multiplier = 1.0;
    
    // Bonus pour la longueur
    if (content.length > 50) multiplier += 0.2;
    if (content.length > 100) multiplier += 0.3;
    
    // Bonus pour certains mots-clés liés au jeu
    const gameKeywords = ['mining', 'minage', 'token', 'battle', 'machine', 'salaire'];
    const keywordCount = gameKeywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    ).length;
    multiplier += keywordCount * 0.1;
    
    // Malus pour spam
    if (content.length < 10) multiplier = 0.5;
    if (/(.)\\1{4,}/.test(content)) multiplier = 0.3;
    
    return Math.max(0.1, Math.min(2.0, multiplier));
  }

  private calculateReactionMultiplier(emoji: string): number {
    const bonusEmojis = ['⛏️', '💎', '🚀', '💰', '🔥', '⚔️'];
    return bonusEmojis.includes(emoji) ? 1.5 : 1.0;
  }
}


export default ActivityService;