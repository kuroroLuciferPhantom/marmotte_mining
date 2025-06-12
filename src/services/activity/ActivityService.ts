import { ActivityType, TransactionType } from '@prisma/client';
import { DatabaseService } from '../database/DatabaseService';
import { RedisService } from '../cache/RedisService';
import { logger } from '../../utils/logger';

interface ActivityReward {
  amount: number;
  type: ActivityType;
  multiplier: number;
}

interface DailyStats {
  messagesCount: number;
  reactionsCount: number;
  voiceMinutes: number;
  lastActivity: Date;
  streakDays: number;
}

export class ActivityService {
  private database: DatabaseService;
  private redis: RedisService;

  // Configuration des récompenses d'activité (en dollars fictifs)
  private rewardRates = {
    message: 1.0,           // 1$ par message
    reaction: 0.5,          // 0.5$ par réaction
    voicePerMinute: 2/60,   // 2$ par heure = 0.033$ par minute
    dailyLogin: 10.0,       // 10$ pour la connexion quotidienne
    streakBonus: 5.0        // 5$ supplémentaires par jour de streak
  };

  // Limites quotidiennes
  private dailyLimits = {
    messages: 50,     // Max 50$ par jour via messages
    reactions: 20,    // Max 10$ par jour via réactions (20 réactions)
    voice: 300        // Max 5h de vocal par jour
  };

  constructor(database: DatabaseService, redis: RedisService) {
    this.database = database;
    this.redis = redis;
  }

  /**
   * Récompense un utilisateur pour un message
   */
  async rewardMessage(userId: string, messageContent: string): Promise<ActivityReward | null> {
    try {
      // S'assurer que l'utilisateur existe
      await this.ensureUserExists(userId);

      // Vérifie les limites quotidiennes
      const todayStats = await this.getTodayStats(userId);
      if (todayStats.messagesCount >= this.dailyLimits.messages) {
        return null; // Limite atteinte
      }

      // Calcule la récompense (bonus pour messages longs et de qualité)
      let baseReward = this.rewardRates.message;
      const multiplier = this.calculateMessageMultiplier(messageContent);
      const finalReward = baseReward * multiplier;

      // Enregistre la récompense
      await this.giveActivityReward(userId, ActivityType.MESSAGE, finalReward, multiplier);

      // Met à jour les stats quotidiennes
      await this.updateDailyStats(userId, 'messages', 1);

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

      const todayStats = await this.getTodayStats(userId);
      if (todayStats.reactionsCount >= this.dailyLimits.reactions) {
        return null;
      }

      let baseReward = this.rewardRates.reaction;
      const multiplier = this.calculateReactionMultiplier(emoji);
      const finalReward = baseReward * multiplier;

      await this.giveActivityReward(userId, ActivityType.REACTION, finalReward, multiplier);
      await this.updateDailyStats(userId, 'reactions', 1);

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
   * S'assure qu'un utilisateur existe dans la base
   */
  private async ensureUserExists(discordId: string): Promise<void> {
    try {
      const existingUser = await this.database.client.user.findUnique({
        where: { discordId }
      });

      if (!existingUser) {
        await this.database.client.user.create({
          data: {
            discordId,
            username: `User_${discordId.slice(-4)}`, // Nom temporaire
            tokens: 100.0 // Tokens de départ
          }
        });
        logger.info(`Created new user: ${discordId}`);
      }
    } catch (error) {
      logger.error('Error ensuring user exists:', error);
    }
  }

  /**
   * Obtient le solde en dollars fictifs d'un utilisateur
   */
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

  // Méthodes privées
  private async giveActivityReward(userId: string, type: ActivityType, amount: number, multiplier: number): Promise<void> {
    await this.database.client.activityReward.create({
      data: {
        userId,
        type,
        amount,
        multiplier
      }
    });
  }

  private async getTodayStats(userId: string): Promise<DailyStats> {
    const today = new Date().toISOString().split('T')[0];
    const cached = await this.redis.hGetAll(`daily_stats:${userId}:${today}`);
    
    if (Object.keys(cached).length > 0) {
      return {
        messagesCount: parseInt(cached.messages || '0'),
        reactionsCount: parseInt(cached.reactions || '0'),
        voiceMinutes: parseInt(cached.voice || '0'),
        lastActivity: new Date(cached.lastActivity || Date.now()),
        streakDays: parseInt(cached.streak || '0')
      };
    }

    return {
      messagesCount: 0,
      reactionsCount: 0,
      voiceMinutes: 0,
      lastActivity: new Date(),
      streakDays: 0
    };
  }

  private async updateDailyStats(userId: string, type: 'messages' | 'reactions' | 'voice', increment: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const key = `daily_stats:${userId}:${today}`;
    
    const current = parseInt(await this.redis.hGet(key, type) || '0');
    await this.redis.hSet(key, type, (current + increment).toString());
    await this.redis.hSet(key, 'lastActivity', Date.now().toString());
  }

  private calculateMessageMultiplier(content: string): number {
    let multiplier = 1.0;
    
    // Bonus pour la longueur (messages plus substantiels)
    if (content.length > 50) multiplier += 0.2;
    if (content.length > 100) multiplier += 0.3;
    
    // Bonus pour certains mots-clés liés au jeu
    const gameKeywords = ['mining', 'minage', 'token', 'battle', 'machine'];
    const keywordCount = gameKeywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    ).length;
    multiplier += keywordCount * 0.1;
    
    // Malus pour spam (messages très courts ou répétitifs)
    if (content.length < 10) multiplier = 0.5;
    if (/(.)\1{4,}/.test(content)) multiplier = 0.3; // Caractères répétés
    
    return Math.max(0.1, Math.min(2.0, multiplier));
  }

  private calculateReactionMultiplier(emoji: string): number {
    // Bonus pour certains emojis liés au jeu
    const bonusEmojis = ['⛏️', '💎', '🚀', '💰', '🔥', '⚔️'];
    return bonusEmojis.includes(emoji) ? 1.5 : 1.0;
  }
}

export default ActivityService;