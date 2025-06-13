import { PrismaClient, AttackType, DefenseType, CardRarity, FragmentType } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface SabotageAttempt {
  attackerId: string;
  targetId: string;
  attackType: AttackType;
  cost: any;
}

export interface SabotageResult {
  success: boolean;
  damage: number;
  duration: number;
  message: string;
  detected: boolean;
  blocked: boolean;
  defenseUsed?: DefenseType;
}

export interface AttackConfig {
  baseDamage: number;
  duration: number; // en minutes
  cost: any;
  baseSuccessRate: number;
  detectionRate: number;
}

export class SabotageService {
  private database: PrismaClient;

  // Configuration des attaques
  private readonly attackConfigs: Record<AttackType, AttackConfig> = {
    [AttackType.VIRUS_Z3_MINER]: {
      baseDamage: 50, // -50% hashrate
      duration: 120, // 2 heures
      cost: { type: 'card', cardType: AttackType.VIRUS_Z3_MINER },
      baseSuccessRate: 0.75,
      detectionRate: 0.6
    },
    [AttackType.BLACKOUT_TARGETED]: {
      baseDamage: 100, // Pause complète
      duration: 20, // 20 minutes
      cost: { type: 'item', item: 'generator', quantity: 1 },
      baseSuccessRate: 0.80,
      detectionRate: 0.8
    },
    [AttackType.FORCED_RECALIBRATION]: {
      baseDamage: 25, // -25% efficacité
      duration: 60, // 1 heure
      cost: { type: 'energy', amount: 80 },
      baseSuccessRate: 0.85,
      detectionRate: 0.3
    },
    [AttackType.DNS_HIJACKING]: {
      baseDamage: 10, // 10% hashrate volé
      duration: 180, // 3 heures
      cost: { type: 'token', amount: 1 },
      baseSuccessRate: 0.70,
      detectionRate: 0.4
    },
    [AttackType.BRUTAL_THEFT]: {
      baseDamage: 5, // 5% des tokens (max 100)
      duration: 0, // Instantané
      cost: { type: 'card', cardType: AttackType.BRUTAL_THEFT },
      baseSuccessRate: 0.60,
      detectionRate: 0.9
    }
  };

  // Messages narratifs pour chaque type d'attaque
  private readonly attackMessages = {
    [AttackType.VIRUS_Z3_MINER]: {
      success: "🦠 Votre virus Z3-Miner s'est infiltré dans les systèmes de {target} ! Leurs machines tournent au ralenti...",
      failure: "❌ Le virus Z3-Miner a été détecté et neutralisé par les défenses de {target}.",
      target: "⚠️ Alerte sécurité ! Un virus Z3-Miner ralentit vos machines de minage de 50% pendant 2h !"
    },
    [AttackType.BLACKOUT_TARGETED]: {
      success: "⚡ Coupure d'électricité réussie ! Les machines de {target} sont à l'arrêt pendant 20 minutes.",
      failure: "❌ Le générateur de secours de {target} a empêché la coupure d'électricité.",
      target: "🔌 Panne électrique ! Vos machines sont temporairement hors service pendant 20 minutes."
    },
    [AttackType.FORCED_RECALIBRATION]: {
      success: "🔧 Recalibrage forcé effectué ! L'efficacité des machines de {target} réduite de 25% pendant 1h.",
      failure: "❌ Les systèmes d'optimisation de {target} ont contré votre tentative de recalibrage.",
      target: "⚙️ Vos machines nécessitent un recalibrage d'urgence ! Efficacité réduite de 25% pendant 1h."
    },
    [AttackType.DNS_HIJACKING]: {
      success: "🌐 Détournement DNS réussi ! 10% du hashrate de {target} vous revient pendant 3h.",
      failure: "❌ Le VPN et le firewall de {target} ont bloqué votre tentative de détournement DNS.",
      target: "🚨 Détournement DNS détecté ! 10% de votre hashrate est redirigé vers un attaquant pendant 3h."
    },
    [AttackType.BRUTAL_THEFT]: {
      success: "💰 Vol audacieux ! Vous avez dérobé {amount} tokens à {target} !",
      failure: "❌ Tentative de vol échouée ! Vos outils de piratage ont été détectés.",
      target: "🚨 Vol de tokens détecté ! Un attaquant vous a dérobé {amount} tokens !"
    }
  };

  constructor(database: PrismaClient) {
    this.database = database;
  }

  /**
   * Tente une attaque de sabotage
   */
  async attemptSabotage(attempt: SabotageAttempt): Promise<SabotageResult> {
    try {
      // Vérifications préliminaires
      const canAttack = await this.canUserAttack(attempt.attackerId, attempt.targetId);
      if (!canAttack.allowed) {
        throw new Error(canAttack.reason);
      }

      // Vérifier les ressources
      const hasResources = await this.checkResources(attempt.attackerId, attempt.attackType);
      if (!hasResources) {
        throw new Error("Ressources insuffisantes pour cette attaque");
      }

      // Calculer le succès de l'attaque
      const defenses = await this.getActiveDefenses(attempt.targetId);
      const result = await this.calculateAttackResult(attempt, defenses);

      // Appliquer les effets
      if (result.success && !result.blocked) {
        await this.applyAttackEffects(attempt, result);
      }

      // Consommer les ressources
      await this.consumeAttackResources(attempt.attackerId, attempt.attackType);

      // Enregistrer l'action
      await this.recordSabotageAction(attempt, result);

      // Mettre à jour les stats
      await this.updateUserStats(attempt.attackerId, attempt.targetId, result.success);

      // Appliquer l'immunité temporaire à la cible
      await this.applyPostAttackImmunity(attempt.targetId);

      logger.info(`Sabotage attempt completed`, {
        attacker: attempt.attackerId,
        target: attempt.targetId,
        type: attempt.attackType,
        success: result.success,
        blocked: result.blocked
      });

      return result;

    } catch (error) {
      logger.error('Error in sabotage attempt:', error);
      throw error;
    }
  }

  /**
   * Vérifie si un utilisateur peut attaquer
   */
  private async canUserAttack(attackerId: string, targetId: string): Promise<{allowed: boolean, reason?: string}> {
    // Auto-attaque interdite
    if (attackerId === targetId) {
      return { allowed: false, reason: "Vous ne pouvez pas vous attaquer vous-même !" };
    }

    // Vérifier le cooldown
    const attacker = await this.database.user.findUnique({
      where: { discordId: attackerId }
    });

    if (attacker?.lastSabotage) {
      const cooldownEnd = new Date(attacker.lastSabotage.getTime() + 3 * 60 * 60 * 1000); // 3h
      if (new Date() < cooldownEnd) {
        const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / (60 * 1000));
        return { allowed: false, reason: `Cooldown actif ! Vous pourrez attaquer dans ${remaining} minutes.` };
      }
    }

    // Vérifier l'activité de la cible
    const target = await this.database.user.findUnique({
      where: { discordId: targetId }
    });

    if (!target) {
      return { allowed: false, reason: "Cible introuvable !" };
    }

    const timeSinceActive = Date.now() - target.lastActive.getTime();
    if (timeSinceActive > 48 * 60 * 60 * 1000) { // 48h
      return { allowed: false, reason: "Cette cible est inactive depuis trop longtemps (>48h)." };
    }

    // Vérifier immunité temporaire
    const immunity = await this.database.sabotageImmunity.findFirst({
      where: {
        userId: targetId,
        endTime: { gt: new Date() }
      }
    });

    if (immunity) {
      const remaining = Math.ceil((immunity.endTime.getTime() - Date.now()) / (60 * 1000));
      return { allowed: false, reason: `Cette cible est immunisée pendant encore ${remaining} minutes.` };
    }

    // Vérifier attaque récente sur cette cible
    const recentAttack = await this.database.sabotageAction.findFirst({
      where: {
        targetId: targetId,
        timestamp: { gt: new Date(Date.now() - 15 * 60 * 1000) } // 15 min
      }
    });

    if (recentAttack) {
      return { allowed: false, reason: "Cette cible a été attaquée récemment. Attendez 15 minutes." };
    }

    return { allowed: true };
  }

  /**
   * Vérifie si l'utilisateur a les ressources nécessaires
   */
  private async checkResources(userId: string, attackType: AttackType): Promise<boolean> {
    const config = this.attackConfigs[attackType];
    const user = await this.database.user.findUnique({
      where: { discordId: userId },
      include: { attackCards: true }
    });

    if (!user) return false;

    switch (config.cost.type) {
      case 'card':
        const hasCard = user.attackCards.some(card => 
          card.type === config.cost.cardType && card.quantity > 0
        );
        return hasCard;

      case 'energy':
        return user.energy >= config.cost.amount;

      case 'token':
        return user.tokens >= config.cost.amount;

      default:
        return true; // Pour les items spéciaux, on assume qu'ils sont disponibles pour l'instant
    }
  }

  /**
   * Récupère les défenses actives d'un utilisateur
   */
  private async getActiveDefenses(userId: string): Promise<DefenseType[]> {
    const defenseCards = await this.database.defenseCard.findMany({
      where: {
        userId: userId,
        isActive: true,
        quantity: { gt: 0 }
      }
    });

    return defenseCards.map(card => card.type);
  }

  /**
   * Calcule le résultat de l'attaque
   */
  private async calculateAttackResult(attempt: SabotageAttempt, defenses: DefenseType[]): Promise<SabotageResult> {
    const config = this.attackConfigs[attempt.attackType];
    let successRate = config.baseSuccessRate;
    let blocked = false;
    let defenseUsed: DefenseType | undefined;

    // Vérifier les défenses spécifiques
    switch (attempt.attackType) {
      case AttackType.VIRUS_Z3_MINER:
        if (defenses.includes(DefenseType.ANTIVIRUS)) {
          blocked = true;
          defenseUsed = DefenseType.ANTIVIRUS;
        }
        break;

      case AttackType.BLACKOUT_TARGETED:
        if (defenses.includes(DefenseType.BACKUP_GENERATOR)) {
          blocked = true;
          defenseUsed = DefenseType.BACKUP_GENERATOR;
        }
        break;

      case AttackType.FORCED_RECALIBRATION:
        if (defenses.includes(DefenseType.OPTIMIZATION_SOFTWARE)) {
          // Réduit la durée de 50% au lieu de bloquer
          config.duration = Math.floor(config.duration * 0.5);
        }
        break;

      case AttackType.DNS_HIJACKING:
        if (defenses.includes(DefenseType.VPN_FIREWALL)) {
          successRate *= 0.5; // 50% de chance d'éviter
        }
        break;
    }

    const success = blocked ? false : Math.random() < successRate;
    const detected = defenses.includes(DefenseType.SABOTAGE_DETECTOR) || 
                    (Math.random() < config.detectionRate);

    // Calculer les dégâts basés sur le type d'attaque
    let damage = config.baseDamage;
    let duration = config.duration;

    if (attempt.attackType === AttackType.BRUTAL_THEFT) {
      // Cas spécial pour le vol : calculer le montant volé
      const target = await this.database.user.findUnique({
        where: { discordId: attempt.targetId }
      });
      if (target) {
        damage = Math.min(target.tokens * 0.05, 100); // 5% max 100 tokens
      }
    }

    const message = this.generateAttackMessage(attempt.attackType, success, blocked, {
      target: attempt.targetId,
      amount: damage
    });

    return {
      success,
      damage,
      duration,
      message,
      detected,
      blocked,
      defenseUsed
    };
  }

  /**
   * Applique les effets de l'attaque
   */
  private async applyAttackEffects(attempt: SabotageAttempt, result: SabotageResult): Promise<void> {
    const endTime = result.duration > 0 ? 
      new Date(Date.now() + result.duration * 60 * 1000) : null;

    switch (attempt.attackType) {
      case AttackType.VIRUS_Z3_MINER:
      case AttackType.FORCED_RECALIBRATION:
        // Appliquer malus aux machines
        await this.database.machine.updateMany({
          where: { userId: attempt.targetId },
          data: {
            hashrateDebuff: attempt.attackType === AttackType.VIRUS_Z3_MINER ? 50 : 0,
            efficiencyDebuff: attempt.attackType === AttackType.FORCED_RECALIBRATION ? 25 : 0,
            sabotageEndTime: endTime
          }
        });
        break;

      case AttackType.BLACKOUT_TARGETED:
        // Arrêter le minage temporairement
        await this.database.user.update({
          where: { discordId: attempt.targetId },
          data: { miningActive: false }
        });
        // Programmer la réactivation (à implémenter avec un système de tâches)
        break;

      case AttackType.DNS_HIJACKING:
        // Rediriger une partie du hashrate (logique à implémenter dans le service de minage)
        break;

      case AttackType.BRUTAL_THEFT:
        // Transférer les tokens
        await this.database.$transaction([
          this.database.user.update({
            where: { discordId: attempt.targetId },
            data: { tokens: { decrement: result.damage } }
          }),
          this.database.user.update({
            where: { discordId: attempt.attackerId },
            data: { tokens: { increment: result.damage } }
          })
        ]);
        break;
    }
  }

  /**
   * Consomme les ressources de l'attaque
   */
  private async consumeAttackResources(userId: string, attackType: AttackType): Promise<void> {
    const config = this.attackConfigs[attackType];

    switch (config.cost.type) {
      case 'card':
        await this.database.attackCard.updateMany({
          where: {
            userId: userId,
            type: config.cost.cardType,
            quantity: { gt: 0 }
          },
          data: { quantity: { decrement: 1 } }
        });
        break;

      case 'energy':
        await this.database.user.update({
          where: { discordId: userId },
          data: { energy: { decrement: config.cost.amount } }
        });
        break;

      case 'token':
        await this.database.user.update({
          where: { discordId: userId },
          data: { tokens: { decrement: config.cost.amount } }
        });
        break;
    }
  }

  /**
   * Enregistre l'action de sabotage
   */
  private async recordSabotageAction(attempt: SabotageAttempt, result: SabotageResult): Promise<void> {
    const endTime = result.duration > 0 ? 
      new Date(Date.now() + result.duration * 60 * 1000) : null;

    await this.database.sabotageAction.create({
      data: {
        attackerId: attempt.attackerId,
        targetId: attempt.targetId,
        type: attempt.attackType,
        success: result.success,
        damage: result.damage,
        duration: result.duration,
        cost: attempt.cost,
        endTime: endTime,
        detected: result.detected,
        logMessage: result.message
      }
    });
  }

  /**
   * Met à jour les statistiques des utilisateurs
   */
  private async updateUserStats(attackerId: string, targetId: string, success: boolean): Promise<void> {
    // Mettre à jour le cooldown de l'attaquant
    await this.database.user.update({
      where: { discordId: attackerId },
      data: { 
        lastSabotage: new Date(),
        sabotagesSuccessful: success ? { increment: 1 } : undefined
      }
    });

    // Mettre à jour les stats de la cible
    await this.database.user.update({
      where: { discordId: targetId },
      data: { sabotagesReceived: { increment: 1 } }
    });
  }

  /**
   * Applique l'immunité temporaire après attaque
   */
  private async applyPostAttackImmunity(targetId: string): Promise<void> {
    const endTime = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes
    
    await this.database.sabotageImmunity.create({
      data: {
        userId: targetId,
        endTime: endTime,
        reason: "Protection post-attaque"
      }
    });
  }

  /**
   * Génère le message narratif de l'attaque
   */
  private generateAttackMessage(attackType: AttackType, success: boolean, blocked: boolean, params: any): string {
    const messages = this.attackMessages[attackType];
    let template = blocked || !success ? messages.failure : messages.success;
    
    // Remplacer les variables dans le template
    Object.keys(params).forEach(key => {
      template = template.replace(`{${key}}`, params[key]);
    });
    
    return template;
  }

  /**
   * Récupère les logs de sabotage d'un utilisateur
   */
  async getUserSabotageLogs(userId: string, limit: number = 10): Promise<any[]> {
    const logs = await this.database.sabotageAction.findMany({
      where: {
        OR: [
          { attackerId: userId },
          { targetId: userId }
        ]
      },
      include: {
        attacker: { select: { username: true } },
        target: { select: { username: true } }
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    return logs;
  }

  /**
   * Nettoie les effets de sabotage expirés
   */
  async cleanupExpiredEffects(): Promise<void> {
    const now = new Date();
    
    // Nettoyer les malus de machines expirés
    await this.database.machine.updateMany({
      where: { sabotageEndTime: { lte: now } },
      data: {
        hashrateDebuff: 0,
        efficiencyDebuff: 0,
        sabotageEndTime: null
      }
    });

    // Nettoyer les immunités expirées
    await this.database.sabotageImmunity.deleteMany({
      where: { endTime: { lte: now } }
    });

    logger.info('Cleaned up expired sabotage effects');
  }

  /**
   * Obtient les statistiques de sabotage d'un utilisateur
   */
  async getUserSabotageStats(userId: string): Promise<any> {
    const user = await this.database.user.findUnique({
      where: { discordId: userId },
      select: {
        sabotagesSuccessful: true,
        sabotagesReceived: true,
        sabotagesBlocked: true,
        lastSabotage: true
      }
    });

    const recentAttacks = await this.database.sabotageAction.count({
      where: {
        attackerId: userId,
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 jours
      }
    });

    const cooldownRemaining = user?.lastSabotage ? 
      Math.max(0, 3 * 60 * 60 * 1000 - (Date.now() - user.lastSabotage.getTime())) : 0;

    return {
      ...user,
      recentAttacks,
      cooldownRemaining: Math.ceil(cooldownRemaining / (60 * 1000)) // en minutes
    };
  }
}