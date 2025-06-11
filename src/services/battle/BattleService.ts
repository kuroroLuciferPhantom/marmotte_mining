import { BattleStatus, TransactionType } from '@prisma/client';
import { DatabaseService } from '../database/DatabaseService';
import { RedisService } from '../cache/RedisService';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';

interface BattleResult {
  battleId: string;
  winnerId: string;
  participants: Array<{
    userId: string;
    position: number;
    reward: number;
  }>;
  prizePool: number;
}

interface BattleInfo {
  id: string;
  status: BattleStatus;
  participants: number;
  maxPlayers: number;
  prizePool: number;
  startTime?: Date;
  endTime?: Date;
}

export class BattleService {
  private database: DatabaseService;
  private redis: RedisService;
  private activeBattles: Map<string, NodeJS.Timeout> = new Map();

  constructor(database: DatabaseService, redis: RedisService) {
    this.database = database;
    this.redis = redis;
  }

  /**
   * Crée une nouvelle bataille royale
   */
  async createBattle(maxPlayers: number = 10): Promise<{ success: boolean; battleId?: string; message: string }> {
    try {
      const battle = await this.database.client.battle.create({
        data: {
          maxPlayers,
          status: BattleStatus.WAITING,
          prizePool: 0
        }
      });

      // Cache la bataille dans Redis
      await this.redis.hSet(`battle:${battle.id}`, 'status', 'WAITING');
      await this.redis.hSet(`battle:${battle.id}`, 'participants', '0');
      await this.redis.hSet(`battle:${battle.id}`, 'maxPlayers', maxPlayers.toString());

      logger.info(`Created new battle ${battle.id} with max ${maxPlayers} players`);
      
      return {
        success: true,
        battleId: battle.id,
        message: `⚔️ Nouvelle bataille créée! ID: ${battle.id}`
      };

    } catch (error) {
      logger.error('Error creating battle:', error);
      return { success: false, message: 'Erreur lors de la création de la bataille' };
    }
  }

  /**
   * Rejoint une bataille
   */
  async joinBattle(userId: string, battleId?: string): Promise<{ success: boolean; message: string; battleInfo?: BattleInfo }> {
    try {
      const user = await this.database.client.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      // Vérifie le cooldown
      const lastBattle = await this.database.client.battleEntry.findFirst({
        where: { userId },
        orderBy: { joinedAt: 'desc' },
        include: { battle: true }
      });

      if (lastBattle) {
        const timeSinceLastBattle = Date.now() - lastBattle.joinedAt.getTime();
        const cooldownTime = config.game.battleCooldown * 1000;
        
        if (timeSinceLastBattle < cooldownTime) {
          const remainingTime = Math.ceil((cooldownTime - timeSinceLastBattle) / 1000 / 60);
          return { 
            success: false, 
            message: `⏰ Vous devez attendre ${remainingTime} minutes avant de rejoindre une autre bataille` 
          };
        }
      }

      // Trouve une bataille disponible
      let battle;
      if (battleId) {
        battle = await this.database.client.battle.findUnique({
          where: { id: battleId },
          include: { entries: true }
        });
      } else {
        battle = await this.database.client.battle.findFirst({
          where: { status: BattleStatus.WAITING },
          include: { entries: true },
          orderBy: { createdAt: 'asc' }
        });

        if (!battle) {
          const createResult = await this.createBattle();
          if (!createResult.success || !createResult.battleId) {
            return { success: false, message: 'Impossible de créer une bataille' };
          }
          
          battle = await this.database.client.battle.findUnique({
            where: { id: createResult.battleId },
            include: { entries: true }
          });
        }
      }

      if (!battle) {
        return { success: false, message: 'Aucune bataille disponible' };
      }

      if (battle.entries.length >= battle.maxPlayers) {
        return { success: false, message: 'Cette bataille est complète' };
      }

      const existingEntry = await this.database.client.battleEntry.findUnique({
        where: { 
          battleId_userId: { 
            battleId: battle.id, 
            userId 
          } 
        }
      });

      if (existingEntry) {
        return { success: false, message: 'Vous êtes déjà dans cette bataille' };
      }

      const entryFee = Math.max(10, user.level * 5);
      
      if (user.tokens < entryFee) {
        return { 
          success: false, 
          message: `Fonds insuffisants! Frais d'entrée: ${entryFee} tokens` 
        };
      }

      // Transaction pour rejoindre
      await this.database.client.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { tokens: { decrement: entryFee } }
        });

        await tx.battleEntry.create({
          data: {
            battleId: battle.id,
            userId
          }
        });

        await tx.battle.update({
          where: { id: battle.id },
          data: { prizePool: { increment: entryFee } }
        });

        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.BATTLE_ENTRY,
            amount: -entryFee,
            description: `Participation bataille ${battle.id}`
          }
        });
      });

      const updatedBattle = await this.database.client.battle.findUnique({
        where: { id: battle.id },
        include: { entries: true }
      });

      let battleInfo: BattleInfo = {
        id: battle.id,
        status: battle.status,
        participants: (updatedBattle?.entries.length || 0),
        maxPlayers: battle.maxPlayers,
        prizePool: battle.prizePool + entryFee
      };

      // Démarre si pleine
      if (updatedBattle && updatedBattle.entries.length >= battle.maxPlayers) {
        await this.startBattle(battle.id);
        battleInfo.status = BattleStatus.ACTIVE;
      }

      logger.info(`User ${userId} joined battle ${battle.id}`);
      
      return {
        success: true,
        message: `⚔️ Vous avez rejoint la bataille! Frais: ${entryFee} tokens`,
        battleInfo
      };

    } catch (error) {
      logger.error('Error joining battle:', error);
      return { success: false, message: 'Erreur lors de la participation à la bataille' };
    }
  }

  /**
   * Démarre une bataille
   */
  private async startBattle(battleId: string): Promise<void> {
    try {
      await this.database.client.battle.update({
        where: { id: battleId },
        data: {
          status: BattleStatus.ACTIVE,
          startTime: new Date()
        }
      });

      await this.redis.hSet(`battle:${battleId}`, 'status', 'ACTIVE');

      // Programme la fin de la bataille (durée aléatoire entre 2-5 minutes)
      const battleDuration = (120 + Math.random() * 180) * 1000; // 2-5 minutes en ms
      
      const timeout = setTimeout(async () => {
        await this.endBattle(battleId);
        this.activeBattles.delete(battleId);
      }, battleDuration);

      this.activeBattles.set(battleId, timeout);
      
      logger.info(`Battle ${battleId} started, will end in ${battleDuration/1000} seconds`);

    } catch (error) {
      logger.error('Error starting battle:', error);
    }
  }

  /**
   * Termine une bataille et distribue les récompenses
   */
  private async endBattle(battleId: string): Promise<BattleResult | null> {
    try {
      const battle = await this.database.client.battle.findUnique({
        where: { id: battleId },
        include: { entries: { include: { user: true } } }
      });

      if (!battle || battle.status !== BattleStatus.ACTIVE) {
        return null;
      }

      // Simule le combat en randomisant les positions basées sur les stats des joueurs
      const participants = await this.simulateBattle(battle.entries);

      // Met à jour la bataille
      await this.database.client.battle.update({
        where: { id: battleId },
        data: {
          status: BattleStatus.FINISHED,
          endTime: new Date(),
          winnerId: participants[0].userId
        }
      });

      // Distribue les récompenses
      const rewards = this.calculateRewards(battle.prizePool, participants.length);
      const result: BattleResult = {
        battleId,
        winnerId: participants[0].userId,
        participants: [],
        prizePool: battle.prizePool
      };

      for (let i = 0; i < participants.length; i++) {
        const participant = participants[i];
        const reward = rewards[i] || 0;
        const position = i + 1;

        // Met à jour l'entrée de bataille
        await this.database.client.battleEntry.update({
          where: { id: participant.id },
          data: {
            position,
            eliminated: position > 1,
            eliminatedAt: position > 1 ? new Date() : null
          }
        });

        if (reward > 0) {
          // Donne la récompense
          await this.database.client.user.update({
            where: { id: participant.userId },
            data: { 
              tokens: { increment: reward },
              battlesWon: position === 1 ? { increment: 1 } : undefined,
              battlesLost: position > 1 ? { increment: 1 } : undefined
            }
          });

          await this.database.client.transaction.create({
            data: {
              userId: participant.userId,
              type: TransactionType.BATTLE_REWARD,
              amount: reward,
              description: `Récompense bataille - Position ${position}`
            }
          });

          // Met à jour le leaderboard
          const updatedUser = await this.database.client.user.findUnique({
            where: { id: participant.userId }
          });
          if (updatedUser) {
            await this.redis.addToLeaderboard(participant.userId, updatedUser.tokens);
          }
        }

        result.participants.push({
          userId: participant.userId,
          position,
          reward
        });
      }

      // Nettoie Redis
      await this.redis.del(`battle:${battleId}`);

      logger.info(`Battle ${battleId} ended, winner: ${participants[0].userId}`);
      return result;

    } catch (error) {
      logger.error('Error ending battle:', error);
      return null;
    }
  }

  /**
   * Simule le déroulement d'une bataille
   */
  private async simulateBattle(entries: any[]): Promise<any[]> {
    // Calcule un score pour chaque participant basé sur leurs stats
    const participantsWithScores = await Promise.all(
      entries.map(async (entry) => {
        const user = entry.user;
        
        // Facteurs influençant le combat
        const levelFactor = user.level * 10;
        const experienceFactor = user.experience * 0.01;
        const tokensFactor = Math.log(Math.max(1, user.tokens)) * 5;
        const randomFactor = Math.random() * 50; // Élément de chance

        const totalScore = levelFactor + experienceFactor + tokensFactor + randomFactor;
        
        return {
          ...entry,
          battleScore: totalScore
        };
      })
    );

    // Trie par score décroissant (meilleur score = meilleure position)
    return participantsWithScores.sort((a, b) => b.battleScore - a.battleScore);
  }

  /**
   * Calcule les récompenses selon les positions
   */
  private calculateRewards(prizePool: number, totalParticipants: number): number[] {
    const rewards: number[] = [];
    
    // Distribution des récompenses: 
    // 1er: 50%, 2e: 25%, 3e: 15%, 4e-6e: 3.33% chacun, autres: 0
    const distribution = [0.5, 0.25, 0.15];
    
    for (let i = 0; i < totalParticipants; i++) {
      if (i < 3) {
        rewards.push(Math.floor(prizePool * distribution[i]));
      } else if (i < 6) {
        rewards.push(Math.floor(prizePool * 0.0333));
      } else {
        rewards.push(0);
      }
    }

    return rewards;
  }

  /**
   * Obtient les informations d'une bataille
   */
  async getBattleInfo(battleId: string): Promise<BattleInfo | null> {
    try {
      const battle = await this.database.client.battle.findUnique({
        where: { id: battleId },
        include: { entries: true }
      });

      if (!battle) {
        return null;
      }

      return {
        id: battle.id,
        status: battle.status,
        participants: battle.entries.length,
        maxPlayers: battle.maxPlayers,
        prizePool: battle.prizePool,
        startTime: battle.startTime || undefined,
        endTime: battle.endTime || undefined
      };

    } catch (error) {
      logger.error('Error getting battle info:', error);
      return null;
    }
  }

  /**
   * Obtient la liste des batailles actives
   */
  async getActiveBattles(): Promise<BattleInfo[]> {
    try {
      const battles = await this.database.client.battle.findMany({
        where: {
          status: {
            in: [BattleStatus.WAITING, BattleStatus.ACTIVE]
          }
        },
        include: { entries: true },
        orderBy: { createdAt: 'desc' }
      });

      return battles.map(battle => ({
        id: battle.id,
        status: battle.status,
        participants: battle.entries.length,
        maxPlayers: battle.maxPlayers,
        prizePool: battle.prizePool,
        startTime: battle.startTime || undefined,
        endTime: battle.endTime || undefined
      }));

    } catch (error) {
      logger.error('Error getting active battles:', error);
      return [];
    }
  }

  /**
   * Obtient l'historique des batailles d'un utilisateur
   */
  async getUserBattleHistory(userId: string, limit: number = 10): Promise<any[]> {
    try {
      const entries = await this.database.client.battleEntry.findMany({
        where: { userId },
        include: { battle: true },
        orderBy: { joinedAt: 'desc' },
        take: limit
      });

      return entries.map(entry => ({
        battleId: entry.battle.id,
        joinedAt: entry.joinedAt,
        position: entry.position,
        prizePool: entry.battle.prizePool,
        status: entry.battle.status,
        participants: entry.battle.maxPlayers
      }));

    } catch (error) {
      logger.error('Error getting user battle history:', error);
      return [];
    }
  }

  /**
   * Nettoie les anciennes batailles terminées
   */
  async cleanupOldBattles(): Promise<void> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await this.database.client.battle.deleteMany({
        where: {
          status: BattleStatus.FINISHED,
          endTime: {
            lt: oneDayAgo
          }
        }
      });

      logger.info('Cleaned up old battles');

    } catch (error) {
      logger.error('Error cleaning up battles:', error);
    }
  }

  /**
   * Annule une bataille en attente
   */
  async cancelBattle(battleId: string): Promise<{ success: boolean; message: string }> {
    try {
      const battle = await this.database.client.battle.findUnique({
        where: { id: battleId },
        include: { entries: { include: { user: true } } }
      });

      if (!battle) {
        return { success: false, message: 'Bataille non trouvée' };
      }

      if (battle.status !== BattleStatus.WAITING) {
        return { success: false, message: 'Seules les batailles en attente peuvent être annulées' };
      }

      // Rembourse tous les participants
      for (const entry of battle.entries) {
        const entryFee = Math.max(10, entry.user.level * 5);
        
        await this.database.client.user.update({
          where: { id: entry.userId },
          data: { tokens: { increment: entryFee } }
        });

        await this.database.client.transaction.create({
          data: {
            userId: entry.userId,
            type: TransactionType.BATTLE_REWARD,
            amount: entryFee,
            description: `Remboursement bataille annulée ${battleId}`
          }
        });
      }

      // Marque la bataille comme annulée
      await this.database.client.battle.update({
        where: { id: battleId },
        data: { status: BattleStatus.CANCELLED }
      });

      await this.redis.del(`battle:${battleId}`);

      logger.info(`Battle ${battleId} cancelled and participants refunded`);
      
      return { 
        success: true, 
        message: 'Bataille annulée et participants remboursés' 
      };

    } catch (error) {
      logger.error('Error cancelling battle:', error);
      return { success: false, message: 'Erreur lors de l\'annulation' };
    }
  }
}

export default BattleService;