import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { HousingService } from '../../services/housing/HousingService';

export const data = new SlashCommandBuilder()
  .setName('demenager')
  .setDescription('Déménager dans un nouveau logement pour étendre votre capacité de minage')
  .addStringOption(option =>
    option.setName('logement')
      .setDescription('Type de logement (optionnel - liste si non spécifié)')
      .setRequired(false)
      .addChoices(
        { name: '🏠 Chambre chez Maman (Gratuit)', value: 'CHAMBRE_MAMAN' },
        { name: '🏢 Studio Étudiant', value: 'STUDIO' },
        { name: '🏠 Appartement 1 Pièce', value: 'APPARTEMENT_1P' },
        { name: '🏡 Appartement 2 Pièces', value: 'APPARTEMENT_2P' },
        { name: '🏘️ Maison avec Garage', value: 'MAISON' },
        { name: '🏭 Entrepôt Industriel', value: 'ENTREPOT' },
        { name: '🏭 Complexe Industriel', value: 'USINE' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const databaseService = services.get('database');
    const activityService = services.get('activity');
    const housingService = new HousingService(databaseService.client);
    
    // Get user data
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { machines: true }
    });

    if (!user) {
      // Rediriger vers l'inscription
      const notRegisteredEmbed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('🏠 Pas de logement trouvé')
        .setDescription(`**${interaction.user.displayName || interaction.user.username}**, vous n'avez pas encore de compte de mineur!`)
        .addFields(
          {
            name: '🎮 Comment créer votre compte?',
            value: 'Utilisez la commande `/register` pour vous inscrire et obtenir votre premier logement!',
            inline: false
          },
          {
            name: '🎁 Bonus d\'inscription',
            value: '• 🏠 Chambre chez maman gratuite\n• 🔧 Machine Basic Rig gratuite\n• ⚡ 100 points d\'énergie\n• 💰 Prêt à commencer le minage!',
            inline: false
          },
          {
            name: '💡 Pourquoi déménager?',
            value: '• **Plus de machines**: Capacité étendue\n• **Meilleur rendement**: Logements premium\n• **Progression**: Du gratuit au complexe industriel\n• **Stratégie**: Équilibrer coûts vs gains!',
            inline: false
          }
        )
        .setFooter({ text: 'Tapez /register pour commencer votre aventure!' })
        .setTimestamp();

      await interaction.reply({ embeds: [notRegisteredEmbed], ephemeral: true });
      return;
    }

    const targetType = interaction.options.getString('logement');
    const dollarBalance = await activityService.getUserDollarBalance(interaction.user.id);
    
    // Mettre à jour le solde de l'utilisateur avec les dollars de l'activité
    await databaseService.client.user.update({
      where: { id: user.id },
      data: { dollars: dollarBalance }
    });

    if (!targetType) {
      // Afficher la liste des logements disponibles
      await showHousingList(interaction, housingService, user, dollarBalance);
    } else {
      // Tenter le déménagement direct
      await attemptMove(interaction, housingService, user, dollarBalance, targetType);
    }

  } catch (error) {
    console.error('Error in demenager command:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors du traitement de votre demande.',
      ephemeral: true
    });
  }
}

async function showHousingList(interaction: ChatInputCommandInteraction, housingService: HousingService, user: any, dollarBalance: number) {
  const availableHousings = await housingService.getAvailableHousings(user.id);
  const currentHousing = housingService.getHousingInfo(user.housingType || 'CHAMBRE_MAMAN');
  const activeMachines = user.machines.filter((m: any) => m.durability > 0).length;

  const embed = new EmbedBuilder()
    .setColor(user.housingType === 'CHAMBRE_MAMAN' ? 0xE74C3C : 0x00AE86)
    .setTitle(`🏠 Système de Déménagement - ${user.username}`)
    .setDescription(`**Logement actuel:** ${currentHousing.emoji} ${currentHousing.name}\n**Machines actives:** ${activeMachines}/${currentHousing.maxMachines}\n**Argent disponible:** ${dollarBalance.toFixed(2)}$`)
    .addFields(
      { name: '🏠 Logement Actuel', value: `${currentHousing.emoji} ${currentHousing.name}`, inline: true },
      { name: '🔧 Capacité', value: `${activeMachines}/${currentHousing.maxMachines} machines`, inline: true },
      { name: '💰 Budget', value: `${dollarBalance.toFixed(2)}$`, inline: true }
    );

  // Ajouter tous les logements disponibles
  let housingList = '';
  for (const housing of availableHousings) {
    const status = housing.canUnlock ? '✅' : '❌';
    const current = housing.type === user.housingType ? ' **(ACTUEL)**' : '';
    const cost = housing.monthlyRent > 0 
      ? ` - ${housing.depositRequired + housing.monthlyRent}$ total`
      : ' - Gratuit';
    
    housingList += `${status} ${housing.emoji} **${housing.name}**${current}\n`;
    housingList += `   • ${housing.maxMachines} machines max${cost}\n`;
    if (!housing.canUnlock && housing.reason) {
      housingList += `   • *${housing.reason}*\n`;
    }
    housingList += '\n';
  }

  embed.addFields({
    name: '🏘️ Logements Disponibles',
    value: housingList,
    inline: false
  });

  // Info importante sur les loyers
  if (user.housingType !== 'CHAMBRE_MAMAN') {
    const rentStatus = await housingService.getRentStatus(user.id);
    if (rentStatus?.isOverdue) {
      embed.addFields({
        name: '⚠️ ATTENTION - Loyer en Retard!',
        value: `🚨 Retard de ${rentStatus.daysOverdue} jours\n💰 Montant dû: ${rentStatus.amount}$ + ${rentStatus.daysOverdue * 5}$ pénalité\n${rentStatus.daysOverdue >= 7 ? '🔧 **VOS MACHINES SONT ARRÊTÉES**' : ''}`,
        inline: false
      });
    }
  }

  embed.addFields(
    {
      name: '💡 Comment déménager?',
      value: 'Utilisez `/demenager [logement]` avec le nom du logement\nExemple: `/demenager studio`',
      inline: true
    },
    {
      name: '⚠️ Important',
      value: 'Les machines s\'arrêtent si le loyer n\'est pas payé à temps!\nUtilisez `/loyer` pour gérer vos paiements.',
      inline: true
    }
  )
  .setFooter({ text: 'Conseil: Déménagez progressivement et gardez toujours de l\'argent pour le loyer!' })
  .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function attemptMove(interaction: ChatInputCommandInteraction, housingService: HousingService, user: any, dollarBalance: number, targetType: string) {
  const result = await housingService.moveToHousing(user.id, targetType as any);
  const housingInfo = housingService.getHousingInfo(targetType as any);

  if (result.success) {
    // Succès du déménagement
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎉 Déménagement Réussi!')
      .setDescription(`**Félicitations ${user.username}!** Vous avez déménagé avec succès.`)
      .addFields(
        { name: '🏠 Nouveau Logement', value: `${housingInfo.emoji} **${housingInfo.name}**`, inline: true },
        { name: '🔧 Nouvelle Capacité', value: `**${housingInfo.maxMachines}** machines max`, inline: true },
        { name: '💰 Coût Total', value: `**${result.cost}$**`, inline: true }
      );

    // Détails du logement
    if (housingInfo.features.length > 0) {
      embed.addFields({
        name: '✨ Avantages Inclus',
        value: housingInfo.features.map(feature => `• ${feature}`).join('\n'),
        inline: false
      });
    }

    // Information sur le loyer
    if (housingInfo.monthlyRent > 0) {
      const nextDue = new Date();
      nextDue.setMonth(nextDue.getMonth() + 1);
      nextDue.setDate(1);
      
      embed.addFields(
        { name: '📅 Prochain Loyer', value: `**${housingInfo.monthlyRent}$** le ${nextDue.toLocaleDateString('fr-FR')}`, inline: true },
        { name: '⚠️ Rappel Important', value: 'Payez à temps sinon vos machines s\'arrêtent après 7 jours!', inline: true }
      );
    }

    embed.addFields(
      {
        name: '🎯 Prochaines Étapes',
        value: housingInfo.monthlyRent > 0 
          ? '• Utilisez `/loyer` pour surveiller vos paiements\n• Achetez des machines avec `/shop`\n• Optimisez vos revenus pour payer le loyer!'
          : '• Achetez des machines avec `/shop`\n• Commencez à miner pour gagner des tokens\n• Épargnez pour le prochain déménagement!',
        inline: false
      }
    )
    .setFooter({ text: housingInfo.monthlyRent > 0 ? 'N\'oubliez jamais votre loyer!' : 'Profitez de votre logement gratuit!' })
    .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } else {
    // Échec du déménagement
    const currentHousing = housingService.getHousingInfo(user.housingType || 'CHAMBRE_MAMAN');
    const totalCost = housingInfo.depositRequired + housingInfo.monthlyRent;
    const missingAmount = Math.max(0, totalCost - dollarBalance);

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('❌ Déménagement Impossible')
      .setDescription(`**Désolé ${user.username}**, vous ne pouvez pas déménager vers ce logement pour le moment.`)
      .addFields(
        { name: '🎯 Logement Visé', value: `${housingInfo.emoji} **${housingInfo.name}**`, inline: true },
        { name: '🏠 Logement Actuel', value: `${currentHousing.emoji} ${currentHousing.name}`, inline: true },
        { name: '❌ Problème', value: result.message, inline: false }
      );

    // Détails financiers si nécessaire
    if (missingAmount > 0) {
      embed.addFields(
        { name: '💰 Situation Financière', value: `• **Vous avez:** ${dollarBalance.toFixed(2)}$\n• **Coût total:** ${totalCost}$\n• **Il manque:** ${missingAmount.toFixed(2)}$`, inline: true },
        { name: '💸 Détail des Coûts', value: `• **Caution:** ${housingInfo.depositRequired}$\n• **Premier loyer:** ${housingInfo.monthlyRent}$`, inline: true }
      );
    }

    // Conditions d'accès
    embed.addFields({
      name: '📋 Conditions Requises',
      value: housingInfo.unlockRequirement,
      inline: false
    });

    // Conseils personnalisés
    let tips = [];
    if (result.message.includes('500$')) tips.push('💬 Chattez plus sur Discord pour gagner des $');
    if (result.message.includes('machines')) tips.push('🔧 Achetez et entretenez plus de machines');
    if (result.message.includes('studio')) tips.push('🏢 Déménagez d\'abord en studio');
    if (result.message.includes('top 5')) tips.push('⛏️ Minez davantage pour monter dans le classement');
    if (missingAmount > 0) tips.push('💰 Gagnez de l\'argent avec l\'activité Discord');

    if (tips.length > 0) {
      embed.addFields({
        name: '💡 Conseils pour Débloquer',
        value: tips.join('\n'),
        inline: false
      });
    }

    embed.addFields(
      {
        name: '🚀 Comment Progresser?',
        value: '• `/balance` - Vérifier vos finances\n• `/profile` - Voir votre progression\n• `/shop` - Acheter des machines\n• `/help` - Guide complet du jeu',
        inline: false
      }
    )
    .setFooter({ text: 'Patience et stratégie sont les clés du succès!' })
    .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}