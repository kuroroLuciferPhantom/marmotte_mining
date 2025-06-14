import { MachineType, TransactionType } from '@prisma/client';
import { DatabaseService } from '../database/DatabaseService';
import { RedisService } from '../cache/RedisService';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';
import { HousingService } from '../housing/HousingService';

interface MiningStats {
  tokensPerSecond: number;
  efficiency: number;
  totalMachines: number;
  powerConsumption: number;
  energyCostPerHour: number;
  maintenanceNeeded: number;
}

interface MachineConfig {
  cost: number;
  baseHashRate: number;
  powerConsumption: number;
  maintenanceCost: number;
  upgradeCost: number;
  wearRate: number; // Taux d'usure par heure
  energyCostPerWatt: number; // Coût en tokens par Watt/heure
}

interface WearResult {
  machineId: string;
  oldDurability: number;
  newDurability: number;
  oldEfficiency: number;
  newEfficiency: number;
  criticalFailure: boolean;
}

export class MiningService {
  private database: DatabaseService;
  private redis: RedisService;

  // Configuration des machines avec système d'usure
  private machineConfigs: Record<MachineType, MachineConfig> = {
    BASIC_RIG: {
      cost: 100,
      baseHashRate: 0.1,
      powerConsumption: 10,
      maintenanceCost: 5,
      upgradeCost: 50,
      wearRate: 0.5, // 0.5% d'usure par heure
      energyCostPerWatt: 0.001 // 0.001 token par Watt/heure
    },
    ADVANCED_RIG: {
      cost: 500,
      baseHashRate: 0.5,
      powerConsumption: 25,
      maintenanceCost: 15,
      upgradeCost: 100,
      wearRate: 0.8,
      energyCostPerWatt: 0.001
    },
    QUANTUM_MINER: {
      cost: 2000,
      baseHashRate: 2.0,
      powerConsumption: 50,
      maintenanceCost: 50,
      upgradeCost: 250,
      wearRate: 1.2,
      energyCostPerWatt: 0.0015
    },
    FUSION_REACTOR: {
      cost: 10000,
      baseHashRate: 10.0,
      powerConsumption: 100,
      maintenanceCost: 200,
      upgradeCost: 500,
      wearRate: 2.0,
      energyCostPerWatt: 0.002
    },
    MEGA_FARM: {
      cost: 50000,
      baseHashRate: 50.0,
      powerConsumption: 300,
      maintenanceCost: 1000,
      upgradeCost: 1000,
      wearRate: 3.0,
      energyCostPerWatt: 0.0025
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

      const operationalCheck = await this.checkMachinesOperational(userId);
  
      if (!operationalCheck.operational) {
        return { 
          success: false, 
          message: 'Pas de loyer, pas de minage!'
        };
      }

      // Vérifie si des machines ont besoin de maintenance critique
      const brokenMachines = user.machines.filter(m => m.durability <= 0);
      if (brokenMachines.length > 0) {
        return { 
          success: false, 
          message: `${brokenMachines.length} machine(s) en panne! Utilisez /repair pour les réparer avant de miner.` 
        };
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
  async stopMining(userId: string): Promise<{ success: boolean; message: string; rewards?: number; energyCost?: number; wearReport?: WearResult[] }> {
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

      const miningTimeHours = (Date.now() - user.lastMiningCheck.getTime()) / (1000 * 60 * 60);

      // Calcule les récompenses brutes
      const grossRewards = await this.calculateMiningRewards(userId, user.lastMiningCheck);

      // Applique l'usure des machines
      const wearReport = await this.applyWearAndTear(userId, miningTimeHours);

      // Calcule les coûts énergétiques
      const energyCost = await this.calculateEnergyCost(userId, miningTimeHours);

      // Récompenses nettes
      const netRewards = Math.max(0, grossRewards - energyCost);

      // Met à jour l'utilisateur
      await this.database.client.user.update({
        where: { id: userId },
        data: {
          miningActive: false,
          tokens: { increment: netRewards },
          totalMined: { increment: grossRewards },
          lastMiningCheck: new Date()
        }
      });

      // Enregistre les transactions
      await this.database.client.transaction.createMany({
        data: [
          {
            userId,
            type: TransactionType.MINING_REWARD,
            amount: grossRewards,
            description: `Récompense de minage: ${grossRewards.toFixed(4)} tokens`
          },
          {
            userId,
            type: TransactionType.ENERGY_COST,
            amount: -energyCost,
            description: `Coût énergétique: ${energyCost.toFixed(4)} tokens (${miningTimeHours.toFixed(1)}h)`
          }
        ]
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

      logger.info(`User ${userId} stopped mining, earned ${netRewards} tokens (gross: ${grossRewards}, energy: ${energyCost})`);
      
      let message = `🎉 Minage arrêté!\n💰 Gains bruts: ${grossRewards.toFixed(4)} tokens\n⚡ Coût énergie: ${energyCost.toFixed(4)} tokens\n💎 Gains nets: ${netRewards.toFixed(4)} tokens`;

      // Ajoute les alertes d'usure
      const criticalMachines = wearReport.filter(w => w.newDurability <= 20);
      if (criticalMachines.length > 0) {
        message += `\n⚠️ ${criticalMachines.length} machine(s) nécessitent une maintenance!`;
      }

      return { 
        success: true, 
        message,
        rewards: netRewards,
        energyCost,
        wearReport
      };

    } catch (error) {
      logger.error('Error stopping mining:', error);
      return { success: false, message: 'Erreur lors de l\'arrêt du minage' };
    }
  }

  /**
   * Applique l'usure des machines en fonction du temps de minage
   */
  private async applyWearAndTear(userId: string, miningTimeHours: number): Promise<WearResult[]> {
    const results: WearResult[] = [];

    try {
      const machines = await this.database.client.machine.findMany({
        where: { userId }
      });

      for (const machine of machines) {
        const config = this.machineConfigs[machine.type];
        
        // Calcul de l'usure basée sur le temps et le type de machine
        const baseWearRate = config.wearRate / 100; // Convertit en décimal
        const levelPenalty = 1 + (machine.level - 1) * 0.1; // +10% d'usure par niveau
        const durabilityWear = miningTimeHours * baseWearRate * levelPenalty;
        
        const oldDurability = machine.durability;
        const newDurability = Math.max(0, oldDurability - durabilityWear);
        
        // L'efficacité est liée à la durabilité
        const oldEfficiency = machine.efficiency;
        let newEfficiency = oldEfficiency;
        
        if (newDurability < 50) {
          // En dessous de 50% de durabilité, l'efficacité baisse plus rapidement
          const efficiencyPenalty = (50 - newDurability) * 0.5;
          newEfficiency = Math.max(10, oldEfficiency - efficiencyPenalty);
        }

        // Panne critique si durabilité tombe à 0
        const criticalFailure = newDurability <= 0;
        if (criticalFailure) {
          newEfficiency = 0;
        }

        // Met à jour la machine
        await this.database.client.machine.update({
          where: { id: machine.id },
          data: {
            durability: newDurability,
            efficiency: newEfficiency
          }
        });

        results.push({
          machineId: machine.id,
          oldDurability,
          newDurability,
          oldEfficiency,
          newEfficiency,
          criticalFailure
        });

        // Log les pannes critiques
        if (criticalFailure) {
          logger.warn(`Machine ${machine.id} (${machine.type}) critical failure for user ${userId}`);
        }
      }

    } catch (error) {
      logger.error('Error applying wear and tear:', error);
    }

    return results;
  }

  /**
   * Vérifie si l'utilisateur peut ajouter une nouvelle machine
   */
  async checkMachineCapacity(userId: string): Promise<{ canAdd: boolean; message: string; current: number; max: number }> {
    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      include: { machines: true }
    });

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const housingService = new HousingService(this.database.client);
    const housingInfo = housingService.getHousingInfo(user.housingType);
    const currentMachines = user.machines.filter(m => m.durability > 0).length;

    const canAdd = currentMachines < housingInfo.maxMachines;
    const message = canAdd 
      ? `Vous pouvez ajouter ${housingInfo.maxMachines - currentMachines} machine(s) supplémentaire(s).`
      : `Capacité maximale atteinte pour ${housingInfo.name}. Déménagez pour plus d'espace !`;

    return {
      canAdd,
      message,
      current: currentMachines,
      max: housingInfo.maxMachines
    };
  }

  /**
   * Vérifie si les machines peuvent fonctionner (loyer payé)
   */
  async checkMachinesOperational(userId: string): Promise<{ operational: boolean; reason?: string }> {
    const user = await this.database.client.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return { operational: false, reason: 'Utilisateur non trouvé' };
    }

    // Si les machines sont désactivées pour loyer impayé
    if (user.machinesDisabled) {
      return { operational: false, reason: 'Machines arrêtées - Loyer impayé depuis plus de 7 jours' };
    }

    // Vérifier si le loyer est très en retard (30+ jours = expulsion automatique)
    if (user.rentDue && user.rentDue < new Date()) {
      const daysOverdue = Math.floor((new Date().getTime() - user.rentDue.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue >= 30) {
        // Auto-expulsion
        await this.handleAutoEviction(userId);
        return { operational: false, reason: 'Expulsion automatique - Retour chez maman forcé' };
      }
    }

    return { operational: true };
  }

/**
 * Gère l'expulsion automatique
 */
private async handleAutoEviction(userId: string): Promise<void> {
  const housingService = new HousingService(this.database.client);
  // L'expulsion est gérée par le HousingService.processOverdueRents()
  await housingService.processOverdueRents();
}

  /**
   * Calcule les coûts énergétiques en fonction du temps de minage
   */
  private async calculateEnergyCost(userId: string, miningTimeHours: number): Promise<number> {
    try {
      const machines = await this.database.client.machine.findMany({
        where: { userId }
      });

      let totalEnergyCost = 0;

      for (const machine of machines) {
        const config = this.machineConfigs[machine.type];
        const powerConsumption = config.powerConsumption * machine.level;
        const energyCostPerHour = powerConsumption * config.energyCostPerWatt;
        
        // Seules les machines fonctionnelles consomment de l'énergie
        if (machine.durability > 0) {
          totalEnergyCost += energyCostPerHour * miningTimeHours;
        }
      }

      return totalEnergyCost;

    } catch (error) {
      logger.error('Error calculating energy cost:', error);
      return 0;
    }
  }

  /**
   * Répare une machine spécifique
   */
  async repairMachine(userId: string, machineId: string): Promise<{ success: boolean; message: string; cost?: number }> {
    try {
      const machine = await this.database.client.machine.findFirst({
        where: { id: machineId, userId },
        include: { user: true }
      });

      if (!machine) {
        return { success: false, message: 'Machine non trouvée' };
      }

      const config = this.machineConfigs[machine.type];
      
      // Coût proportionnel aux dégâts et au niveau
      const damageRatio = 1 - (machine.durability / 100);
      const levelMultiplier = 1 + (machine.level - 1) * 0.3;
      const repairCost = config.maintenanceCost * damageRatio * levelMultiplier;

      if (machine.user.tokens < repairCost) {
        return { 
          success: false, 
          message: `Fonds insuffisants! Réparation coûte ${repairCost.toFixed(2)} tokens.`,
          cost: repairCost
        };
      }

      // Transaction pour réparer
      await this.database.client.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { tokens: { decrement: repairCost } }
        });

        await tx.machine.update({
          where: { id: machineId },
          data: { 
            durability: 100,
            efficiency: Math.min(100, machine.efficiency + 20) // Bonus d'efficacité après réparation
          }
        });

        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.MAINTENANCE_COST,
            amount: -repairCost,
            description: `Réparation machine ${machine.type}`
          }
        });
      });

      logger.info(`User ${userId} repaired machine ${machineId} for ${repairCost} tokens`);
      return { 
        success: true, 
        message: `🔧 Machine ${machine.type} réparée! (+20% efficacité bonus)`,
        cost: repairCost
      };

    } catch (error) {
      logger.error('Error repairing machine:', error);
      return { success: false, message: 'Erreur lors de la réparation' };
    }
  }

  /**
   * Répare toutes les machines d'un utilisateur
   */
  async repairAllMachines(userId: string): Promise<{ success: boolean; message: string; totalCost?: number; repairedCount?: number }> {
    try {
      const user = await this.database.client.user.findUnique({
        where: { id: userId },
        include: { machines: true }
      });

      if (!user) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      const damagedMachines = user.machines.filter(m => m.durability < 100);
      
      if (damagedMachines.length === 0) {
        return { success: false, message: 'Toutes vos machines sont en parfait état!' };
      }

      let totalCost = 0;
      
      // Calcule le coût total
      for (const machine of damagedMachines) {
        const config = this.machineConfigs[machine.type];
        const damageRatio = 1 - (machine.durability / 100);
        const levelMultiplier = 1 + (machine.level - 1) * 0.3;
        totalCost += config.maintenanceCost * damageRatio * levelMultiplier;
      }

      if (user.tokens < totalCost) {
        return { 
          success: false, 
          message: `Fonds insuffisants! Réparation complète coûte ${totalCost.toFixed(2)} tokens.`,
          totalCost
        };
      }

      // Transaction pour réparer toutes les machines
      await this.database.client.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { tokens: { decrement: totalCost } }
        });

        // Répare chaque machine
        for (const machine of damagedMachines) {
          await tx.machine.update({
            where: { id: machine.id },
            data: { 
              durability: 100,
              efficiency: Math.min(100, machine.efficiency + 10)
            }
          });
        }

        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.MAINTENANCE_COST,
            amount: -totalCost,
            description: `Réparation complète de ${damagedMachines.length} machines`
          }
        });
      });

      logger.info(`User ${userId} repaired ${damagedMachines.length} machines for ${totalCost} tokens`);
      return { 
        success: true, 
        message: `🔧 ${damagedMachines.length} machines réparées! Coût total: ${totalCost.toFixed(2)} tokens`,
        totalCost,
        repairedCount: damagedMachines.length
      };

    } catch (error) {
      logger.error('Error repairing all machines:', error);
      return { success: false, message: 'Erreur lors de la réparation complète' };
    }
  }

  /**
   * Obtient les statistiques de minage d'un utilisateur avec les nouveaux paramètres
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
      let energyCostPerHour = 0;
      let maintenanceNeeded = 0;

      for (const machine of user.machines) {
        const config = this.machineConfigs[machine.type];
        const levelMultiplier = 1 + (machine.level - 1) * 0.2;
        
        if (machine.durability > 0) {
          totalHashRate += config.baseHashRate * levelMultiplier * (machine.efficiency / 100) * (machine.durability / 100);
          totalPowerConsumption += config.powerConsumption * machine.level;
          energyCostPerHour += config.powerConsumption * machine.level * config.energyCostPerWatt;
        }
        
        averageEfficiency += machine.efficiency;
        
        if (machine.durability < 50) {
          maintenanceNeeded++;
        }
      }

      if (user.machines.length > 0) {
        averageEfficiency = averageEfficiency / user.machines.length;
      }

      return {
        tokensPerSecond: totalHashRate * config.game.miningBaseRate,
        efficiency: averageEfficiency,
        totalMachines: user.machines.length,
        powerConsumption: totalPowerConsumption,
        energyCostPerHour,
        maintenanceNeeded
      };

    } catch (error) {
      logger.error('Error getting mining stats:', error);
      return null;
    }
  }

  /**
   * Calcule les récompenses de minage basées sur les machines et le temps (inchangé mais améliore la lisibilité)
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

      // Calcule le hash rate total de toutes les machines fonctionnelles
      for (const machine of user.machines) {
        // Seules les machines avec durabilité > 0 peuvent miner
        if (machine.durability <= 0) continue;

        const machineConfig = this.machineConfigs[machine.type];
        const levelMultiplier = 1 + (machine.level - 1) * 0.2; // +20% par niveau
        const efficiencyMultiplier = machine.efficiency / 100;
        const durabilityMultiplier = machine.durability / 100;

        totalHashRate += machineConfig.baseHashRate * levelMultiplier * efficiencyMultiplier * durabilityMultiplier;
      }

      // Obtient le prix actuel du token
      const currentPrice = await this.getCurrentTokenPrice();
      
      // Calcule les récompenses brutes (avant coûts énergétiques)
      const baseReward = totalHashRate * timeElapsed * config.game.miningBaseRate;
      const priceMultiplier = currentPrice / config.game.tokenBasePrice;
      
      return Math.max(0, baseReward * priceMultiplier);

    } catch (error) {
      logger.error('Error calculating mining rewards:', error);
      return 0;
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

      // Vérifier la capacité avant l'achat
      const capacityCheck = await this.checkMachineCapacity(userId);
      
      if (!capacityCheck.canAdd) {
        return { 
          success: false, 
          message: `Espace insuffisant! Utilisez \`/demenager\` pour un logement plus grand !` 
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