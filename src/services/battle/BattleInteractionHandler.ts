import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { DatabaseService } from '../database/DatabaseService';
import { BattleService } from './BattleService';
import { currentBattle } from '../../commands/admin/admin-battle';
import { logger } from '../../utils/logger';

export class BattleInteractionHandler {
  private databaseService: DatabaseService;
  private battleService: BattleService;

  constructor(databaseService: DatabaseService, cacheService: any) {
    this.databaseService = databaseService;
    this.battleService = new BattleService(databaseService, cacheService);
  }

  async handleBattleInteraction(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    try {
      // Assurer que l'utilisateur existe en base
      await this.databaseService.ensureUserExists(interaction.user.id, interaction.user.username);

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

    // Vérifier si la bataille est pleine
    if (currentBattle.participants.length >= currentBattle.maxPlayers) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🚫 Server Full')
          .setDescription('Cette bataille est complète !\n\n*"No more connections available. Try again later."*')
          .setTimestamp()]
      });
      return;
    }

    // Tenter de rejoindre
    const result = await this.battleService.joinBattle(interaction.user.id, battleId);

    if (!result.success) {
      const failEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🚫 Join Failed')
        .setDescription(`**Access denied !**\n\n${result.message}`)
        .addFields([
          {
            name: '💡 Troubleshooting',
            value: '• Check your token balance\n• Wait for cooldown to expire\n• Contact admin if issue persists',
            inline: false
          }
        ])
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

    // Obtenir le niveau de l'utilisateur pour calculer les frais
    const user = await this.databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id }
    });
    const entryFee = user ? Math.max(10, (user.level || 1) * 5) : 10;

    const successEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Welcome to the Arena !')
      .setDescription(`
${entryMessage}

**🎮 Connection successful !**
Entry fee paid: **${entryFee} tokens**

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
          value: `${currentBattle.participants.length}/${currentBattle.maxPlayers}`,
          inline: true
        },
        {
          name: '💰 Prize Pool',
          value: `${result.battleInfo?.prizePool || 0} tokens`,
          inline: true
        }
      ])
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    // Annoncer dans le canal principal
    try {
      const channel = interaction.channel;
      if (channel?.isTextBased()) {
        const announceEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setDescription(`${entryMessage}\n\n*A new warrior enters the digital battlefield !*`)
          .setFooter({ text: `${currentBattle.participants.length}/${currentBattle.maxPlayers} participants` })
          .setTimestamp();

        await channel.send({ embeds: [announceEmbed] });

        // Mettre à jour le message principal
        const originalMessage = await channel.messages.fetch(currentBattle.messageId);
        if (originalMessage && originalMessage.embeds[0]) {
          const updatedEmbed = new EmbedBuilder(originalMessage.embeds[0].toJSON())
            .setFields(
              {
                name: '🏆 Prize Pool',
                value: `${result.battleInfo?.prizePool || 0} tokens`,
                inline: true
              },
              {
                name: '👥 Participants',
                value: `${currentBattle.participants.length}/${currentBattle.maxPlayers}`,
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

    logger.info(`User ${interaction.user.id} joined battle ${battleId} via button`);
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

    const battleInfo = await this.battleService.getBattleInfo(battleId);
    
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
      .setDescription('**Detailed combat node analysis**')
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
          value: `${battleInfo.participants}/${battleInfo.maxPlayers}`,
          inline: true
        },
        {
          name: '💰 Total Rewards',
          value: `${battleInfo.prizePool} tokens`,
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
          name: '🏆 Prize Distribution',
          value: '🥇 50% • 🥈 25% • 🥉 15%\n🏅 4th-6th: 3.33% each',
          inline: true
        }
      ])
      .setTimestamp();

    // Entry requirements
    if (currentBattle.status === 'registration') {
      try {
        const user = await this.databaseService.client.user.findUnique({
          where: { discordId: interaction.user.id }
        });
        
        const entryFee = user ? Math.max(10, (user.level || 1) * 5) : 10;
        const hasEnoughTokens = user ? user.tokens >= entryFee : false;
        
        infoEmbed.addFields([
          {
            name: '💳 Your Entry Fee',
            value: `${entryFee} tokens ${hasEnoughTokens ? '✅' : '❌'}`,
            inline: true
          },
          {
            name: '💰 Your Balance',
            value: user ? `${user.tokens.toFixed(2)} tokens` : 'Unknown',
            inline: true
          },
          {
            name: '✅ Eligible',
            value: hasEnoughTokens ? 'Ready to fight !' : 'Insufficient funds',
            inline: true
          }
        ]);
      } catch (error) {
        logger.error('Error getting user info for battle details:', error);
      }
    }

    // Combat simulation info
    infoEmbed.addFields([
      {
        name: '⚔️ Combat System',
        value: 'Auto-battle with real-time events\nBased on level, tokens, and luck\nEpic roleplay narration included',
        inline: false
      },
      {
        name: '🎭 Battle Theme',
        value: '💻 **Cyber Mining Warfare**\nHacking, mining, and digital chaos !\nSerious, funny, and bizarre events',
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
  databaseService: DatabaseService,
  cacheService: any
): Promise<void> {
  const handler = new BattleInteractionHandler(databaseService, cacheService);
  await handler.handleBattleInteraction(interaction);
}
