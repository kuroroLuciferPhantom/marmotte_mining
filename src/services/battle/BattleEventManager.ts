import { EmbedBuilder, TextChannel, Client, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { DatabaseService } from '../../services/database/DatabaseService';
import { RedisService } from '../../services/cache/RedisService';
import { BattleService } from '../../services/battle/BattleService';
import { BattleNarratorService } from '../../services/battle/BattleNarratorService';
import { logger } from '../../utils/logger';
import { BATTLE_THEMES } from '../admin/admin-battle';

interface LiveBattleEvent {
  type: 'join' | 'combat' | 'elimination' | 'special' | 'victory';
  participants: string[];
  message: string;
  timestamp: Date;
}

export class BattleEventManager {
  private client: Client;
  private database: DatabaseService;
  private redis: RedisService;
  private battleService: BattleService;
  private narrator: BattleNarratorService;
  private activeBattleChannels: Map<string, string> = new Map(); // battleId -> channelId

  constructor(client: Client, database: DatabaseService, redis: RedisService) {
    this.client = client;
    this.database = database;
    this.redis = redis;
    this.battleService = new BattleService(database, redis, client);
    this.narrator = new BattleNarratorService(client);
  }

  /**
   * Démarre le suivi d'une bataille en temps réel
   */
  async startBattleTracking(battleId: string, channelId: string, themeKey: string = 'gladiator'): Promise<void> {
    this.activeBattleChannels.set(battleId, channelId);
    
    // Enregistrer dans Redis pour persistance
    await this.redis.hSet(`battle:${battleId}:tracking`, 'channelId', channelId);
    await this.redis.hSet(`battle:${battleId}:tracking`, 'theme', themeKey);
    await this.redis.hSet(`battle:${battleId}:tracking`, 'startTime', Date.now().toString());
    
    logger.info(`Started battle tracking for ${battleId} in channel ${channelId}`);
  }

  /**
   * Gère l'événement quand un joueur rejoint une bataille
   */
  async handlePlayerJoin(battleId: string, userId: string, username: string): Promise<void> {
    const channelId = this.activeBattleChannels.get(battleId) || 
                     await this.redis.hGet(`battle:${battleId}:tracking`, 'channelId');
    
    if (!channelId) return;

    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      const theme = await this.redis.hGet(`battle:${battleId}:tracking`, 'theme') || 'gladiator';
      
      // Messages d'entrée roleplay
      const entryMessages = [
        `🚪 **${username}** pousse les lourdes portes de l'arène d'un air déterminé !`,
        `⚡ **${username}** fait son entrée dans un nuage de fumée épique !`,
        `🎭 **${username}** brandit ses équipements de mining avec confiance !`,
        `🔥 **${username}** s'avance, ses machines ronronnant de puissance !`,
        `💎 **${username}** entre en scène, l'air confiant et les poches pleines !`,
        `🌟 **${username}** fait son apparition sous les acclamations de la foule !`
      ];

      const entryMessage = entryMessages[Math.floor(Math.random() * entryMessages.length)];
      
      // Obtenir les infos de la bataille
      const battleInfo = await this.battleService.getBattleInfo(battleId);
      
      if (battleInfo) {
        const joinEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setDescription(`${entryMessage}\n\n*Un nouveau challenger entre dans l'arène !*`)
          .addFields([
            {
              name: '👥 Participants',
              value: `${battleInfo.participants}/${battleInfo.maxPlayers}`,
              inline: true
            },
            {
              name: '💰 Cagnotte',
              value: `${battleInfo.prizePool} tokens`,
              inline: true
            },
            {
              name: '🎯 Statut',
              value: battleInfo.participants >= battleInfo.maxPlayers ? 
                     '🔥 **BATAILLE IMMINENTE !**' : 
                     `⏳ En attente de ${battleInfo.maxPlayers - battleInfo.participants} participant(s)`,
              inline: true
            }
          ])
          .setTimestamp();

        await channel.send({ embeds: [joinEmbed] });

        // Si la bataille est pleine, annoncer le début imminent
        if (battleInfo.participants >= battleInfo.maxPlayers) {
          setTimeout(async () => {
            await this.announceBattleStart(battleId, channelId, theme);
          }, 3000);
        }
      }

    } catch (error) {
      logger.error('Error handling player join event:', error);
    }
  }

  /**
   * Annonce le début d'une bataille avec compteur
   */
  async announceBattleStart(battleId: string, channelId: string, themeKey: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      const theme = BATTLE_THEMES[themeKey];
      
      // Compte à rebours dramatique
      const countdownEmbed = new EmbedBuilder()
        .setTitle(`${theme.emoji} LA BATAILLE VA COMMENCER ! ${theme.emoji}`)
        .setColor(0xff0000)
        .setDescription(`
${theme.startMessage}

**⚔️ TOUS LES COMBATTANTS SONT PRÊTS !**

🔥 **DÉBUT DU COMBAT DANS...**
        `)
        .setImage('https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif')
        .setTimestamp();

      const countdownMessage = await channel.send({ embeds: [countdownEmbed] });

      // Compte à rebours de 5 secondes
      for (let i = 5; i > 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const updateEmbed = new EmbedBuilder()
          .setTitle(`${theme.emoji} LA BATAILLE VA COMMENCER ! ${theme.emoji}`)
          .setColor(0xff0000)
          .setDescription(`
${theme.startMessage}

**⚔️ TOUS LES COMBATTANTS SONT PRÊTS !**

🔥 **DÉBUT DU COMBAT DANS... ${i}**
          `)
          .setTimestamp();

        await countdownMessage.edit({ embeds: [updateEmbed] });
      }

      // Annonce finale
      const startEmbed = new EmbedBuilder()
        .setTitle(`${theme.emoji} QUE LA BATAILLE COMMENCE ! ${theme.emoji}`)
        .setColor(0xff6600)
        .setDescription(`
**🎺 LES TROMPETTES RÉSONNENT !**

${theme.arena}

*Les combattants s'élancent ! Que le meilleur gagne !*
        `)
        .setImage('https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif')
        .setTimestamp();

      await countdownMessage.edit({ embeds: [startEmbed] });

    } catch (error) {
      logger.error('Error announcing battle start:', error);
    }
  }

  /**
   * Génère des événements de combat en temps réel
   */
  async generateCombatEvents(battleId: string): Promise<void> {
    const channelId = await this.redis.hGet(`battle:${battleId}:tracking`, 'channelId');
    const themeKey = await this.redis.hGet(`battle:${battleId}:tracking`, 'theme') || 'gladiator';
    
    if (!channelId) return;

    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      const battleInfo = await this.battleService.getBattleInfo(battleId);
      
      if (!battleInfo || battleInfo.status !== 'ACTIVE') return;

      // Simuler des événements de combat
      const events = await this.generateRandomCombatEvents(battleId, themeKey);
      
      for (const event of events) {
        const eventEmbed = new EmbedBuilder()
          .setColor(this.getEventColor(event.type))
          .setDescription(`${event.message}`)
          .setTimestamp();

        if (event.type === 'special') {
          eventEmbed.setTitle('✨ ÉVÉNEMENT SPÉCIAL !');
        } else if (event.type === 'elimination') {
          eventEmbed.setTitle('💥 ÉLIMINATION !');
        }

        await channel.send({ embeds: [eventEmbed] });
        
        // Délai entre les événements
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      }

    } catch (error) {
      logger.error('Error generating combat events:', error);
    }
  }

  /**
   * Génère des événements de combat aléatoires
   */
  private async generateRandomCombatEvents(battleId: string, themeKey: string): Promise<LiveBattleEvent[]> {
    const events: LiveBattleEvent[] = [];
    const theme = BATTLE_THEMES[themeKey];
    
    // Simuler 3-7 événements de combat
    const numEvents = 3 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < numEvents; i++) {
      const eventType = this.getRandomEventType();
      const participants = ['CryptoMiner42', 'HashMaster', 'TokenHunter', 'BlockchainWizard']; // À remplacer par de vrais participants
      
      let message = '';
      
      switch (eventType) {
        case 'combat':
          const attacker = participants[Math.floor(Math.random() * participants.length)];
          const defender = participants[Math.floor(Math.random() * participants.length)];
          if (attacker !== defender) {
            message = `💥 **${attacker}** lance une attaque de hash power dévastatrice sur **${defender}** !`;
          }
          break;
          
        case 'special':
          message = theme.commentary[Math.floor(Math.random() * theme.commentary.length)];
          break;
          
        case 'elimination':
          const eliminated = participants[Math.floor(Math.random() * participants.length)];
          message = `💔 **${eliminated}** s'effondre, ses derniers tokens s'envolant dans le vent...`;
          break;
      }
      
      if (message) {
        events.push({
          type: eventType,
          participants,
          message,
          timestamp: new Date()
        });
      }
    }
    
    return events;
  }

  private getRandomEventType(): LiveBattleEvent['type'] {
    const types: LiveBattleEvent['type'][] = ['combat', 'combat', 'combat', 'special', 'elimination'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private getEventColor(type: LiveBattleEvent['type']): number {
    switch (type) {
      case 'combat': return 0xff6600;
      case 'special': return 0xffd700;
      case 'elimination': return 0xff0000;
      case 'victory': return 0x00ff00;
      default: return 0x3498db;
    }
  }

  /**
   * Créé un panneau de contrôle interactif pour les batailles
   */
  async createBattleControlPanel(channelId: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      
      const panelEmbed = new EmbedBuilder()
        .setTitle('🎮 Panneau de Contrôle - Bataille Royale')
        .setColor(0x3498db)
        .setDescription(`
**Bienvenue dans l'arène de combat !**

Utilise les boutons ci-dessous pour participer ou gérer les batailles.

📊 **Statistiques en temps réel :**
• Batailles actives : En cours de chargement...
• Participants en attente : En cours de chargement...
• Prochaine bataille : En cours de planification...
        `)
        .addFields([
          {
            name: '🎯 Actions Rapides',
            value: '• Rejoindre une bataille\n• Voir les statistiques\n• Consulter le leaderboard',
            inline: true
          },
          {
            name: '🏆 Récompenses',
            value: '• 1er : 50% de la cagnotte\n• 2e : 25% de la cagnotte\n• 3e : 15% de la cagnotte',
            inline: true
          }
        ])
        .setFooter({ text: 'Panneau mis à jour automatiquement' })
        .setTimestamp();

      // Boutons d'action
      const joinButton = new ButtonBuilder()
        .setCustomId('quick-join-battle')
        .setLabel('⚡ Rejoindre une Bataille')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚔️');

      const statsButton = new ButtonBuilder()
        .setCustomId('view-battle-stats')
        .setLabel('📊 Statistiques')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📈');

      const leaderboardButton = new ButtonBuilder()
        .setCustomId('view-leaderboard')
        .setLabel('🏆 Classement')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👑');

      const helpButton = new ButtonBuilder()
        .setCustomId('battle-help')
        .setLabel('❓ Aide')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎭');

      const refreshButton = new ButtonBuilder()
        .setCustomId('refresh-panel')
        .setLabel('🔄 Actualiser')
        .setStyle(ButtonStyle.Success);

      const actionRow1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(joinButton, statsButton, leaderboardButton);
      
      const actionRow2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(helpButton, refreshButton);

      // Menu de sélection des thèmes
      const themeSelect = new StringSelectMenuBuilder()
        .setCustomId('select-battle-theme')
        .setPlaceholder('🎭 Choisir un thème de bataille...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('⚔️ Gladiateurs du Mining')
            .setDescription('Combat épique dans le Colisée du Hash')
            .setValue('gladiator')
            .setEmoji('⚔️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🏴‍☠️ Pirates des 7 Blockchains')
            .setDescription('Bataille navale pour le trésor crypto')
            .setValue('pirate')
            .setEmoji('🏴‍☠️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🤖 Guerre des Robots Mineurs')
            .setDescription('Cybernétique et intelligence artificielle')
            .setValue('robot')
            .setEmoji('🤖'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🦄 Licornes Cryptographiques')
            .setDescription('Magie et rainbows de profit')
            .setValue('unicorn')
            .setEmoji('🦄'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🐸 Grenouilles de la Degen Pool')
            .setDescription('REEEEE ! To the moon !')
            .setValue('frog')
            .setEmoji('🐸')
        );

      const themeRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(themeSelect);

      await channel.send({ 
        embeds: [panelEmbed], 
        components: [actionRow1, actionRow2, themeRow] 
      });

    } catch (error) {
      logger.error('Error creating battle control panel:', error);
    }
  }

  /**
   * Met à jour le panneau de contrôle avec les données en temps réel
   */
  async updateControlPanel(messageId: string, channelId: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      const message = await channel.messages.fetch(messageId);
      
      const activeBattles = await this.battleService.getActiveBattles();
      const waitingBattles = activeBattles.filter(b => b.status === 'WAITING');
      const activeBattlesInProgress = activeBattles.filter(b => b.status === 'ACTIVE');
      
      const totalParticipants = waitingBattles.reduce((sum, b) => sum + b.participants, 0);
      
      const updatedEmbed = new EmbedBuilder()
        .setTitle('🎮 Panneau de Contrôle - Bataille Royale')
        .setColor(0x3498db)
        .setDescription(`
**Bienvenue dans l'arène de combat !**

Utilise les boutons ci-dessous pour participer ou gérer les batailles.

📊 **Statistiques en temps réel :**
• Batailles en attente : **${waitingBattles.length}**
• Batailles en cours : **${activeBattlesInProgress.length}**
• Participants en attente : **${totalParticipants}**
• Prochaine bataille : ${waitingBattles.length > 0 ? 'Rejoins maintenant !' : 'Bientôt...'}
        `)
        .addFields([
          {
            name: '🎯 Actions Rapides',
            value: '• Rejoindre une bataille\n• Voir les statistiques\n• Consulter le leaderboard',
            inline: true
          },
          {
            name: '🏆 Récompenses',
            value: '• 1er : 50% de la cagnotte\n• 2e : 25% de la cagnotte\n• 3e : 15% de la cagnotte',
            inline: true
          }
        ])
        .setFooter({ text: `Dernière mise à jour` })
        .setTimestamp();

      await message.edit({ embeds: [updatedEmbed] });

    } catch (error) {
      logger.error('Error updating control panel:', error);
    }
  }

  /**
   * Nettoie les données de bataille expirées
   */
  async cleanupExpiredBattles(): Promise<void> {
    try {
      const allKeys = await this.redis.keys('battle:*:tracking');
      
      for (const key of allKeys) {
        const startTime = await this.redis.hGet(key, 'startTime');
        if (startTime) {
          const elapsed = Date.now() - parseInt(startTime);
          // Nettoyer après 2 heures
          if (elapsed > 2 * 60 * 60 * 1000) {
            await this.redis.del(key);
            const battleId = key.split(':')[1];
            this.activeBattleChannels.delete(battleId);
          }
        }
      }
      
    } catch (error) {
      logger.error('Error cleaning up expired battles:', error);
    }
  }
}

export default BattleEventManager;
