import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ActivityService } from '../../services/activity/ActivityService';
import { HousingService } from '../../services/housing/HousingService';
import { DatabaseService } from '../../services/database/DatabaseService';
import { CardService } from '../../services/sabotage/CardService';


export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Affiche votre profil de mineur avec vos statistiques');

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const activityService = services.get('activity') as ActivityService;
    const databaseService = services.get('database') as DatabaseService;
    const cardService = services.get('cards') as CardService;

    // Create HousingService instance locally until it's added to dependency injection
    const housingService = new HousingService(databaseService.client);
    
    // Get user data
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { 
        machines: true,
        battleEntries: {
          include: {
            battle: true
          }
        }
      }
    });

    if (!user) {
      // Rediriger vers l'inscription au lieu de créer automatiquement
      const notRegisteredEmbed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('🚫 Compte non trouvé')
        .setDescription(`**${interaction.user.displayName || interaction.user.username}**, vous n'êtes pas encore inscrit au jeu!`)
        .addFields(
          {
            name: '🎮 Comment s\'inscrire?',
            value: 'Utilisez la commande `/register` pour créer votre compte de mineur et commencer l\'aventure!',
            inline: false
          },
          {
            name: '🎁 Ce que vous recevrez',
            value: '• 🏠 Lieu de départ: "Chambre chez maman"\n• 🔧 Machine gratuite: Basic Rig\n • 📚 Guide complet du jeu',
            inline: false
          }
        )
        .setFooter({ text: 'Tapez /register pour commencer!' })
        .setTimestamp();

      await interaction.reply({ embeds: [notRegisteredEmbed], ephemeral: true });
      return;
    }

    // Get housing information
    const housingInfo = housingService.getHousingInfo(user.housingType);
    const rentStatus = await housingService.getRentStatus(user.id);

    // Get battle statistics
    const completedBattles = user.battleEntries.filter(entry => 
      entry.battle.status === 'FINISHED'
    );
    const battlesWon = completedBattles.filter(entry => entry.position === 1).length;
    const battlesLost = completedBattles.filter(entry => entry.position !== null && entry.position > 1).length;

    // Count sabotage defenses (approximate from existing data)
    const sabotageDefenses = await databaseService.client.sabotageDefense.count({
      where: { 
        userId: user.id,
        success: true
      }
    });

    // 🆕 OBTENIR LES STATS XP ET MISSIONS
    let levelDisplay = `Niveau ${user.level}`;
    let xpDisplay = 'XP non disponible';
    let missionStatus = 'Statut inconnu';
    let nextMissionTime = 'N/A';
    
    try {
      // Stats XP
      const xpStats = await cardService.getUserXpStats(user.discordId);
      const progressPercent = Math.floor((xpStats.currentXp / xpStats.xpForNextLevel) * 100);
      const progressBar = '█'.repeat(Math.floor(progressPercent / 10)) + '░'.repeat(10 - Math.floor(progressPercent / 10));
      
      // Affichage niveau avec émojis selon le niveau
      let levelEmoji = '';
      if (xpStats.level >= 50) levelEmoji = '👑';
      else if (xpStats.level >= 20) levelEmoji = '⭐';
      else if (xpStats.level >= 10) levelEmoji = '🔥';
      
      levelDisplay = `Niveau ${xpStats.level} ${levelEmoji}`;
      xpDisplay = `${xpStats.currentXp}/${xpStats.xpForNextLevel} XP\n${progressBar} (${progressPercent}%)`;
      
      // Statut missions
      const cooldownStatus = await cardService.getUserCooldownStatus(user.discordId);
      const availableMissions = cooldownStatus.cooldowns.filter((c: any) => c.available).length;
      const totalMissions = cooldownStatus.cooldowns.length;
      
      if (availableMissions === totalMissions) {
        missionStatus = '✅ Toutes missions disponibles';
        nextMissionTime = 'Maintenant !';
      } else if (availableMissions > 0) {
        missionStatus = `🕐 ${availableMissions}/${totalMissions} missions prêtes`;
        const nextCooldown = cooldownStatus.cooldowns
          .filter((c: any) => !c.available)
          .sort((a: any, b: any) => a.timeRemaining - b.timeRemaining)[0];
        
        if (nextCooldown) {
          const hours = Math.floor(nextCooldown.timeRemaining / 60);
          const minutes = nextCooldown.timeRemaining % 60;
          nextMissionTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
        }
      } else {
        missionStatus = '⏰ Toutes missions en cooldown';
        const shortestCooldown = cooldownStatus.cooldowns
          .sort((a: any, b: any) => a.timeRemaining - b.timeRemaining)[0];
        
        if (shortestCooldown) {
          const hours = Math.floor(shortestCooldown.timeRemaining / 60);
          const minutes = shortestCooldown.timeRemaining % 60;
          nextMissionTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
        }
      }
    } catch (error) {
      console.error('Error getting XP/mission stats:', error);
      levelDisplay = `Niveau ${user.level}`;
      xpDisplay = 'Erreur lors du chargement XP';
      missionStatus = 'Utilisez /mission';
      nextMissionTime = 'N/A';
    }

    // Get recent mission count
    const recentMissions = await databaseService.client.missionAttempt.count({
      where: {
        userId: user.id,
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h
        }
      }
    });

    // Déterminer la couleur de l'embed selon le niveau
    let embedColor = 0x00AE86; // Vert par défaut
    if (user.level >= 50) embedColor = 0xFFD700; // Or pour niveau 50+
    else if (user.level >= 20) embedColor = 0xFF6B35; // Orange pour niveau 20+
    else if (user.level >= 10) embedColor = 0x4ECDC4; // Turquoise pour niveau 10+
    else if (user.tokens > 1000) embedColor = 0xFFD700; // Or pour les riches

    // Create profile embed with location
    const embed = new EmbedBuilder()
      .setColor(user.tokens > 1000 ? 0xFFD700 : 0x00AE86)
      .setTitle(`🎮 Profil de ${user.username}`)
      .setDescription(
        user.level >= 20 
          ? '🔥 Maître des missions clandestines !' 
          : user.level >= 10 
            ? '⭐ Agent expérimenté' 
            : '⛏️ Mineur en développement'
      )
      .addFields(
        { name: '📍 Lieu', value: user.location || 'Chambre chez maman', inline: true },
        { name: '🏠 Logement', value: `${housingInfo.emoji} ${housingInfo.name}`, inline: true },
        { name: '🔧 Capacité', value: `${user.machines.length}/${housingInfo.maxMachines} machines`, inline: true },
        { 
          name: '🎯 Niveau', 
          value: levelDisplay, 
          inline: true 
        },
        { 
          name: '📊 Expérience', 
          value: xpDisplay, 
          inline: true 
        },
        { 
          name: '🚀 Bonus Missions', 
          value: `+${(user.level - 1) * 3}% succès`, 
          inline: true 
        },
        
        // 🆕 SECTION MISSIONS (statut détaillé)
        { 
          name: '🕵️ Statut Missions', 
          value: `${missionStatus}\n📊 **24h**: ${recentMissions} missions`, 
          inline: true 
        },
        { 
          name: '⏰ Prochaine disponible', 
          value: nextMissionTime, 
          inline: true 
        },
        { 
          name: '📅 Dernière mission', 
          value: user.lastMission ? `<t:${Math.floor(user.lastMission.getTime() / 1000)}:R>` : 'Jamais', 
          inline: true 
        },
        { name: '💰 Tokens', value: user.tokens.toFixed(2), inline: true },
        { name: '💵 Dollars', value: `${user.dollars.toFixed(2)}$`, inline: true },
        { name: '⛏️ Machines', value: user.machines.length.toString(), inline: true },
        { name: '📈 Total miné', value: `${user.totalMined.toFixed(2)} tokens`, inline: true },
        { name: '⚔️ Batailles', value: `${battlesWon}W / ${battlesLost}L`, inline: true },
        { name: '🔥 Statut', value: user.miningActive ? '⛏️ En minage' : '😴 Inactif', inline: true },
        { name: '🛡️ Défenses', value: sabotageDefenses > 0 ? `${sabotageDefenses} bloquées` : 'Aucune', inline: true },
        { name: '💸 Loyer', value: rentStatus ? (rentStatus.isOverdue ? '🔴 En retard' : '🟢 À jour') : 'Maman qui régale', inline: true },
        { name: '📅 Membre depuis', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: 'Marmotte Mining • Utilisez /help pour voir toutes les commandes' })
      .setTimestamp();

      // 🆕 AJOUTER DES BADGES SPÉCIAUX SELON LE NIVEAU
    if (user.level >= 50) {
      embed.setThumbnail('https://cdn.discordapp.com/emojis/placeholder_crown.png'); // Couronne
    } else if (user.level >= 20) {
      embed.setThumbnail('https://cdn.discordapp.com/emojis/placeholder_star.png'); // Étoile
    } else {
      embed.setThumbnail(interaction.user.displayAvatarURL());
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in profile command:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors de l\'affichage de votre profil.',
      ephemeral: true
    });
  }
}
