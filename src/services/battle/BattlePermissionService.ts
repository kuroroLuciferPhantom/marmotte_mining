import { logger } from '../../utils/logger';

export interface BattlePermissionResult {
  success: boolean;
  message: string;
  permissions?: any[];
}

export interface UserPermissionInfo {
  id: string;
  discordId: string;
  username: string;
  grantedBy: string;
  grantedAt: Date;
  reason?: string;
}

export class BattlePermissionService {
  constructor(
    private databaseService: any,
    private cacheService?: any
  ) {}

  // ============ VÉRIFICATION DES PERMISSIONS ============

  /**
   * Vérifie si un utilisateur peut lancer des battles
   */
  async canUserStartBattle(discordId: string): Promise<boolean> {
    try {
      // Vérifier le cache d'abord
      const cached = await this.getCachedPermissionStatus(discordId);
      if (cached !== null) {
        return cached;
      }

      // Les admins peuvent toujours lancer des battles
      if (await this.isUserAdmin(discordId)) {
        await this.cachePermissionStatus(discordId, true);
        return true;
      }

      // Vérifier si l'utilisateur a une permission explicite
      const permission = await this.databaseService.client.battlePermission.findFirst({
        where: {
          discordId: discordId,
          isActive: true
        }
      });

      const canStart = !!permission;
      await this.cachePermissionStatus(discordId, canStart);
      return canStart;
    } catch (error) {
      logger.error('Error checking battle permissions:', error);
      return false;
    }
  }

  /**
   * Vérifie si un utilisateur est admin (à adapter selon votre système d'auth)
   */
  private async isUserAdmin(discordId: string): Promise<boolean> {
    // Cette fonction devrait être adaptée selon votre système d'authentification
    // Pour l'instant, on se base sur les rôles Discord ou une liste hardcodée
    
    // Vous pouvez ajouter ici la logique pour vérifier les rôles Discord
    // ou maintenir une liste des admins dans la base de données
    
    return false; // À remplacer par votre logique d'admin
  }

  // ============ GESTION DES PERMISSIONS ============

  /**
   * Accorde une permission de battle à un utilisateur
   */
  async grantBattlePermission(
    targetDiscordId: string,
    targetUsername: string,
    grantedByDiscordId: string,
    reason?: string
  ): Promise<BattlePermissionResult> {
    try {
      // Vérifier si l'utilisateur a déjà une permission
      const existing = await this.databaseService.client.battlePermission.findFirst({
        where: { discordId: targetDiscordId }
      });

      if (existing && existing.isActive) {
        return {
          success: false,
          message: `${targetUsername} a déjà la permission de lancer des battles !`
        };
      }

      // Vérifier si l'utilisateur existe, sinon le créer
      let user = await this.databaseService.client.user.findFirst({
        where: { discordId: targetDiscordId }
      });

      if (!user) {
        user = await this.databaseService.client.user.create({
          data: {
            discordId: targetDiscordId,
            username: targetUsername,
            dollars: 0,
            tokens: 100
          }
        });
      }

      // Créer ou réactiver la permission
      if (existing) {
        await this.databaseService.client.battlePermission.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            grantedBy: grantedByDiscordId,
            grantedAt: new Date(),
            reason: reason,
            username: targetUsername
          }
        });
      } else {
        await this.databaseService.client.battlePermission.create({
          data: {
            userId: user.id,
            discordId: targetDiscordId,
            username: targetUsername,
            grantedBy: grantedByDiscordId,
            reason: reason,
            isActive: true
          }
        });
      }

      // Invalider le cache si disponible
      await this.invalidatePermissionCache(targetDiscordId);

      logger.info(`Battle permission granted to ${targetUsername} (${targetDiscordId}) by ${grantedByDiscordId}`);

      return {
        success: true,
        message: `✅ Permission accordée à **${targetUsername}** !\nIl peut maintenant lancer des battles royales.`
      };

    } catch (error) {
      logger.error('Error granting battle permission:', error);
      return {
        success: false,
        message: '❌ Erreur lors de l\'attribution de la permission !'
      };
    }
  }

  /**
   * Révoque une permission de battle
   */
  async revokeBattlePermission(targetDiscordId: string): Promise<BattlePermissionResult> {
    try {
      const permission = await this.databaseService.client.battlePermission.findFirst({
        where: {
          discordId: targetDiscordId,
          isActive: true
        }
      });

      if (!permission) {
        return {
          success: false,
          message: '❌ Cet utilisateur n\'a pas de permission de battle !'
        };
      }

      await this.databaseService.client.battlePermission.update({
        where: { id: permission.id },
        data: { isActive: false }
      });

      // Invalider le cache
      await this.invalidatePermissionCache(targetDiscordId);

      logger.info(`Battle permission revoked from ${permission.username} (${targetDiscordId})`);

      return {
        success: true,
        message: `✅ Permission révoquée pour **${permission.username}** !`
      };

    } catch (error) {
      logger.error('Error revoking battle permission:', error);
      return {
        success: false,
        message: '❌ Erreur lors de la révocation de la permission !'
      };
    }
  }

  /**
   * Liste tous les utilisateurs avec permission de battle
   */
  async listBattlePermissions(): Promise<BattlePermissionResult> {
    try {
      const permissions = await this.databaseService.client.battlePermission.findMany({
        where: { isActive: true },
        orderBy: { grantedAt: 'desc' }
      });

      return {
        success: true,
        message: '',
        permissions: permissions.map(p => ({
          id: p.id,
          discordId: p.discordId,
          username: p.username,
          grantedBy: p.grantedBy,
          grantedAt: p.grantedAt,
          reason: p.reason
        }))
      };

    } catch (error) {
      logger.error('Error listing battle permissions:', error);
      return {
        success: false,
        message: '❌ Erreur lors de la récupération des permissions !',
        permissions: []
      };
    }
  }

  // ============ FONCTIONS UTILITAIRES ============

  /**
   * Invalide le cache des permissions pour un utilisateur
   */
  private async invalidatePermissionCache(discordId: string): Promise<void> {
    if (this.cacheService) {
      try {
        await this.cacheService.delete(`battle_permission:${discordId}`);
      } catch (error) {
        logger.warn('Failed to invalidate permission cache:', error);
      }
    }
  }

  /**
   * Met en cache le statut des permissions (optionnel)
   */
  private async cachePermissionStatus(discordId: string, canStart: boolean): Promise<void> {
    if (this.cacheService) {
      try {
        await this.cacheService.set(
          `battle_permission:${discordId}`,
          JSON.stringify({ canStart, cachedAt: Date.now() }),
          300 // 5 minutes
        );
      } catch (error) {
        logger.warn('Failed to cache permission status:', error);
      }
    }
  }

  /**
   * Récupère le statut depuis le cache
   */
  private async getCachedPermissionStatus(discordId: string): Promise<boolean | null> {
    if (!this.cacheService) return null;

    try {
      const cached = await this.cacheService.get(`battle_permission:${discordId}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Cache valide pendant 5 minutes
        if (Date.now() - data.cachedAt < 300000) {
          return data.canStart;
        }
      }
    } catch (error) {
      logger.warn('Failed to get cached permission status:', error);
    }

    return null;
  }

  /**
   * Compte le nombre total d'utilisateurs avec permissions
   */
  async getPermissionStats(): Promise<{ total: number; active: number; }> {
    try {
      const [total, active] = await Promise.all([
        this.databaseService.client.battlePermission.count(),
        this.databaseService.client.battlePermission.count({
          where: { isActive: true }
        })
      ]);

      return { total, active };
    } catch (error) {
      logger.error('Error getting permission stats:', error);
      return { total: 0, active: 0 };
    }
  }

  /**
   * Nettoie les permissions expirées (si vous voulez ajouter une logique d'expiration)
   */
  async cleanupExpiredPermissions(): Promise<void> {
    try {
      // Cette fonction peut être utilisée pour nettoyer les permissions expirées
      // Si vous décidez d'ajouter une logique d'expiration automatique
      logger.info('Permission cleanup completed');
    } catch (error) {
      logger.error('Error during permission cleanup:', error);
    }
  }
}