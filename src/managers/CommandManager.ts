import { Client, Collection, REST, Routes, ButtonInteraction } from 'discord.js';
import { handleLeaderboardButtonInteraction } from '../services/leaderboard/LeaderboardInteractionHandler';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class CommandManager {
  private client: Client;
  private services: Map<string, any>;
  private commands: Collection<string, any>;

  constructor(client: Client, services: Map<string, any>) {
    this.client = client;
    this.services = services;
    this.commands = new Collection();
  }

  async loadCommands(): Promise<void> {
    logger.info('🔧 Loading slash commands...');

    const commandsPath = path.join(__dirname, '..', 'commands');
    
    // Load commands from subdirectories - AJOUT DU DOSSIER ADMIN
    const commandFolders = ['game', 'utility', 'admin'];
    
    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      
      if (!fs.existsSync(folderPath)) {
        logger.warn(`Command folder ${folder} does not exist`);
        continue;
      }

      const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

      for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        
        try {
          const command = await import(filePath);
          
          if ('data' in command && 'execute' in command) {
            this.commands.set(command.data.name, command);
            logger.info(`✅ Loaded command: ${command.data.name}`);
          } else {
            logger.warn(`⚠️ Command ${file} is missing required "data" or "execute" property`);
          }
        } catch (error) {
          logger.error(`❌ Error loading command ${file}:`, error);
        }
      }
    }

    logger.info(`📋 Loaded ${this.commands.size} commands total`);
  }

  async deployCommands(): Promise<void> {
    try {
      logger.info('🚀 Deploying slash commands...');

      const commandsData = Array.from(this.commands.values()).map(command => command.data.toJSON());

      const rest = new REST().setToken(config.discord.token);

      if (config.discord.guildId) {
        // Deploy to specific guild (faster for development)
        await rest.put(
          Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
          { body: commandsData }
        );
        logger.info(`✅ Successfully deployed ${commandsData.length} guild commands`);
      } else {
        // Deploy globally (takes up to 1 hour)
        await rest.put(
          Routes.applicationCommands(config.discord.clientId),
          { body: commandsData }
        );
        logger.info(`✅ Successfully deployed ${commandsData.length} global commands`);
      }

    } catch (error) {
      logger.error('❌ Error deploying commands:', error);
      throw error;
    }
  }

  setupCommandHandler(): void {
    this.client.on('interactionCreate', async (interaction) => {
      // Gestion des slash commands
      if (interaction.isChatInputCommand()) {
        const command = this.commands.get(interaction.commandName);

        if (!command) {
          logger.warn(`Unknown command: ${interaction.commandName}`);
          await interaction.reply({
            content: '❌ Commande inconnue.',
            ephemeral: true
          });
          return;
        }

        try {
          logger.info(`🎮 Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
          await command.execute(interaction, this.services);
        } catch (error) {
          logger.error(`Error executing command ${interaction.commandName}:`, error);
          
          const errorMessage = '❌ Une erreur est survenue lors de l\'exécution de cette commande.';
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        }
      }
      
      else if (interaction.isButton()) {
        const customId = interaction.customId;
        
        if (customId.startsWith('join_battle_') || customId.startsWith('info_battle_')) {
          await this.handleBattleButtonInteraction(interaction as ButtonInteraction);
        }
        // Ici tu peux ajouter d'autres boutons existants si tu en as
      }

      if ((interaction.isButton() && interaction.customId === 'leaderboard_refresh') ||
        (interaction.isStringSelectMenu() && interaction.customId === 'leaderboard_navigation')) {
      
        const databaseService = this.services.get('database');
        if (!databaseService) {
          await interaction.reply({ 
            content: '❌ Service de base de données indisponible.', 
            ephemeral: true 
          });
          return;
        }
        
        await handleLeaderboardButtonInteraction(interaction, databaseService);
        return;
      }
    });

    logger.info('✅ Command handler setup complete');
  }


  private async handleBattleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    try {
      // Import dynamique pour éviter les dépendances circulaires
      const { handleBattleButtonInteraction } = await import('../services/battle/BattleInteractionHandler');
      
      const databaseService = this.services.get('database');
      const cacheService = this.services.get('cache');
      
      await handleBattleButtonInteraction(interaction, databaseService, cacheService);
      
    } catch (error) {
      logger.error('Error handling battle button interaction:', error);
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ Erreur lors du traitement de l\'interaction.'
        });
      } else {
        await interaction.reply({
          content: '❌ Erreur lors du traitement de l\'interaction.',
          ephemeral: true
        });
      }
    }
  }

  private setupInteractionHandlers(): void {
    this.client.on('interactionCreate', async (interaction: any) => {
      try {
        // Routage vers les handlers spécialisés
        if (this.isLeaderboardInteraction(interaction)) {
          const { handleLeaderboardButtonInteraction } = await import('../services/leaderboard/LeaderboardInteractionHandler');
          await handleLeaderboardButtonInteraction(interaction, this.services.get('database'));
          return;
        }

        if (this.isBattleInteraction(interaction)) {
          const { handleBattleButtonInteraction } = await import('../services/battle/BattleInteractionHandler');
          await handleBattleButtonInteraction(interaction, this.services.get('database'), this.services.get('cache'));
          return;
        }

        // ... autres interactions existantes ...
      } catch (error) {
        logger.error('Error in interaction handler:', error);
      }
    });
  }

  // Méthodes de détection simples
  private isLeaderboardInteraction(interaction: any): boolean {
    return (interaction.isStringSelectMenu() && interaction.customId === 'leaderboard_navigation') ||
          (interaction.isButton() && interaction.customId === 'leaderboard_refresh');
  }

  private isBattleInteraction(interaction: any): boolean {
    return (interaction.isButton() && 
            (interaction.customId === 'battle_create_quick' ||
            interaction.customId.startsWith('battle_create_') ||
            interaction.customId.startsWith('join_battle_') ||
            interaction.customId.startsWith('info_battle_')));
  }


  getCommands(): Collection<string, any> {
    return this.commands;
  }
}

export default CommandManager;
