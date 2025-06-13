import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ComponentType, ButtonStyle } from 'discord.js';
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
        { name: '🏭 Infiltration de Ferme (Facile)', value: MissionType.INFILTRATE_FARM },
        { name: '🏢 Piratage d\'Entrepôt (Moyen)', value: MissionType.HACK_WAREHOUSE },
        { name: '📋 Vol de Plans (Difficile)', value: MissionType.STEAL_BLUEPRINT },
        { name: '💥 Sabotage de Concurrent (Très Difficile)', value: MissionType.SABOTAGE_COMPETITOR },
        { name: '💾 Récupération de Données (Moyen)', value: MissionType.RESCUE_DATA }
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
        .setFooter({ text: '💡 Plus la mission est difficile, plus les récompenses sont importantes' });

      for (const mission of missions) {
        const difficultyStars = '⭐'.repeat(mission.config.difficulty);
        const statusEmoji = mission.available ? '✅' : '❌';
        const successRate = Math.floor(mission.config.baseSuccessRate * 100);
        
        embed.addFields({
          name: `${statusEmoji} ${mission.config.name} ${difficultyStars}`,
          value: `${mission.config.description}\n` +
                 `**Coût:** ${mission.config.energyCost} énergie\n` +
                 `**Taux de succès:** ~${successRate}%\n` +
                 `**Cooldown:** ${mission.config.cooldown}h\n` +
                 `${!mission.available ? `⏱️ ${mission.reason}` : ''}`,
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
        { name: '💰 Coût', value: `${result.config.energyCost} énergie`, inline: true },
        { name: '📊 Résultat', value: result.success ? 'Succès' : 'Échec', inline: true },
        { name: '⭐ Difficulté', value: '⭐'.repeat(result.config.difficulty), inline: true }
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
          case 'energy':
            rewardTexts.push(`⚡ ${reward.amount > 0 ? '+' : ''}${reward.amount} énergie`);
            break;
        }
      }
      
      embed.addFields({
        name: '🎁 Récompenses obtenues',
        value: rewardTexts.join('\n') || 'Aucune récompense cette fois',
        inline: false
      });
    }

    embed.setFooter({
      text: `Prochaine mission dans ${result.config.cooldown}h`
    })
    .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in mission command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Erreur de Mission')
      .setDescription(error.message || 'Une erreur inattendue s\'est produite.')
      .setFooter({ text: 'Vérifiez votre énergie et les cooldowns' });

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}