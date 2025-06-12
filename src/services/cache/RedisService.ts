import { createClient, RedisClientType } from 'redis';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';

export class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    // Configuration spéciale pour Upstash
    this.client = createClient({
      url: config.redis.url,
      socket: {
        keepAlive: true,
        reconnectStrategy: (retries) => {
          this.reconnectAttempts = retries;
          if (retries > this.maxReconnectAttempts) {
            logger.error(`Redis: Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
            return false; // Stop reconnecting
          }
          const delay = Math.min(retries * 1000, 5000); // Max 5 seconds
          logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        },
        connectTimeout: 30000, // 30 seconds
        commandTimeout: 10000,  // 10 seconds
        lazyConnect: false
      },
      // Upstash specific settings
      disableOfflineQueue: false
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      logger.info('🔗 Redis connecting...');
    });

    this.client.on('ready', () => {
      logger.info('✅ Redis ready and authenticated');
      this.isConnected = true;
      this.reconnectAttempts = 0; // Reset counter on successful connection
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      // Only log significant errors, not every disconnection
      if (error.message.includes('ECONNRESET') || error.message.includes('Socket closed')) {
        logger.debug(`Redis connection issue: ${error.message}`);
      } else {
        logger.error('Redis error:', error.message);
      }
    });

    this.client.on('end', () => {
      logger.warn('⚠️ Redis connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info(`🔄 Redis reconnecting... (attempt ${this.reconnectAttempts})`);
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      // Test the connection
      await this.client.ping();
      logger.info('✅ Redis service initialized and tested');
    } catch (error) {
      logger.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client.isOpen) {
        await this.client.disconnect();
      }
      logger.info('✅ Disconnected from Redis');
    } catch (error) {
      logger.error('❌ Failed to disconnect from Redis:', error);
    }
  }

  get isHealthy(): boolean {
    return this.isConnected && this.client.isReady;
  }

  // Wrapper with automatic retry for critical operations
  private async executeWithRetry<T>(operation: () => Promise<T>, retries: number = 2): Promise<T | null> {
    for (let i = 0; i <= retries; i++) {
      try {
        if (!this.client.isReady) {
          if (i === retries) return null;
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }
        return await operation();
      } catch (error) {
        if (i === retries) {
          logger.error('Redis operation failed after retries:', error);
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
      }
    }
    return null;
  }

  // Redis operations with retry logic
  async get(key: string): Promise<string | null> {
    return this.executeWithRetry(() => this.client.get(key));
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.executeWithRetry(async () => {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    });
  }

  async del(key: string): Promise<number> {
    const result = await this.executeWithRetry(() => this.client.del(key));
    return result || 0;
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    return this.executeWithRetry(() => this.client.hGet(key, field)) || undefined;
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    const result = await this.executeWithRetry(() => this.client.hSet(key, field, value));
    return result || 0;
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    const result = await this.executeWithRetry(() => this.client.hGetAll(key));
    return result || {};
  }

  async zAdd(key: string, score: number, member: string): Promise<number> {
    const result = await this.executeWithRetry(() => 
      this.client.zAdd(key, { score, value: member })
    );
    return result || 0;
  }

  async zRevRange(key: string, start: number, stop: number): Promise<string[]> {
    const result = await this.executeWithRetry(() => this.client.zRevRange(key, start, stop));
    return result || [];
  }

  // Game-specific methods (simplified, no retry needed for these)
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
    await this.set(key, JSON.stringify({ price, timestamp }), 300);
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