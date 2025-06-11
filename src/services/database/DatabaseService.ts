import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.prisma.$on('query', (e) => {
      logger.debug('Query executed', {
        query: e.query,
        params: e.params,
        duration: e.duration,
      });
    });

    this.prisma.$on('error', (e) => {
      logger.error('Database error', e);
    });

    this.prisma.$on('info', (e) => {
      logger.info('Database info', e);
    });

    this.prisma.$on('warn', (e) => {
      logger.warn('Database warning', e);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('✅ Connected to database');
    } catch (error) {
      logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('✅ Disconnected from database');
    } catch (error) {
      logger.error('❌ Failed to disconnect from database:', error);
      throw error;
    }
  }

  get client(): PrismaClient {
    return this.prisma;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  async getStats(): Promise<{
    totalUsers: number;
    totalMachines: number;
    activeBattles: number;
    totalTransactions: number;
  }> {
    try {
      const [totalUsers, totalMachines, activeBattles, totalTransactions] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.machine.count(),
        this.prisma.battle.count({ where: { status: 'ACTIVE' } }),
        this.prisma.transaction.count(),
      ]);

      return {
        totalUsers,
        totalMachines,
        activeBattles,
        totalTransactions,
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      throw error;
    }
  }
}

export default DatabaseService;