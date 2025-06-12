import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config/config';
import { logger } from './utils/logger';
import { DatabaseService } from './services/database/DatabaseService';
import { RedisService } from './services/cache/RedisService';
import { MiningService } from './services/mining/MiningService';
import { BattleService } from './services/battle/BattleService';
import { ActivityService } from './services/activity/ActivityService';

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

    // Redis Service
    const redisService = new RedisService();
    await redisService.connect();
    this.services.set('redis', redisService);

    // Mining Service
    const miningService = new MiningService(databaseService, redisService);
    this.services.set('mining', miningService);

    // Battle Service
    const battleService = new BattleService(databaseService, redisService);
    this.services.set('battle', battleService);

    // Activity Service
    const activityService = new ActivityService(databaseService, redisService);
    this.services.set('activity', activityService);

    logger.info('✅ All services initialized successfully');
  }

  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      logger.info(`✅ Bot logged in as ${this.client.user?.tag}!`);
      logger.info(`🎮 Bot is ready and serving ${this.client.guilds.cache.size} servers`);
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      // Reward user for activity
      const activityService = this.getService<ActivityService>('activity');
      await activityService.rewardMessage(message.author.id, message.content);
    });

    this.client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      
      // Reward user for reaction
      const activityService = this.getService<ActivityService>('activity');
      await activityService.rewardReaction(user.id, reaction.emoji.name || '👍');
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      logger.info(`Command received: ${interaction.commandName} from ${interaction.user.tag}`);
      
      // TODO: Handle slash commands here
      await interaction.reply({
        content: `🚧 Command \`${interaction.commandName}\` is coming soon! The bot is being developed.`,
        ephemeral: true
      });
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
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

    // Close database connection
    const database = this.services.get('database');
    if (database) {
      await database.disconnect();
    }

    // Close Redis connection
    const redis = this.services.get('redis');
    if (redis) {
      await redis.disconnect();
    }

    // Destroy Discord client
    this.client.destroy();

    logger.info('✅ Bot shutdown complete');
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