import { PrismaClient, AttackType, DefenseType, CardRarity, FragmentType, MissionType } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface MissionConfig {
  name: string;
  description: string;
  difficulty: number; // 1-5
  baseSuccessRate: number;
  energyCost: number;
  cooldown: number; // en heures
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

  // Configuration des missions
  private readonly missionConfigs: Record<MissionType, MissionConfig> = {
    [MissionType.INFILTRATE_FARM]: {
      name: "Infiltration de Ferme",
      description: "Infiltrez une ferme de minage abandonnée pour récupérer du matériel",
      difficulty: 2,
      baseSuccessRate: 0.70,
      energyCost: 40,
      cooldown: 6,
      rewards: {
        success: [
          { type: 'card', cardType: AttackType.VIRUS_Z3_MINER, rarity: CardRarity.COMMON, chance: 0.3 },
          { type: 'fragments', fragmentType: FragmentType.ATTACK_FRAGMENT, quantity: 2, chance: 0.5 },
          { type: 'tokens', amount: 15, chance: 0.8 }
        ],
        failure: [
          { type: 'energy', amount: -20, chance: 1.0 }
        ]
      }
    },
    [MissionType.HACK_WAREHOUSE]: {
      name: "Piratage d'Entrepôt",
      description: "Piratez les systèmes d'un entrepôt de matériel technologique",
      difficulty: 3,
      baseSuccessRate: 0.60,
      energyCost: 60,
      cooldown: 8,
      rewards: {
        success: [
          { type: 'card', cardType: DefenseType.VPN_FIREWALL, rarity: CardRarity.UNCOMMON, chance: 0.4 },
          { type: 'fragments', fragmentType: FragmentType.DEFENSE_FRAGMENT, quantity: 3, chance: 0.6 },
          { type: 'tokens', amount: 25, chance: 0.9 }
        ]
      }
    },
    [MissionType.STEAL_BLUEPRINT]: {
      name: "Vol de Plans",
      description: "Dérobez les plans secrets d'une nouvelle technologie de minage",
      difficulty: 4,
      baseSuccessRate: 0.50,
      energyCost: 80,
      cooldown: 12,
      rewards: {
        success: [
          { type: 'card', cardType: AttackType.DNS_HIJACKING, rarity: CardRarity.RARE, chance: 0.5 },
          { type: 'fragments', fragmentType: FragmentType.RARE_FRAGMENT, quantity: 1, chance: 0.7 },
          { type: 'tokens', amount: 50, chance: 1.0 }
        ]
      }
    },
    [MissionType.SABOTAGE_COMPETITOR]: {
      name: "Sabotage de Concurrent",
      description: "Sabotez discrètement les opérations d'un concurrent majeur",
      difficulty: 5,
      baseSuccessRate: 0.35,
      energyCost: 100,
      cooldown: 24,
      rewards: {
        success: [
          { type: 'card', cardType: AttackType.BRUTAL_THEFT, rarity: CardRarity.EPIC, chance: 0.6 },
          { type: 'card', cardType: DefenseType.SABOTAGE_DETECTOR, rarity: CardRarity.RARE, chance: 0.4 },
          { type: 'tokens', amount: 100, chance: 1.0 }
        ]
      }
    },
    [MissionType.RESCUE_DATA]: {
      name: "Récupération de Données",
      description: "Récupérez des données critiques depuis un serveur compromis",
      difficulty: 3,
      baseSuccessRate: 0.65,
      energyCost: 50,
      cooldown: 6,
      rewards: {
        success: [
          { type: 'fragments', fragmentType: FragmentType.DEFENSE_FRAGMENT, quantity: 2, chance: 0.8 },
          { type: 'fragments', fragmentType: FragmentType.ATTACK_FRAGMENT, quantity: 2, chance: 0.6 },
          { type: 'tokens', amount: 30, chance: 1.0 }
        ]
      }
    }
  };

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
   * Tente une mission clandestine
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

      // Calculer le succès
      let successRate = config.baseSuccessRate;
      // Bonus basé sur le niveau de l'utilisateur
      successRate += (user.level - 1) * 0.02; // +2% par niveau
      const success = Math.random() < successRate;

      // Consommer l'énergie
      await this.database.user.update({
        where: { discordId: userId },
        data: { 
          energy: { decrement: config.energyCost },
          lastMission: new Date()
        }
      });

      // Appliquer les récompenses
      const rewards = success ? config.rewards.success : (config.rewards.failure || []);
      const obtainedRewards = [];

      for (const reward of rewards) {
        if (Math.random() < reward.chance) {
          await this.applyReward(user.discordId, reward);
          obtainedRewards.push(reward);
        }
      }

      // Enregistrer la tentative
      const narrative = this.generateMissionNarrative(missionType, success);
      await this.database.missionAttempt.create({
        data: {
          userId: userId,
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
        rewards: obtainedRewards.length
      });

      return {
        success,
        config,
        rewards: obtainedRewards,
        narrative
      };

    } catch (error) {
      logger.error('Error in mission attempt:', error);
      throw error;
    }
  }

  /**
   * Vérifie si un utilisateur peut tenter une mission
   */
  private async canAttemptMission(userId: string, missionType: MissionType): Promise<{allowed: boolean, reason?: string}> {
    const user = await this.database.user.findUnique({
      where: { discordId: userId }
    });

    if (!user) {
      return { allowed: false, reason: "Utilisateur introuvable" };
    }

    const config = this.missionConfigs[missionType];

    // Vérifier le cooldown
    if (user.lastMission) {
      const cooldownEnd = new Date(user.lastMission.getTime() + config.cooldown * 60 * 60 * 1000);
      if (new Date() < cooldownEnd) {
        const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / (60 * 1000));
        return { allowed: false, reason: `Cooldown actif ! Prochaine mission dans ${remaining} minutes.` };
      }
    }

    // Vérifier l'énergie
    if (user.energy < config.energyCost) {
      return { allowed: false, reason: `Énergie insuffisante ! Il vous faut ${config.energyCost} d'énergie.` };
    }

    return { allowed: true };
  }

  /**
   * Applique une récompense à un utilisateur
   */
  private async applyReward(userId: string, reward: any): Promise<void> {
    switch (reward.type) {
      case 'card':
        if (reward.cardType in AttackType) {
          await this.addAttackCard(userId, reward.cardType, reward.rarity);
        } else if (reward.cardType in DefenseType) {
          await this.addDefenseCard(userId, reward.cardType, reward.rarity);
        }
        break;

      case 'fragments':
        await this.addFragments(userId, reward.fragmentType, reward.quantity);
        break;

      case 'tokens':
        await this.database.user.update({
          where: { discordId: userId },
          data: { tokens: { increment: reward.amount } }
        });
        break;

      case 'energy':
        await this.database.user.update({
          where: { discordId: userId },
          data: { energy: { increment: reward.amount } }
        });
        break;
    }
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
      energy: user.energy,
      attackCards: user.attackCards.filter(card => card.quantity > 0),
      defenseCards: user.defenseCards.filter(card => card.quantity > 0),
      fragments: user.cardFragments.filter(fragment => fragment.quantity > 0),
      activeDefenses: user.defenseCards.filter(card => card.isActive && card.quantity > 0)
    };
  }

  /**
   * Obtient les missions disponibles pour un utilisateur
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
      
      missions.push({
        type: missionType,
        config,
        available: canAttempt.allowed,
        reason: canAttempt.reason
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
        failure: "🚨 Des capteurs de mouvement que vous n'aviez pas repérés déclenchent l'alarme ! Vous devez battre en retraite précipitamment, perdant de l'énergie dans votre fuite."
      },
      [MissionType.HACK_WAREHOUSE]: {
        success: "💻 Vos doigts dansent sur le clavier alors que vous percez les défenses du système. Les données défilent sur votre écran - jackpot ! Vous téléchargez tout ce qui vous intéresse avant d'effacer vos traces.",
        failure: "⚠️ Le firewall est plus sophistiqué que prévu. Votre intrusion est détectée et vous devez déconnecter en urgence avant d'être tracé. Mission échouée."
      },
      [MissionType.STEAL_BLUEPRINT]: {
        success: "📋 Déguisé en employé, vous accédez aux bureaux de R&D. Les plans de la nouvelle technologie sont là, sur le serveur principal. Quelques manipulations expertes et les fichiers sont à vous.",
        failure: "🔒 La sécurité du bâtiment est renforcée. Votre fausse carte d'accès ne fonctionne pas et vous devez abandonner la mission avant d'être découvert."
      },
      [MissionType.SABOTAGE_COMPETITOR]: {
        success: "⚡ Vous infiltrez les installations de votre concurrent principal. Quelques modifications subtiles dans leur code de minage et leurs opérations seront perturbées pendant des semaines.",
        failure: "👮 Les agents de sécurité patrouillent plus que d'habitude. Vous ne parvenez pas à approcher des systèmes critiques et devez vous retirer bredouille."
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

  /**
   * Régénère l'énergie des utilisateurs (à appeler périodiquement)
   */
  async regenerateEnergy(): Promise<void> {
    // Regenerer 1 énergie par heure, max 100
    await this.database.user.updateMany({
      where: { energy: { lt: 100 } },
      data: { energy: { increment: 1 } }
    });

    // S'assurer qu'on ne dépasse pas 100
    await this.database.user.updateMany({
      where: { energy: { gt: 100 } },
      data: { energy: 100 }
    });

    logger.info('Regenerated energy for users');
  }
}