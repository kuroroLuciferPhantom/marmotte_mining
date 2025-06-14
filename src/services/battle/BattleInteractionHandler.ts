import { ButtonInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { currentBattle } from '../../commands/admin/admin-battle';

export class BattleInteractionHandler {
  private databaseService: any;
  private cacheService: any;

  constructor(databaseService: any, cacheService: any) {
    this.databaseService = databaseService;
    this.cacheService = cacheService;
  }

  async handleBattleInteraction(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    try {
      // Assurer que l'utilisateur existe en base
      await this.ensureUserExists(interaction.user.id, interaction.user.username);

      if (customId.startsWith('join_battle_')) {
        await this.handleJoinButton(interaction);
      } else if (customId.startsWith('info_battle_')) {
        await this.handleInfoButton(interaction);
      } else {
        await interaction.reply({
          content: '❌ Interaction non reconnue !',
          ephemeral: true
        });
      }

    } catch (error) {
      logger.error('Error handling battle interaction:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('💥 System Error !')
        .setDescription('Exception caught in battle handler !\n\n```\nError: INTERACTION_FAILED\nStack trace: cosmic.ray.interference\n```')
        .setTimestamp();

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  // 🆕 Fonction améliorée pour créer/vérifier l'utilisateur
  private async ensureUserExists(discordId: string, username: string) {
    try {
      let user = await this.databaseService.client.user.findUnique({
        where: { discordId }
      });

      if (!user) {
        user = await this.databaseService.client.user.create({
          data: {
            discordId,
            username,
            tokens: 100.0,
            dollars: 0.0
          }
        });
        logger.info(`Created new user: ${username} (${discordId})`);
      }

      return user;
    } catch (error) {
      logger.error('Error ensuring user exists:', error);
      throw error;
    }
  }

  private async handleJoinButton(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const battleId = interaction.customId.replace('join_battle_', '');

    // Vérifications de base
    if (!currentBattle || currentBattle.id !== battleId) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Battle Not Found')
          .setDescription('Cette bataille n\'existe plus ou a expiré.\n\n*"Like tears in rain... time to die." - Blade Runner*')
          .setTimestamp()]
      });
      return;
    }

    if (currentBattle.status !== 'registration') {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle('⚠️ Registration Closed')
          .setDescription(`Les inscriptions sont fermées !\n\nStatut actuel: ${this.getStatusText(currentBattle.status)}`)
          .setTimestamp()]
      });
      return;
    }

    // Vérifier si déjà inscrit
    if (currentBattle.participants.includes(interaction.user.id)) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle('⚠️ Already Connected')
          .setDescription(`Tu es déjà dans cette bataille, ${interaction.user.username} !\n\n*"You're already in the matrix, Neo..."*`)
          .setTimestamp()]
      });
      return;
    }

    // 🆕 Plus de vérification de limite car places illimitées (999)

    // Créer le BattleService dynamiquement avec le nouveau service
    const { BattleService } = await import('./BattleService');
    const battleService = new BattleService(this.databaseService, this.cacheService);

    // 🆕 Utiliser l'ID interne de l'utilisateur au lieu de l'ID Discord
    const user = await this.databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id }
    });

    if (!user) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ User Not Found')
          .setDescription('**Erreur de profil !**\n\nVotre compte n\'a pas pu être créé. Réessayez dans quelques instants.')
          .setTimestamp()]
      });
      return;
    }

    // Tenter de rejoindre avec l'ID interne
    const result = await battleService.joinBattle(user.id, battleId);

    if (!result.success) {
      const failEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🚫 Join Failed')
        .setDescription(`**Access denied !**\n\n${result.message}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [failEmbed] });
      return;
    }

    // Succès ! Ajouter aux participants
    currentBattle.participants.push(interaction.user.id);

    // Messages d'entrée épiques
    const entryMessages = [
      `🔌 **${interaction.user.username}** branche ses rigs et rejoint la ferme de mining !`,
      `💻 **${interaction.user.username}** hack son chemin dans le réseau de la bataille !`,
      `⚡ **${interaction.user.username}** overclocke ses GPUs et entre dans l'arène !`,
      `🌐 **${interaction.user.username}** se connecte au pool de bataille avec un ping parfait !`,
      `🔧 **${interaction.user.username}** configure ses ASICs pour la guerre totale !`,
      `💾 **${interaction.user.username}** télécharge les scripts de combat... 100% complete !`,
      `🎯 **${interaction.user.username}** scan le réseau et trouve une faille pour entrer !`,
      `🚀 **${interaction.user.username}** déploie ses bots de mining dans la bataille !`
    ];

    const entryMessage = entryMessages[Math.floor(Math.random() * entryMessages.length)];

    // 🆕 Pas de frais d'entrée !
    const successEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Welcome to the Arena !')
      .setDescription(`
${entryMessage}

**🎮 Connection successful !**
**🆓 ENTRÉE GRATUITE** - Nouveau système !

*"You are now part of the digital resistance..."*
      `)
      .addFields([
        {
          name: '🆔 Battle Node',
          value: `\`${battleId.slice(0, 8)}...\``,
          inline: true
        },
        {
          name: '👥 Connected Users',
          value: `${currentBattle.participants.length} warriors`,
          inline: true
        },
        {
          name: '🎁 Rewards',
          value: '1er: 100 tokens\n2e: 50 tokens\n3e: 25 tokens',
          inline: true
        }
      ])
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    // Annoncer dans le canal principal
    try {
      const channel = await interaction.client.channels.fetch(currentBattle.channelId);
      if (channel && 'send' in channel) {
        const textChannel = channel as TextChannel;
        
        const announceEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setDescription(`${entryMessage}\n\n*A new warrior enters the digital battlefield !*`)
          .setFooter({ text: `${currentBattle.participants.length} participants connectés` })
          .setTimestamp();

        await textChannel.send({ embeds: [announceEmbed] });

        // Mettre à jour le message principal
        const originalMessage = await textChannel.messages.fetch(currentBattle.messageId);
        if (originalMessage && originalMessage.embeds[0]) {
          const updatedEmbed = new EmbedBuilder(originalMessage.embeds[0].toJSON())
            .setFields(
              {
                name: '🏆 Récompenses',
                value: '1er: 100 tokens\n2e: 50 tokens\n3e: 25 tokens\n4e: 10 tokens\n5e: 5 tokens',
                inline: true
              },
              {
                name: '👥 Participants',
                value: `${currentBattle.participants.length} warriors\n+ 5 bots de test`,
                inline: true
              },
              {
                name: '⏳ Fin des inscriptions',
                value: `<t:${Math.floor(currentBattle.registrationEndTime.getTime() / 1000)}:R>`,
                inline: true
              }
            );

          await originalMessage.edit({ embeds: [updatedEmbed], components: originalMessage.components });
        }
      }
    } catch (error) {
      logger.error('Error announcing new participant:', error);
    }

    logger.info(`User ${interaction.user.id} joined battle ${battleId} via button - FREE ENTRY`);
  }

  private async handleInfoButton(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const battleId = interaction.customId.replace('info_battle_', '');

    if (!currentBattle || currentBattle.id !== battleId) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Battle Not Found')
          .setDescription('Cette bataille n\'existe plus.')
          .setTimestamp()]
      });
      return;
    }

    // Créer le BattleService dynamiquement
    const { BattleService } = await import('./BattleService');
    const battleService = new BattleService(this.databaseService, this.cacheService);
    
    const battleInfo = await battleService.getBattleInfo(battleId);
    
    if (!battleInfo) {
      await interaction.editReply('❌ Impossible de récupérer les informations de bataille !');
      return;
    }

    const timeLeft = currentBattle.registrationEndTime.getTime() - Date.now();
    const minutesLeft = Math.max(0, Math.floor(timeLeft / 1000 / 60));
    const secondsLeft = Math.max(0, Math.floor((timeLeft / 1000) % 60));

    const infoEmbed = new EmbedBuilder()
      .setTitle('📊 Battle Information System')
      .setColor(0x3498db)
      .setDescription('**Detailed combat node analysis - NEW SYSTEM**')
      .addFields([
        {
          name: '🆔 Battle ID',
          value: `\`${battleInfo.id}\``,
          inline: true
        },
        {
          name: '🎯 Status',
          value: this.getStatusText(currentBattle.status),
          inline: true
        },
        {
          name: '👥 Capacity',
          value: `${battleInfo.participants} warriors (illimité)`,
          inline: true
        },
        {
          name: '🆓 Entry Cost',
          value: '**GRATUIT** - Plus de frais !',
          inline: true
        },
        {
          name: '⏰ Registration Time',
          value: currentBattle.status === 'registration' && timeLeft > 0 ? 
                 `${minutesLeft}m ${secondsLeft}s left` : 
                 'Closed',
          inline: true
        },
        {
          name: '🏆 Fixed Rewards',
          value: '🥇 100 tokens\n🥈 50 tokens\n🥉 25 tokens\n🏅 4e: 10 tokens\n🏅 5e: 5 tokens',
          inline: true
        }
      ])
      .setTimestamp();

    // 🆕 Plus de vérification de frais car c'est gratuit
    if (currentBattle.status === 'registration') {
      try {
        const user = await this.databaseService.client.user.findUnique({
          where: { discordId: interaction.user.id }
        });
        
        infoEmbed.addFields([
          {
            name: '💳 Your Entry',
            value: 'FREE - No cost ! ✅',
            inline: true
          },
          {
            name: '💰 Your Balance',
            value: user ? `${user.tokens.toFixed(2)} tokens` : 'Unknown',
            inline: true
          },
          {
            name: '✅ Eligible',
            value: '✅ Ready to fight !',
            inline: true
          }
        ]);
      } catch (error) {
        logger.error('Error getting user info for battle details:', error);
      }
    }

    // 🆕 Nouvelles infos sur les événements aléatoires
    infoEmbed.addFields([
      {
        name: '⚔️ Combat System',
        value: 'Auto-battle with EPIC random events\n• 🌋 Apocalypse events (mass elimination)\n• ✨ Revival events (resurrect players)\n• 🚀 Power boost events',
        inline: false
      },
      {
        name: '🎲 Random Events',
        value: '• **Apocalypse** (10%): Elimine 30-60% des joueurs\n• **Résurrection** (10%): Ranime 1-3 joueurs\n• **Boost** (15%): Power-up cosmique\n• **Combat** (65%): Combat normal',
        inline: false
      },
      {
        name: '🎭 Battle Theme',
        value: '💻 **Cyber Mining Warfare**\nHacking, mining, et chaos numérique !\nÉvénements sérieux, drôles, et bizarres',
        inline: false
      }
    ]);

    await interaction.editReply({ embeds: [infoEmbed] });
  }

  private getStatusText(status: string): string {
    const statusMap = {
      'registration': '🟡 Registration Open',
      'starting': '🟠 Starting Soon',
      'active': '🔴 Combat Active',
      'finished': '✅ Completed'
    };
    return statusMap[status as keyof typeof statusMap] || '❓ Unknown';
  }
}

// Fonction utilitaire pour l'import depuis le CommandManager
export async function handleBattleButtonInteraction(
  interaction: ButtonInteraction,
  databaseService: any,
  cacheService: any
): Promise<void> {
  const handler = new BattleInteractionHandler(databaseService, cacheService);
  await handler.handleBattleInteraction(interaction);
}