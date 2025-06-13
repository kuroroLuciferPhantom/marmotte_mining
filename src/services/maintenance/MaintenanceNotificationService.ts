import { DatabaseService } from '../database/DatabaseService';
import { logger } from '../../utils/logger';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';

interface MaintenanceAlert {
  userId: string;
  machineId: string;
  machineType: string;
  alertType: 'LOW_DURABILITY' | 'CRITICAL_FAILURE' | 'EFFICIENCY_DROP' | 'HIGH_ENERGY_COST';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  durability: number;
  efficiency: number;
  repairCost?: number;
}

export class MaintenanceNotificationService {
  private database: DatabaseService;
  private discordClient: Client;
  private alertCooldowns: Map<string, number> = new Map(); // userId -> timestamp

  constructor(database: DatabaseService, discordClient: Client) {
    this.database = database;
    this.discordClient = discordClient;
  }

  /**
   * Vérifie et envoie les alertes de maintenance pour un utilisateur
   */
  async checkAndSendMaintenanceAlerts(userId: string): Promise<void> {
    try {
      const user = await this.database.client.user.findUnique({
        where: { id: userId },
        include: { machines: true }
      });

      if (!user || user.machines.length === 0) {
        return;
      }

      // Évite le spam d'alertes (cooldown de 1 heure)
      const lastAlert = this.alertCooldowns.get(userId) || 0;
      const now = Date.now();
      if (now - lastAlert < 3600000) { // 1 heure
        return;
      }

      const alerts: MaintenanceAlert[] = [];

      // Analyse chaque machine
      for (const machine of user.machines) {
        const machineAlerts = this.analyzeMachine(userId, machine);
        alerts.push(...machineAlerts);
      }

      // Envoie les alertes si nécessaire
      if (alerts.length > 0) {
        await this.sendMaintenanceNotification(user.discordId, alerts);
        this.alertCooldowns.set(userId, now);
        
        // Enregistre les alertes en base
        await this.logMaintenanceAlerts(alerts);
      }

    } catch (error) {
      logger.error('Error checking maintenance alerts:', error);
    }
  }

  /**
   * Analyse une machine et génère les alertes appropriées
   */
  private analyzeMachine(userId: string, machine: any): MaintenanceAlert[] {
    const alerts: MaintenanceAlert[] = [];

    // Alerte de durabilité critique
    if (machine.durability <= 0) {
      alerts.push({
        userId,
        machineId: machine.id,
        machineType: machine.type,
        alertType: 'CRITICAL_FAILURE',
        severity: 'CRITICAL',
        durability: machine.durability,
        efficiency: machine.efficiency,
        repairCost: this.estimateRepairCost(machine)
      });
    }
    // Alerte de durabilité faible
    else if (machine.durability <= 20) {
      alerts.push({
        userId,
        machineId: machine.id,
        machineType: machine.type,
        alertType: 'LOW_DURABILITY',
        severity: 'HIGH',
        durability: machine.durability,
        efficiency: machine.efficiency,
        repairCost: this.estimateRepairCost(machine)
      });
    }
    // Alerte de durabilité modérée
    else if (machine.durability <= 50) {
      alerts.push({
        userId,
        machineId: machine.id,
        machineType: machine.type,
        alertType: 'LOW_DURABILITY',
        severity: 'MEDIUM',
        durability: machine.durability,
        efficiency: machine.efficiency,
        repairCost: this.estimateRepairCost(machine)
      });
    }

    // Alerte de chute d'efficacité
    if (machine.efficiency <= 30) {
      alerts.push({
        userId,
        machineId: machine.id,
        machineType: machine.type,
        alertType: 'EFFICIENCY_DROP',
        severity: machine.efficiency <= 10 ? 'CRITICAL' : 'HIGH',
        durability: machine.durability,
        efficiency: machine.efficiency,
        repairCost: this.estimateRepairCost(machine)
      });
    }

    return alerts;
  }

  /**
   * Estime le coût de réparation d'une machine
   */
  private estimateRepairCost(machine: any): number {
    const baseCosts = {
      BASIC_RIG: 5,
      ADVANCED_RIG: 15,
      QUANTUM_MINER: 50,
      FUSION_REACTOR: 200,
      MEGA_FARM: 1000
    };

    const baseCost = baseCosts[machine.type as keyof typeof baseCosts] || 5;
    const damageRatio = 1 - (machine.durability / 100);
    const levelMultiplier = 1 + (machine.level - 1) * 0.3;

    return baseCost * damageRatio * levelMultiplier;
  }

  /**
   * Envoie une notification de maintenance par DM Discord
   */
  private async sendMaintenanceNotification(discordId: string, alerts: MaintenanceAlert[]): Promise<void> {
    try {
      const user = await this.discordClient.users.fetch(discordId);
      if (!user) {
        logger.warn(`Could not find Discord user ${discordId} for maintenance alert`);
        return;
      }

      const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
      const highAlerts = alerts.filter(a => a.severity === 'HIGH');
      const mediumAlerts = alerts.filter(a => a.severity === 'MEDIUM');

      let embedColor = 0x95A5A6; // Gris par défaut
      let title = '🔧 **Maintenance Recommandée**';

      if (criticalAlerts.length > 0) {
        embedColor = 0xE74C3C; // Rouge
        title = '🚨 **MAINTENANCE CRITIQUE REQUISE!**';
      } else if (highAlerts.length > 0) {
        embedColor = 0xF39C12; // Orange
        title = '⚠️ **Maintenance Urgente Recommandée**';
      }

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(title)
        .setDescription('Vos machines de minage ont besoin d\'attention!')
        .setTimestamp();

      // Ajoute les alertes critiques
      if (criticalAlerts.length > 0) {
        const criticalText = criticalAlerts.map(alert => 
          `💀 **${alert.machineType}** - EN PANNE!\n` +
          `🔧 Réparation: ${alert.repairCost?.toFixed(2)} tokens`
        ).join('\n\n');

        embed.addFields({
          name: '💀 Machines en Panne',
          value: criticalText,
          inline: false
        });
      }

      // Ajoute les alertes importantes
      if (highAlerts.length > 0) {
        const highText = highAlerts.map(alert => 
          `🔴 **${alert.machineType}** - Durabilité: ${alert.durability.toFixed(1)}%\n` +
          `🔧 Réparation: ${alert.repairCost?.toFixed(2)} tokens`
        ).join('\n\n');

        embed.addFields({
          name: '🔴 Maintenance Urgente',
          value: highText,
          inline: false
        });
      }

      // Ajoute les alertes modérées
      if (mediumAlerts.length > 0) {
        const mediumText = mediumAlerts.map(alert => 
          `🟡 **${alert.machineType}** - Durabilité: ${alert.durability.toFixed(1)}%`
        ).join('\n');

        embed.addFields({
          name: '🟡 Maintenance Préventive',
          value: mediumText,
          inline: false
        });
      }

      // Calcule le coût total de réparation
      const totalRepairCost = alerts.reduce((sum, alert) => sum + (alert.repairCost || 0), 0);
      
      embed.addFields(
        {
          name: '💰 Coût Total de Réparation',
          value: `${totalRepairCost.toFixed(2)} tokens`,
          inline: true
        },
        {
          name: '🛠️ Actions Disponibles',
          value: '• `/repair all` - Réparer toutes\n• `/repair machine <id>` - Réparer une machine\n• `/repair list` - Voir l\'état détaillé',
          inline: true
        }
      );

      if (criticalAlerts.length > 0) {
        embed.addFields({
          name: '⚠️ Important',
          value: 'Les machines en panne ne peuvent pas miner! Réparez-les avant de redémarrer le minage.',
          inline: false
        });
      }

      embed.setFooter({ 
        text: 'Cette alerte ne sera envoyée qu\'une fois par heure. Maintenez vos machines pour une efficacité optimale!' 
      });

      await user.send({ embeds: [embed] });
      logger.info(`Maintenance alert sent to user ${discordId} for ${alerts.length} issues`);

    } catch (error) {
      logger.error(`Error sending maintenance notification to ${discordId}:`, error);
    }
  }

  /**
   * Enregistre les alertes en base de données
   */
  private async logMaintenanceAlerts(alerts: MaintenanceAlert[]): Promise<void> {
    try {
      
      const alertData = alerts.map(alert => ({
        userId: alert.userId,
        machineId: alert.machineId,
        alertType: alert.alertType,
        message: this.generateAlertMessage(alert),
        severity: alert.severity
      }));

      await this.database.client.maintenanceAlert.createMany({
        data: alertData
      });

    } catch (error) {
      logger.error('Error logging maintenance alerts:', error);
    }
  }

  /**
   * Génère un message d'alerte personnalisé
   */
  private generateAlertMessage(alert: MaintenanceAlert): string {
    switch (alert.alertType) {
      case 'CRITICAL_FAILURE':
        return `Machine ${alert.machineType} en panne critique - Réparation immédiate requise`;
      case 'LOW_DURABILITY':
        return `Machine ${alert.machineType} - Durabilité faible (${alert.durability.toFixed(1)}%)`;
      case 'EFFICIENCY_DROP':
        return `Machine ${alert.machineType} - Efficacité réduite (${alert.efficiency.toFixed(1)}%)`;
      case 'HIGH_ENERGY_COST':
        return `Machine ${alert.machineType} - Coûts énergétiques élevés`;
      default:
        return `Problème détecté sur machine ${alert.machineType}`;
    }
  }

  /**
   * Vérifie automatiquement toutes les machines actives (à appeler périodiquement)
   */
  async performScheduledMaintenanceCheck(): Promise<void> {
    try {
      const activeUsers = await this.database.client.user.findMany({
        where: { miningActive: true },
        include: { machines: true }
      });

      for (const user of activeUsers) {
        await this.checkAndSendMaintenanceAlerts(user.id);
      }

      logger.info(`Performed scheduled maintenance check for ${activeUsers.length} active users`);

    } catch (error) {
      logger.error('Error in scheduled maintenance check:', error);
    }
  }

  /**
   * Nettoie les anciens cooldowns d'alertes
   */
  cleanupAlertCooldowns(): void {
    const now = Date.now();
    const oneHour = 3600000;

    for (const [userId, timestamp] of this.alertCooldowns.entries()) {
      if (now - timestamp > oneHour) {
        this.alertCooldowns.delete(userId);
      }
    }
  }
}

export default MaintenanceNotificationService;