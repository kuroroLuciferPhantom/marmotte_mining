// src/commands/game/salary.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ActivityService } from '../../services/activity/ActivityService';

export const data = new SlashCommandBuilder()
  .setName('salaire')
  .setDescription('💰 Récupérer votre salaire hebdomadaire (disponible chaque semaine)');

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    await interaction.deferReply();

    const activityService = services.get('activity') as ActivityService;
    const userId = interaction.user.id;

    // Vérifier d'abord si le salaire est disponible
    const availability = await activityService.canClaimSalary(userId);

    if (!availability.canClaim && availability.nextAvailable) {
      const timeUntilNext = availability.nextAvailable.getTime() - Date.now();
      const daysLeft = Math.ceil(timeUntilNext / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.ceil((timeUntilNext % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      const waitEmbed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('⏰ Salaire Déjà Récupéré')
        .setDescription('Vous avez déjà récupéré votre salaire cette semaine !')
        .addFields(
          {
            name: '📅 Prochain Salaire Disponible',
            value: `<t:${Math.floor(availability.nextAvailable.getTime() / 1000)}:F>`,
            inline: false
          },
          {
            name: '⏱️ Temps Restant',
            value: `${daysLeft > 0 ? `${daysLeft} jour(s) ` : ''}${hoursLeft} heure(s)`,
            inline: true
          }
        )
        .setFooter({ text: 'Le salaire se recharge automatiquement chaque semaine' })
        .setTimestamp();

      await interaction.editReply({ embeds: [waitEmbed] });
      return;
    }

    // Récupérer le salaire
    const result = await activityService.claimWeeklySalary(userId);

    if (!result.success) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF4757')
        .setTitle('❌ Erreur')
        .setDescription(result.error || 'Une erreur est survenue lors de la récupération du salaire')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // Obtenir les stats d'activité pour afficher les détails
    const weeklyStats = await (activityService as any).getWeeklyActivityStats(userId);
    const activityBonus = (activityService as any).calculateActivityBonus(weeklyStats);
    const baseSalary = 250;

    const successEmbed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('💰 Salaire Récupéré avec Succès !')
      .setDescription(`Félicitations ! Vous avez reçu votre salaire hebdomadaire.`)
      .addFields(
        {
          name: '💵 Salaire Total',
          value: `**${result.amount?.toFixed(2)}$**`,
          inline: true
        },
        {
          name: '📊 Détails',
          value: `• Salaire de base: ${baseSalary}$\n• Bonus d'activité: +${activityBonus}$`,
          inline: true
        },
        {
          name: '📈 Votre Activité Cette Semaine',
          value: `• Messages envoyés: **${weeklyStats.messages}**\n• Réactions données: **${weeklyStats.reactions}**\n• Jours actifs: **${weeklyStats.activeDays}/7**`,
          inline: false
        },
        {
          name: '🎯 Bonus d\'Activité',
          value: getActivityBonusExplanation(weeklyStats, activityBonus),
          inline: false
        },
        {
          name: '📅 Prochain Salaire',
          value: `<t:${Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000)}:R>`,
          inline: true
        }
      )
      .setFooter({ text: 'Restez actif pour maximiser vos bonus !' })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

  } catch (error) {
    console.error('Error in salary command:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor('#FF4757')
      .setTitle('❌ Erreur')
      .setDescription('Une erreur inattendue est survenue. Veuillez réessayer plus tard.')
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

function getActivityBonusExplanation(stats: { messages: number; reactions: number; activeDays: number }, bonus: number): string {
  const explanations = [];

  // Bonus jours actifs
  const dayBonus = Math.min(stats.activeDays * 7, 50);
  if (dayBonus > 0) {
    explanations.push(`• Jours actifs: +${dayBonus}$ (${stats.activeDays} × 7$)`);
  }

  // Bonus activité
  const totalActivity = stats.messages + (stats.reactions * 2);
  let activityBonus = 0;
  
  if (totalActivity >= 350) {
    activityBonus = 100;
    explanations.push(`• Super actif (350+ actions): +100$`);
  } else if (totalActivity >= 200) {
    activityBonus = 50;
    explanations.push(`• Très actif (200+ actions): +50$`);
  } else if (totalActivity >= 100) {
    activityBonus = 25;
    explanations.push(`• Actif (100+ actions): +25$`);
  }

  if (explanations.length === 0) {
    return '• Aucun bonus cette semaine\n• Soyez plus actif pour gagner des bonus !';
  }

  explanations.push(`\n**Total Bonus: +${bonus}$**`);
  return explanations.join('\n');
}