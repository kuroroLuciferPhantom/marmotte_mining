import { PrismaClient, AttackType, DefenseType, CardRarity, FragmentType, MissionType, User } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface MissionConfig {
  name: string;
  description: string;
  difficulty: number; // 1-5
  baseSuccessRate: number;
  cooldownHours: number;
  xpReward: {
    success: number;
    failure: number;
  };
  rewards: {
    success: any[];
    failure?: any[];
  };
}



export interface CraftResult {
  success: boolean;
  item?: any;
  message: string;
}

export class CardService {
  private database: PrismaClient;

  // 🆕 CONFIGURATION MISSIONS AVEC XP
  private readonly missionConfigs: Record<MissionType, MissionConfig> = {
    [MissionType.INFILTRATE_FARM]: {
      name: "Infiltration de Ferme",
      description: "Infiltrez une ferme de minage abandonnée pour récupérer du matériel",
      difficulty: 1,
      baseSuccessRate: 0.70,
      cooldownHours: 2,
      xpReward: {
        success: 25,   // 🆕 25 XP en cas de succès
        failure: 10    // 🆕 10 XP même en cas d'échec
      },
      rewards: {
        success: [
          { type: 'card', cardType: AttackType.VIRUS_Z3_MINER, rarity: CardRarity.COMMON, chance: 0.3 },
          { type: 'fragments', fragmentType: FragmentType.ATTACK_FRAGMENT, quantity: 2, chance: 0.5 },
          { type: 'tokens', amount: 15, chance: 0.8 }
        ],
        failure: [
          { type: 'tokens', amount: 5, chance: 0.3 }
        ]
      }
    },
    [MissionType.HACK_WAREHOUSE]: {
      name: "Piratage d'Entrepôt",
      description: "Piratez les systèmes d'un entrepôt de matériel technologique",
      difficulty: 2,
      baseSuccessRate: 0.60,
      cooldownHours: 4,
      xpReward: {
        success: 40,   // 🆕 40 XP en cas de succès
        failure: 15    // 🆕 15 XP même en cas d'échec
      },
      rewards: {
        success: [
          { type: 'card', cardType: DefenseType.VPN_FIREWALL, rarity: CardRarity.UNCOMMON, chance: 0.4 },
          { type: 'fragments', fragmentType: FragmentType.DEFENSE_FRAGMENT, quantity: 3, chance: 0.6 },
          { type: 'tokens', amount: 25, chance: 0.9 }
        ]
      }
    },
    [MissionType.RESCUE_DATA]: {
      name: "Récupération de Données",
      description: "Récupérez des données critiques depuis un serveur compromis",
      difficulty: 3,
      baseSuccessRate: 0.65,
      cooldownHours: 6,
      xpReward: {
        success: 50,   // 🆕 50 XP en cas de succès
        failure: 20    // 🆕 20 XP même en cas d'échec
      },
      rewards: {
        success: [
          { type: 'fragments', fragmentType: FragmentType.DEFENSE_FRAGMENT, quantity: 2, chance: 0.8 },
          { type: 'fragments', fragmentType: FragmentType.ATTACK_FRAGMENT, quantity: 2, chance: 0.6 },
          { type: 'tokens', amount: 30, chance: 1.0 }
        ]
      }
    },
    [MissionType.STEAL_BLUEPRINT]: {
      name: "Vol de Plans",
      description: "Dérobez les plans secrets d'une nouvelle technologie de minage",
      difficulty: 4,
      baseSuccessRate: 0.50,
      cooldownHours: 8,
      xpReward: {
        success: 75,   // 🆕 75 XP en cas de succès
        failure: 25    // 🆕 25 XP même en cas d'échec
      },
      rewards: {
        success: [
          { type: 'card', cardType: AttackType.DNS_HIJACKING, rarity: CardRarity.RARE, chance: 0.5 },
          { type: 'fragments', fragmentType: FragmentType.RARE_FRAGMENT, quantity: 1, chance: 0.7 },
          { type: 'tokens', amount: 50, chance: 1.0 }
        ]
      }
    }
  };

  /**
   * 🆕 SYSTÈME DE PROGRESSION DES NIVEAUX
   */
  private calculateLevelProgression(currentLevel: number): number {
    // Formule : 100 * level^1.5 (progression exponentielle)
    return Math.floor(100 * Math.pow(currentLevel, 1.5));
  }

  /**
   * 🆕 MÉTHODE DE GESTION DE L'XP ET DES NIVEAUX
   */
  private async addExperience(userId: string, xpGained: number): Promise<{
    leveledUp: boolean;
    oldLevel: number;
    newLevel: number;
    xpGained: number;
    totalXp: number;
    xpToNext: number;
  }> {
    const user = await this.database.user.findUnique({
      where: { discordId: userId },
      select: {
        id: true,
        level: true,
        experience: true,
        experienceToNext: true
      }
    });

    if (!user) {
      throw new Error("Utilisateur introuvable");
    }

    const oldLevel = user.level;
    let newExperience = user.experience + xpGained;
    let newLevel = user.level;
    let leveledUp = false;

    // Vérifier si l'utilisateur monte de niveau
    while (newExperience >= user.experienceToNext) {
      newExperience -= user.experienceToNext;
      newLevel++;
      leveledUp = true;
    }

    // Calculer l'XP nécessaire pour le prochain niveau
    const xpToNext = this.calculateLevelProgression(newLevel);

    // Mettre à jour en base
    await this.database.user.update({
      where: { discordId: userId },
      data: {
        level: newLevel,
        experience: newExperience,
        experienceToNext: xpToNext
      }
    });

    // Log si montée de niveau
    if (leveledUp) {
      logger.info(`User leveled up: ${userId} from ${oldLevel} to ${newLevel}`);
    }

    return {
      leveledUp,
      oldLevel,
      newLevel,
      xpGained,
      totalXp: newExperience,
      xpToNext: xpToNext - newExperience
    };
  }

  // Configuration du craft
  private readonly craftRecipes = {
    attackCard: {
      cost: { type: FragmentType.ATTACK_FRAGMENT, quantity: 5 },
      possibleResults: [
        { cardType: AttackType.VIRUS_Z3_MINER, rarity: CardRarity.COMMON, chance: 0.4 },
        { cardType: AttackType.FORCED_RECALIBRATION, rarity: CardRarity.COMMON, chance: 0.3 },
        { cardType: AttackType.BLACKOUT_TARGETED, rarity: CardRarity.UNCOMMON, chance: 0.2 },
        { cardType: AttackType.DNS_HIJACKING, rarity: CardRarity.RARE, chance: 0.08 },
        { cardType: AttackType.BRUTAL_THEFT, rarity: CardRarity.EPIC, chance: 0.02 }
      ]
    },
    defenseCard: {
      cost: { type: FragmentType.DEFENSE_FRAGMENT, quantity: 5 },
      possibleResults: [
        { cardType: DefenseType.ANTIVIRUS, rarity: CardRarity.COMMON, chance: 0.4 },
        { cardType: DefenseType.OPTIMIZATION_SOFTWARE, rarity: CardRarity.COMMON, chance: 0.3 },
        { cardType: DefenseType.BACKUP_GENERATOR, rarity: CardRarity.UNCOMMON, chance: 0.2 },
        { cardType: DefenseType.VPN_FIREWALL, rarity: CardRarity.RARE, chance: 0.08 },
        { cardType: DefenseType.SABOTAGE_DETECTOR, rarity: CardRarity.EPIC, chance: 0.02 }
      ]
    }
  };

  constructor(database: PrismaClient) {
    this.database = database;
  }
  
  /**
   * 🆕 MÉTHODE MISE À JOUR : Tenter une mission (avec XP)
   */
  async attemptMission(userId: string, missionType: MissionType): Promise<any> {
    try {
      // Vérifier les conditions
      const canAttempt = await this.canAttemptMission(userId, missionType);
      if (!canAttempt.allowed) {
        throw new Error(canAttempt.reason);
      }

      const config = this.missionConfigs[missionType];
      const user = await this.database.user.findUnique({
        where: { discordId: userId }
      });

      if (!user) {
        throw new Error("Utilisateur introuvable");
      }

      // Calculer le succès (bonus niveau maintenant plus important)
      let successRate = config.baseSuccessRate;
      successRate += (user.level - 1) * 0.03; // +3% par niveau (au lieu de 2%)
      successRate = Math.min(0.95, successRate); // Maximum 95% de succès
      const success = Math.random() < successRate;

      // 🆕 DONNER L'XP EN PREMIER (avant les récompenses)
      const xpReward = success ? config.xpReward.success : config.xpReward.failure;
      const xpResult = await this.addExperience(userId, xpReward);

      // Mettre à jour lastMission
      await this.database.user.update({
        where: { discordId: userId },
        data: { 
          lastMission: new Date()
        }
      });

      // Appliquer les récompenses
      const rewards = success ? config.rewards.success : (config.rewards.failure || []);
      const obtainedRewards = [];

      for (const reward of rewards) {
        if (Math.random() < reward.chance) {
          await this.applyReward(user, reward);
          obtainedRewards.push(reward);
        }
      }

      // Enregistrer la tentative
      const narrative = this.generateMissionNarrative(missionType, success);


      // Utiliser l'ID interne pour la relation
      await this.database.missionAttempt.create({
        data: {
          userId: user.id,  // ✅ Utiliser l'ID interne
          missionType: missionType,
          success: success,
          reward: obtainedRewards,
          narrative: narrative
        }
      });

      logger.info(`Mission attempt completed`, {
        user: userId,
        mission: missionType,
        success: success,
        xpGained: xpReward,
        leveledUp: xpResult.leveledUp,
        newLevel: xpResult.newLevel,
        rewards: obtainedRewards.length
      });

      return {
        success,
        config,
        rewards: obtainedRewards,
        narrative,
        xpResult, // 🆕 Inclure les résultats XP
        nextMissionAt: new Date(Date.now() + config.cooldownHours * 60 * 60 * 1000)
      };

    } catch (error) {
      logger.error('Error in mission attempt:', error);
      throw error;
    }
  }

  /**
   * 🆕 NOUVELLE MÉTHODE : Vérifier si un utilisateur peut tenter une mission
   */
  private async canAttemptMission(userId: string, missionType: MissionType): Promise<{allowed: boolean, reason?: string, timeRemaining?: number}> {
    const user = await this.database.user.findUnique({
      where: { discordId: userId }
    });

    if (!user) {
      return { allowed: false, reason: "Utilisateur introuvable" };
    }

    const config = this.missionConfigs[missionType];

    // Vérifier le cooldown basé sur lastMission
    if (user.lastMission) {
      const cooldownEnd = new Date(user.lastMission.getTime() + config.cooldownHours * 60 * 60 * 1000);
      const now = new Date();
      
      if (now < cooldownEnd) {
        const timeRemaining = Math.ceil((cooldownEnd.getTime() - now.getTime()) / (60 * 1000)); // en minutes
        const hours = Math.floor(timeRemaining / 60);
        const minutes = timeRemaining % 60;
        
        let timeText = '';
        if (hours > 0) {
          timeText = `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
        } else {
          timeText = `${minutes}min`;
        }
        
        return { 
          allowed: false, 
          reason: `Cooldown actif ! Prochaine mission dans ${timeText}.`,
          timeRemaining
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 🆕 MÉTHODE : Obtenir les statistiques d'XP d'un utilisateur
   */
  async getUserXpStats(userId: string): Promise<any> {
    const user = await this.database.user.findUnique({
      where: { discordId: userId },
      select: {
        username: true,
        level: true,
        experience: true,
        experienceToNext: true
      }
    });

    if (!user) {
      throw new Error("Utilisateur introuvable");
    }

    const xpToNextLevel = user.experienceToNext - user.experience;
    const progressPercent = Math.floor((user.experience / user.experienceToNext) * 100);

    // Calculer l'XP total gagnée
    let totalXpGained = user.experience;
    for (let i = 1; i < user.level; i++) {
      totalXpGained += this.calculateLevelProgression(i);
    }

    return {
      username: user.username,
      level: user.level,
      currentXp: user.experience,
      xpToNext: xpToNextLevel,
      xpForNextLevel: user.experienceToNext,
      progressPercent,
      totalXpGained
    };
  }

  /**
   * Applique une récompense
   */
  private async applyReward(user: User, reward: any): Promise<void> {
    switch (reward.type) {
      case 'card':
        if (reward.cardType in AttackType) {
          await this.addAttackCard(user.id, reward.cardType, reward.rarity);
        } else if (reward.cardType in DefenseType) {
          await this.addDefenseCard(user.id, reward.cardType, reward.rarity);
        }
        break;

      case 'fragments':
        await this.addFragments(user.id, reward.fragmentType, reward.quantity);
        break;

      case 'tokens':
        await this.database.user.update({
          where: { id: user.id },
          data: { tokens: { increment: reward.amount } }
        });
        break;
    }
  }

  // 🆕 NOUVELLE MÉTHODE : Obtenir le statut des cooldowns d'un utilisateur
  async getUserCooldownStatus(userId: string): Promise<any> {
    const user = await this.database.user.findUnique({
      where: { discordId: userId },
      select: {
        discordId: true,
        username: true,
        lastMission: true,
        level: true
      }
    });

    if (!user) {
      throw new Error("Utilisateur introuvable");
    }

    const cooldowns = [];
    
    for (const [missionType, config] of Object.entries(this.missionConfigs)) {
      const canAttempt = await this.canAttemptMission(userId, missionType as MissionType);
      
      cooldowns.push({
        missionType,
        name: config.name,
        difficulty: config.difficulty,
        cooldownHours: config.cooldownHours,
        available: canAttempt.allowed,
        timeRemaining: canAttempt.timeRemaining || 0
      });
    }

    return {
      user: {
        username: user.username,
        level: user.level,
        lastMission: user.lastMission
      },
      cooldowns
    };
  }

  /**
   * Ajoute une carte d'attaque à un utilisateur
   */
  async addAttackCard(userId: string, cardType: AttackType, rarity: CardRarity = CardRarity.COMMON): Promise<void> {
    const existingCard = await this.database.attackCard.findFirst({
      where: { userId, type: cardType, rarity }
    });

    if (existingCard) {
      await this.database.attackCard.update({
        where: { id: existingCard.id },
        data: { quantity: { increment: 1 } }
      });
    } else {
      await this.database.attackCard.create({
        data: { userId, type: cardType, rarity, quantity: 1 }
      });
    }
  }

  /**
   * Ajoute une carte de défense à un utilisateur
   */
  async addDefenseCard(userId: string, cardType: DefenseType, rarity: CardRarity = CardRarity.COMMON): Promise<void> {
    const existingCard = await this.database.defenseCard.findFirst({
      where: { userId, type: cardType, rarity }
    });

    if (existingCard) {
      await this.database.defenseCard.update({
        where: { id: existingCard.id },
        data: { quantity: { increment: 1 } }
      });
    } else {
      await this.database.defenseCard.create({
        data: { userId, type: cardType, rarity, quantity: 1 }
      });
    }
  }

  /**
   * Ajoute des fragments à un utilisateur
   */
  async addFragments(userId: string, fragmentType: FragmentType, quantity: number): Promise<void> {
    const existingFragment = await this.database.cardFragment.findFirst({
      where: { userId, type: fragmentType }
    });

    if (existingFragment) {
      await this.database.cardFragment.update({
        where: { id: existingFragment.id },
        data: { quantity: { increment: quantity } }
      });
    } else {
      await this.database.cardFragment.create({
        data: { userId, type: fragmentType, quantity }
      });
    }
  }

  /**
   * Craft une carte à partir de fragments
   */
  async craftCard(userId: string, cardType: 'attackCard' | 'defenseCard'): Promise<CraftResult> {
    try {
      const recipe = this.craftRecipes[cardType];
      
      // Vérifier les fragments
      const fragment = await this.database.cardFragment.findFirst({
        where: {
          userId: userId,
          type: recipe.cost.type,
          quantity: { gte: recipe.cost.quantity }
        }
      });

      if (!fragment) {
        return {
          success: false,
          message: `Il vous faut ${recipe.cost.quantity} fragments de ${recipe.cost.type} pour ce craft.`
        };
      }

      // Consommer les fragments
      await this.database.cardFragment.update({
        where: { id: fragment.id },
        data: { quantity: { decrement: recipe.cost.quantity } }
      });

      // Déterminer le résultat
      const roll = Math.random();
      let cumulative = 0;
      let result = null;

      for (const possibleResult of recipe.possibleResults) {
        cumulative += possibleResult.chance;
        if (roll <= cumulative) {
          result = possibleResult;
          break;
        }
      }

      if (!result) {
        result = recipe.possibleResults[recipe.possibleResults.length - 1];
      }

      // Ajouter la carte
      if (cardType === 'attackCard') {
        await this.addAttackCard(userId, result.cardType as AttackType, result.rarity);
      } else {
        await this.addDefenseCard(userId, result.cardType as DefenseType, result.rarity);
      }

      logger.info(`Card crafted`, {
        user: userId,
        cardType: result.cardType,
        rarity: result.rarity
      });

      return {
        success: true,
        item: result,
        message: `🎉 Craft réussi ! Vous avez obtenu: ${result.cardType} (${result.rarity})`
      };

    } catch (error) {
      logger.error('Error in card crafting:', error);
      throw error;
    }
  }

  /**
   * Recycle une carte en fragments
   */
  async recycleCard(userId: string, cardId: string, cardType: 'attack' | 'defense'): Promise<any> {
    try {
      const table = cardType === 'attack' ? 'attackCard' : 'defenseCard';
      const card = cardType === 'attack'
        ? await (this.database.attackCard.findFirst({
            where: { id: cardId, userId: userId }
          }))
        : await (this.database.defenseCard.findFirst({
            where: { id: cardId, userId: userId }
          }));

      if (!card || card.quantity <= 0) {
        throw new Error("Carte introuvable ou quantité insuffisante");
      }

      // Calculer les fragments obtenus (basé sur la rareté)
      const fragmentMultiplier = {
        [CardRarity.COMMON]: 2,
        [CardRarity.UNCOMMON]: 3,
        [CardRarity.RARE]: 5,
        [CardRarity.EPIC]: 8,
        [CardRarity.LEGENDARY]: 12
      };

      const fragmentsObtained = fragmentMultiplier[card.rarity] || 2;
      const fragmentType = cardType === 'attack' ? 
        FragmentType.ATTACK_FRAGMENT : FragmentType.DEFENSE_FRAGMENT;

      // Supprimer la carte
      if (card.quantity === 1) {
        if (cardType === 'attack') {
          await this.database.attackCard.delete({ where: { id: cardId } });
        } else {
          await this.database.defenseCard.delete({ where: { id: cardId } });
        }
      } else {
        if (cardType === 'attack') {
          await this.database.attackCard.update({
            where: { id: cardId },
            data: { quantity: { decrement: 1 } }
          });
        } else {
          await this.database.defenseCard.update({
            where: { id: cardId },
            data: { quantity: { decrement: 1 } }
          });
        }
      }

      // Ajouter les fragments
      await this.addFragments(userId, fragmentType, fragmentsObtained);

      return {
        success: true,
        fragmentsObtained,
        fragmentType,
        message: `♻️ Carte recyclée ! Vous avez obtenu ${fragmentsObtained} fragments.`
      };

    } catch (error) {
      logger.error('Error in card recycling:', error);
      throw error;
    }
  }

  /**
   * Active/désactive une défense
   */
  async toggleDefense(userId: string, defenseId: string): Promise<any> {
    try {
      const defense = await this.database.defenseCard.findFirst({
        where: { id: defenseId, userId: userId }
      });

      if (!defense || defense.quantity <= 0) {
        throw new Error("Carte de défense introuvable");
      }

      const newStatus = !defense.isActive;
      
      await this.database.defenseCard.update({
        where: { id: defenseId },
        data: { isActive: newStatus }
      });

      return {
        success: true,
        isActive: newStatus,
        message: newStatus ? 
          `🛡️ Défense ${defense.type} activée !` : 
          `🔓 Défense ${defense.type} désactivée.`
      };

    } catch (error) {
      logger.error('Error toggling defense:', error);
      throw error;
    }
  }

  /**
   * Obtient l'inventaire complet d'un utilisateur
   */
  async getUserInventory(userId: string): Promise<any> {
    const user = await this.database.user.findUnique({
      where: { discordId: userId },
      include: {
        attackCards: true,
        defenseCards: true,
        cardFragments: true
      }
    });

    if (!user) {
      throw new Error("Utilisateur introuvable");
    }

    return {
      attackCards: user.attackCards.filter(card => card.quantity > 0),
      defenseCards: user.defenseCards.filter(card => card.quantity > 0),
      fragments: user.cardFragments.filter(fragment => fragment.quantity > 0),
      activeDefenses: user.defenseCards.filter(card => card.isActive && card.quantity > 0)
    };
  }

  /**
   * 🆕 MÉTHODE MISE À JOUR : Obtenir les missions disponibles
   */
  async getAvailableMissions(userId: string): Promise<any> {
    const user = await this.database.user.findUnique({
      where: { discordId: userId }
    });

    if (!user) {
      throw new Error("Utilisateur introuvable");
    }

    const missions = [];
    
    for (const [missionType, config] of Object.entries(this.missionConfigs)) {
      const canAttempt = await this.canAttemptMission(userId, missionType as MissionType);
      
      // Calculer le temps jusqu'à la prochaine mission possible
      let nextAvailableAt = null;
      if (!canAttempt.allowed && canAttempt.timeRemaining) {
        nextAvailableAt = new Date(Date.now() + canAttempt.timeRemaining * 60 * 1000);
      }
      
      missions.push({
        type: missionType,
        config,
        available: canAttempt.allowed,
        reason: canAttempt.reason,
        timeRemaining: canAttempt.timeRemaining,
        nextAvailableAt
      });
    }

    return missions;
  }

  /**
   * Génère un récit narratif pour une mission
   */
  private generateMissionNarrative(missionType: MissionType, success: boolean): string {
    const narratives = {
      [MissionType.INFILTRATE_FARM]: {
        success: "🌙 Sous le couvert de la nuit, vous vous faufilez dans la ferme abandonnée. Les anciens rigs de minage gisent là, oubliés. Vous récupérez discrètement du matériel utile avant de disparaître dans l'ombre.",
        failure: "🚨 Des capteurs de mouvement que vous n'aviez pas repérés déclenchent l'alarme ! Vous devez battre en retraite précipitamment"
      },
      [MissionType.HACK_WAREHOUSE]: {
        success: "💻 Vos doigts dansent sur le clavier alors que vous percez les défenses du système. Les données défilent sur votre écran - jackpot ! Vous téléchargez tout ce qui vous intéresse avant d'effacer vos traces.",
        failure: "⚠️ Le firewall est plus sophistiqué que prévu. Votre intrusion est détectée et vous devez déconnecter en urgence avant d'être tracé. Mission échouée."
      },
      [MissionType.STEAL_BLUEPRINT]: {
        success: "📋 Déguisé en employé, vous accédez aux bureaux de R&D. Les plans de la nouvelle technologie sont là, sur le serveur principal. Quelques manipulations expertes et les fichiers sont à vous.",
        failure: "🔒 La sécurité du bâtiment est renforcée. Votre fausse carte d'accès ne fonctionne pas et vous devez abandonner la mission avant d'être découvert."
      },
      [MissionType.RESCUE_DATA]: {
        success: "💾 Le serveur compromis crache ses dernières données vitales. Vous naviguez dans le chaos numérique pour extraire l'information cruciale avant que le système ne s'effondre complètement.",
        failure: "💥 Trop tard ! Le serveur s'autodétruit avant que vous puissiez récupérer quoi que ce soit. Les données sont perdues à jamais."
      }
    };

    return success ? narratives[missionType].success : narratives[missionType].failure;
  }

  /**
   * Nettoie les fragments vides et les cartes à quantité 0
   */
  async cleanupInventory(): Promise<void> {
    // Supprimer les fragments vides
    await this.database.cardFragment.deleteMany({
      where: { quantity: { lte: 0 } }
    });

    // Supprimer les cartes vides
    await this.database.attackCard.deleteMany({
      where: { quantity: { lte: 0 } }
    });

    await this.database.defenseCard.deleteMany({
      where: { quantity: { lte: 0 } }
    });

    logger.info('Cleaned up empty inventory items');
  }
}