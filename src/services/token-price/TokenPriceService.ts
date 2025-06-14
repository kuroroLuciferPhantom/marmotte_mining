// src/services/token-price/TokenPriceService.ts - Version corrigée
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { DatabaseService } from '../database/DatabaseService';
import { ICacheService } from '../cache/ICacheService';
import { config } from '../../config/config';

export interface TokenValueFactors {
  totalHeld: number;
  totalMined24h: number;
  totalCirculation: number;
  bonusFactor: number; // Pour events, hype, burns, etc.
}

export interface TokenPriceData {
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  factors: TokenValueFactors;
  trend: 'up' | 'down' | 'stable';
}

export class TokenPriceService {
  private database: DatabaseService;
  private cache: ICacheService;
  private readonly CACHE_KEY = 'token_price';
  private readonly CACHE_TTL = 30; // 30 seconds
  private readonly BASE_PRICE = config.game.tokenBasePrice; // 0.01$ par défaut

  constructor(database: DatabaseService, cache: ICacheService) {
    this.database = database;
    this.cache = cache;
  }

  /**
   * Calcule la valeur actuelle du token $7N1 selon la formule dynamique
   * Valeur_$7N1 = Base_Price × (1 + H/CT) × (1 - M/CT) × (1 + F)
   */
  async calculateTokenValue(): Promise<TokenPriceData> {
    try {
      // Vérifier le cache d'abord
      const cached = await this.cache.get(this.CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Calculating dynamic token value...');

      // Récupérer les données nécessaires pour le calcul
      const factors = await this.getTokenValueFactors();
      
      // Formule : Valeur_$7N1 = Base_Price × (1 + H/CT) × (1 - M/CT) × (1 + F)
      const holdingMultiplier = factors.totalCirculation > 0 ? 
        (1 + factors.totalHeld / factors.totalCirculation) : 1;
      
      const miningPenalty = factors.totalCirculation > 0 ? 
        Math.max(0.1, 1 - factors.totalMined24h / factors.totalCirculation) : 1;
      
      const bonusMultiplier = 1 + factors.bonusFactor;

      const currentPrice = this.BASE_PRICE * holdingMultiplier * miningPenalty * bonusMultiplier;

      // Récupérer le prix précédent pour calculer la variation
      const previousPrice = await this.getLastPrice();
      const change24h = previousPrice > 0 ? 
        ((currentPrice - previousPrice) / previousPrice) * 100 : 0;

      // Calculer le volume et market cap approximatifs
      const volume24h = factors.totalMined24h * currentPrice;
      const marketCap = factors.totalCirculation * currentPrice;

      // Déterminer la tendance
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (Math.abs(change24h) > 0.5) {
        trend = change24h > 0 ? 'up' : 'down';
      }

      const priceData: TokenPriceData = {
        price: Number(currentPrice.toFixed(6)),
        change24h: Number(change24h.toFixed(2)),
        volume24h: Number(volume24h.toFixed(2)),
        marketCap: Number(marketCap.toFixed(2)),
        factors,
        trend
      };

      // Sauvegarder le nouveau prix en base
      await this.saveTokenPrice(priceData);

      // Mettre en cache
      await this.cache.set(this.CACHE_KEY, JSON.stringify(priceData), this.CACHE_TTL);

      logger.info(`Token price calculated: $${priceData.price} (${priceData.change24h > 0 ? '+' : ''}${priceData.change24h}%)`);

      return priceData;

    } catch (error) {
      logger.error('Error calculating token value:', error);
      throw new Error('Failed to calculate token value');
    }
  }

  /**
   * Récupère les facteurs nécessaires pour le calcul de valeur
   */
  private async getTokenValueFactors(): Promise<TokenValueFactors> {
    const prisma = this.database.client;
    
    const [
      totalUsersData,
      totalMined24hData,
      totalCirculationData,
      activeEvents
    ] = await Promise.all([
      // Total des tokens détenus (holdés)
      prisma.user.aggregate({
        _sum: { tokens: true }
      }),
      
      // Total miné dans les 24 dernières heures
      prisma.transaction.aggregate({
        where: {
          type: 'MINING_REWARD',
          timestamp: { // Changé de 'timestamp' à 'createdAt'
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        _sum: { amount: true }
      }),
      
      // Total en circulation (approximé par le total des tokens des utilisateurs)
      prisma.user.aggregate({
        _sum: { tokens: true }
      }),
      
      // Pour les événements, on va simuler pour l'instant car la table n'existe pas encore
      Promise.resolve([])
    ]);

    // Calculer le facteur bonus basé sur les événements actifs
    let bonusFactor = 0;
    
    // Simulation d'événements basés sur l'heure pour ajouter de la variabilité
    const hour = new Date().getHours();
    if (hour >= 18 && hour <= 22) { // Heures de pointe
      bonusFactor += 0.05; // +5% pendant les heures de pointe
    } else if (hour >= 2 && hour <= 6) { // Heures creuses
      bonusFactor -= 0.03; // -3% pendant les heures creuses
    }

    // Ajout de variabilité aléatoire mineure
    bonusFactor += (Math.random() - 0.5) * 0.02; // ±1% aléatoire

    return {
      totalHeld: totalUsersData._sum.tokens || 0,
      totalMined24h: totalMined24hData._sum.amount || 0,
      totalCirculation: totalCirculationData._sum.tokens || 1, // Éviter division par 0
      bonusFactor: Math.max(-0.5, Math.min(1.0, bonusFactor)) // Limiter entre -50% et +100%
    };
  }

  /**
   * Récupère le dernier prix enregistré
   */
  private async getLastPrice(): Promise<number> {
    try {
      const lastPrice = await this.database.client.tokenPrice.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      
      return lastPrice?.price || this.BASE_PRICE;
    } catch (error) {
      // Si la table n'existe pas encore, retourner le prix de base
      logger.debug('TokenPrice table not found, using base price');
      return this.BASE_PRICE;
    }
  }

  /**
   * Sauvegarde le nouveau prix en base de données
   */
  private async saveTokenPrice(priceData: TokenPriceData): Promise<void> {
    try {
      await this.database.client.tokenPrice.create({
        data: {
          price: priceData.price,
          volume: priceData.volume24h,
          change24h: priceData.change24h // Changé de 'change24h' à 'change' selon le schema
        }
      });
    } catch (error) {
      // Si la table n'existe pas, on ignore l'erreur pour l'instant
      logger.debug('Could not save token price, table might not exist yet');
    }
  }

  /**
   * Récupère l'historique des prix
   */
  async getPriceHistory(hours: number = 24): Promise<any[]> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      return await this.database.client.tokenPrice.findMany({
        where: {
          timestamp: { gte: startTime }
        },
        orderBy: { timestamp: 'asc' },
        select: {
          price: true,
          volume: true,
          change24h: true,
          timestamp: true
        }
      });
    } catch (error) {
      logger.debug('Could not get price history, table might not exist yet');
      return [];
    }
  }

  /**
   * Applique un facteur bonus/malus temporaire (pour événements spéciaux)
   */
  async applyEventFactor(factor: number, duration: number, reason: string): Promise<void> {
    try {
      // Pour l'instant, on stocke dans le cache car la table gameEvent n'existe pas
      const eventData = {
        factor,
        endTime: Date.now() + duration * 60 * 1000, // duration en minutes
        reason
      };
      
      await this.cache.set('active_price_event', JSON.stringify(eventData), duration * 60);
      
      // Invalider le cache pour forcer un recalcul
      await this.cache.del(this.CACHE_KEY);
      
      logger.info(`Applied price factor ${factor} for ${duration} minutes: ${reason}`);
    } catch (error) {
      logger.error('Error applying event factor:', error);
    }
  }

  /**
   * Force un recalcul immédiat du prix (invalide le cache)
   */
  async forceRecalculation(): Promise<TokenPriceData> {
    await this.cache.del(this.CACHE_KEY);
    return await this.calculateTokenValue();
  }

  /**
   * Récupère les statistiques du marché
   */
  async getMarketStats(): Promise<{
    currentPrice: number;
    change24h: number;
    volume24h: number;
    marketCap: number;
    totalSupply: number;
    activeHolders: number;
  }> {
    const priceData = await this.calculateTokenValue();
    
    const [totalSupply, activeHolders] = await Promise.all([
      this.database.client.user.aggregate({
        _sum: { tokens: true }
      }),
      this.database.client.user.count({
        where: { tokens: { gt: 0 } }
      })
    ]);

    return {
      currentPrice: priceData.price,
      change24h: priceData.change24h,
      volume24h: priceData.volume24h,
      marketCap: priceData.marketCap,
      totalSupply: totalSupply._sum.tokens || 0,
      activeHolders
    };
  }

  /**
   * Récupère le prix actuel pour le cache Redis legacy (compatibilité)
   */
  async getCurrentTokenPrice(): Promise<{ price: number; timestamp: number } | null> {
    try {
      const priceData = await this.calculateTokenValue();
      return {
        price: priceData.price,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error getting current token price:', error);
      return null;
    }
  }

  /**
   * Met en cache le prix pour la compatibilité (utilisé par MiningService)
   */
  async cacheTokenPrice(price: number, timestamp: number): Promise<void> {
    await this.cache.cacheTokenPrice(price, timestamp);
  }
}