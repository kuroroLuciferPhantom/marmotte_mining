// src/services/cache/MockCacheService.ts - Version compatible avec RedisService
import { ICacheService } from './ICacheService';
import { logger } from '../../utils/logger';

export class MockCacheService implements ICacheService {
  private cache: Map<string, any> = new Map();
  private expiries: Map<string, number> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  // Propriétés pour compatibilité parfaite avec RedisService
  public client: any = { 
    ping: async () => 'PONG',
    quit: async () => 'OK'
  };
  public isConnected: boolean = false;
  public reconnectAttempts: number = 0;
  public maxReconnectAttempts: number = 5;

  get isHealthy(): boolean {
    return this.isConnected;
  }

  async connect(): Promise<void> {
    logger.info('📦 Using in-memory cache (no Redis required)');
    this.isConnected = true;
    this.startCleanupInterval();
  }

  async disconnect(): Promise<void> {
    this.cache.clear();
    this.expiries.clear();
    this.isConnected = false;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  // === Opérations de base ===

  async get(key: string): Promise<string | null> {
    // Vérifier expiration
    const expiry = this.expiries.get(key);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key);
      this.expiries.delete(key);
      return null;
    }
    
    return this.cache.get(key) || null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.cache.set(key, value);
    
    if (ttl) {
      this.expiries.set(key, Date.now() + ttl * 1000);
    } else {
      this.expiries.delete(key);
    }
  }

  async del(key: string): Promise<number> {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    this.expiries.delete(key);
    return existed ? 1 : 0;
  }

  // === Opérations Hash ===

  async hGet(key: string, field: string): Promise<string | undefined> {
    const hashKey = `${key}:${field}`;
    const value = await this.get(hashKey);
    return value || undefined;
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    const hashKey = `${key}:${field}`;
    const existed = this.cache.has(hashKey);
    await this.set(hashKey, value, 86400); // 24h par défaut pour les hash
    return existed ? 0 : 1;
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const pattern = `${key}:`;
    
    for (const [cacheKey, value] of this.cache.entries()) {
      if (cacheKey.startsWith(pattern)) {
        // Vérifier expiration
        const expiry = this.expiries.get(cacheKey);
        if (!expiry || Date.now() <= expiry) {
          const field = cacheKey.replace(pattern, '');
          result[field] = value;
        }
      }
    }
    
    return result;
  }

  // === Opérations Sorted Sets ===

  async zAdd(key: string, score: number, member: string): Promise<number> {
    const zsetKey = `zset:${key}`;
    let zset: Array<{ score: number; member: string }> = this.cache.get(zsetKey) || [];
    
    // Supprimer l'ancien membre s'il existe
    zset = zset.filter(item => item.member !== member);
    
    // Ajouter le nouveau
    zset.push({ score, member });
    
    // Trier par score décroissant
    zset.sort((a, b) => b.score - a.score);
    
    this.cache.set(zsetKey, zset);
    return 1;
  }

  async zRevRange(key: string, start: number, stop: number): Promise<string[]> {
    const zsetKey = `zset:${key}`;
    const zset: Array<{ score: number; member: string }> = this.cache.get(zsetKey) || [];
    
    return zset.slice(start, stop + 1).map(item => item.member);
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
    const zsetKey = `zset:leaderboard:tokens`;
    const zset: Array<{ score: number; member: string }> = this.cache.get(zsetKey) || [];
    
    return zset
      .slice(0, limit)
      .map(item => ({ userId: item.member, score: item.score }));
  }

  // === Méthodes supplémentaires pour compatibilité totale ===

  async exists(key: string): Promise<number> {
    const value = await this.get(key);
    return value !== null ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.cache.has(key)) {
      this.expiries.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    const expiry = this.expiries.get(key);
    if (!expiry) return -1; // Pas d'expiration
    
    const remaining = Math.ceil((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2; // -2 = expiré
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async flushdb(): Promise<void> {
    this.cache.clear();
    this.expiries.clear();
  }

  // === Nettoyage automatique ===

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000); // Toutes les minutes
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, expiry] of this.expiries.entries()) {
      if (now > expiry) {
        this.cache.delete(key);
        this.expiries.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`🧹 MockCache: Cleaned ${cleanedCount} expired entries`);
    }
  }
}