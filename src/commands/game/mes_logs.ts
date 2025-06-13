import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SabotageService } from '../../services/sabotage/SabotageService';

export const data = new SlashCommandBuilder()
  .setName('mes_logs')
  .setDescription('📜 Consultez l\'historique de vos actions de sabotage')
  .addIntegerOption(option =>
    option
      .setName('limite')
      .setDescription('Nombre de logs à afficher (max 20)')
      .setMinValue(1)
      .setMaxValue(20)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const sabotageService = services.get('sabotage') as SabotageService;
    const limit = interaction.options.getInteger('limite') || 10;

    await interaction.deferReply({ ephemeral: true });

    // Récupérer les logs et les stats
    const logs = await sabotageService.getUserSabotageLogs(interaction.user.id, limit);
    const stats = await sabotageService.getUserSabotageStats(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x8B4513)
      .setTitle('📜 Journal de Sabotage')
      .setDescription(`**${interaction.user.displayName}** - Historique des opérations clandestines`)
      .addFields(
        {
          name: '📊 Statistiques Globales',
          value: `**Attaques réussies:** ${stats.sabotagesSuccessful}\n` +
                 `**Attaques subies:** ${stats.sabotagesReceived}\n` +
                 `**Attaques bloquées:** ${stats.sabotagesBlocked}\n` +
                 `**Activité récente:** ${stats.recentAttacks} (7 derniers jours)`,
          inline: false
        }
      );

    if (stats.cooldownRemaining > 0) {
      embed.addFields({
        name: '⏱️ Cooldown Actuel',
        value: `Prochaine attaque possible dans **${stats.cooldownRemaining} minutes**`,
        inline: false
      });
    }

    if (logs.length === 0) {
      embed.addFields({
        name: '📝 Aucun Log',
        value: 'Aucune activité de sabotage enregistrée.\nCommencez par utiliser `/sabotage` ou `/mission` !',
        inline: false
      });
    } else {
      embed.setFooter({ text: `${logs.length} logs affichés • Utilisez /sabotage pour attaquer` });

      // Grouper les logs par date pour une meilleure lisibilité
      const logsByDate = new Map<string, any[]>();
      
      for (const log of logs) {
        const date = log.timestamp.toDateString();
        if (!logsByDate.has(date)) {
          logsByDate.set(date, []);
        }
        logsByDate.get(date)!.push(log);
      }

      let fieldCount = 2; // On compte les champs des stats et cooldown
      
      for (const [date, dateLogs] of logsByDate) {
        if (fieldCount >= 25) break; // Limite Discord de 25 fields

        let logTexts = [];
        
        for (const log of dateLogs) {
          if (logTexts.length >= 10) break; // Max 10 logs par jour pour la lisibilité

          const isAttacker = log.attackerId === interaction.user.id;
          const otherUser = isAttacker ? log.target.username : log.attacker.username;
          
          const timeStr = log.timestamp.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });

          let logText = `\`${timeStr}\` `;
          
          if (isAttacker) {
            // L'utilisateur était l'attaquant
            const statusEmoji = log.success ? '✅' : '❌';
            const detectedText = log.detected ? ' 🔍' : '';
            logText += `${statusEmoji} **Attaque sur ${otherUser}**${detectedText}\n`;
            logText += `   └ ${this.getAttackTypeEmoji(log.type)} ${log.type}`;
            
            if (log.success && log.damage > 0) {
              if (log.type === 'BRUTAL_THEFT') {
                logText += ` (+${log.damage.toFixed(1)} tokens)`;
              } else if (log.duration > 0) {
                logText += ` (${log.duration}min)`;
              }
            }
          } else {
            // L'utilisateur était la cible
            const statusEmoji = log.success ? '🚨' : '🛡️';
            const attackerName = log.detected ? log.attacker.username : 'Inconnu';
            logText += `${statusEmoji} **Attaqué par ${attackerName}**\n`;
            logText += `   └ ${this.getAttackTypeEmoji(log.type)} ${log.type}`;
            
            if (log.success && log.damage > 0) {
              if (log.type === 'BRUTAL_THEFT') {
                logText += ` (-${log.damage.toFixed(1)} tokens)`;
              } else if (log.duration > 0) {
                logText += ` (${log.duration}min)`;
              }
            }
          }
          
          logTexts.push(logText);
        }

        if (logTexts.length > 0 && fieldCount < 25) {
          const dateFormatted = new Date(date).toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          });
          
          embed.addFields({
            name: `📅 ${dateFormatted}`,
            value: logTexts.join('\n\n'),
            inline: false
          });
          
          fieldCount++;
        }
      }
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in mes_logs command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Erreur de Log')
      .setDescription('Impossible de récupérer l\'historique de sabotage.')
      .setFooter({ text: 'Réessayez plus tard' });

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }

  // Méthode helper pour obtenir l'emoji du type d'attaque
  private getAttackTypeEmoji(attackType: string): string {
    const emojis = {
      'VIRUS_Z3_MINER': '🦠',
      'BLACKOUT_TARGETED': '⚡',
      'FORCED_RECALIBRATION': '🔧',
      'DNS_HIJACKING': '🌐',
      'BRUTAL_THEFT': '💰'
    };
    
    return emojis[attackType] || '⚔️';
  }
}