import { BattleStatus, TransactionType } from '@prisma/client';
import { ICacheService } from '../cache/ICacheService';
import { logger } from '../../utils/logger';

interface BattleResult {
  battleId: string;
  winnerId: string;
  participants: Array<{
    userId: string;
    position: number;
    reward: number;
  }>;
  prizePool: number;
}

interface BattleInfo {
  id: string;
  status: BattleStatus;
  participants: number;
  maxPlayers: number;
  prizePool: number;
  startTime?: Date;
  endTime?: Date;
}

export class BattleService {
  private databaseService: any;
  private cacheService: ICacheService;
  private activeBattles: Map<string, NodeJS.Timeout> = new Map();

  constructor(databaseService: any, cacheService: ICacheService) {
    this.databaseService = databaseService;
    this.cacheService = cacheService;
  }

  /**
   * Crée une nouvelle bataille royale avec 5 utilisateurs simulés pour les tests
   */
  async createBattle(maxPlayers: number = 999): Promise<{ success: boolean; battleId?: string; message: string }> {
    try {
      const battle = await this.databaseService.client.battle.create({
        data: {
          maxPlayers,
          status: BattleStatus.WAITING,
          prizePool: 0
        }
      });

      // Cache la bataille
      if (this.cacheService && this.cacheService.isHealthy) {
        await this.cacheService.hSet(`battle:${battle.id}`, 'status', 'WAITING');
        await this.cacheService.hSet(`battle:${battle.id}`, 'participants', '0');
        await this.cacheService.hSet(`battle:${battle.id}`, 'maxPlayers', maxPlayers.toString());
      }

      // 🆕 Ajouter 5 utilisateurs simulés pour les tests
      await this.addSimulatedUsers(battle.id);

      logger.info(`Created new battle ${battle.id} with max ${maxPlayers} players and 5 simulated users`);
      
      return {
        success: true,
        battleId: battle.id,
        message: `⚔️ Nouvelle bataille créée! ID: ${battle.id} (avec 5 bots pour test)`
      };

    } catch (error) {
      logger.error('Error creating battle:', error);
      return { success: false, message: 'Erreur lors de la création de la bataille' };
    }
  }

  /**
   * 🆕 Ajoute 5 utilisateurs simulés pour les tests
   */
  private async addSimulatedUsers(battleId: string): Promise<void> {
    const botNames = ['TechNinja', 'CryptoHacker', 'BitcoinMiner', 'HashWarrior', 'QuantumBot'];
    
    for (let i = 0; i < botNames.length; i++) {
      try {
        const botDiscordId = `bot_${Date.now()}_${i}`;
        
        // Créer ou trouver l'utilisateur bot
        let botUser = await this.databaseService.client.user.findFirst({
          where: { discordId: botDiscordId }
        });

        if (!botUser) {
          botUser = await this.databaseService.client.user.create({
            data: {
              discordId: botDiscordId,
              username: botNames[i],
              tokens: 1000,
              dollars: 500
            }
          });
        }

        // Ajouter le bot à la bataille
        await this.databaseService.client.battleEntry.create({
          data: {
            battleId: battleId,
            userId: botUser.id
          }
        });

        logger.info(`Added simulated user ${botNames[i]} to battle ${battleId}`);
      } catch (error) {
        logger.warn(`Failed to add simulated user ${botNames[i]}:`, error);
      }
    }
  }

  /**
   * Rejoint une bataille - CORRIGÉ avec messages d'erreur précis et sans frais
   */
  async joinBattle(userId: string, battleId?: string): Promise<{ success: boolean; message: string; battleInfo?: BattleInfo }> {
    try {
      // 1. Vérifier que l'utilisateur existe
      const user = await this.databaseService.client.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return { 
          success: false, 
          message: '❌ **Utilisateur non trouvé**\nVotre profil n\'existe pas dans la base de données. Utilisez une commande comme `/profile` pour créer votre compte.' 
        };
      }

      // 2. Vérifier le cooldown
      const lastBattle = await this.databaseService.client.battleEntry.findFirst({
        where: { userId },
        orderBy: { joinedAt: 'desc' },
        include: { battle: true }
      });

      if (lastBattle) {
        const timeSinceLastBattle = Date.now() - lastBattle.joinedAt.getTime();
        const cooldownTime = 300 * 1000; // 5 minutes en ms
        
        if (timeSinceLastBattle < cooldownTime) {
          const remainingTime = Math.ceil((cooldownTime - timeSinceLastBattle) / 1000 / 60);
          return { 
            success: false, 
            message: `⏰ **Cooldown actif**\nVous devez attendre encore **${remainingTime} minute(s)** avant de rejoindre une autre bataille.` 
          };
        }
      }

      // 3. Trouve une bataille disponible
      let battle;
      if (battleId) {
        battle = await this.databaseService.client.battle.findUnique({
          where: { id: battleId },
          include: { entries: true }
        });

        if (!battle) {
          return { 
            success: false, 
            message: '❌ **Bataille introuvable**\nLa bataille spécifiée n\'existe pas ou a été supprimée.' 
          };
        }
      } else {
        battle = await this.databaseService.client.battle.findFirst({
          where: { status: BattleStatus.WAITING },
          include: { entries: true },
          orderBy: { createdAt: 'asc' }
        });

        if (!battle) {
          return { 
            success: false, 
            message: '❌ **Aucune bataille disponible**\nIl n\'y a actuellement aucune bataille en cours d\'inscription.' 
          };
        }
      }

      // 4. Vérifier le statut de la bataille
      if (battle.status !== BattleStatus.WAITING) {
        return { 
          success: false, 
          message: '❌ **Bataille non disponible**\nCette bataille est déjà commencée ou terminée.' 
        };
      }

      // 5. Vérifier si déjà participant
      const existingEntry = await this.databaseService.client.battleEntry.findUnique({
        where: { 
          battleId_userId: { 
            battleId: battle.id, 
            userId 
          } 
        }
      });

      if (existingEntry) {
        return { 
          success: false, 
          message: '❌ **Déjà inscrit**\nVous participez déjà à cette bataille !' 
        };
      }

      // 6. 🆕 PLUS DE FRAIS D'ENTRÉE - Rejoindre directement
      await this.databaseService.client.battleEntry.create({
        data: {
          battleId: battle.id,
          userId
        }
      });

      const updatedBattle = await this.databaseService.client.battle.findUnique({
        where: { id: battle.id },
        include: { entries: true }
      });

      let battleInfo: BattleInfo = {
        id: battle.id,
        status: battle.status,
        participants: (updatedBattle?.entries.length || 0),
        maxPlayers: battle.maxPlayers,
        prizePool: battle.prizePool
      };

      logger.info(`User ${userId} joined battle ${battle.id} - FREE ENTRY`);
      
      return {
        success: true,
        message: `✅ **Bataille rejointe !**\nVous participez maintenant à la bataille royale. **Entrée gratuite !**\n👥 Participants: ${battleInfo.participants}`,
        battleInfo
      };

    } catch (error) {
      logger.error('Error joining battle:', error);
      return { 
        success: false, 
        message: '❌ **Erreur système**\nUne erreur technique s\'est produite. Veuillez réessayer dans quelques instants.' 
      };
    }
  }

  /**
   * Démarre une bataille
   */
  private async startBattle(battleId: string): Promise<void> {
    try {
      await this.databaseService.client.battle.update({
        where: { id: battleId },
        data: {
          status: BattleStatus.ACTIVE,
          startTime: new Date()
        }
      });

      if (this.cacheService && this.cacheService.isHealthy) {
        await this.cacheService.hSet(`battle:${battleId}`, 'status', 'ACTIVE');
      }

      // Programme la fin de la bataille (durée aléatoire entre 2-5 minutes)
      const battleDuration = (120 + Math.random() * 180) * 1000; // 2-5 minutes en ms
      
      const timeout = setTimeout(async () => {
        await this.endBattle(battleId);
        this.activeBattles.delete(battleId);
      }, battleDuration);

      this.activeBattles.set(battleId, timeout);
      
      logger.info(`Battle ${battleId} started, will end in ${battleDuration/1000} seconds`);

    } catch (error) {
      logger.error('Error starting battle:', error);
    }
  }

  /**
   * 🆕 Termine une bataille avec événements aléatoires améliorés
   */
  private async endBattle(battleId: string): Promise<BattleResult | null> {
    try {
      const battle = await this.databaseService.client.battle.findUnique({
        where: { id: battleId },
        include: { entries: { include: { user: true } } }
      });

      if (!battle || battle.status !== BattleStatus.ACTIVE) {
        return null;
      }

      // 🆕 Simule le combat avec événements aléatoires
      const participants = await this.simulateEnhancedBattle(battle.entries);

      // Met à jour la bataille
      await this.databaseService.client.battle.update({
        where: { id: battleId },
        data: {
          status: BattleStatus.FINISHED,
          endTime: new Date(),
          winnerId: participants[0].userId
        }
      });

      // 🆕 Distribue des récompenses symboliques (pas de frais d'entrée)
      const rewards = this.calculateSymbolicRewards(participants.length);
      const result: BattleResult = {
        battleId,
        winnerId: participants[0].userId,
        participants: [],
        prizePool: 0 // Plus de prize pool
      };

      for (let i = 0; i < participants.length; i++) {
        const participant = participants[i];
        const reward = rewards[i] || 0;
        const position = i + 1;

        // Met à jour l'entrée de bataille
        await this.databaseService.client.battleEntry.update({
          where: { id: participant.id },
          data: {
            position,
            eliminated: position > 1,
            eliminatedAt: position > 1 ? new Date() : null
          }
        });

        if (reward > 0) {
          // Donne la récompense
          await this.databaseService.client.user.update({
            where: { id: participant.userId },
            data: { 
              tokens: { increment: reward }
            }
          });

          await this.databaseService.client.transaction.create({
            data: {
              userId: participant.userId,
              type: TransactionType.BATTLE_REWARD,
              amount: reward,
              description: `Récompense bataille - Position ${position}`
            }
          });
        }

        result.participants.push({
          userId: participant.userId,
          position,
          reward
        });
      }

      // Nettoie le cache
      if (this.cacheService && this.cacheService.isHealthy) {
        await this.cacheService.del(`battle:${battleId}`);
      }

      logger.info(`Battle ${battleId} ended, winner: ${participants[0].userId}`);
      return result;

    } catch (error) {
      logger.error('Error ending battle:', error);
      return null;
    }
  }

  /**
   * 🆕 Simulation de bataille améliorée avec événements aléatoires
   */
  private async simulateEnhancedBattle(entries: any[]): Promise<any[]> {
    let participants = entries.map(entry => ({
      ...entry,
      eliminated: false,
      revived: false,
      battleScore: 0
    }));

    // Événements aléatoires pendant la bataille
    const eventCount = Math.floor(Math.random() * 3) + 1; // 1-3 événements
    
    for (let i = 0; i < eventCount; i++) {
      const eventType = Math.random();
      
      if (eventType < 0.3) {
        // 🆕 Événement "Apocalypse" - Tue 30-50% des participants
        await this.triggerApocalypseEvent(participants);
      } else if (eventType < 0.6) {
        // 🆕 Événement "Résurrection" - Ranime 1-3 participants
        await this.triggerRevivalEvent(participants);
      } else {
        // Événement normal - Boost aléatoire
        await this.triggerBoostEvent(participants);
      }
    }

    // Calcule les scores finaux
    for (const participant of participants) {
      const user = participant.user;
      
      // Facteurs influençant le combat
      const levelFactor = (user.level || 1) * 10;
      const tokensFactor = Math.log(Math.max(1, user.tokens || 1)) * 5;
      const randomFactor = Math.random() * 50; // Élément de chance
      const revivalPenalty = participant.revived ? -20 : 0; // Malus si ressuscité
      
      participant.battleScore = levelFactor + tokensFactor + randomFactor + revivalPenalty;
    }

    // Trie par score décroissant (meilleur score = meilleure position)
    return participants
      .filter(p => !p.eliminated)
      .sort((a, b) => b.battleScore - a.battleScore)
      .concat(participants.filter(p => p.eliminated));
  }

  /**
   * 🆕 Événement Apocalypse - Tue une partie des participants
   */
  private async triggerApocalypseEvent(participants: any[]): Promise<void> {
    const alive = participants.filter(p => !p.eliminated);
    if (alive.length <= 2) return; // Garde au moins 2 survivants
    
    const killCount = Math.floor(alive.length * (0.3 + Math.random() * 0.2)); // 30-50%
    
    for (let i = 0; i < killCount; i++) {
      const randomIndex = Math.floor(Math.random() * alive.length);
      const victim = alive[randomIndex];
      victim.eliminated = true;
      alive.splice(randomIndex, 1);
    }
    
    logger.info(`🌋 Apocalypse Event: ${killCount} participants eliminated`);
  }

  /**
   * 🆕 Événement Résurrection - Ranime des participants
   */
  private async triggerRevivalEvent(participants: any[]): Promise<void> {
    const dead = participants.filter(p => p.eliminated && !p.revived);
    if (dead.length === 0) return;
    
    const reviveCount = Math.min(3, Math.floor(Math.random() * 3) + 1); // 1-3 participants
    
    for (let i = 0; i < Math.min(reviveCount, dead.length); i++) {
      const randomIndex = Math.floor(Math.random() * dead.length);
      const revived = dead[randomIndex];
      revived.eliminated = false;
      revived.revived = true;
      dead.splice(randomIndex, 1);
    }
    
    logger.info(`✨ Revival Event: ${Math.min(reviveCount, dead.length)} participants revived`);
  }

  /**
   * 🆕 Événement Boost - Boost aléatoire
   */
  private async triggerBoostEvent(participants: any[]): Promise<void> {
    const alive = participants.filter(p => !p.eliminated);
    if (alive.length === 0) return;
    
    const boosted = alive[Math.floor(Math.random() * alive.length)];
    boosted.battleScore = (boosted.battleScore || 0) + 30;
    
    logger.info(`🚀 Boost Event: ${boosted.user.username} received power boost`);
  }

  /**
   * 🆕 Calcule des récompenses symboliques (plus de frais d'entrée)
   */
  private calculateSymbolicRewards(totalParticipants: number): number[] {
    const rewards: number[] = [];
    
    // Récompenses fixes pour encourager la participation
    const baseRewards = [100, 50, 25, 10, 5]; // Top 5 gagnent des tokens
    
    for (let i = 0; i < totalParticipants; i++) {
      if (i < baseRewards.length) {
        rewards.push(baseRewards[i]);
      } else {
        rewards.push(0);
      }
    }

    return rewards;
  }

  /**
   * Obtient les informations d'une bataille
   */
  async getBattleInfo(battleId: string): Promise<BattleInfo | null> {
    try {
      const battle = await this.databaseService.client.battle.findUnique({
        where: { id: battleId },
        include: { entries: true }
      });

      if (!battle) {
        return null;
      }

      return {
        id: battle.id,
        status: battle.status,
        participants: battle.entries.length,
        maxPlayers: battle.maxPlayers,
        prizePool: battle.prizePool,
        startTime: battle.startTime || undefined,
        endTime: battle.endTime || undefined
      };

    } catch (error) {
      logger.error('Error getting battle info:', error);
      return null;
    }
  }

  /**
   * Obtient la liste des batailles actives
   */
  async getActiveBattles(): Promise<BattleInfo[]> {
    try {
      const battles = await this.databaseService.client.battle.findMany({
        where: {
          status: {
            in: [BattleStatus.WAITING, BattleStatus.ACTIVE]
          }
        },
        include: { entries: true },
        orderBy: { createdAt: 'desc' }
      });

      return battles.map(battle => ({
        id: battle.id,
        status: battle.status,
        participants: battle.entries.length,
        maxPlayers: battle.maxPlayers,
        prizePool: battle.prizePool,
        startTime: battle.startTime || undefined,
        endTime: battle.endTime || undefined
      }));

    } catch (error) {
      logger.error('Error getting active battles:', error);
      return [];
    }
  }

  /**
   * Obtient l'historique des batailles d'un utilisateur
   */
  async getUserBattleHistory(userId: string, limit: number = 10): Promise<any[]> {
    try {
      const entries = await this.databaseService.client.battleEntry.findMany({
        where: { userId },
        include: { battle: true },
        orderBy: { joinedAt: 'desc' },
        take: limit
      });

      return entries.map(entry => ({
        battleId: entry.battle.id,
        joinedAt: entry.joinedAt,
        position: entry.position,
        prizePool: entry.battle.prizePool,
        status: entry.battle.status,
        participants: entry.battle.maxPlayers
      }));

    } catch (error) {
      logger.error('Error getting user battle history:', error);
      return [];
    }
  }

  /**
   * Nettoie les anciennes batailles terminées
   */
  async cleanupOldBattles(): Promise<void> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await this.databaseService.client.battle.deleteMany({
        where: {
          status: BattleStatus.FINISHED,
          endTime: {
            lt: oneDayAgo
          }
        }
      });

      logger.info('Cleaned up old battles');

    } catch (error) {
      logger.error('Error cleaning up battles:', error);
    }
  }

  /**
   * Annule une bataille en attente
   */
  async cancelBattle(battleId: string): Promise<{ success: boolean; message: string }> {
    try {
      const battle = await this.databaseService.client.battle.findUnique({
        where: { id: battleId },
        include: { entries: { include: { user: true } } }
      });

      if (!battle) {
        return { success: false, message: 'Bataille non trouvée' };
      }

      if (battle.status !== BattleStatus.WAITING) {
        return { success: false, message: 'Seules les batailles en attente peuvent être annulées' };
      }

      // 🆕 Plus besoin de remboursement car plus de frais d'entrée
      
      // Marque la bataille comme annulée
      await this.databaseService.client.battle.update({
        where: { id: battleId },
        data: { status: BattleStatus.CANCELLED }
      });

      if (this.cacheService && this.cacheService.isHealthy) {
        await this.cacheService.del(`battle:${battleId}`);
      }

      logger.info(`Battle ${battleId} cancelled`);
      
      return { 
        success: true, 
        message: 'Bataille annulée avec succès' 
      };

    } catch (error) {
      logger.error('Error cancelling battle:', error);
      return { success: false, message: 'Erreur lors de l\'annulation' };
    }
  }
}

export default BattleService;