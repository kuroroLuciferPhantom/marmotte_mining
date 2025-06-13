import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { TokenPriceService } from './TokenPriceService';
import { DatabaseService } from '../database/DatabaseService';
import { RedisService } from '../cache/RedisService';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';

export interface PriceAlert {
  type: 'significant_change' | 'milestone' | 'volume_spike' | 'market_event';
  message: string;
  priceData: any;
  severity: 'low' | 'medium' | 'high';
}

export class TokenMarketService {
  private client: Client;
  private tokenPriceService: TokenPriceService;
  private redisService: RedisService;
  private db: DatabaseService;
  private marketChannelId?: string;
  private lastNotificationTime: number = 0;
  private readonly NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes

  constructor(client: Client, marketChannelId?: string) {
    this.client = client;
    this.tokenPriceService = new TokenPriceService();
    this.redisService = RedisService.getInstance();
    this.db = DatabaseService.getInstance();
    this.marketChannelId = marketChannelId;
  }

  /**
   * Démarre le service de surveillance du marché
   */
  async startMarketMonitoring() {
    logger.info('Starting token market monitoring service...');

    // Surveillance périodique toutes les 2 minutes
    setInterval(async () => {
      await this.checkMarketConditions();
    }, 2 * 60 * 1000);

    // Fluctuations automatiques toutes les 30 minutes
    setInterval(async () => {
      await this.triggerRandomMarketEvent();
    }, 30 * 60 * 1000);

    // Rapport quotidien à 12h00
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 12 && now.getMinutes() === 0) {
        await this.sendDailyReport();
      }
    }, 60 * 1000);

    logger.info('Token market monitoring service started');
  }

  /**
   * Vérifie les conditions du marché et envoie des alertes si nécessaire
   */
  private async checkMarketConditions() {
    try {
      const priceData = await this.tokenPriceService.calculateTokenValue();
      const lastPrice = await this.getLastNotifiedPrice();

      // Calculer le changement depuis la dernière notification
      const priceChange = lastPrice > 0 ? ((priceData.price - lastPrice) / lastPrice) * 100 : 0;

      const alerts: PriceAlert[] = [];

      // Vérifier les changements significatifs (>5%)
      if (Math.abs(priceChange) > 5) {
        alerts.push({
          type: 'significant_change',
          message: priceChange > 0 ? 
            `🚀 **Forte hausse du $7N1** (+${priceChange.toFixed(2)}%)` :
            `📉 **Chute du $7N1** (${priceChange.toFixed(2)}%)`,
          priceData,
          severity: Math.abs(priceChange) > 15 ? 'high' : 'medium'
        });
      }

      // Vérifier les jalons de prix
      if (this.isPriceMilestone(priceData.price)) {
        alerts.push({
          type: 'milestone',
          message: `🎯 **Jalon atteint !** Le $7N1 vaut maintenant $${priceData.price.toFixed(6)}`,
          priceData,
          severity: 'medium'
        });
      }

      // Vérifier les pics de volume
      if (priceData.volume24h > await this.getAverageVolume() * 2) {
        alerts.push({
          type: 'volume_spike',
          message: `💹 **Volume exceptionnel** détecté ! ${priceData.volume24h.toFixed(2)}$ en 24h`,
          priceData,
          severity: 'medium'
        });
      }

      // Envoyer les alertes
      for (const alert of alerts) {
        await this.sendMarketAlert(alert);
      }

      // Mettre à jour le dernier prix notifié
      if (alerts.length > 0) {
        await this.setLastNotifiedPrice(priceData.price);
      }

    } catch (error) {
      logger.error('Error checking market conditions:', error);
    }
  }

  /**
   * Déclenche un événement de marché aléatoire
   */
  private async triggerRandomMarketEvent() {
    try {
      const random = Math.random();
      
      if (random < 0.3) { // 30% de chance d'événement
        const events = [
          {
            type: 'mining_rush',
            factor: 0.15,
            duration: 60,
            message: '⛏️ **Rush de minage détecté !** Activité minière intense'
          },
          {
            type: 'whale_activity',
            factor: random > 0.5 ? 0.1 : -0.1,
            duration: 30,
            message: random > 0.5 ? 
              '🐋 **Baleine acheteuse** sur le marché ! Gros investissement détecté' :
              '🐋 **Baleine vendeuse** sur le marché ! Gros désinvestissement détecté'
          },
          {
            type: 'technical_upgrade',
            factor: 0.2,
            duration: 120,
            message: '🔧 **Mise à jour technique** ! Amélioration de l\'algorithme de minage'
          },
          {
            type: 'market_sentiment',
            factor: (Math.random() - 0.5) * 0.2,
            duration: 45,
            message: '📊 **Changement de sentiment** du marché détecté'
          }
        ];

        const event = events[Math.floor(Math.random() * events.length)];
        
        await this.tokenPriceService.applyEventFactor(
          event.factor,
          event.duration,
          event.type
        );

        const alert: PriceAlert = {
          type: 'market_event',
          message: event.message,
          priceData: await this.tokenPriceService.calculateTokenValue(),
          severity: Math.abs(event.factor) > 0.15 ? 'high' : 'medium'
        };

        await this.sendMarketAlert(alert);
        
        logger.info(`Triggered market event: ${event.type} (${event.factor})`);
      }
    } catch (error) {
      logger.error('Error triggering market event:', error);
    }
  }

  /**
   * Envoie une alerte de marché dans le canal dédié
   */
  private async sendMarketAlert(alert: PriceAlert) {
    if (!this.marketChannelId || Date.now() - this.lastNotificationTime < this.NOTIFICATION_COOLDOWN) {
      return;
    }

    try {
      const channel = this.client.channels.cache.get(this.marketChannelId) as TextChannel;
      if (!channel) return;

      const color = alert.severity === 'high' ? 0xff0000 : 
                   alert.severity === 'medium' ? 0xffaa00 : 0x00ff00;

      const embed = new EmbedBuilder()
        .setTitle('📊 Alerte Marché $7N1')
        .setDescription(alert.message)
        .setColor(color)
        .addFields([
          {
            name: '💰 Prix actuel',
            value: `$${alert.priceData.price.toFixed(6)}`,
            inline: true
          },
          {
            name: '📈 Variation 24h',
            value: `${alert.priceData.change24h > 0 ? '+' : ''}${alert.priceData.change24h.toFixed(2)}%`,
            inline: true
          },
          {
            name: '💹 Volume 24h',
            value: `$${alert.priceData.volume24h.toFixed(2)}`,
            inline: true
          }
        ])
        .setFooter({ text: '💡 Utilisez /cours pour plus de détails' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      this.lastNotificationTime = Date.now();

    } catch (error) {
      logger.error('Error sending market alert:', error);
    }
  }

  /**
   * Envoie le rapport quotidien du marché
   */
  private async sendDailyReport() {
    if (!this.marketChannelId) return;

    try {
      const channel = this.client.channels.cache.get(this.marketChannelId) as TextChannel;
      if (!channel) return;

      const [priceData, marketStats, history24h] = await Promise.all([
        this.tokenPriceService.calculateTokenValue(),
        this.tokenPriceService.getMarketStats(),
        this.tokenPriceService.getPriceHistory(24)
      ]);

      const prices24h = history24h.map(h => h.price);
      const high24h = Math.max(...prices24h);
      const low24h = Math.min(...prices24h);

      const embed = new EmbedBuilder()
        .setTitle('📋 Rapport Quotidien du Marché $7N1')
        .setColor(0x3498db)
        .setDescription('Résumé des dernières 24 heures')
        .addFields([
          {
            name: '💰 Prix actuel',
            value: `$${priceData.price.toFixed(6)}`,
            inline: true
          },
          {
            name: '📈 Plus haut 24h',
            value: `$${high24h.toFixed(6)}`,
            inline: true
          },
          {
            name: '📉 Plus bas 24h',
            value: `$${low24h.toFixed(6)}`,
            inline: true
          },
          {
            name: '💹 Volume total',
            value: `$${priceData.volume24h.toFixed(2)}`,
            inline: true
          },
          {
            name: '👥 Holders actifs',
            value: `${marketStats.activeHolders}`,
            inline: true
          },
          {
            name: '🪙 Supply totale',
            value: `${marketStats.totalSupply.toFixed(2)} $7N1`,
            inline: true
          }
        ])
        .addFields([
          {
            name: '📊 Analyse',
            value: this.generateMarketAnalysis(priceData, history24h),
            inline: false
          }
        ])
        .setFooter({ text: '📈 Rapport automatique quotidien' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

    } catch (error) {
      logger.error('Error sending daily report:', error);
    }
  }

  /**
   * Génère une analyse textuelle du marché
   */
  private generateMarketAnalysis(priceData: any, history: any[]): string {
    const analysis = [];
    
    if (priceData.change24h > 10) {
      analysis.push('🚀 **Forte performance** - Le token montre une croissance exceptionnelle');
    } else if (priceData.change24h > 5) {
      analysis.push('📈 **Tendance positive** - Croissance soutenue du token');
    } else if (priceData.change24h < -10) {
      analysis.push('📉 **Correction importante** - Le marché traverse une phase de correction');
    } else if (priceData.change24h < -5) {
      analysis.push('📉 **Tendance baissière** - Pression vendeuse sur le marché');
    } else {
      analysis.push('📊 **Marché stable** - Le prix évolue dans une fourchette restreinte');
    }

    // Analyse du volume
    if (priceData.volume24h > 1000) {
      analysis.push('💹 **Fort volume** - Activité intense des traders');
    } else if (priceData.volume24h < 100) {
      analysis.push('💤 **Faible volume** - Marché peu actif');
    }

    // Analyse des facteurs
    if (priceData.factors.bonusFactor > 0.1) {
      analysis.push('🎉 **Événements positifs** - Facteurs favorables actifs');
    } else if (priceData.factors.bonusFactor < -0.1) {
      analysis.push('⚠️ **Événements négatifs** - Facteurs défavorables actifs');
    }

    return analysis.join('\n• ');
  }

  /**
   * Vérifie si le prix atteint un jalon significatif
   */
  private isPriceMilestone(price: number): boolean {
    const milestones = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0];
    const tolerance = 0.0001;
    
    return milestones.some(milestone => 
      Math.abs(price - milestone) < tolerance
    );
  }

  /**
   * Récupère le dernier prix notifié depuis le cache
   */
  private async getLastNotifiedPrice(): Promise<number> {
    try {
      const cached = await this.redisService.get('last_notified_price');
      return cached ? parseFloat(cached) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Sauvegarde le dernier prix notifié
   */
  private async setLastNotifiedPrice(price: number): Promise<void> {
    try {
      await this.redisService.setex('last_notified_price', 3600, price.toString());
    } catch (error) {
      logger.error('Error setting last notified price:', error);
    }
  }

  /**
   * Calcule le volume moyen sur les dernières 24h
   */
  private async getAverageVolume(): Promise<number> {
    try {
      const history = await this.tokenPriceService.getPriceHistory(24);
      if (history.length === 0) return 100; // Valeur par défaut
      
      const totalVolume = history.reduce((sum, h) => sum + (h.volume || 0), 0);
      return totalVolume / history.length;
    } catch (error) {
      return 100; // Valeur par défaut en cas d'erreur
    }
  }

  /**
   * Configure le canal de notifications de marché
   */
  setMarketChannel(channelId: string) {
    this.marketChannelId = channelId;
    logger.info(`Market notifications channel set to: ${channelId}`);
  }

  /**
   * Déclenche manuellement un événement de marché
   */
  async triggerManualEvent(factor: number, duration: number, reason: string): Promise<void> {
    await this.tokenPriceService.applyEventFactor(factor, duration, reason);
    
    const alert: PriceAlert = {
      type: 'market_event',
      message: `🎯 **Événement manuel** : ${reason}`,
      priceData: await this.tokenPriceService.calculateTokenValue(),
      severity: Math.abs(factor) > 0.2 ? 'high' : 'medium'
    };

    await this.sendMarketAlert(alert);
    logger.info(`Manual market event triggered: ${reason} (${factor})`);
  }

  /**
   * Simule un "pump and dump" pour tester le système
   */
  async simulatePumpAndDump(): Promise<void> {
    logger.info('Simulating pump and dump event...');
    
    // Phase 1: Pump (+25% pendant 30 minutes)
    await this.triggerManualEvent(0.25, 30, 'Pump Phase - Achat massif détecté');
    
    // Phase 2: Attendre puis dump (-20% pendant 60 minutes)
    setTimeout(async () => {
      await this.triggerManualEvent(-0.2, 60, 'Dump Phase - Vente massive détectée');
    }, 35 * 60 * 1000); // 35 minutes plus tard
  }

  /**
   * Récupère les statistiques de surveillance
   */
  async getMonitoringStats(): Promise<{
    alertsSent24h: number;
    lastAlertTime: Date | null;
    averagePrice24h: number;
    priceVolatility: number;
  }> {
    const history = await this.tokenPriceService.getPriceHistory(24);
    const prices = history.map(h => h.price);
    
    const averagePrice = prices.length > 0 ? 
      prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    
    const priceVolatility = prices.length > 1 ? 
      Math.sqrt(prices.reduce((sum, price) => 
        sum + Math.pow(price - averagePrice, 2), 0) / prices.length) : 0;

    return {
      alertsSent24h: await this.getAlertCount24h(),
      lastAlertTime: this.lastNotificationTime > 0 ? 
        new Date(this.lastNotificationTime) : null,
      averagePrice24h: averagePrice,
      priceVolatility
    };
  }

  /**
   * Compte le nombre d'alertes envoyées dans les dernières 24h
   */
  private async getAlertCount24h(): Promise<number> {
    try {
      const count = await this.redisService.get('alert_count_24h');
      return count ? parseInt(count) : 0;
    } catch (error) {
      return 0;
    }
  }
}
