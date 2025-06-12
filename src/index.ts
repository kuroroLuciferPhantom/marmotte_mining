import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config/config';
import { logger } from './utils/logger';
import { DatabaseService } from './services/database/DatabaseService';
import { MiningService } from './services/mining/MiningService';
import { BattleService } from './services/battle/BattleService';
import { ActivityService } from './services/activity/ActivityService';

// Mock Redis service for fallback
class MockRedisService {
  private cache: Map<string, any> = new Map();

  async connect(): Promise<void> {
    logger.info('📦 Using in-memory cache (Redis unavailable)');
  }

  async disconnect(): Promise<void> {}

  get isHealthy(): boolean { return true; }

  async get(key: string): Promise<string | null> {
    return this.cache.get(key) || null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.cache.set(key, value);
    if (ttl) {
      setTimeout(() => this.cache.delete(key), ttl * 1000);
    }
  }

  async del(key: string): Promise<number> {
    return this.cache.delete(key) ? 1 : 0;
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    const hash = this.cache.get(key) || {};
    return hash[field];
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    const hash = this.cache.get(key) || {};
    hash[field] = value;
    this.cache.set(key, hash);
    return 1;
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.cache.get(key) || {};
  }

  async zAdd(key: string, score: number, member: string): Promise<number> {
    const zset = this.cache.get(key) || [];
    zset.push({ score, value: member });
    zset.sort((a: any, b: any) => b.score - a.score);
    this.cache.set(key, zset);
    return 1;
  }

  async zRevRange(key: string, start: number, stop: number): Promise<string[]> {
    const zset = this.cache.get(key) || [];
    return zset.slice(start, stop + 1).map((item: any) => item.value);
  }

  // Game-specific methods
  async cacheUserData(userId: string, userData: any, ttl: number = 3600): Promise<void> {
    await this.set(`user:${userId}`, JSON.stringify(userData), ttl);
  }

  async getUserData(userId: string): Promise<any | null> {
    const data = await this.get(`user:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async cacheTokenPrice(price: number, timestamp: number): Promise<void> {
    await this.set('token:current_price', JSON.stringify({ price, timestamp }), 300);
  }

  async getCurrentTokenPrice(): Promise<{ price: number; timestamp: number } | null> {
    const data = await this.get('token:current_price');
    return data ? JSON.parse(data) : null;
  }

  async addToLeaderboard(userId: string, score: number): Promise<void> {
    await this.zAdd('leaderboard:tokens', score, userId);
  }

  async getLeaderboard(limit: number = 10): Promise<Array<{ userId: string; score: number }>> {
    const result = await this.zRevRange('leaderboard:tokens', 0, limit - 1);
    return result.map((userId, index) => ({ userId, score: 0 })); // Simplified for mock
  }
}

class MarmotteMiningBot {
  public client: Client;
  public commands: Collection<string, any>;
  private services: Map<string, any>;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
      ]
    });

    this.commands = new Collection();
    this.services = new Map();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Starting Marmotte Mining Bot...');

      // Initialize core services
      await this.initializeServices();

      // Setup basic event handlers
      this.setupEventHandlers();

      // Login to Discord
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

    // Try Redis, fallback to mock if failed
    let redisService;
    try {
      logger.info('🔄 Attempting to connect to Redis...');
      const { RedisService } = await import('./services/cache/RedisService');
      redisService = new RedisService();
      
      // Set a shorter timeout for the connection attempt
      const connectPromise = redisService.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 10000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      this.services.set('redis', redisService);
      logger.info('✅ Redis connected successfully');
      
    } catch (error) {
      logger.warn('⚠️ Redis connection failed, using in-memory cache instead');
      logger.debug('Redis error details:', error.message);
      
      redisService = new MockRedisService();
      await redisService.connect();
      this.services.set('redis', redisService);
    }

    // Initialize other services
    const miningService = new MiningService(databaseService, this.services.get('redis'));
    this.services.set('mining', miningService);

    const battleService = new BattleService(databaseService, this.services.get('redis'));
    this.services.set('battle', battleService);

    const activityService = new ActivityService(databaseService, this.services.get('redis'));
    this.services.set('activity', activityService);

    logger.info('✅ All services initialized successfully');
  }

  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      logger.info(`✅ Bot logged in as ${this.client.user?.tag}!`);
      logger.info(`🎮 Bot is ready and serving ${this.client.guilds.cache.size} servers`);
      logger.info('💡 Send messages in Discord to earn dollars automatically!');
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      try {
        // Reward user for activity
        const activityService = this.getService<ActivityService>('activity');
        const reward = await activityService.rewardMessage(message.author.id, message.content);
        
        if (reward && reward.amount > 0) {
          logger.info(`💰 ${message.author.tag} earned ${reward.amount.toFixed(2)}$ for message activity`);
          
          // Optional: React to show the reward
          try {
            await message.react('💰');
          } catch (e) {
            // Ignore reaction errors
          }
        }
      } catch (error) {
        logger.error('Error processing message reward:', error.message);
      }
    });

    this.client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      
      try {
        const activityService = this.getService<ActivityService>('activity');
        const reward = await activityService.rewardReaction(user.id, reaction.emoji.name || '👍');
        
        if (reward && reward.amount > 0) {
          logger.info(`💰 ${user.tag} earned ${reward.amount.toFixed(2)}$ for reaction`);
        }
      } catch (error) {
        logger.error('Error processing reaction reward:', error.message);
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      logger.info(`🎮 Command received: ${interaction.commandName} from ${interaction.user.tag}`);
      
      try {
        // Get user's current balance
        const activityService = this.getService<ActivityService>('activity');
        const balance = await activityService.getUserDollarBalance(interaction.user.id);
        
        await interaction.reply({
          content: `🚧 **Commands coming soon!**\n💰 Your current balance: **${balance.toFixed(2)}$**\n\n📝 For now, earn dollars by:\n• Sending messages (+1$)\n• Adding reactions (+0.5$)\n• Being active in voice channels\n\n🔜 Soon you'll be able to:\n• Buy tokens with your dollars\n• Purchase mining machines\n• Join battle royales`,
          ephemeral: true
        });
      } catch (error) {
        logger.error('Error handling interaction:', error);
        await interaction.reply({
          content: '❌ An error occurred while processing your command.',
          ephemeral: true
        });
      }
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });

    this.client.on('warn', (warning) => {
      logger.warn('Discord client warning:', warning);
    });
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
      // Close database connection
      const database = this.services.get('database');
      if (database) {
        await database.disconnect();
      }

      // Close Redis connection
      const redis = this.services.get('redis');
      if (redis && redis.disconnect) {
        await redis.disconnect();
      }

      // Destroy Discord client
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