import { PrismaClient, AttackType, DefenseType, CardRarity } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface BlackMarketOffer {
  id: string;
  cardType: string;
  rarity: CardRarity;
  price: number;
  stock: number;
  expiresAt: Date;
}

export class BlackMarketService {
  private database: PrismaClient;

  // Configuration du marché noir
  private readonly cardPrices = {
    // Prix de base par rareté
    [CardRarity.COMMON]: { min: 10, max: 25 },
    [CardRarity.UNCOMMON]: { min: 30, max: 60 },
    [CardRarity.RARE]: { min: 80, max: 150 },
    [CardRarity.EPIC]: { min: 200, max: 400 },
    [CardRarity.LEGENDARY]: { min: 500, max: 1000 }
  };

  // Pool de cartes disponibles avec leurs poids de spawn
  private readonly cardPool = [
    // Cartes d'attaque
    { type: AttackType.VIRUS_Z3_MINER, rarity: CardRarity.COMMON, weight: 25 },
    { type: AttackType.FORCED_RECALIBRATION, rarity: CardRarity.COMMON, weight: 20 },
    { type: AttackType.BLACKOUT_TARGETED, rarity: CardRarity.UNCOMMON, weight: 15 },
    { type: AttackType.DNS_HIJACKING, rarity: CardRarity.RARE, weight: 8 },
    { type: AttackType.BRUTAL_THEFT, rarity: CardRarity.EPIC, weight: 3 },

    // Cartes de défense
    { type: DefenseType.ANTIVIRUS, rarity: CardRarity.COMMON, weight: 20 },
    { type: DefenseType.OPTIMIZATION_SOFTWARE, rarity: CardRarity.COMMON, weight: 18 },
    { type: DefenseType.BACKUP_GENERATOR, rarity: CardRarity.UNCOMMON, weight: 12 },
    { type: DefenseType.VPN_FIREWALL, rarity: CardRarity.RARE, weight: 6 },
    { type: DefenseType.SABOTAGE_DETECTOR, rarity: CardRarity.EPIC, weight: 2 }
  ];

  constructor(database: PrismaClient) {
    this.database = database;
  }

  /**
   * Rafraîchit les offres du marché noir (toutes les 12h)
   */
  async refreshMarket(): Promise<void> {
    try {
      // Supprimer les anciennes offres expirées
      await this.database.blackMarketOffer.deleteMany({
        where: { expiresAt: { lte: new Date() } }
      });

      // Générer 3 nouvelles offres
      const offers = this.generateRandomOffers(3);
      
      for (const offer of offers) {
        await this.database.blackMarketOffer.create({
          data: offer
        });
      }

      logger.info('Black market refreshed with new offers', { offerCount: offers.length });

    } catch (error) {
      logger.error('Error refreshing black market:', error);
      throw error;
    }
  }

  /**
   * Génère des offres aléatoires
   */
  private generateRandomOffers(count: number): any[] {
    const offers = [];
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h

    for (let i = 0; i < count; i++) {
      const card = this.selectRandomCard();
      const basePrice = this.cardPrices[card.rarity];
      const price = Math.floor(
        basePrice.min + Math.random() * (basePrice.max - basePrice.min)
      );

      // Variation de prix basée sur la demande simulée
      const demandMultiplier = 0.8 + Math.random() * 0.4; // 0.8 à 1.2
      const finalPrice = Math.floor(price * demandMultiplier);

      offers.push({
        cardType: card.type,
        rarity: card.rarity,
        price: finalPrice,
        stock: Math.floor(Math.random() * 3) + 1, // 1-3 exemplaires
        expiresAt: expiresAt
      });
    }

    return offers;
  }

  /**
   * Sélectionne une carte aléatoire basée sur les poids
   */
  private selectRandomCard(): any {
    const totalWeight = this.cardPool.reduce((sum, card) => sum + card.weight, 0);
    let random = Math.random() * totalWeight;

    for (const card of this.cardPool) {
      random -= card.weight;
      if (random <= 0) {
        return card;
      }
    }

    // Fallback sur la dernière carte
    return this.cardPool[this.cardPool.length - 1];
  }

  /**
   * Récupère les offres actuelles du marché
   */
  async getCurrentOffers(): Promise<any[]> {
    const offers = await this.database.blackMarketOffer.findMany({
      where: {
        expiresAt: { gt: new Date() },
        stock: { gt: 0 }
      },
      orderBy: { refreshedAt: 'desc' }
    });

    return offers.map(offer => ({
      ...offer,
      timeRemaining: offer.expiresAt.getTime() - Date.now(),
      description: this.getCardDescription(offer.cardType),
      rarityEmoji: this.getRarityEmoji(offer.rarity)
    }));
  }

  /**
   * Achète une carte sur le marché noir
   */
  async purchaseCard(userId: string, offerId: string): Promise<any> {
    try {
      const offer = await this.database.blackMarketOffer.findUnique({
        where: { id: offerId }
      });

      if (!offer) {
        throw new Error("Offre introuvable !");
      }

      if (offer.expiresAt <= new Date()) {
        throw new Error("Cette offre a expiré !");
      }

      if (offer.stock <= 0) {
        throw new Error("Stock épuisé !");
      }

      // Vérifier si l'utilisateur a déjà acheté dans ce cycle
      const existingPurchase = await this.database.blackMarketPurchase.findFirst({
        where: {
          userId: userId,
          offer: {
            refreshedAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) }
          }
        }
      });

      if (existingPurchase) {
        throw new Error("Vous avez déjà effectué un achat dans ce cycle du marché noir !");
      }

      const user = await this.database.user.findUnique({
        where: { discordId: userId }
      });

      if (!user) {
        throw new Error("Utilisateur introuvable !");
      }

      if (user.tokens < offer.price) {
        throw new Error(`Tokens insuffisants ! Il vous faut ${offer.price} $7N1.`);
      }

      // Transaction atomique
      await this.database.$transaction(async (tx) => {
        // Débiter les tokens
        await tx.user.update({
          where: { discordId: userId },
          data: { tokens: { decrement: offer.price } }
        });

        // Réduire le stock
        await tx.blackMarketOffer.update({
          where: { id: offerId },
          data: { stock: { decrement: 1 } }
        });

        // Enregistrer l'achat
        await tx.blackMarketPurchase.create({
          data: {
            userId: userId,
            offerId: offerId,
            price: offer.price
          }
        });

        // Ajouter la carte à l'inventaire
        if (this.isAttackCard(offer.cardType)) {
          const existingCard = await tx.attackCard.findFirst({
            where: { userId, type: offer.cardType as AttackType, rarity: offer.rarity }
          });

          if (existingCard) {
            await tx.attackCard.update({
              where: { id: existingCard.id },
              data: { quantity: { increment: 1 } }
            });
          } else {
            await tx.attackCard.create({
              data: {
                userId,
                type: offer.cardType as AttackType,
                rarity: offer.rarity,
                quantity: 1
              }
            });
          }
        } else {
          const existingCard = await tx.defenseCard.findFirst({
            where: { userId, type: offer.cardType as DefenseType, rarity: offer.rarity }
          });

          if (existingCard) {
            await tx.defenseCard.update({
              where: { id: existingCard.id },
              data: { quantity: { increment: 1 } }
            });
          } else {
            await tx.defenseCard.create({
              data: {
                userId,
                type: offer.cardType as DefenseType,
                rarity: offer.rarity,
                quantity: 1
              }
            });
          }
        }

        // Enregistrer la transaction
        await tx.transaction.create({
          data: {
            userId: userId,
            type: 'BLACK_MARKET_PURCHASE',
            amount: -offer.price,
            description: `Achat marché noir: ${offer.cardType} (${offer.rarity})`,
            metadata: { offerId, cardType: offer.cardType, rarity: offer.rarity }
          }
        });
      });

      logger.info('Black market purchase completed', {
        user: userId,
        card: offer.cardType,
        rarity: offer.rarity,
        price: offer.price
      });

      return {
        success: true,
        cardType: offer.cardType,
        rarity: offer.rarity,
        price: offer.price,
        message: `🛒 Achat réussi ! Vous avez acquis: ${offer.cardType} (${offer.rarity}) pour ${offer.price} $7N1`
      };

    } catch (error) {
      logger.error('Error in black market purchase:', error);
      throw error;
    }
  }

  /**
   * Vérifie si une carte est une carte d'attaque
   */
  private isAttackCard(cardType: string): boolean {
    return Object.values(AttackType).includes(cardType as AttackType);
  }

  /**
   * Obtient la description d'une carte
   */
  private getCardDescription(cardType: string): string {
    const descriptions = {
      // Attaques
      [AttackType.VIRUS_Z3_MINER]: "Virus informatique réduisant le hashrate de 50% pendant 2h",
      [AttackType.BLACKOUT_TARGETED]: "Coupure d'électricité ciblée arrêtant le minage pendant 20min",
      [AttackType.FORCED_RECALIBRATION]: "Recalibrage forcé réduisant l'efficacité de 25% pendant 1h", 
      [AttackType.DNS_HIJACKING]: "Détournement DNS volant 10% du hashrate pendant 3h",
      [AttackType.BRUTAL_THEFT]: "Vol direct de 5% des tokens de la cible (max 100)",

      // Défenses
      [DefenseType.ANTIVIRUS]: "Protection permanente contre les virus informatiques",
      [DefenseType.BACKUP_GENERATOR]: "Générateur de secours bloquant les coupures d'électricité",
      [DefenseType.OPTIMIZATION_SOFTWARE]: "Logiciel réduisant la durée des malus de 50%",
      [DefenseType.VPN_FIREWALL]: "Protection réseau avec 50% de chance d'éviter les attaques",
      [DefenseType.SABOTAGE_DETECTOR]: "Détecteur révélant l'identité des attaquants"
    };

    return descriptions[cardType] || "Carte mystérieuse aux effets inconnus...";
  }

  /**
   * Obtient l'emoji de rareté
   */
  private getRarityEmoji(rarity: CardRarity): string {
    const emojis = {
      [CardRarity.COMMON]: "⚪",
      [CardRarity.UNCOMMON]: "🟢", 
      [CardRarity.RARE]: "🔵",
      [CardRarity.EPIC]: "🟣",
      [CardRarity.LEGENDARY]: "🟡"
    };

    return emojis[rarity] || "❓";
  }

  /**
   * Obtient l'historique des achats d'un utilisateur
   */
  async getUserPurchaseHistory(userId: string, limit: number = 10): Promise<any[]> {
    const purchases = await this.database.blackMarketPurchase.findMany({
      where: { userId },
      include: {
        offer: {
          select: {
            cardType: true,
            rarity: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    return purchases.map(purchase => ({
      ...purchase,
      description: this.getCardDescription(purchase.offer.cardType),
      rarityEmoji: this.getRarityEmoji(purchase.offer.rarity)
    }));
  }

  /**
   * Obtient les statistiques du marché noir
   */
  async getMarketStats(): Promise<any> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const currentCycle = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    const stats = await this.database.blackMarketPurchase.aggregate({
      where: { timestamp: { gte: last24h } },
      _count: true,
      _sum: { price: true },
      _avg: { price: true }
    });

    const currentOffers = await this.database.blackMarketOffer.count({
      where: {
        expiresAt: { gt: now },
        stock: { gt: 0 }
      }
    });

    const cycleStats = await this.database.blackMarketPurchase.aggregate({
      where: { timestamp: { gte: currentCycle } },
      _count: true
    });

    // Calculer le temps jusqu'au prochain refresh
    const lastRefresh = await this.database.blackMarketOffer.findFirst({
      orderBy: { refreshedAt: 'desc' },
      select: { refreshedAt: true }
    });

    const nextRefresh = lastRefresh ? 
      new Date(lastRefresh.refreshedAt.getTime() + 12 * 60 * 60 * 1000) : 
      new Date(now.getTime() + 12 * 60 * 60 * 1000);

    return {
      last24h: {
        totalPurchases: stats._count || 0,
        totalValue: stats._sum.price || 0,
        averagePrice: stats._avg.price || 0
      },
      currentCycle: {
        purchases: cycleStats._count || 0,
        availableOffers: currentOffers
      },
      nextRefresh: nextRefresh,
      timeUntilRefresh: Math.max(0, nextRefresh.getTime() - now.getTime())
    };
  }

  /**
   * Force le refresh du marché (admin uniquement)
   */
  async forceRefresh(): Promise<void> {
    await this.refreshMarket();
    logger.info('Black market manually refreshed');
  }

  /**
   * Nettoie les anciennes données du marché
   */
  async cleanup(): Promise<void> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Supprimer les anciennes offres expirées
    await this.database.blackMarketOffer.deleteMany({
      where: { expiresAt: { lte: oneWeekAgo } }
    });

    // Supprimer les anciens achats (garder 30 jours)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await this.database.blackMarketPurchase.deleteMany({
      where: { timestamp: { lte: thirtyDaysAgo } }
    });

    logger.info('Black market cleanup completed');
  }

  /**
   * Vérifie si le marché a besoin d'être rafraîchi
   */
  async needsRefresh(): Promise<boolean> {
    const latestOffer = await this.database.blackMarketOffer.findFirst({
      orderBy: { refreshedAt: 'desc' },
      select: { refreshedAt: true }
    });

    if (!latestOffer) {
      return true; // Aucune offre = besoin de refresh
    }

    const refreshInterval = 12 * 60 * 60 * 1000; // 12h
    const timeSinceRefresh = Date.now() - latestOffer.refreshedAt.getTime();
    
    return timeSinceRefresh >= refreshInterval;
  }

  /**
   * Planifie le prochain refresh automatique
   */
  async scheduleNextRefresh(): Promise<Date> {
    const latestOffer = await this.database.blackMarketOffer.findFirst({
      orderBy: { refreshedAt: 'desc' },
      select: { refreshedAt: true }
    });

    const baseTime = latestOffer ? latestOffer.refreshedAt : new Date();
    const nextRefresh = new Date(baseTime.getTime() + 12 * 60 * 60 * 1000);

    return nextRefresh;
  }
}