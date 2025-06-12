import { Client, Collection, REST, Routes } from 'discord.js';
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
    
    // Load commands from subdirectories
    const commandFolders = ['game', 'utility'];
    
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
      if (!interaction.isChatInputCommand()) return;

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
    });

    logger.info('✅ Command handler setup complete');
  }

  getCommands(): Collection<string, any> {
    return this.commands;
  }
}

export default CommandManager;