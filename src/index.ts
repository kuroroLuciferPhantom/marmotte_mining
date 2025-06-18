// src/index.ts - Version finale avec services token intégrés
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config/config';
import { logger } from './utils/logger';
import { DatabaseService } from './services/database/DatabaseService';
import { MiningService } from './services/mining/MiningService';
import { BattleService } from './services/battle/BattleService';
import { ActivityService } from './services/activity/ActivityService';
import { SabotageService } from './services/sabotage/SabotageService';
import { CardService } from './services/sabotage/CardService';
import { BlackMarketService } from './services/sabotage/BlackMarketService';
import { TokenPriceService } from './services/token-price/TokenPriceService';
import { TokenMarketService } from './services/token-price/TokenMarketService';
import { MachineMaintenanceService } from './services/maintenance/MachineMaintenanceService';
import { CommandManager } from './managers/CommandManager';

// Import de l'interface et du mock
import { ICacheService } from './services/cache/ICacheService';
import { MockCacheService } from './services/cache/MockCacheService';

class MarmotteMiningBot {
  public client: Client;
  public commands: Collection<string, any>;
  private services: Map<string, any>;
  private commandManager: CommandManager;
  private cleanupInterval?: NodeJS.Timeout;
  private marketRefreshInterval?: NodeJS.Timeout;
  private energyRegenInterval?: NodeJS.Timeout;
  private tokenPriceInterval?: NodeJS.Timeout;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
        // ❌ Supprimé: GatewayIntentBits.GuildVoiceStates
      ]
    });

    this.commands = new Collection();
    this.services = new Map();
    this.commandManager = new CommandManager(this.client, this.services);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Starting Marmotte Mining Bot...');

      await this.initializeServices();
      await this.initializeCommands();
      this.setupEventHandlers();
      this.setupPeriodicTasks();

      await this.client.login(config.discord.token);

      logger.info('✅ Bot successfully initialized and logged in!');
    } catch (error) {
      logger.error('❌ Failed to initialize bot:', error);
      process.exit(1);
    }
  }

  private async initializeServices(): Promise<void> {
    logger.info('🔧 Initializing services...');

    // Database Service
    const databaseService = new DatabaseService();
    await databaseService.connect();
    this.services.set('database', databaseService);
    
    // Cache Service - Utilisation du MockCacheService (Redis désactivé)
    let cacheService: ICacheService;

    logger.info('📦 Using in-memory cache (Redis disabled for now)');
    cacheService = new MockCacheService();
    await cacheService.connect();
    
    this.services.set('cache', cacheService);

    // Core services
    const activityService = new ActivityService(databaseService);
    this.services.set('activity', activityService);

    const miningService = new MiningService(databaseService, cacheService as any);
    this.services.set('mining', miningService);

    const battleService = new BattleService(databaseService, cacheService as any);
    this.services.set('battle', battleService);

    // 🆕 Token services - Maintenant corrigés
    const tokenPriceService = new TokenPriceService(databaseService, cacheService);
    this.services.set('tokenPrice', tokenPriceService);

    const tokenMarketService = new TokenMarketService(
      this.client, 
      databaseService, 
      cacheService
      // config.discord.marketChannelId // Optionnel - à configurer plus tard
    );
    this.services.set('tokenMarket', tokenMarketService);

    // PvP services
    const sabotageService = new SabotageService(databaseService.client);
    this.services.set('sabotage', sabotageService);

    const cardService = new CardService(databaseService.client);
    this.services.set('cards', cardService);

    const blackMarketService = new BlackMarketService(databaseService.client);
    this.services.set('blackmarket', blackMarketService);

    const maintenanceService = new MachineMaintenanceService(databaseService, miningService);
    this.services.set('maintenance', maintenanceService);

    // Démarre la boucle de maintenance automatique
    maintenanceService.startMaintenanceLoop();

    logger.info('✅ All services initialized successfully');
  }

  private async initializeCommands(): Promise<void> {
    try {
      await this.commandManager.loadCommands();
      await this.commandManager.deployCommands();
      this.commandManager.setupCommandHandler();
      
      logger.info('✅ Commands system initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize commands:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      logger.info(`✅ Bot logged in as ${this.client.user?.tag}!`);
      logger.info(`🎮 Bot is ready and serving ${this.client.guilds.cache.size} servers`);
      logger.info('💡 Send messages to earn dollars automatically!');
      logger.info('💰 Use /salaire every week to get your salary!');
      logger.info('📊 Token market monitoring active!');
      logger.info('🎯 Try these commands: /profile, /balance, /salaire, /help');
    });

    // 📝 Messages - Récompenses automatiques
    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      try {
        const activityService = this.getService<ActivityService>('activity');
        const reward = await activityService.rewardMessage(message.author.id, message.content);
        
        if (reward && reward.amount > 0) {
          logger.info(`💰 ${message.author.tag} earned ${reward.amount.toFixed(2)}$ for message activity`);
          
          try {
            await message.react('💰');
          } catch (e) {
            // Ignore reaction errors (permissions, etc.)
          }
        }
      } catch (error: any) {
        logger.error('Error processing message reward:', error.message);
      }
    });

    // 👍 Réactions - Récompenses automatiques
    this.client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      
      try {
        const activityService = this.getService<ActivityService>('activity');
        const reward = await activityService.rewardReaction(user.id, reaction.emoji.name || '👍');
        
        if (reward && reward.amount > 0) {
          logger.info(`💰 ${user.tag} earned ${reward.amount.toFixed(2)}$ for reaction`);
        }
      } catch (error: any) {
        logger.error('Error processing reaction reward:', error.message);
      }
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });

    this.client.on('warn', (warning) => {
      logger.warn('Discord client warning:', warning);
    });
  }

  private setupPeriodicTasks(): void {
    // Nettoyage des effets de sabotage expirés (toutes les 5 minutes)
    this.cleanupInterval = setInterval(async () => {
      try {
        const sabotageService = this.getService<SabotageService>('sabotage');
        await sabotageService.cleanupExpiredEffects();
      } catch (error) {
        logger.error('Error in sabotage cleanup:', error);
      }
    }, 5 * 60 * 1000);

    // Refresh du marché noir (toutes les heures)
    this.marketRefreshInterval = setInterval(async () => {
      try {
        const blackMarketService = this.getService<BlackMarketService>('blackmarket');
        if (await blackMarketService.needsRefresh()) {
          await blackMarketService.refreshMarket();
          logger.info('🕴️ Black market refreshed automatically');
        }
      } catch (error) {
        logger.error('Error in market refresh:', error);
      }
    }, 60 * 60 * 1000);

    // Régénération d'énergie (toutes les heures)
    this.energyRegenInterval = setInterval(async () => {
      try {
        const cardService = this.getService<CardService>('cards');
        await cardService.regenerateEnergy();
        logger.info('⚡ Energy regenerated for all users');
      } catch (error) {
        logger.error('Error in energy regeneration:', error);
      }
    }, 60 * 60 * 1000);

    // 🆕 Surveillance des prix tokens (toutes les 2 minutes)
    this.tokenPriceInterval = setInterval(async () => {
      try {
        const tokenMarketService = this.getService<TokenMarketService>('tokenMarket');
        await tokenMarketService.startMarketMonitoring();
      } catch (error) {
        logger.error('Error in token price monitoring:', error);
      }
    }, 2 * 60 * 1000);

    // Rappel hebdomadaire pour le salaire
    this.scheduleWeeklySalaryReminder();

    // Nettoyage quotidien
    this.scheduleDailyCleanup();

    logger.info('⏰ Periodic tasks scheduled');
    logger.info('💰 Weekly salary reminders activated');
    logger.info('📊 Token market monitoring activated');
  }

  private scheduleWeeklySalaryReminder(): void {
    const now = new Date();
    const nextMonday = new Date();
    nextMonday.setDate(now.getDate() + (1 - now.getDay() + 7) % 7 || 7);
    nextMonday.setHours(12, 0, 0, 0);
    
    const timeUntilMonday = nextMonday.getTime() - now.getTime();
    
    setTimeout(async () => {
      try {
        logger.info('💰 Weekly salary reminder: notifications sent');
        
        // Ici on pourrait envoyer des notifications dans le canal général
        // const generalChannel = this.client.channels.cache.get(config.discord.generalChannelId);
        // if (generalChannel) {
        //   await generalChannel.send('💰 **Rappel** : N\'oubliez pas de récupérer votre salaire hebdomadaire avec `/salaire` !');
        // }
        
        // Reprogrammer pour la semaine suivante
        this.scheduleWeeklySalaryReminder();
      } catch (error) {
        logger.error('Error in weekly salary reminder:', error);
      }
    }, timeUntilMonday);
  }

  private scheduleDailyCleanup(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(3, 0, 0, 0);
    
    const timeUntilCleanup = tomorrow.getTime() - now.getTime();
    
    setTimeout(async () => {
      try {
        const cardService = this.getService<CardService>('cards');
        await cardService.cleanupInventory();
        
        const blackMarketService = this.getService<BlackMarketService>('blackmarket');
        await blackMarketService.cleanup();
        
        logger.info('🧹 Daily cleanup completed');
        
        // Reprogrammer pour le lendemain
        this.scheduleDailyCleanup();
      } catch (error) {
        logger.error('Error in daily cleanup:', error);
      }
    }, timeUntilCleanup);
  }

  public getService<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }
    return service as T;
  }

  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down bot...');

    try {
      // Clear intervals
      if (this.cleanupInterval) clearInterval(this.cleanupInterval);
      if (this.marketRefreshInterval) clearInterval(this.marketRefreshInterval);
      if (this.energyRegenInterval) clearInterval(this.energyRegenInterval);
      if (this.tokenPriceInterval) clearInterval(this.tokenPriceInterval);
      const maintenanceService = this.services.get('maintenance') as MachineMaintenanceService;
      maintenanceService.stopMaintenanceLoop();

      const database = this.services.get('database');
      if (database) {
        await database.disconnect();
      }

      const cache = this.services.get('cache');
      if (cache && cache.disconnect) {
        await cache.disconnect();
      }

      this.client.destroy();
      logger.info('✅ Bot shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// Initialize and start the bot
const bot = new MarmotteMiningBot();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await bot.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await bot.shutdown();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the bot
bot.initialize().catch((error) => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});

export default bot;