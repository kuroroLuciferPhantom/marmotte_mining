import { DatabaseService } from '../database/DatabaseService';
import { MiningService } from '../mining/MiningService';
import { logger } from '../../utils/logger';

export class MachineMaintenanceService {
  private database: DatabaseService;
  private miningService: MiningService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(database: DatabaseService, miningService: MiningService) {
    this.database = database;
    this.miningService = miningService;
  }

  /**
   * ⚙️ Démarre le processus de maintenance automatique
   */
  startMaintenanceLoop(): void {
    if (this.intervalId) {
      logger.warn('Maintenance loop already running');
      return;
    }

    // Exécute la maintenance toutes les heures
    this.intervalId = setInterval(async () => {
      try {
        await this.runMaintenanceCycle();
      } catch (error) {
        logger.error('Error in maintenance cycle:', error);
      }
    }, 60 * 60 * 1000); // 1 heure

    logger.info('🔧 Machine maintenance loop started (runs every hour)');
  }

  /**
   * 🛑 Arrête le processus de maintenance
   */
  stopMaintenanceLoop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('🛑 Machine maintenance loop stopped');
    }
  }

  /**
   * 🔧 Exécute un cycle complet de maintenance
   */
  private async runMaintenanceCycle(): Promise<void> {
    logger.info('🔧 Starting maintenance cycle...');

    // 1. Applique l'usure périodique aux machines en fonctionnement
    await this.miningService.applyPeriodicWear();

    // 2. Vérifie les machines nécessitant une maintenance critique
    await this.checkCriticalMaintenance();

    // 3. Notifie les utilisateurs si nécessaire
    await this.notifyMaintenanceNeeded();

    logger.info('✅ Maintenance cycle completed');
  }

  /**
   * ⚠️ Vérifie les machines en état critique
   */
  private async checkCriticalMaintenance(): Promise<void> {
    const criticalMachines = await this.database.client.machine.findMany({
      where: {
        durability: { lte: 20 },
        user: { miningActive: true }
      },
      include: { user: true }
    });

    if (criticalMachines.length > 0) {
      logger.warn(`⚠️ Found ${criticalMachines.length} machines in critical condition`);
      
      // Groupe par utilisateur
      const userGroups = criticalMachines.reduce((groups, machine) => {
        const userId = machine.user.id;
        if (!groups[userId]) {
          groups[userId] = [];
        }
        groups[userId].push(machine);
        return groups;
      }, {} as Record<string, typeof criticalMachines>);

      // Log pour chaque utilisateur
      Object.entries(userGroups).forEach(([userId, machines]) => {
        logger.warn(`User ${userId} has ${machines.length} critical machines (durability ≤ 20%)`);
      });
    }
  }

  /**
   * 📢 Notifie les utilisateurs de la maintenance nécessaire
   * (Placeholder pour future implémentation Discord)
   */
  private async notifyMaintenanceNeeded(): Promise<void> {
    // TODO: Intégrer avec Discord pour envoyer des notifications
    // Pour l'instant, on log seulement
    
    const usersNeedingMaintenance = await this.database.client.user.findMany({
      where: {
        miningActive: true,
        machines: {
          some: {
            durability: { lte: 30 }
          }
        }
      },
      include: {
        machines: {
          where: {
            durability: { lte: 30 }
          }
        }
      }
    });

    if (usersNeedingMaintenance.length > 0) {
      logger.info(`📢 ${usersNeedingMaintenance.length} users need machine maintenance notifications`);
    }
  }

  /**
   * 📊 Obtient les statistiques de maintenance globales
   */
  async getMaintenanceStats(): Promise<{
    totalMachines: number;
    healthyMachines: number;
    needsMaintenance: number;
    criticalMachines: number;
    brokenMachines: number;
  }> {
    const [total, healthy, needsMaintenance, critical, broken] = await Promise.all([
      this.database.client.machine.count(),
      this.database.client.machine.count({ where: { durability: { gte: 80 } } }),
      this.database.client.machine.count({ where: { durability: { lt: 50, gt: 0 } } }),
      this.database.client.machine.count({ where: { durability: { lte: 20, gt: 0 } } }),
      this.database.client.machine.count({ where: { durability: { lte: 0 } } })
    ]);

    return {
      totalMachines: total,
      healthyMachines: healthy,
      needsMaintenance,
      criticalMachines: critical,
      brokenMachines: broken
    };
  }
}