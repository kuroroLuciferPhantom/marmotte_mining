import { createClient, RedisClientType } from 'redis';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';

export class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          logger.info(`Redis reconnecting... attempt ${retries}`);
          return Math.min(retries * 50, 500);
        },
        connectTimeout: 10000,
        lazyConnect: true
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      logger.info('✅ Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('❌ Redis error:', error.message);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.warn('⚠️ Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });

    this.client.on('ready', () => {
      logger.info('🚀 Redis ready');
      this.isConnected = true;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('✅ Redis service initialized');
    } catch (error) {
      logger.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      logger.info('✅ Disconnected from Redis');
    } catch (error) {
      logger.error('❌ Failed to disconnect from Redis:', error);
      throw error;
    }
  }

  get isHealthy(): boolean {
    return this.isConnected;
  }

  // Generic Redis operations with error handling
  async get(key: string): Promise<string | null> {
    try {
      if (!this.isConnected) return null;
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (!this.isConnected) return;
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error(`Failed to set key ${key}:`, error);
    }
  }

  async del(key: string): Promise<number> {
    try {
      if (!this.isConnected) return 0;
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Failed to delete key ${key}:`, error);
      return 0;
    }
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    try {
      if (!this.isConnected) return undefined;
      return await this.client.hGet(key, field);
    } catch (error) {
      logger.error(`Failed to get hash field ${field} from ${key}:`, error);
      return undefined;
    }
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    try {
      if (!this.isConnected) return 0;
      return await this.client.hSet(key, field, value);
    } catch (error) {
      logger.error(`Failed to set hash field ${field} in ${key}:`, error);
      return 0;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      if (!this.isConnected) return {};
      return await this.client.hGetAll(key);
    } catch (error) {
      logger.error(`Failed to get all hash fields from ${key}:`, error);
      return {};
    }
  }

  async zAdd(key: string, score: number, member: string): Promise<number> {
    try {
      if (!this.isConnected) return 0;
      return await this.client.zAdd(key, { score, value: member });
    } catch (error) {
      logger.error(`Failed to add member to sorted set ${key}:`, error);
      return 0;
    }
  }

  async zRevRange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      if (!this.isConnected) return [];
      return await this.client.zRevRange(key, start, stop);
    } catch (error) {
      logger.error(`Failed to get reverse range from sorted set ${key}:`, error);
      return [];
    }
  }

  // Game-specific cache methods
  async cacheUserData(userId: string, userData: any, ttl: number = 3600): Promise<void> {
    const key = `user:${userId}`;
    await this.set(key, JSON.stringify(userData), ttl);
  }

  async getUserData(userId: string): Promise<any | null> {
    const key = `user:${userId}`;
    const data = await this.get(key);
    return data ? JSON.parse(data) : null;
  }

  async cacheTokenPrice(price: number, timestamp: number): Promise<void> {
    const key = 'token:current_price';
    await this.set(key, JSON.stringify({ price, timestamp }), 300); // 5 minutes TTL
  }

  async getCurrentTokenPrice(): Promise<{ price: number; timestamp: number } | null> {
    const key = 'token:current_price';
    const data = await this.get(key);
    return data ? JSON.parse(data) : null;
  }

  async addToLeaderboard(userId: string, score: number): Promise<void> {
    const key = 'leaderboard:tokens';
    await this.zAdd(key, score, userId);
  }

  async getLeaderboard(limit: number = 10): Promise<Array<{ userId: string; score: number }>> {
    const key = 'leaderboard:tokens';
    const result = await this.zRevRange(key, 0, limit - 1);
    
    const leaderboard = [];
    for (let i = 0; i < result.length; i += 2) {
      leaderboard.push({
        userId: result[i],
        score: parseFloat(result[i + 1] || '0')
      });
    }
    return leaderboard;
  }
}

export default RedisService;