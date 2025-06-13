import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { MiningService } from '../../services/mining/MiningService';

export const data = new SlashCommandBuilder()
  .setName('mine')
  .setDescription('⛏️ Gérez votre activité de minage')
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('🟢 Démarrer le minage avec vos machines')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stop')
      .setDescription('🔴 Arrêter le minage et collecter les récompenses')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('📊 Afficher l\'état actuel de votre minage')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('collect')
      .setDescription('💰 Collecter les récompenses sans arrêter le minage')
  );

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const miningService = services.get('mining') as MiningService;
    const databaseService = services.get('database');
    const subcommand = interaction.options.getSubcommand();
    
    // Récupère l'utilisateur actuel
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { machines: true }
    });

    if (!user) {
      await interaction.reply({
        content: '❌ Vous devez d\'abord créer un compte! Utilisez `/profile` ou `/balance`.',
        ephemeral: true
      });
      return;
    }

    // Switch basé sur la sous-commande
    switch (subcommand) {
      case 'start':
        await handleStartMining(interaction, miningService, user);
        break;
      case 'stop':
        await handleStopMining(interaction, miningService, user);
        break;
      case 'status':
        await handleMiningStatus(interaction, miningService, user);
        break;
      case 'collect':
        await handleCollectRewards(interaction, miningService, user);
        break;
    }

  } catch (error) {
    console.error('Error in mine command:', error);
    
    const errorMessage = {
      content: '❌ Une erreur est survenue lors de l\'exécution de la commande minage.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function handleStartMining(interaction: ChatInputCommandInteraction, miningService: MiningService, user: any) {
  if (user.machines.length === 0) {
    const noMachinesEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('❌ Aucune machine disponible')
      .setDescription('Vous devez d\'abord acheter une machine de minage!')
      .addFields(
        { name: '🛒 Comment acheter?', value: 'Utilisez `/shop` pour voir la boutique', inline: true },
        { name: '💰 Machine d\'entrée', value: 'BASIC RIG - 100 tokens', inline: true }
      )
      .setFooter({ text: 'Astuce: Gagnez des dollars avec l\'activité Discord!' });

    await interaction.reply({ embeds: [noMachinesEmbed], ephemeral: true });
    return;
  }

  // Vérifie l'état des machines
  const brokenMachines = user.machines.filter((m: any) => m.durability <= 0);
  const criticalMachines = user.machines.filter((m: any) => m.durability <= 20 && m.durability > 0);

  if (brokenMachines.length > 0) {
    const brokenEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('💀 Machines en panne détectées!')
      .setDescription(`${brokenMachines.length} machine(s) sont en panne et ne peuvent pas miner.`)
      .addFields(
        { name: '🔧 Solution', value: 'Utilisez `/repair all` ou `/repair machine <id>`', inline: true },
        { name: '💡 Conseil', value: 'Les machines en panne ne génèrent aucun token!', inline: true }
      )
      .setFooter({ text: 'Réparez vos machines avant de commencer le minage' });

    await interaction.reply({ embeds: [brokenEmbed], ephemeral: true });
    return;
  }

  const result = await miningService.startMining(user.id);

  if (result.success) {
    // Calcule les statistiques de minage
    const stats = await miningService.getMiningStats(user.id);
    
    const workingMachines = user.machines.filter((m: any) => m.durability > 0);
    const avgEfficiency = workingMachines.reduce((sum: number, m: any) => sum + m.efficiency, 0) / workingMachines.length || 0;
    const avgDurability = workingMachines.reduce((sum: number, m: any) => sum + m.durability, 0) / workingMachines.length || 0;

    const successEmbed = new EmbedBuilder()
      .setColor(avgDurability > 70 ? 0x27AE60 : avgDurability > 40 ? 0xF39C12 : 0xE74C3C)
      .setTitle('⛏️ **MINAGE DÉMARRÉ!** ⛏️')
      .setDescription(result.message)
      .addFields(
        { name: '🏭 Machines actives', value: `${workingMachines.length}/${user.machines.length} machine(s)`, inline: true },
        { name: '⚡ Production brute', value: `${stats?.tokensPerSecond.toFixed(4) || '0'} tokens/sec`, inline: true },
        { name: '📈 Gains/heure (brut)', value: `~${((stats?.tokensPerSecond || 0) * 3600).toFixed(2)} tokens`, inline: true },
        { name: '🔋 Consommation', value: `${stats?.powerConsumption || 0}W`, inline: true },
        { name: '💸 Coût énergie/h', value: `${stats?.energyCostPerHour.toFixed(4) || '0'} tokens`, inline: true },
        { name: '💎 Gains nets/h', value: `~${(((stats?.tokensPerSecond || 0) * 3600) - (stats?.energyCostPerHour || 0)).toFixed(2)} tokens`, inline: true },
        { name: '⚙️ Efficacité moy.', value: `${avgEfficiency.toFixed(1)}%`, inline: true },
        { name: '🔧 Durabilité moy.', value: `${avgDurability.toFixed(1)}%`, inline: true },
        { name: '⚠️ Maintenance requise', value: `${stats?.maintenanceNeeded || 0} machine(s)`, inline: true }
      )
      .setFooter({ text: 'Le minage continue même hors ligne! Les machines s\'usent avec le temps.' })
      .setTimestamp();

    // Ajoute des alertes si nécessaire
    if (criticalMachines.length > 0) {
      successEmbed.addFields({
        name: '⚠️ Attention',
        value: `${criticalMachines.length} machine(s) ont une faible durabilité (<20%). Pensez à les réparer!`,
        inline: false
      });
    }

    // Boutons d'action
    const statusButton = new ButtonBuilder()
      .setCustomId('mining_status')
      .setLabel('📊 Voir le statut')
      .setStyle(ButtonStyle.Primary);

    const collectButton = new ButtonBuilder()
      .setCustomId('mining_collect')
      .setLabel('💰 Collecter')
      .setStyle(ButtonStyle.Success);

    const stopButton = new ButtonBuilder()
      .setCustomId('mining_stop')
      .setLabel('🛑 Arrêter')
      .setStyle(ButtonStyle.Danger);

    const repairButton = new ButtonBuilder()
      .setCustomId('mining_repair')
      .setLabel('🔧 Réparer')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(stats?.maintenanceNeeded === 0);

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(statusButton, collectButton, stopButton, repairButton);

    const response = await interaction.reply({
      embeds: [successEmbed],
      components: [actionRow],
      fetchReply: true
    });

    // Collecteur pour les boutons
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: '❌ Vous ne pouvez pas utiliser ces boutons!',
          ephemeral: true
        });
        return;
      }

      switch (buttonInteraction.customId) {
        case 'mining_status':
          await handleMiningStatusButton(buttonInteraction, miningService, user.id);
          break;
        case 'mining_collect':
          await handleCollectButton(buttonInteraction, miningService, user.id);
          break;
        case 'mining_stop':
          await handleStopButton(buttonInteraction, miningService, user.id);
          break;
        case 'mining_repair':
          await buttonInteraction.reply({
            content: '🔧 Utilisez `/repair list` pour voir l\'état de vos machines et `/repair all` pour les réparer!',
            ephemeral: true
          });
          break;
      }
    });

  } else {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('❌ Impossible de démarrer le minage')
      .setDescription(result.message)
      .setFooter({ text: 'Vérifiez vos machines avec /inventory ou /repair list' });

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleStopMining(interaction: ChatInputCommandInteraction, miningService: MiningService, user: any) {
  if (!user.miningActive) {
    await interaction.reply({
      content: '❌ Vous n\'êtes pas en train de miner! Utilisez `/mine start` pour commencer.',
      ephemeral: true
    });
    return;
  }

  const result = await miningService.stopMining(user.id);

  if (result.success) {
    const criticalWear = result.wearReport?.filter(w => w.criticalFailure).length || 0;
    const highWear = result.wearReport?.filter(w => w.newDurability <= 20 && !w.criticalFailure).length || 0;

    const successEmbed = new EmbedBuilder()
      .setColor(criticalWear > 0 ? 0xE74C3C : highWear > 0 ? 0xF39C12 : 0x27AE60)
      .setTitle('🛑 **MINAGE ARRÊTÉ**')
      .setDescription('Voici le bilan de votre session de minage:')
      .addFields(
        { name: '💰 Gains bruts', value: `**${(result.rewards! + result.energyCost!).toFixed(4)} tokens**`, inline: true },
        { name: '⚡ Coût énergie', value: `**-${result.energyCost?.toFixed(4)} tokens**`, inline: true },
        { name: '💎 Gains nets', value: `**${result.rewards?.toFixed(4)} tokens**`, inline: true }
      );

    // Ajoute les informations d'usure
    if (result.wearReport && result.wearReport.length > 0) {
      const wearSummary = result.wearReport.map(w => {
        const wearAmount = w.oldDurability - w.newDurability;
        const status = w.criticalFailure ? '💀' : w.newDurability <= 20 ? '🔴' : w.newDurability <= 50 ? '🟡' : '🟢';
        return `${status} Machine: -${wearAmount.toFixed(1)}% durabilité`;
      }).join('\n');

      successEmbed.addFields(
        { name: '🔧 Usure des machines', value: wearSummary, inline: false }
      );

      if (criticalWear > 0) {
        successEmbed.addFields(
          { name: '💀 Machines en panne', value: `${criticalWear} machine(s) nécessitent une réparation immédiate!`, inline: false }
        );
      } else if (highWear > 0) {
        successEmbed.addFields(
          { name: '⚠️ Maintenance recommandée', value: `${highWear} machine(s) ont une faible durabilité`, inline: false }
        );
      }
    }

    successEmbed.addFields(
      { name: '💡 Conseils', value: 'Les machines s\'usent avec le temps. Pensez à les réparer régulièrement pour maintenir l\'efficacité!', inline: false }
    );

    successEmbed.setFooter({ text: 'Vous pouvez redémarrer le minage quand vous voulez!' })
              .setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });
  } else {
    await interaction.reply({
      content: `❌ ${result.message}`,
      ephemeral: true
    });
  }
}

async function handleMiningStatus(interaction: ChatInputCommandInteraction, miningService: MiningService, user: any) {
  const stats = await miningService.getMiningStats(user.id);
  
  if (!stats) {
    await interaction.reply({
      content: '❌ Impossible de récupérer les statistiques de minage.',
      ephemeral: true
    });
    return;
  }

  // Calcule le temps de minage
  const now = new Date();
  const miningTime = user.miningActive 
    ? Math.floor((now.getTime() - user.lastMiningCheck.getTime()) / 1000 / 60)
    : 0;

  const workingMachines = user.machines.filter((m: any) => m.durability > 0);
  const netGainsPerHour = (stats.tokensPerSecond * 3600) - stats.energyCostPerHour;

  const statusEmbed = new EmbedBuilder()
    .setColor(user.miningActive ? 0x27AE60 : 0x95A5A6)
    .setTitle(`⛏️ Statut - ${user.miningActive ? '🟢 ACTIF' : '🔴 INACTIF'}`)
    .addFields(
      { name: '🏭 Machines', value: `${workingMachines.length}/${user.machines.length}`, inline: true },
      { name: '💎 Gains nets/h', value: `${netGainsPerHour.toFixed(2)} tokens`, inline: true },
      { name: '⏱️ Temps actif', value: `${miningTime} min`, inline: true }
    );

  if (stats.maintenanceNeeded > 0) {
    statusEmbed.addFields(
      { name: '⚠️ Maintenance', value: `${stats.maintenanceNeeded} machine(s)`, inline: true }
    );
  }

  await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
}



async function handleStopButton(buttonInteraction: any, miningService: MiningService, userId: string) {
  const result = await miningService.stopMining(userId);

  if (result.success) {
    const criticalWear = result.wearReport?.filter(w => w.criticalFailure).length || 0;
    
    let statusColor = 0x27AE60;
    let statusText = 'Minage arrêté avec succès!';
    
    if (criticalWear > 0) {
      statusColor = 0xE74C3C;
      statusText = `Minage arrêté - ${criticalWear} machine(s) en panne!`;
    }

    const stopEmbed = new EmbedBuilder()
      .setColor(statusColor)
      .setTitle('🛑 Minage arrêté')
      .setDescription(statusText)
      .addFields(
        { name: '💎 Gains nets', value: `**${result.rewards?.toFixed(4) || '0'} tokens**`, inline: true },
        { name: '⚡ Coût énergie', value: `${result.energyCost?.toFixed(4) || '0'} tokens`, inline: true }
      );

    if (criticalWear > 0) {
      stopEmbed.addFields(
        { name: '🔧 Action requise', value: 'Utilisez `/repair` pour réparer vos machines!', inline: false }
      );
    }

    stopEmbed.setFooter({ text: 'Vous pouvez redémarrer quand vous voulez' });

    await buttonInteraction.update({
      embeds: [stopEmbed],
      components: []
    });
  } else {
    await buttonInteraction.reply({
      content: `❌ ${result.message}`,
      ephemeral: true
    });
  }
}

// Fonctions pour les boutons interactifs (versions améliorées)
async function handleMiningStatusButton(buttonInteraction: any, miningService: MiningService, userId: string) {
  const user = await buttonInteraction.client.services.get('database').client.user.findUnique({
    where: { id: userId },
    include: { machines: true }
  });

  const stats = await miningService.getMiningStats(userId);
  
  if (!stats || !user) {
    await buttonInteraction.reply({
      content: '❌ Impossible de récupérer les statistiques.',
      ephemeral: true
    });
    return;
  }

  const now = new Date();
  const miningTime = user.miningActive 
    ? Math.floor((now.getTime() - user.lastMiningCheck.getTime()) / 1000 / 60) // en minutes
    : 0;

  const workingMachines = user.machines.filter((m: any) => m.durability > 0);
  const brokenMachines = user.machines.filter((m: any) => m.durability <= 0);
  const netGainsPerHour = (stats.tokensPerSecond * 3600) - stats.energyCostPerHour;
  
  // Calcule les gains estimés actuels
  const currentGrossGains = user.miningActive ? stats.tokensPerSecond * miningTime * 60 : 0;
  const currentEnergyCost = user.miningActive ? (stats.energyCostPerHour / 60) * miningTime : 0;
  const currentNetGains = Math.max(0, currentGrossGains - currentEnergyCost);

  const statusEmbed = new EmbedBuilder()
    .setColor(
      brokenMachines.length > 0 ? 0xE74C3C :
      stats.maintenanceNeeded > 0 ? 0xF39C12 :
      user.miningActive ? 0x27AE60 : 0x95A5A6
    )
    .setTitle(`⛏️ Statut Détaillé - ${user.miningActive ? '🟢 ACTIF' : '🔴 INACTIF'}`)
    .addFields(
      { name: '🏭 Machines', value: `${workingMachines.length}/${user.machines.length} opérationnelles`, inline: true },
      { name: '⚡ Production brute', value: `${stats.tokensPerSecond.toFixed(4)} tokens/sec`, inline: true },
      { name: '💸 Coût énergie/h', value: `${stats.energyCostPerHour.toFixed(4)} tokens`, inline: true },
      { name: '💎 Gains nets/h', value: `${netGainsPerHour.toFixed(2)} tokens`, inline: true },
      { name: '⚙️ Efficacité moy.', value: `${stats.efficiency.toFixed(1)}%`, inline: true },
      { name: '⏱️ Temps actif', value: `${miningTime} min`, inline: true }
    );

  if (user.miningActive && miningTime > 0) {
    statusEmbed.addFields(
      { name: '💰 Gains actuels (brut)', value: `${currentGrossGains.toFixed(4)} tokens`, inline: true },
      { name: '⚡ Coût énergie actuel', value: `${currentEnergyCost.toFixed(4)} tokens`, inline: true },
      { name: '💎 Gains nets actuels', value: `${currentNetGains.toFixed(4)} tokens`, inline: true }
    );
  }

  // Alertes de maintenance
  if (brokenMachines.length > 0) {
    statusEmbed.addFields(
      { name: '💀 Machines en panne', value: `${brokenMachines.length} machine(s) - Réparation obligatoire!`, inline: false }
    );
  }

  if (stats.maintenanceNeeded > 0) {
    statusEmbed.addFields(
      { name: '⚠️ Maintenance recommandée', value: `${stats.maintenanceNeeded} machine(s) avec durabilité < 50%`, inline: false }
    );
  }

  statusEmbed.setFooter({ 
    text: user.miningActive 
      ? 'Collectez régulièrement vos gains!' 
      : 'Réparez vos machines et redémarrez le minage' 
  });

  await buttonInteraction.reply({ embeds: [statusEmbed], ephemeral: true });
}

async function handleCollectButton(buttonInteraction: any, miningService: MiningService, userId: string) {
  const user = await buttonInteraction.client.services.get('database').client.user.findUnique({
    where: { id: userId },
    include: { machines: true }
  });

  if (!user || !user.miningActive) {
    await buttonInteraction.reply({
      content: '❌ Vous n\'êtes pas en train de miner!',
      ephemeral: true
    });
    return;
  }

  // Calcule le temps de minage et les gains estimés
  const now = new Date();
  const miningTimeMinutes = Math.floor((now.getTime() - user.lastMiningCheck.getTime()) / 1000 / 60);
  
  if (miningTimeMinutes < 1) {
    await buttonInteraction.reply({
      content: '💤 Attendez au moins 1 minute avant de collecter!',
      ephemeral: true
    });
    return;
  }

  const rewards = await miningService.collectMiningRewards(userId);

  if (rewards > 0) {
    await buttonInteraction.reply({
      content: `💰 **+${rewards.toFixed(4)} tokens** collectés après ${miningTimeMinutes} min de minage!\n🔋 Coûts énergétiques déjà déduits. Le minage continue...`,
      ephemeral: true
    });
  } else {
    await buttonInteraction.reply({
      content: '💤 Aucune récompense à collecter pour le moment.',
      ephemeral: true
    });
  }
}

async function handleCollectRewards(interaction: ChatInputCommandInteraction, miningService: MiningService, user: any) {
  if (!user.miningActive) {
    await interaction.reply({
      content: '❌ Vous n\'êtes pas en train de miner! Aucune récompense à collecter.',
      ephemeral: true
    });
    return;
  }

  // Calcule les statistiques avant collecte pour estimer les gains
  const stats = await miningService.getMiningStats(user.id);
  const now = new Date();
  const miningTimeMinutes = Math.floor((now.getTime() - user.lastMiningCheck.getTime()) / 1000 / 60);
  
  if (miningTimeMinutes < 1) {
    await interaction.reply({
      content: '💤 Attendez au moins 1 minute avant de collecter vos premières récompenses!',
      ephemeral: true
    });
    return;
  }

  const estimatedGrossGains = stats ? stats.tokensPerSecond * miningTimeMinutes * 60 : 0;
  const estimatedEnergyCost = stats ? (stats.energyCostPerHour / 60) * miningTimeMinutes : 0;
  const estimatedNetGains = Math.max(0, estimatedGrossGains - estimatedEnergyCost);

  const rewards = await miningService.collectMiningRewards(user.id);

  if (rewards > 0) {
    const collectEmbed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('💰 **RÉCOMPENSES COLLECTÉES!**')
      .setDescription(`Session de **${miningTimeMinutes} minutes** terminée`)
      .addFields(
        { name: '💰 Gains bruts estimés', value: `${estimatedGrossGains.toFixed(4)} tokens`, inline: true },
        { name: '⚡ Coût énergie estimé', value: `${estimatedEnergyCost.toFixed(4)} tokens`, inline: true },
        { name: '💎 Gains nets reçus', value: `**${rewards.toFixed(4)} tokens**`, inline: true },
        { name: '✅ Statut', value: 'Minage toujours actif', inline: true },
        { name: '⏱️ Prochaine collecte', value: 'Disponible immédiatement', inline: true },
        { name: '🔋 Info', value: 'Coûts énergétiques déjà déduits', inline: true }
      );

    // Ajoute des conseils basés sur la performance
    const efficiency = estimatedGrossGains > 0 ? (rewards / estimatedGrossGains) * 100 : 0;
    
    if (efficiency < 70) {
      collectEmbed.addFields({
        name: '💡 Conseil',
        value: `Efficacité: ${efficiency.toFixed(1)}% - Vos machines ont besoin de maintenance pour optimiser les gains!`,
        inline: false
      });
    } else if (efficiency > 90) {
      collectEmbed.addFields({
        name: '✨ Excellent!',
        value: `Efficacité: ${efficiency.toFixed(1)}% - Vos machines sont en excellent état!`,
        inline: false
      });
    }

    collectEmbed.setFooter({ text: 'Le minage continue... Surveillez l\'usure de vos machines!' })
              .setTimestamp();

    await interaction.reply({ embeds: [collectEmbed] });
  } else {
    await interaction.reply({
      content: '💤 Aucune récompense à collecter pour le moment. Attendez un peu plus!',
      ephemeral: true
    });
  }
}