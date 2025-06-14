// src/services/cache/ICacheService.ts - Interface commune compatible avec RedisService
export interface ICacheService {
  // Propriétés requises par les services existants
  readonly isHealthy: boolean;
  readonly client?: any;
  readonly isConnected?: boolean;
  readonly reconnectAttempts?: number;
  readonly maxReconnectAttempts?: number;

  // Méthodes de connexion
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Opérations de base
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<number>;

  // Opérations Hash
  hGet(key: string, field: string): Promise<string | undefined>;
  hSet(key: string, field: string, value: string): Promise<number>;
  hGetAll(key: string): Promise<Record<string, string>>;

  // Opérations Sorted Sets
  zAdd(key: string, score: number, member: string): Promise<number>;
  zRevRange(key: string, start: number, stop: number): Promise<string[]>;

  // Méthodes spécifiques au jeu (utilisées par RedisService)
  cacheUserData(userId: string, userData: any, ttl?: number): Promise<void>;
  getUserData(userId: string): Promise<any | null>;
  cacheTokenPrice(price: number, timestamp: number): Promise<void>;
  getCurrentTokenPrice(): Promise<{ price: number; timestamp: number } | null>;
  addToLeaderboard(userId: string, score: number): Promise<void>;
  getLeaderboard(limit?: number): Promise<Array<{ userId: string; score: number }>>;
}