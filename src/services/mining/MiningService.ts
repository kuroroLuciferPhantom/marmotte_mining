import { MachineType, TransactionType } from '@prisma/client';
import { DatabaseService } from '../database/DatabaseService';
import { RedisService } from '../cache/RedisService';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';

interface MiningStats {
  tokensPerSecond: number;
  efficiency: number;
  totalMachines: number;
  powerConsumption: number;
}

interface MachineConfig {
  cost: number;
  baseHashRate: number;
  powerConsumption: number;
  maintenanceCost: number;
  upgradeCost: number;
}

export class MiningService {
  private database: DatabaseService;
  private redis: RedisService;

  // Configuration des machines
  private machineConfigs: Record<MachineType, MachineConfig> = {
    BASIC_RIG: {
      cost: 100,
      baseHashRate: 0.1,
      powerConsumption: 10,
      maintenanceCost: 5,
      upgradeCost: 50
    },
    ADVANCED_RIG: {
      cost: 500,
      baseHashRate: 0.5,
      powerConsumption: 25,
      maintenanceCost: 15,
      upgradeCost: 100
    },
    QUANTUM_MINER: {
      cost: 2000,
      baseHashRate: 2.0,
      powerConsumption: 50,
      maintenanceCost: 50,
      upgradeCost: 250
    },
    FUSION_REACTOR: {
      cost: 10000,
      baseHashRate: 10.0,
      powerConsumption: 100,
      maintenanceCost: 200,
      upgradeCost: 500
    },
    MEGA_FARM: {
      cost: 50000,
      baseHashRate: 50.0,
      powerConsumption: 300,
      maintenanceCost: 1000,
      upgradeCost: 1000
    }
  };

  constructor(database: DatabaseService, redis: RedisService) {
    this.database = database;
    this.redis = redis;
  }

  /**
   * Démarre le minage pour un utilisateur
   */
  async startMining(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.database.client.user.findUnique({
        where: { id: userId },
        include: { machines: true }
      });

      if (!user) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      if (user.machines.length === 0) {
        return { success: false, message: 'Vous devez d\'abord acheter une machine pour commencer à miner!' };
      }

      if (user.miningActive) {
        return { success: false, message: 'Vous êtes déjà en train de miner!' };
      }

      // Active le minage
      await this.database.client.user.update({
        where: { id: userId },
        data: {
          miningActive: true,
          lastMiningCheck: new Date()
        }
      });

      // Cache les informations de minage dans Redis
      await this.redis.hSet(`mining:${userId}`, 'active', 'true');
      await this.redis.hSet(`mining:${userId}`, 'startTime', Date.now().toString());

      logger.info(`User ${userId} started mining`);
      return { success: true, message: '⛏️ Minage démarré! Vos machines travaillent dur.' };

    } catch (error) {
      logger.error('Error starting mining:', error);
      return { success: false, message: 'Erreur lors du démarrage du minage' };
    }
  }

  /**
   * Arrête le minage pour un utilisateur
   */
  async stopMining(userId: string): Promise<{ success: boolean; message: string; rewards?: number }> {
    try {
      const user = await this.database.client.user.findUnique({
        where: { id: userId },
        include: { machines: true }
      });

      if (!user) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      if (!user.miningActive) {
        return { success: false, message: 'Vous n\'êtes pas en train de miner!' };
      }

      // Calcule les récompenses
      const rewards = await this.calculateMiningRewards(userId, user.lastMiningCheck);

      // Met à jour l'utilisateur
      await this.database.client.user.update({
        where: { id: userId },
        data: {
          miningActive: false,
          tokens: { increment: rewards },
          totalMined: { increment: rewards },
          lastMiningCheck: new Date()
        }
      });

      // Enregistre la transaction
      await this.database.client.transaction.create({
        data: {
          userId,
          type: TransactionType.MINING_REWARD,
          amount: rewards,
          description: `Récompense de minage: ${rewards.toFixed(4)} tokens`
        }
      });

      // Nettoie Redis
      await this.redis.del(`mining:${userId}`);

      // Met à jour le leaderboard
      const updatedUser = await this.database.client.user.findUnique({
        where: { id: userId }
      });
      if (updatedUser) {
        await this.redis.addToLeaderboard(userId, updatedUser.tokens);
      }

      logger.info(`User ${userId} stopped mining, earned ${rewards} tokens`);
      return { 
        success: true, 
        message: `🎉 Minage arrêté! Vous avez gagné ${rewards.toFixed(4)} tokens.`,
        rewards 
      };

    } catch (error) {
      logger.error('Error stopping mining:', error);
      return { success: false, message: 'Erreur lors de l\'arrêt du minage' };
    }
  }

  /**
   * Collecte automatiquement les récompenses de minage
   */
  async collectMiningRewards(userId: string): Promise<number> {
    try {
      const user = await this.database.client.user.findUnique({
        where: { id: userId },
        include: { machines: true }
      });

      if (!user || !user.miningActive) {
        return 0;
      }

      const rewards = await this.calculateMiningRewards(userId, user.lastMiningCheck);

      if (rewards > 0) {
        await this.database.client.user.update({
          where: { id: userId },
          data: {
            tokens: { increment: rewards },
            totalMined: { increment: rewards },
            lastMiningCheck: new Date()
          }
        });

        await this.database.client.transaction.create({
          data: {
            userId,
            type: TransactionType.MINING_REWARD,
            amount: rewards,
            description: `Collecte automatique: ${rewards.toFixed(4)} tokens`
          }
        });

        // Met à jour le leaderboard
        const updatedUser = await this.database.client.user.findUnique({
          where: { id: userId }
        });
        if (updatedUser) {
          await this.redis.addToLeaderboard(userId, updatedUser.tokens);
        }
      }

      return rewards;

    } catch (error) {
      logger.error('Error collecting mining rewards:', error);
      return 0;
    }
  }

  /**
   * Calcule les récompenses de minage basées sur les machines et le temps
   */
  private async calculateMiningRewards(userId: string, lastCheck: Date): Promise<number> {
    try {
      const user = await this.database.client.user.findUnique({
        where: { id: userId },
        include: { machines: true }
      });

      if (!user || user.machines.length === 0) {
        return 0;
      }

      const now = new Date();
      const timeElapsed = (now.getTime() - lastCheck.getTime()) / 1000; // en secondes

      let totalHashRate = 0;

      // Calcule le hash rate total de toutes les machines
      for (const machine of user.machines) {
        const machineConfig = this.machineConfigs[machine.type];
        const levelMultiplier = 1 + (machine.level - 1) * 0.2; // +20% par niveau
        const efficiencyMultiplier = machine.efficiency / 100;
        const durabilityMultiplier = machine.durability / 100;

        totalHashRate += machineConfig.baseHashRate * levelMultiplier * efficiencyMultiplier * durabilityMultiplier;
      }

      // Obtient le prix actuel du token
      const currentPrice = await this.getCurrentTokenPrice();
      
      // Calcule les récompenses
      const baseReward = totalHashRate * timeElapsed * config.game.miningBaseRate;
      const priceMultiplier = currentPrice / config.game.tokenBasePrice;
      
      return Math.max(0, baseReward * priceMultiplier);

    } catch (error) {
      logger.error('Error calculating mining rewards:', error);
      return 0;
    }
  }

  /**
   * Achète une machine
   */
  async purchaseMachine(userId: string, machineType: MachineType): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.database.client.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      const machineConfig = this.machineConfigs[machineType];
      
      if (user.tokens < machineConfig.cost) {
        return { 
          success: false, 
          message: `Fonds insuffisants! Vous avez besoin de ${machineConfig.cost} tokens.` 
        };
      }

      // Transaction pour acheter la machine
      await this.database.client.$transaction(async (tx) => {
        // Débite les tokens
        await tx.user.update({
          where: { id: userId },
          data: { tokens: { decrement: machineConfig.cost } }
        });

        // Crée la machine
        await tx.machine.create({
          data: {
            userId,
            type: machineType,
            efficiency: 100.0,
            durability: 100.0
          }
        });

        // Enregistre la transaction
        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.MACHINE_PURCHASE,
            amount: -machineConfig.cost,
            description: `Achat de machine: ${machineType}`
          }
        });
      });

      logger.info(`User ${userId} purchased machine ${machineType}`);
      return { 
        success: true, 
        message: `🎉 Machine ${machineType} achetée avec succès!` 
      };

    } catch (error) {
      logger.error('Error purchasing machine:', error);
      return { success: false, message: 'Erreur lors de l\'achat de la machine' };
    }
  }

  /**
   * Améliore une machine
   */
  async upgradeMachine(userId: string, machineId: string): Promise<{ success: boolean; message: string }> {
    try {
      const machine = await this.database.client.machine.findFirst({
        where: { id: machineId, userId },
        include: { user: true }
      });

      if (!machine) {
        return { success: false, message: 'Machine non trouvée' };
      }

      const machineConfig = this.machineConfigs[machine.type];
      const upgradeCost = machineConfig.upgradeCost * machine.level;

      if (machine.user.tokens < upgradeCost) {
        return { 
          success: false, 
          message: `Fonds insuffisants! Amélioration coûte ${upgradeCost} tokens.` 
        };
      }

      // Transaction pour améliorer
      await this.database.client.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { tokens: { decrement: upgradeCost } }
        });

        await tx.machine.update({
          where: { id: machineId },
          data: { level: { increment: 1 } }
        });

        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.UPGRADE_COST,
            amount: -upgradeCost,
            description: `Amélioration machine niveau ${machine.level + 1}`
          }
        });
      });

      return { 
        success: true, 
        message: `⬆️ Machine améliorée au niveau ${machine.level + 1}!` 
      };

    } catch (error) {
      logger.error('Error upgrading machine:', error);
      return { success: false, message: 'Erreur lors de l\'amélioration' };
    }
  }

  /**
   * Obtient les statistiques de minage d'un utilisateur
   */
  async getMiningStats(userId: string): Promise<MiningStats | null> {
    try {
      const user = await this.database.client.user.findUnique({
        where: { id: userId },
        include: { machines: true }
      });

      if (!user) {
        return null;
      }

      let totalHashRate = 0;
      let totalPowerConsumption = 0;
      let averageEfficiency = 0;

      for (const machine of user.machines) {
        const config = this.machineConfigs[machine.type];
        const levelMultiplier = 1 + (machine.level - 1) * 0.2;
        
        totalHashRate += config.baseHashRate * levelMultiplier * (machine.efficiency / 100);
        totalPowerConsumption += config.powerConsumption * machine.level;
        averageEfficiency += machine.efficiency;
      }

      if (user.machines.length > 0) {
        averageEfficiency = averageEfficiency / user.machines.length;
      }

      return {
        tokensPerSecond: totalHashRate * config.game.miningBaseRate,
        efficiency: averageEfficiency,
        totalMachines: user.machines.length,
        powerConsumption: totalPowerConsumption
      };

    } catch (error) {
      logger.error('Error getting mining stats:', error);
      return null;
    }
  }

  /**
   * Obtient le prix actuel du token
   */
  private async getCurrentTokenPrice(): Promise<number> {
    try {
      const cachedPrice = await this.redis.getCurrentTokenPrice();
      if (cachedPrice) {
        return cachedPrice.price;
      }

      // Si pas en cache, retourne le prix de base
      return config.game.tokenBasePrice;
    } catch (error) {
      logger.error('Error getting current token price:', error);
      return config.game.tokenBasePrice;
    }
  }

  /**
   * Obtient les configurations des machines
   */
  getMachineConfigs(): Record<MachineType, MachineConfig> {
    return this.machineConfigs;
  }
}

export default MiningService;