import { createClient, RedisClientType } from 'redis';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';

export class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.redis.url,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      logger.info('✅ Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('❌ Redis error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.warn('⚠️ Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
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

  // Generic Redis operations
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Failed to get key ${key}:`, error);
      throw error;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error(`Failed to set key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Failed to delete key ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<number> {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error(`Failed to check existence of key ${key}:`, error);
      throw error;
    }
  }

  // Hash operations
  async hGet(key: string, field: string): Promise<string | undefined> {
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      logger.error(`Failed to get hash field ${field} from ${key}:`, error);
      throw error;
    }
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.client.hSet(key, field, value);
    } catch (error) {
      logger.error(`Failed to set hash field ${field} in ${key}:`, error);
      throw error;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      logger.error(`Failed to get all hash fields from ${key}:`, error);
      throw error;
    }
  }

  // Sorted set operations
  async zAdd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.client.zAdd(key, { score, value: member });
    } catch (error) {
      logger.error(`Failed to add member to sorted set ${key}:`, error);
      throw error;
    }
  }

  async zRevRange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zRevRange(key, start, stop);
    } catch (error) {
      logger.error(`Failed to get reverse range from sorted set ${key}:`, error);
      throw error;
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