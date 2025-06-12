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

    const dollarBalance = await activityService.getUserDollarBalance(interaction.user.id);

    if (!user) {
      // Create user if doesn't exist
      await databaseService.client.user.create({
        data: {
          discordId: interaction.user.id,
          username: interaction.user.displayName || interaction.user.username,
          tokens: 100.0
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('🎮 Profil de Mineur - Nouveau joueur!')
        .setDescription(`Bienvenue ${interaction.user.displayName}!`)
        .addFields(
          { name: '💰 Tokens', value: '100.00', inline: true },
          { name: '💵 Dollars', value: `${dollarBalance.toFixed(2)}$`, inline: true },
          { name: '⛏️ Machines', value: '0', inline: true },
          { name: '📊 Niveau', value: '1', inline: true },
          { name: '🏆 Expérience', value: '0 XP', inline: true },
          { name: '📈 Total miné', value: '0.00 tokens', inline: true }
        )
        .setFooter({ text: '💡 Envoyez des messages pour gagner des dollars!' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Create profile embed
    const embed = new EmbedBuilder()
      .setColor(user.tokens > 1000 ? 0xFFD700 : 0x00AE86)
      .setTitle(`🎮 Profil de ${user.username}`)
      .setDescription(user.tokens > 1000 ? '🔥 Mineur expérimenté!' : '⛏️ Mineur en développement')
      .addFields(
        { name: '💰 Tokens', value: user.tokens.toFixed(2), inline: true },
        { name: '💵 Dollars', value: `${dollarBalance.toFixed(2)}$`, inline: true },
        { name: '⛏️ Machines', value: user.machines.length.toString(), inline: true },
        { name: '📊 Niveau', value: user.level.toString(), inline: true },
        { name: '🏆 Expérience', value: `${user.experience} XP`, inline: true },
        { name: '📈 Total miné', value: `${user.totalMined.toFixed(2)} tokens`, inline: true },
        { name: '⚔️ Batailles', value: `${user.battlesWon}W / ${user.battlesLost}L`, inline: true },
        { name: '🔥 Statut', value: user.miningActive ? '⛏️ En minage' : '😴 Inactif', inline: true },
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