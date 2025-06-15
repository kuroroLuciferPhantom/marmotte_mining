// src/services/housing/HousingService.ts

import { PrismaClient, HousingType, User } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface HousingInfo {
  type: HousingType;
  name: string;
  description: string;
  maxMachines: number;
  monthlyRent: number; // en dollars
  depositRequired: number; // caution en dollars
  unlockRequirement: string;
  emoji: string;
  features: string[];
}

export interface RentStatus {
  isOverdue: boolean;
  daysOverdue: number;
  amount: number;
  nextDueDate: Date;
  warningsCount: number;
}

export class HousingService {
  private prisma: PrismaClient;

  // Configuration des logements
  private readonly HOUSING_CONFIG: Record<HousingType, HousingInfo> = {
    CHAMBRE_MAMAN: {
      type: 'CHAMBRE_MAMAN',
      name: 'Chambre chez Maman',
      description: 'Ta chambre d\'enfance, gratuite mais limitée',
      maxMachines: 2,
      monthlyRent: 0,
      depositRequired: 0,
      unlockRequirement: 'Disponible par défaut',
      emoji: '🏠',
      features: ['Pas de loyer', 'Électricité gratuite', 'Très limité']
    },
    STUDIO: {
      type: 'STUDIO',
      name: 'Studio Étudiant',
      description: 'Petit mais à toi, parfait pour commencer',
      maxMachines: 4,
      monthlyRent: 150,
      depositRequired: 300,
      unlockRequirement: 'Avoir 500$ et 2 machines',
      emoji: '🏢',
      features: ['Indépendance', 'Plus d\'espace', 'Voisins sympas']
    },
    APPARTEMENT_1P: {
      type: 'APPARTEMENT_1P',
      name: 'Appartement 1 Pièce',
      description: 'Un vrai appartement avec cuisine équipée',
      maxMachines: 8,
      monthlyRent: 300,
      depositRequired: 600,
      unlockRequirement: 'Avoir 1000$ et vivre en studio depuis 1 semaine',
      emoji: '🏠',
      features: ['Cuisine équipée', 'Meilleure isolation', 'Internet fibre']
    },
    APPARTEMENT_2P: {
      type: 'APPARTEMENT_2P',
      name: 'Appartement 2 Pièces',
      description: 'Spacieux avec pièce dédiée au minage',
      maxMachines: 15,
      monthlyRent: 500,
      depositRequired: 1000,
      unlockRequirement: 'Avoir 2000$ et 10 machines fonctionnelles',
      emoji: '🏡',
      features: ['Pièce minage dédiée', 'Clim incluse', 'Parking privé']
    },
    MAISON: {
      type: 'MAISON',
      name: 'Maison avec Garage',
      description: 'Maison entière avec garage aménageable',
      maxMachines: 25,
      monthlyRent: 800,
      depositRequired: 1600,
      unlockRequirement: 'Avoir 5000$ et gérer 15+ machines',
      emoji: '🏘️',
      features: ['Garage aménagé', 'Jardin', 'Triple compteur électrique']
    },
    ENTREPOT: {
      type: 'ENTREPOT',
      name: 'Entrepôt Industriel',
      description: 'Entrepôt de 200m² pour grande exploitation',
      maxMachines: 50,
      monthlyRent: 1500,
      depositRequired: 3000,
      unlockRequirement: 'Avoir 10000$ et prouver sa rentabilité',
      emoji: '🏭',
      features: ['200m² d\'espace', 'Ventilation industrielle', 'Sécurité 24h/24']
    },
    USINE: {
      type: 'USINE',
      name: 'Complexe Industriel',
      description: 'Usine complète pour les barons du minage',
      maxMachines: 100,
      monthlyRent: 3000,
      depositRequired: 6000,
      unlockRequirement: 'Être dans le top 5 mondial et avoir 25000$',
      emoji: '🏭',
      features: ['Complexe de 500m²', 'Centrale électrique privée', 'Équipe de maintenance']
    }
  };

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Obtient les informations d'un logement
   */
  getHousingInfo(type: HousingType): HousingInfo {
    return this.HOUSING_CONFIG[type];
  }

  /**
   * Liste tous les logements disponibles avec conditions
   */
  async getAvailableHousings(userId: string): Promise<Array<HousingInfo & { canUnlock: boolean; reason?: string }>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { machines: true }
    });

    if (!user) throw new Error('Utilisateur non trouvé');

    const results = [];

    for (const [type, info] of Object.entries(this.HOUSING_CONFIG)) {
      const housingType = type as HousingType;
      const canUnlock = await this.canUserUnlockHousing(user, housingType);
      
      results.push({
        ...info,
        canUnlock: canUnlock.canUnlock,
        reason: canUnlock.reason
      });
    }

    return results;
  }

  /**
   * Vérifie si un utilisateur peut débloquer un logement
   */
  private async canUserUnlockHousing(user: User & { machines: any[] }, targetType: HousingType): Promise<{ canUnlock: boolean; reason?: string }> {
    if (user.housingType === targetType) {
      return { canUnlock: false, reason: 'Vous habitez déjà ici' };
    }

    const info = this.HOUSING_CONFIG[targetType];
    const activeMachines = user.machines.filter(m => m.durability > 0).length;

    switch (targetType) {
      case 'CHAMBRE_MAMAN':
        return { canUnlock: true };

      case 'STUDIO':
        if (user.dollars < 500) return { canUnlock: false, reason: 'Besoin de 500$ minimum' };
        if (activeMachines < 2) return { canUnlock: false, reason: 'Besoin de 2 machines fonctionnelles' };
        return { canUnlock: true };

      case 'APPARTEMENT_1P':
        if (user.dollars < 1000) return { canUnlock: false, reason: 'Besoin de 1000$ minimum' };
        if (user.housingType !== 'STUDIO') return { canUnlock: false, reason: 'Vous devez d\'abord vivre en studio' };
        // Vérifier durée en studio (implémentation simplifiée)
        return { canUnlock: true };

      case 'APPARTEMENT_2P':
        if (user.dollars < 2000) return { canUnlock: false, reason: 'Besoin de 2000$ minimum' };
        if (activeMachines < 10) return { canUnlock: false, reason: 'Besoin de 10 machines fonctionnelles' };
        return { canUnlock: true };

      case 'MAISON':
        if (user.dollars < 5000) return { canUnlock: false, reason: 'Besoin de 5000$ minimum' };
        if (activeMachines < 15) return { canUnlock: false, reason: 'Besoin de 15+ machines fonctionnelles' };
        return { canUnlock: true };

      case 'ENTREPOT':
        if (user.dollars < 10000) return { canUnlock: false, reason: 'Besoin de 10000$ minimum' };
        if (user.totalMined < 1000) return { canUnlock: false, reason: 'Prouver votre rentabilité (1000 tokens minés)' };
        return { canUnlock: true };

      case 'USINE':
        if (user.dollars < 25000) return { canUnlock: false, reason: 'Besoin de 25000$ minimum' };
        // Vérifier top 5 mondial (implémentation simplifiée)
        const topUsers = await this.prisma.user.findMany({
          orderBy: { totalMined: 'desc' },
          take: 5,
          select: { id: true }
        });
        const isInTop5 = topUsers.some(u => u.id === user.id);
        if (!isInTop5) return { canUnlock: false, reason: 'Vous devez être dans le top 5 mondial' };
        return { canUnlock: true };

      default:
        return { canUnlock: false, reason: 'Logement inconnu' };
    }
  }

  /**
   * Déménage un utilisateur vers un nouveau logement
   */
  async moveToHousing(userId: string, targetType: HousingType): Promise<{ success: boolean; message: string; cost?: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { machines: true }
    });

    if (!user) {
      return { success: false, message: 'Utilisateur non trouvé' };
    }

    // Vérifier éligibilité
    const eligibility = await this.canUserUnlockHousing(user, targetType);
    if (!eligibility.canUnlock) {
      return { success: false, message: eligibility.reason || 'Conditions non remplies' };
    }

    const targetInfo = this.HOUSING_CONFIG[targetType];
    const totalCost = targetInfo.depositRequired + targetInfo.monthlyRent;

    // Vérifier argent suffisant
    if (user.dollars < totalCost) {
      return { 
        success: false, 
        message: `Fonds insuffisants. Besoin de ${totalCost}$ (caution: ${targetInfo.depositRequired}$ + premier loyer: ${targetInfo.monthlyRent}$)` 
      };
    }

    // Vérifier capacité machines
    const activeMachines = user.machines.filter(m => m.durability > 0).length;
    if (activeMachines > targetInfo.maxMachines) {
      return { 
        success: false, 
        message: `Ce logement ne peut accueillir que ${targetInfo.maxMachines} machines. Vous en avez ${activeMachines} actives.` 
      };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Déduire les coûts
        await tx.user.update({
          where: { id: userId },
          data: {
            dollars: user.dollars - totalCost,
            housingType: targetType,
            totalRentPaid: user.totalRentPaid + targetInfo.monthlyRent,
            lastRentPayment: new Date(),
            rentDue: this.calculateNextRentDue(),
            machinesDisabled: false,
            evictionWarnings: 0
          }
        });

        // Enregistrer transaction
        await tx.transaction.create({
          data: {
            userId,
            type: 'MACHINE_PURCHASE', // Ou créer HOUSING_COST
            amount: -totalCost,
            description: `Déménagement vers ${targetInfo.name} (caution + premier loyer)`
          }
        });

        // Historique déménagement
        await tx.housingHistory.create({
          data: {
            userId,
            oldHousingType: user.housingType,
            newHousingType: targetType,
            reason: 'Déménagement volontaire',
            cost: totalCost
          }
        });

        // Créer prochaine échéance si loyer > 0
        if (targetInfo.monthlyRent > 0) {
          await tx.rentPayment.create({
            data: {
              userId,
              housingType: targetType,
              amount: targetInfo.monthlyRent,
              period: this.getCurrentPeriod(1), // Mois suivant
              dueDate: this.calculateNextRentDue(),
              status: 'PENDING'
            }
          });
        }
      });

      logger.info(`User ${userId} moved to ${targetType} for ${totalCost}$`);
      
      return { 
        success: true, 
        message: `🎉 Bienvenue dans votre ${targetInfo.name} ! Capacité: ${targetInfo.maxMachines} machines.`,
        cost: totalCost
      };

    } catch (error) {
      logger.error('Error moving user to new housing:', error);
      return { success: false, message: 'Erreur lors du déménagement' };
    }
  }

  /**
   * Obtient le statut du loyer d'un utilisateur
   */
  async getRentStatus(userId: string): Promise<RentStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.housingType === 'CHAMBRE_MAMAN') {
      return null; // Pas de loyer chez maman
    }

    const info = this.HOUSING_CONFIG[user.housingType];
    const now = new Date();
    const isOverdue = user.rentDue ? now > user.rentDue : false;
    const daysOverdue = user.rentDue ? Math.max(0, Math.floor((now.getTime() - user.rentDue.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    return {
      isOverdue,
      daysOverdue,
      amount: info.monthlyRent,
      nextDueDate: user.rentDue || this.calculateNextRentDue(),
      warningsCount: user.evictionWarnings
    };
  }

  /**
   * Traite le paiement du loyer
   */
  async payRent(userId: string): Promise<{ success: boolean; message: string; cost?: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return { success: false, message: 'Utilisateur non trouvé' };
    }

    if (user.housingType === 'CHAMBRE_MAMAN') {
      return { success: false, message: 'Pas de loyer à payer chez maman ! 😄' };
    }

    const info = this.HOUSING_CONFIG[user.housingType];
    const rentStatus = await this.getRentStatus(userId);
    
    if (!rentStatus || !rentStatus.isOverdue) {
      return { success: false, message: 'Aucun loyer en retard à payer' };
    }

    let totalCost = info.monthlyRent;
    
    // Majoration pour retard (5$ par jour)
    if (rentStatus.daysOverdue > 0) {
      totalCost += rentStatus.daysOverdue * 5;
    }

    if (user.dollars < totalCost) {
      return { 
        success: false, 
        message: `Fonds insuffisants. Besoin de ${totalCost}$ (loyer: ${info.monthlyRent}$ + pénalité: ${totalCost - info.monthlyRent}$)` 
      };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Déduire le paiement
        await tx.user.update({
          where: { id: userId },
          data: {
            dollars: user.dollars - totalCost,
            totalRentPaid: user.totalRentPaid + totalCost,
            lastRentPayment: new Date(),
            rentDue: this.calculateNextRentDue(),
            evictionWarnings: 0,
            machinesDisabled: false
          }
        });

        // Enregistrer transaction
        await tx.transaction.create({
          data: {
            userId,
            type: 'MACHINE_PURCHASE', // Ou créer RENT_PAYMENT
            amount: -totalCost,
            description: `Paiement loyer ${info.name}${rentStatus.daysOverdue > 0 ? ` (retard: ${rentStatus.daysOverdue} jours)` : ''}`
          }
        });

        // Marquer le paiement comme payé
        await tx.rentPayment.updateMany({
          where: {
            userId,
            status: 'PENDING'
          },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            lateFee: totalCost - info.monthlyRent
          }
        });

        // Créer prochaine échéance
        await tx.rentPayment.create({
          data: {
            userId,
            housingType: user.housingType,
            amount: info.monthlyRent,
            period: this.getCurrentPeriod(1),
            dueDate: this.calculateNextRentDue(),
            status: 'PENDING'
          }
        });
      });

      logger.info(`User ${userId} paid rent for ${totalCost}$`);
      
      return { 
        success: true, 
        message: `✅ Loyer payé ! Coût total: ${totalCost}$. Prochaine échéance: ${this.calculateNextRentDue().toLocaleDateString()}`,
        cost: totalCost
      };

    } catch (error) {
      logger.error('Error paying rent:', error);
      return { success: false, message: 'Erreur lors du paiement' };
    }
  }

  /**
   * Vérifie les loyers en retard et applique les pénalités
   */
  async processOverdueRents(): Promise<void> {
    const now = new Date();
    
    const overdueUsers = await this.prisma.user.findMany({
      where: {
        rentDue: { lt: now },
        housingType: { not: 'CHAMBRE_MAMAN' },
        rentOverdue: false
      }
    });

    for (const user of overdueUsers) {
      const daysSinceOverdue = Math.floor((now.getTime() - user.rentDue!.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceOverdue >= 7 && !user.machinesDisabled) {
        // Arrêter les machines après 7 jours
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            machinesDisabled: true,
            evictionWarnings: user.evictionWarnings + 1
          }
        });

        logger.warn(`User ${user.id} machines disabled due to overdue rent (${daysSinceOverdue} days)`);
      }

      if (daysSinceOverdue >= 30) {
        // Expulsion après 30 jours - retour chez maman
        await this.forceEviction(user.id, 'Expulsion pour loyer impayé (30+ jours)');
      }
    }
  }

  /**
   * Force l'expulsion d'un utilisateur
   */
  private async forceEviction(userId: string, reason: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.housingType === 'CHAMBRE_MAMAN') return;

    await this.prisma.$transaction(async (tx) => {
      // Retour chez maman
      await tx.user.update({
        where: { id: userId },
        data: {
          housingType: 'CHAMBRE_MAMAN',
          rentDue: null,
          rentOverdue: false,
          machinesDisabled: false,
          evictionWarnings: 0
        }
      });

      // Historique expulsion
      await tx.housingHistory.create({
        data: {
          userId,
          oldHousingType: user.housingType,
          newHousingType: 'CHAMBRE_MAMAN',
          reason,
          cost: 0
        }
      });

      // Annuler paiements en attente
      await tx.rentPayment.updateMany({
        where: {
          userId,
          status: 'PENDING'
        },
        data: { status: 'CANCELLED' }
      });
    });

    logger.warn(`User ${userId} evicted: ${reason}`);
  }

  /**
   * Calcule la prochaine date d'échéance (premier du mois suivant)
   */
  private calculateNextRentDue(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  /**
   * Obtient la période courante + offset en format YYYY-MM
   */
  private getCurrentPeriod(monthOffset: number = 0): string {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}