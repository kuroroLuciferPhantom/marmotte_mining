import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { DatabaseService } from '../database/DatabaseService';
import { RedisService } from '../cache/RedisService';
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
  private prisma: PrismaClient;
  private redisService: RedisService;
  private readonly CACHE_KEY = 'token_price';
  private readonly CACHE_TTL = 30; // 30 seconds
  private readonly BASE_PRICE = config.game.tokenBasePrice; // 0.01$ par défaut

  constructor() {
    this.prisma = DatabaseService.getInstance().getClient();
    this.redisService = RedisService.getInstance();
  }

  /**
   * Calcule la valeur actuelle du token $7N1 selon la formule dynamique
   * Valeur_$7N1 = Base_Price × (1 + H/CT) × (1 - M/CT) × (1 + F)
   */
  async calculateTokenValue(): Promise<TokenPriceData> {
    try {
      // Vérifier le cache d'abord
      const cached = await this.redisService.get(this.CACHE_KEY);
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
      await this.redisService.setex(this.CACHE_KEY, this.CACHE_TTL, JSON.stringify(priceData));

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
    const [
      totalUsersData,
      totalMined24hData,
      totalCirculationData,
      activeEvents
    ] = await Promise.all([
      // Total des tokens détenus (holdés)
      this.prisma.user.aggregate({
        _sum: { tokens: true }
      }),
      
      // Total miné dans les 24 dernières heures
      this.prisma.transaction.aggregate({
        where: {
          type: 'MINING_REWARD',
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        _sum: { amount: true }
      }),
      
      // Total en circulation (approximé par le total des tokens des utilisateurs)
      this.prisma.user.aggregate({
        _sum: { tokens: true }
      }),
      
      // Événements actifs pour le bonus factor
      this.prisma.gameEvent.findMany({
        where: {
          isActive: true,
          startTime: { lte: new Date() },
          OR: [
            { endTime: null },
            { endTime: { gte: new Date() } }
          ]
        }
      })
    ]);

    // Calculer le facteur bonus basé sur les événements actifs
    let bonusFactor = 0;
    for (const event of activeEvents) {
      switch (event.type) {
        case 'PRICE_BOOST':
          bonusFactor += event.multiplier - 1;
          break;
        case 'MINING_BONUS':
          bonusFactor += 0.1; // Légère augmentation de valeur
          break;
        case 'FLASH_SALE':
          bonusFactor -= 0.1; // Légère diminution pendant les ventes flash
          break;
        default:
          bonusFactor += 0.05; // Bonus mineur pour autres événements
      }
    }

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
    const lastPrice = await this.prisma.tokenPrice.findFirst({
      orderBy: { timestamp: 'desc' }
    });
    
    return lastPrice?.price || this.BASE_PRICE;
  }

  /**
   * Sauvegarde le nouveau prix en base de données
   */
  private async saveTokenPrice(priceData: TokenPriceData): Promise<void> {
    await this.prisma.tokenPrice.create({
      data: {
        price: priceData.price,
        volume: priceData.volume24h,
        change24h: priceData.change24h
      }
    });
  }

  /**
   * Récupère l'historique des prix
   */
  async getPriceHistory(hours: number = 24): Promise<any[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await this.prisma.tokenPrice.findMany({
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
  }

  /**
   * Applique un facteur bonus/malus temporaire (pour événements spéciaux)
   */
  async applyEventFactor(factor: number, duration: number, reason: string): Promise<void> {
    // Créer un événement temporaire
    const endTime = new Date(Date.now() + duration * 60 * 1000); // duration en minutes
    
    await this.prisma.gameEvent.create({
      data: {
        type: 'PRICE_BOOST',
        title: 'Facteur de Prix Spécial',
        description: reason,
        multiplier: factor,
        endTime
      }
    });

    // Invalider le cache pour forcer un recalcul
    await this.redisService.del(this.CACHE_KEY);
    
    logger.info(`Applied price factor ${factor} for ${duration} minutes: ${reason}`);
  }

  /**
   * Simule un "burn" de tokens pour augmenter la valeur
   */
  async burnTokens(amount: number, reason: string): Promise<void> {
    // Créer une transaction de burn
    await this.prisma.transaction.create({
      data: {
        userId: 'system', // ID système
        type: 'TOKEN_PURCHASE', // Réutiliser ce type pour les burns
        amount: -amount,
        description: `Token burn: ${reason}`,
        metadata: { type: 'burn', reason }
      }
    });

    // Invalider le cache
    await this.redisService.del(this.CACHE_KEY);
    
    logger.info(`Burned ${amount} tokens: ${reason}`);
  }

  /**
   * Force un recalcul immédiat du prix (invalide le cache)
   */
  async forceRecalculation(): Promise<TokenPriceData> {
    await this.redisService.del(this.CACHE_KEY);
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
      this.prisma.user.aggregate({
        _sum: { tokens: true }
      }),
      this.prisma.user.count({
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
}
