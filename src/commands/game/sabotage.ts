import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, User } from 'discord.js';
import { SabotageService } from '../../services/sabotage/SabotageService';
import { AttackType } from '@prisma/client';

export const data = new SlashCommandBuilder()
  .setName('sabotage')
  .setDescription('🔥 Lancez une attaque de sabotage contre un autre mineur')
  .addUserOption(option =>
    option
      .setName('cible')
      .setDescription('Le joueur à attaquer')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Type d\'attaque à utiliser')
      .addChoices(
        { name: '🦠 Virus Z3-Miner (-50% hashrate, 2h)', value: AttackType.VIRUS_Z3_MINER },
        { name: '⚡ Blackout Ciblé (pause mining, 20min)', value: AttackType.BLACKOUT_TARGETED },
        { name: '🔧 Recalibrage Forcé (-25% efficacité, 1h)', value: AttackType.FORCED_RECALIBRATION },
        { name: '🌐 Détournement DNS (vol 10% hashrate, 3h)', value: AttackType.DNS_HIJACKING },
        { name: '💰 Vol Brutal (5% tokens, instantané)', value: AttackType.BRUTAL_THEFT }
      )
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const sabotageService = services.get('sabotage') as SabotageService;
    const target = interaction.options.getUser('cible') as User;
    const attackType = interaction.options.getString('type') as AttackType;

    // Vérifications de base
    if (target.bot) {
      await interaction.reply({
        content: '❌ Vous ne pouvez pas attaquer un bot !',
        ephemeral: true
      });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ Vous ne pouvez pas vous attaquer vous-même !',
        ephemeral: true
      });
      return;
    }

    // Si aucun type spécifié, montrer la liste des attaques disponibles
    if (!attackType) {
      const statsUser = await sabotageService.getUserSabotageStats(interaction.user.id);
      const embed = new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('🔥 Système de Sabotage PvP')
        .setDescription(`**Cible sélectionnée:** ${target.displayName}\n\nChoisissez votre type d'attaque avec l'option \`type\`.`)
        .addFields(
          {
            name: '🦠 Virus Z3-Miner',
            value: 'Réduit le hashrate de 50% pendant 2 heures\n**Coût:** 1 carte virus | **Détection:** Moyenne',
            inline: true
          },
          {
            name: '⚡ Blackout Ciblé',
            value: 'Interrompt le minage pendant 20 minutes\n**Coût:** 1 générateur | **Détection:** Haute',
            inline: true
          },
          {
            name: '🔧 Recalibrage Forcé',
            value: 'Réduit l\'efficacité de 25% pendant 1 heure\n**Coût:** 80 énergie | **Détection:** Basse',
            inline: true
          },
          {
            name: '🌐 Détournement DNS',
            value: 'Vole 10% du hashrate pendant 3 heures\n**Coût:** 1 token rare | **Détection:** Faible',
            inline: true
          },
          {
            name: '💰 Vol Brutal',
            value: 'Vole 5% des tokens (max 100) instantanément\n**Coût:** 1 carte vol | **Détection:** Très haute',
            inline: true
          },
          {
            name: '📊 Vos Statistiques',
            value: `**Attaques réussies:** ${statsUser.sabotagesSuccessful}\n**Attaques subies:** ${statsUser.sabotagesReceived}\n**Cooldown:** ${statsUser.cooldownRemaining > 0 ? `${statsUser.cooldownRemaining}min` : 'Prêt'}`,
            inline: false
          }
        )
        .setFooter({ text: '⚠️ Cooldown de 3h entre les attaques • Immunité de 20min post-attaque' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Déférer la réponse car l'attaque peut prendre du temps
    await interaction.deferReply();

    // Tenter l'attaque
    const sabotageAttempt = {
      attackerId: interaction.user.id,
      targetId: target.id,
      attackType: attackType,
      cost: {} // Le service calculera le coût automatiquement
    };

    const result = await sabotageService.attemptSabotage(sabotageAttempt);

    // Créer l'embed de résultat
    const embed = new EmbedBuilder()
      .setColor(result.success ? 0x00FF00 : 0xFF0000)
      .setTitle(result.success ? '💥 Attaque Réussie !' : '❌ Attaque Échouée')
      .setDescription(result.message)
      .addFields(
        { name: '🎯 Cible', value: target.displayName, inline: true },
        { name: '⚔️ Type d\'attaque', value: attackType, inline: true },
        { name: '📊 Résultat', value: result.blocked ? 'Bloquée' : (result.success ? 'Succès' : 'Échec'), inline: true }
      );

    if (result.success && !result.blocked) {
      if (result.duration > 0) {
        embed.addFields({
          name: '⏱️ Durée des effets',
          value: `${result.duration} minutes`,
          inline: true
        });
      }
      if (result.damage > 0) {
        embed.addFields({
          name: '💥 Dégâts',
          value: attackType === AttackType.BRUTAL_THEFT ? 
            `${result.damage.toFixed(2)} tokens volés` : 
            `${result.damage}% de malus`,
          inline: true
        });
      }
    }

    if (result.defenseUsed) {
      embed.addFields({
        name: '🛡️ Défense utilisée',
        value: result.defenseUsed,
        inline: true
      });
    }

    if (result.detected) {
      embed.addFields({
        name: '🚨 Détection',
        value: 'Votre attaque a été détectée !',
        inline: true
      });
    }

    embed.setFooter({
      text: `Prochaine attaque possible dans 3h • ${result.detected ? 'Identité révélée' : 'Attaque anonyme'}`
    })
    .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Notifier la cible si l'attaque a réussi
    if (result.success && !result.blocked) {
      try {
        const targetUser = await interaction.client.users.fetch(target.id);
        const notificationEmbed = new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle('🚨 Vous êtes sous attaque !')
          .setDescription(result.message.replace('{target}', 'vous'))
          .addFields(
            { name: '⚔️ Type d\'attaque', value: attackType, inline: true },
            { name: '🕐 Durée', value: result.duration > 0 ? `${result.duration} minutes` : 'Instantané', inline: true },
            { name: '🔍 Attaquant', value: result.detected ? interaction.user.displayName : '🤫 Anonyme', inline: true }
          )
          .setFooter({ text: 'Utilisez /defense pour activer vos protections' })
          .setTimestamp();

        await targetUser.send({ embeds: [notificationEmbed] });
      } catch (error) {
        // L'utilisateur a probablement les DM fermés, on ignore
      }
    }

  } catch (error) {
    console.error('Error in sabotage command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Erreur de Sabotage')
      .setDescription(error.message || 'Une erreur inattendue s\'est produite.')
      .setFooter({ text: 'Vérifiez vos ressources et les conditions d\'attaque' });

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}