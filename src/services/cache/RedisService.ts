// src/services/cache/RedisService.ts - Version simplifiée et fonctionnelle
import Redis from 'ioredis';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';
import { ICacheService } from './ICacheService';

export class RedisService implements ICacheService {
  public readonly client: Redis;
  private _isConnected: boolean = false;
  private _reconnectAttempts: number = 0;
  private readonly _maxReconnectAttempts: number = 5;

  constructor() {
    // Configuration simplifiée qui fonctionne
    this.client = new Redis(config.redis.url);
    this.setupEventListeners();
  }

  get isHealthy(): boolean {
    return this.client.status === 'ready';
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get reconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  get maxReconnectAttempts(): number {
    return this._maxReconnectAttempts;
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      logger.info('✅ Redis connected');
      this._isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('✅ Redis ready');
      this._isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('❌ Redis error:', error);
      this._isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('⚠️ Redis connection closed');
      this._isConnected = false;
    });

    this.client.on('reconnecting', (times: number) => {
      logger.info(`🔄 Redis reconnecting... Attempt ${times}`);
      this._reconnectAttempts = times;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.ping();
      this._isConnected = true;
      logger.info('✅ Redis connection established');
    } catch (error) {
      this._isConnected = false;
      logger.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this._isConnected = false;
      logger.info('✅ Redis disconnected');
    } catch (error) {
      logger.error('❌ Failed to disconnect from Redis:', error);
      throw error;
    }
  }

  // === Opérations de base ===

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error('Redis set error:', error);
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis del error:', error);
      return 0;
    }
  }

  // === Opérations Hash ===

  async hGet(key: string, field: string): Promise<string | undefined> {
    try {
      const result = await this.client.hget(key, field);
      return result || undefined;
    } catch (error) {
      logger.error('Redis hGet error:', error);
      return undefined;
    }
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.client.hset(key, field, value);
    } catch (error) {
      logger.error('Redis hSet error:', error);
      return 0;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      logger.error('Redis hGetAll error:', error);
      return {};
    }
  }

  // === Opérations Sorted Sets ===

  async zAdd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.client.zadd(key, score, member);
    } catch (error) {
      logger.error('Redis zAdd error:', error);
      return 0;
    }
  }

  async zRevRange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zrevrange(key, start, stop);
    } catch (error) {
      logger.error('Redis zRevRange error:', error);
      return [];
    }
  }

  // === Méthodes spécifiques au jeu ===

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
    try {
      const results = await this.zRevRange('leaderboard:tokens', 0, limit - 1);
      
      // Récupérer les scores pour chaque membre
      const leaderboard = [];
      for (const userId of results) {
        const score = await this.client.zscore('leaderboard:tokens', userId);
        leaderboard.push({ userId, score: parseFloat(score || '0') });
      }
      
      return leaderboard;
    } catch (error) {
      logger.error('Redis getLeaderboard error:', error);
      return [];
    }
  }

  // === Méthodes Redis supplémentaires ===

  async exists(key: string): Promise<number> {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error('Redis exists error:', error);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error('Redis expire error:', error);
      return 0;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Redis ttl error:', error);
      return -1;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis keys error:', error);
      return [];
    }
  }

  async flushdb(): Promise<void> {
    try {
      await this.client.flushdb();
    } catch (error) {
      logger.error('Redis flushdb error:', error);
    }
  }

  // === Méthodes legacy pour compatibilité ===

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.set(key, value, seconds);
  }
}