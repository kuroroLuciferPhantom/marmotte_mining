// src/commands/game/battle.ts
import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, TextChannel, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('battle')
  .setDescription('⚔️ Lancer une bataille royale de mining (permission requise)')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('🚀 Créer une nouvelle bataille royale')
      .addIntegerOption(option =>
        option.setName('temps-inscription')
          .setDescription('Temps d\'inscription en minutes (5-30)')
          .setRequired(false)
          .setMinValue(5)
          .setMaxValue(30)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('join')
      .setDescription('🔥 Rejoindre la bataille en cours'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('info')
      .setDescription('📊 Informations sur la bataille actuelle'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('leaderboard')
      .setDescription('🏆 Classement des meilleurs warriors'));

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    await interaction.deferReply({ ephemeral: false });

    const subcommand = interaction.options.getSubcommand();
    const databaseService = services.get('database');
    const cacheService = services.get('cache');

    if (!databaseService) {
      throw new Error('Database service not available');
    }

    // Vérifier les permissions pour la sous-commande 'create'
    if (subcommand === 'create') {
      const { BattlePermissionService } = await import('../../services/battle/BattlePermissionService');
      const permissionService = new BattlePermissionService(databaseService, cacheService);
      
      const canStart = await permissionService.canUserStartBattle(interaction.user.id);
      
      if (!canStart) {
        const noPermissionEmbed = new EmbedBuilder()
          .setTitle('🚫 Accès Refusé')
          .setColor(0xff0000)
          .setDescription(`
**Vous n'avez pas la permission de lancer des battles !**

🔒 Seuls les utilisateurs autorisés peuvent créer des batailles royales.
Contactez un administrateur si vous pensez mériter cette permission.

**Vous pouvez quand même :**
• Rejoindre les battles existantes avec \`/battle join\`
• Consulter les infos avec \`/battle info\`
• Voir le classement avec \`/battle leaderboard\`
          `)
          .setFooter({ text: 'Tip: Soyez actif sur le serveur pour peut-être gagner cette permission !' })
          .setTimestamp();

        await interaction.editReply({ embeds: [noPermissionEmbed] });
        return;
      }
    }

    switch (subcommand) {
      case 'create':
        await handleCreateBattle(interaction, services);
        break;
      
      case 'join':
        await handleJoinBattle(interaction, services);
        break;
      
      case 'info':
        await handleBattleInfo(interaction, services);
        break;
      
      case 'leaderboard':
        await handleLeaderboard(interaction, services);
        break;
      
      default:
        await interaction.editReply('❌ Sous-commande non reconnue.');
    }

  } catch (error) {
    logger.error('Error in battle command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('💥 Erreur !')
      .setDescription('Une erreur s\'est produite lors de l\'exécution de la commande.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleCreateBattle(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  // Importer l'état des battles depuis admin-battle
  const { currentBattle } = await import('../admin/admin-battle');
  
  // Vérifier qu'il n'y a pas déjà une bataille
  if (currentBattle && currentBattle.status !== 'finished') {
    const embed = new EmbedBuilder()
      .setTitle('⚔️ Bataille Déjà Active !')
      .setColor(0xff6600)
      .setDescription(`
**Il y a déjà une bataille en cours !**

🔥 Utilisez \`/battle join\` pour rejoindre la bataille actuelle
📊 Ou \`/battle info\` pour voir les détails

*"One battle at a time, warrior..."*
      `)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const registrationTime = interaction.options.getInteger('temps-inscription') || 15;
  
  const databaseService = services.get('database');
  const cacheService = services.get('cache');
  
  // Créer le BattleService dynamiquement
  const { BattleService } = await import('../../services/battle/BattleService');
  const battleService = new BattleService(databaseService, cacheService);
  
  const result = await battleService.createBattle(999); // Pas de limite
  
  if (!result.success || !result.battleId) {
    await interaction.editReply('❌ Impossible de créer la bataille !');
    return;
  }

  const registrationEndTime = new Date(Date.now() + registrationTime * 60 * 1000);

  setTimeout(async () => {
    try {
      logger.info(`⏰ [AutoStart] Timer expired for battle ${result.battleId}, starting battle`);
      
      // Vérifier si la bataille existe encore et est en attente
      const battleInfo = await battleService.getBattleInfo(result.battleId!);
      if (battleInfo && battleInfo.status === 'WAITING' && battleInfo.participants > 0) {
        logger.info(`🚀 [AutoStart] Starting battle ${result.battleId} with ${battleInfo.participants} participants`);
        await battleService.startBattle(result.battleId!);
        
        // Annoncer le démarrage dans le canal
        const channel = interaction.channel as TextChannel;
        if (channel) {
          const startEmbed = new EmbedBuilder()
            .setTitle('⚔️ BATAILLE COMMENCÉE !')
            .setColor(0xff0000)
            .setDescription(`
**🚨 Temps d'inscription écoulé !**

La bataille royale démarre avec **${battleInfo.participants} guerriers** !
Que le meilleur warrior gagne ! 🏆

*"Let the digital carnage begin..."*
            `)
            .addFields([
              {
                name: '👥 Participants',
                value: `${battleInfo.participants} warriors`,
                inline: true
              },
              {
                name: '💰 Prize Pool',
                value: `${battleInfo.prizePool} tokens`,
                inline: true
              },
              {
                name: '⏱️ Durée estimée',
                value: '2-5 minutes',
                inline: true
              }
            ])
            .setTimestamp();

          await channel.send({ embeds: [startEmbed] });
        }
      } else if (battleInfo && battleInfo.participants === 0) {
        logger.info(`❌ [AutoStart] Cancelling battle ${result.battleId} - no participants`);
        await battleService.cancelBattle(result.battleId!);
        
        // Annoncer l'annulation
        const channel = interaction.channel as TextChannel;
        if (channel) {
          const cancelEmbed = new EmbedBuilder()
            .setTitle('💤 Bataille Annulée')
            .setColor(0x95a5a6)
            .setDescription('La bataille a été annulée faute de participants.\n\n*"No warriors showed up to the digital battlefield..."*')
            .setTimestamp();

          await channel.send({ embeds: [cancelEmbed] });
        }
      }
    } catch (error) {
      logger.error(`❌ [AutoStart] Error starting battle ${result.battleId}:`, error);
    }
  }, registrationTime * 60 * 1000); // Timer en millisecondes
  
  // Créer l'annonce publique
  const channel = interaction.channel as TextChannel;
  
  const announceEmbed = new EmbedBuilder()
    .setTitle('⚔️ BATAILLE ROYALE LANCÉE ! ⚔️')
    .setColor(0x00ff00)
    .setDescription(`
**🎯 ${interaction.user.username} défie la communauté !**

Une nouvelle guerre des hashrates commence ! Qui osera affronter ce warrior expérimenté ?

**💻 NOUVELLES RÈGLES :**
• **🆓 ENTRÉE GRATUITE** - Plus de frais d'inscription !
• **♾️ PLACES ILLIMITÉES** - Tout le monde peut participer !
• **🎁 Récompenses fixes** - Top 5 gagnent des tokens !
• **🎲 Événements aléatoires** - Apocalypse, résurrections, et plus !

**⏰ TEMPS LIMITÉ :**
Vous avez **${registrationTime} minutes** pour vous inscrire !
    `)
    .addFields([
      {
        name: '🏆 Récompenses',
        value: '1er: 100 tokens\n2e: 50 tokens\n3e: 25 tokens\n4e: 10 tokens\n5e: 5 tokens',
        inline: true
      },
      {
        name: '👥 Participants',
        value: '5 bots déjà inscrits\n+ joueurs réels',
        inline: true
      },
      {
        name: '⏳ Fin des inscriptions',
        value: `<t:${Math.floor(registrationEndTime.getTime() / 1000)}:R>`,
        inline: true
      }
    ])
    .setFooter({ text: `Battle créée par ${interaction.user.username} | ID: ${result.battleId.slice(0, 8)}... | 5 bots de test inclus` })
    .setTimestamp();

  // Boutons d'interaction
  const joinButton = new ButtonBuilder()
    .setCustomId(`join_battle_${result.battleId}`)
    .setLabel('🔥 REJOINDRE LE COMBAT')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('⚔️');

  const infoButton = new ButtonBuilder()
    .setCustomId(`info_battle_${result.battleId}`)
    .setLabel('📊 Détails')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('💻');

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(joinButton, infoButton);

  const message = await channel.send({ 
    embeds: [announceEmbed],
    components: [row],
    content: `🚨 **DÉFI LANCÉ !** 🚨 ${interaction.user.username} a créé une bataille royale ! Qui sera le dernier debout ?`
  });

  // Confirmation pour le créateur
  const confirmEmbed = new EmbedBuilder()
    .setTitle('✅ Bataille Créée avec Succès !')
    .setColor(0x00ff00)
    .setDescription(`
**Votre bataille a été lancée !**

🆔 **Battle ID :** \`${result.battleId}\`
♾️ **Participants :** Illimités
⏰ **Durée inscription :** ${registrationTime} minutes
🤖 **Bots de test :** 5 utilisateurs simulés ajoutés

La bataille a été annoncée publiquement ! Que la guerre commence ! 🔥
    `)
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
  
  logger.info(`User ${interaction.user.id} created battle ${result.battleId} with unlimited players`);
}

// Fonctions pour les autres sous-commandes (join, info, leaderboard)
async function handleJoinBattle(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  const embed = new EmbedBuilder()
    .setTitle('🔥 Rejoindre une Bataille')
    .setColor(0x3498db)
    .setDescription('Utilisez les boutons sur l\'annonce de bataille pour rejoindre !')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleBattleInfo(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  // Importer l'état des battles depuis admin-battle
  const { currentBattle } = await import('../admin/admin-battle');
  
  if (!currentBattle) {
    const embed = new EmbedBuilder()
      .setTitle('📭 Aucune Bataille Active')
      .setColor(0x95a5a6)
      .setDescription('Aucune bataille n\'est actuellement en cours.\nUtilisez `/battle create` pour en lancer une !')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const timeLeft = currentBattle.registrationEndTime.getTime() - Date.now();
  const minutesLeft = Math.max(0, Math.floor(timeLeft / 1000 / 60));

  const embed = new EmbedBuilder()
    .setTitle('📊 Informations de la Bataille')
    .setColor(0x3498db)
    .addFields([
      {
        name: '🆔 Battle ID',
        value: `\`${currentBattle.id.slice(0, 8)}...\``,
        inline: true
      },
      {
        name: '📊 Statut',
        value: getStatusDisplay(currentBattle.status),
        inline: true
      },
      {
        name: '👥 Participants',
        value: `${currentBattle.participants.length}/${currentBattle.maxPlayers}`,
        inline: true
      },
      {
        name: '⏰ Temps Restant',
        value: currentBattle.status === 'registration' ? 
               `${minutesLeft} minutes` : 
               'N/A',
        inline: true
      }
    ])
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 Leaderboard des Warriors')
    .setColor(0xffd700)
    .setDescription('Classement bientôt disponible !')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

function getStatusDisplay(status: string): string {
  switch (status) {
    case 'registration': return '🟡 Inscriptions ouvertes';
    case 'starting': return '🟠 Démarrage imminent';
    case 'active': return '🔴 Combat en cours';
    case 'finished': return '✅ Terminée';
    default: return '❓ Inconnu';
  }
}