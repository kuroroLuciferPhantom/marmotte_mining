import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CardService } from '../../services/sabotage/CardService';
import { MissionType } from '@prisma/client';

export const data = new SlashCommandBuilder()
  .setName('mission')
  .setDescription('🕵️ Lancez-vous dans une mission clandestine pour obtenir des cartes')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Type de mission à effectuer')
      .addChoices(
        { name: '🏭 Infiltration de Ferme (Très facile - 2h cooldown)', value: MissionType.INFILTRATE_FARM },
        { name: '🏢 Piratage d\'Entrepôt (Facile - 4h cooldown)', value: MissionType.HACK_WAREHOUSE },
        { name: '💾 Récupération de Données (Moyen - 6h cooldown)', value: MissionType.RESCUE_DATA }
        { name: '📋 Vol de Plans (Difficile - 8h cooldown)', value: MissionType.STEAL_BLUEPRINT },
        
      )
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const cardService = services.get('cards') as CardService;
    const missionType = interaction.options.getString('type') as MissionType;

    // Si aucun type spécifié, afficher la liste des missions
    if (!missionType) {
      const missions = await cardService.getAvailableMissions(interaction.user.id);
      
      const embed = new EmbedBuilder()
        .setColor(0x8B4513)
        .setTitle('🕵️ Missions Clandestines Disponibles')
        .setDescription('Infiltrez, piratez et sabotez pour obtenir des cartes rares !\n\n**Sélectionnez une mission avec l\'option `type`**')
        .setFooter({ text: '💡 Plus la mission est difficile, plus le cooldown est long mais les récompenses meilleures' });

      for (const mission of missions) {
        const difficultyStars = '⭐'.repeat(mission.config.difficulty);
        const statusEmoji = mission.available ? '✅' : '⏰';
        const successRate = Math.floor(mission.config.baseSuccessRate * 100);
        
        let statusText = '';
        if (mission.available) {
          statusText = '🟢 **Disponible maintenant !**';
        } else if (mission.timeRemaining) {
          const hours = Math.floor(mission.timeRemaining / 60);
          const minutes = mission.timeRemaining % 60;
          const timeText = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
          statusText = `🔴 Cooldown: ${timeText}`;
        }
        
        embed.addFields({
          name: `${statusEmoji} ${mission.config.name} ${difficultyStars}`,
          value: `${mission.config.description}\n` +
                 `**Cooldown:** ${mission.config.cooldownHours}h\n` +
                 `**Taux de succès:** ~${successRate}%\n` +
                 `${statusText}`,
          inline: true
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Déférer la réponse car la mission peut prendre du temps
    await interaction.deferReply();

    // Tenter la mission
    const result = await cardService.attemptMission(interaction.user.id, missionType);

    // Créer l'embed de résultat
    const embed = new EmbedBuilder()
      .setColor(result.success ? 0x00FF00 : 0xFF4444)
      .setTitle(result.success ? '✅ Mission Réussie !' : '❌ Mission Échouée')
      .setDescription(`**${result.config.name}**\n\n${result.narrative}`)
      .addFields(
        { name: '⏰ Cooldown', value: `${result.config.cooldownHours}h`, inline: true },
        { name: '📊 Résultat', value: result.success ? 'Succès' : 'Échec', inline: true },
        { name: '⚠️ Difficulté', value: '⭐'.repeat(result.config.difficulty), inline: true }
      );

    if (result.success && result.rewards.length > 0) {
      const rewardTexts = [];
      for (const reward of result.rewards) {
        switch (reward.type) {
          case 'card':
            rewardTexts.push(`🃏 ${reward.cardType} (${reward.rarity})`);
            break;
          case 'fragments':
            rewardTexts.push(`🧩 ${reward.quantity}x ${reward.fragmentType.replace('_', ' ')}`);
            break;
          case 'tokens':
            rewardTexts.push(`💰 ${reward.amount} $7N1`);
            break;
        }
      }
      
      embed.addFields({
        name: '🎁 Récompenses obtenues',
        value: rewardTexts.join('\n') || 'Aucune récompense cette fois',
        inline: false
      });
    } else if (!result.success && result.rewards.length > 0) {
      // Récompenses de consolation pour échec
      const rewardTexts = [];
      for (const reward of result.rewards) {
        if (reward.type === 'tokens') {
          rewardTexts.push(`💰 ${reward.amount} $7N1 (consolation)`);
        }
      }
      
      if (rewardTexts.length > 0) {
        embed.addFields({
          name: '🎁 Récompenses de consolation',
          value: rewardTexts.join('\n'),
          inline: false
        });
      }
    }

    // Calculer la prochaine mission disponible
    const nextMission = new Date(Date.now() + result.config.cooldownHours * 60 * 60 * 1000);
    
    embed.addFields({
      name: '⏰ Prochaine mission',
      value: `<t:${Math.floor(nextMission.getTime() / 1000)}:R>`,
      inline: false
    });

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error: any) {
    console.error('Error in mission command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Erreur de Mission')
      .setDescription(error.message || 'Une erreur inattendue s\'est produite.')
      .setFooter({ text: 'Vérifiez vos cooldowns avec /cooldowns' });

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}