// src/services/cache/DatabaseCacheService.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

export class DatabaseCacheService {
  private database: PrismaClient;

  constructor(database: PrismaClient) {
    this.database = database;
  }

  async connect(): Promise<void> {
    logger.info('📦 Using PostgreSQL for caching');
  }

  async disconnect(): Promise<void> {}

  get isHealthy(): boolean { return true; }

  // === Méthodes Redis équivalentes ===

  async get(key: string): Promise<string | null> {
    try {
      const cached = await this.database.cache.findUnique({
        where: { key }
      });
      
      // Vérifier expiration
      if (cached && cached.expiresAt && cached.expiresAt < new Date()) {
        await this.del(key);
        return null;
      }
      
      return cached?.value || null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : null;
      
      await this.database.cache.upsert({
        where: { key },
        update: { value, expiresAt },
        create: { key, value, expiresAt }
      });
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<number> {
    try {
      const deleted = await this.database.cache.deleteMany({
        where: { key }
      });
      return deleted.count;
    } catch (error) {
      logger.error('Cache del error:', error);
      return 0;
    }
  }

  // === Hash operations (pour les stats quotidiennes) ===

  async hGet(key: string, field: string): Promise<string | undefined> {
    try {
      const hashKey = `${key}:${field}`;
      const value = await this.get(hashKey);
      return value || undefined;
    } catch (error) {
      logger.error('Cache hGet error:', error);
      return undefined;
    }
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    try {
      const hashKey = `${key}:${field}`;
      await this.set(hashKey, value, 86400); // 24h TTL pour les stats quotidiennes
      return 1;
    } catch (error) {
      logger.error('Cache hSet error:', error);
      return 0;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      // Récupérer toutes les clés qui commencent par le pattern
      const cached = await this.database.cache.findMany({
        where: {
          key: {
            startsWith: `${key}:`
          },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });

      const result: Record<string, string> = {};
      for (const item of cached) {
        const field = item.key.replace(`${key}:`, '');
        result[field] = item.value;
      }
      
      return result;
    } catch (error) {
      logger.error('Cache hGetAll error:', error);
      return {};
    }
  }

  // === Sorted sets (pour les leaderboards) ===

  async zAdd(key: string, score: number, member: string): Promise<number> {
    try {
      await this.database.leaderboard.upsert({
        where: {
          key_member: {
            key,
            member
          }
        },
        update: { score },
        create: { key, member, score }
      });
      return 1;
    } catch (error) {
      logger.error('Cache zAdd error:', error);
      return 0;
    }
  }

  async zRevRange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const results = await this.database.leaderboard.findMany({
        where: { key },
        orderBy: { score: 'desc' },
        skip: start,
        take: stop - start + 1
      });
      
      return results.map(r => r.member);
    } catch (error) {
      logger.error('Cache zRevRange error:', error);
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
      const results = await this.database.leaderboard.findMany({
        where: { key: 'leaderboard:tokens' },
        orderBy: { score: 'desc' },
        take: limit
      });
      
      return results.map(r => ({ userId: r.member, score: r.score }));
    } catch (error) {
      logger.error('Leaderboard error:', error);
      return [];
    }
  }

  // === Nettoyage automatique ===

  async cleanupExpired(): Promise<void> {
    try {
      const deleted = await this.database.cache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });
      
      if (deleted.count > 0) {
        logger.debug(`🧹 Cleaned up ${deleted.count} expired cache entries`);
      }
    } catch (error) {
      logger.error('Cache cleanup error:', error);
    }
  }
}