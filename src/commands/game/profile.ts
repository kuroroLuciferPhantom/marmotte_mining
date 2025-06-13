import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ActivityService } from '../../services/activity/ActivityService';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Affiche votre profil de mineur avec vos statistiques');

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const activityService = services.get('activity') as ActivityService;
    const databaseService = services.get('database');
    
    // Get user data
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { machines: true }
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
            value: '• 🏠 Lieu de départ: "Chambre chez maman"\n• 🔧 Machine gratuite: Basic Rig\n• ⚡ 100 points d\'énergie\n• 📚 Guide complet du jeu',
            inline: false
          }
        )
        .setFooter({ text: 'Tapez /register pour commencer!' })
        .setTimestamp();

      await interaction.reply({ embeds: [notRegisteredEmbed], ephemeral: true });
      return;
    }

    const dollarBalance = await activityService.getUserDollarBalance(interaction.user.id);

    // Create profile embed with location
    const embed = new EmbedBuilder()
      .setColor(user.tokens > 1000 ? 0xFFD700 : 0x00AE86)
      .setTitle(`🎮 Profil de ${user.username}`)
      .setDescription(user.tokens > 1000 ? '🔥 Mineur expérimenté!' : '⛏️ Mineur en développement')
      .addFields(
        { name: '📍 Lieu', value: user.location || 'Chambre chez maman', inline: true },
        { name: '💰 Tokens', value: user.tokens.toFixed(2), inline: true },
        { name: '💵 Dollars', value: `${dollarBalance.toFixed(2)}$`, inline: true },
        { name: '⛏️ Machines', value: user.machines.length.toString(), inline: true },
        { name: '📊 Niveau', value: user.level.toString(), inline: true },
        { name: '⚡ Énergie', value: `${user.energy}/100`, inline: true },
        { name: '🏆 Expérience', value: `${user.experience} XP`, inline: true },
        { name: '📈 Total miné', value: `${user.totalMined.toFixed(2)} tokens`, inline: true },
        { name: '⚔️ Batailles', value: `${user.battlesWon}W / ${user.battlesLost}L`, inline: true },
        { name: '🔥 Statut', value: user.miningActive ? '⛏️ En minage' : '😴 Inactif', inline: true },
        { name: '🛡️ Défenses', value: user.sabotagesBlocked > 0 ? `${user.sabotagesBlocked} bloquées` : 'Aucune', inline: true },
        { name: '📅 Membre depuis', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: 'Marmotte Mining • Utilisez /help pour voir toutes les commandes' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in profile command:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors de l\'affichage de votre profil.',
      ephemeral: true
    });
  }
}