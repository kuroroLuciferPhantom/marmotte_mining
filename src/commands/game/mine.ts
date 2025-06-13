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

  const result = await miningService.startMining(user.id);

  if (result.success) {
    // Calcule les statistiques de minage
    const stats = await miningService.getMiningStats(user.id);
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle('⛏️ **MINAGE DÉMARRÉ!** ⛏️')
      .setDescription(result.message)
      .addFields(
        { name: '🏭 Machines actives', value: `${user.machines.length} machine(s)`, inline: true },
        { name: '⚡ Production', value: `${stats?.tokensPerSecond.toFixed(4) || '0'} tokens/sec`, inline: true },
        { name: '📈 Estimation/heure', value: `~${((stats?.tokensPerSecond || 0) * 3600).toFixed(2)} tokens`, inline: true },
        { name: '🔋 Consommation', value: `${stats?.powerConsumption || 0}W`, inline: true },
        { name: '⚙️ Efficacité moyenne', value: `${stats?.efficiency.toFixed(1) || '0'}%`, inline: true },
        { name: '💡 Info', value: 'Le minage continue même hors ligne!', inline: true }
      )
      .setFooter({ text: 'Utilisez /mine status pour suivre vos gains' })
      .setTimestamp();

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

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(statusButton, collectButton, stopButton);

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
      }
    });

  } else {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('❌ Impossible de démarrer le minage')
      .setDescription(result.message)
      .setFooter({ text: 'Vérifiez vos machines avec /inventory' });

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
    const successEmbed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setTitle('🛑 **MINAGE ARRÊTÉ**')
      .setDescription(result.message)
      .addFields(
        { name: '💰 Récompenses gagnées', value: `**${result.rewards?.toFixed(4) || '0'} tokens**`, inline: true },
        { name: '💡 Conseil', value: 'Vous pouvez redémarrer le minage quand vous voulez!', inline: true }
      )
      .setFooter({ text: 'Merci d\'avoir miné avec nous!' })
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
    ? Math.floor((now.getTime() - user.lastMiningCheck.getTime()) / 1000 / 60) // en minutes
    : 0;

  const statusEmbed = new EmbedBuilder()
    .setColor(user.miningActive ? 0x27AE60 : 0x95A5A6)
    .setTitle(`⛏️ **STATUT DE MINAGE** - ${user.miningActive ? '🟢 ACTIF' : '🔴 INACTIF'}`)
    .setDescription(user.miningActive ? 'Vos machines travaillent dur!' : 'Le minage est actuellement arrêté')
    .addFields(
      { name: '🏭 Machines', value: `${stats.totalMachines} machine(s)`, inline: true },
      { name: '⚡ Production', value: `${stats.tokensPerSecond.toFixed(4)} tokens/sec`, inline: true },
      { name: '🔋 Consommation', value: `${stats.powerConsumption}W`, inline: true },
      { name: '⚙️ Efficacité', value: `${stats.efficiency.toFixed(1)}%`, inline: true },
      { name: '📈 Gains/heure', value: `~${(stats.tokensPerSecond * 3600).toFixed(2)} tokens`, inline: true },
      { name: '⏱️ Temps actif', value: user.miningActive ? `${miningTime} minutes` : 'Arrêté', inline: true }
    );

  if (user.miningActive) {
    statusEmbed.addFields(
      { name: '💰 Gains estimés actuels', value: `~${(stats.tokensPerSecond * miningTime * 60).toFixed(4)} tokens`, inline: false }
    );
  }

  statusEmbed.setFooter({ text: user.miningActive ? 'Utilisez /mine collect pour récupérer vos gains' : 'Utilisez /mine start pour commencer' })
          .setTimestamp();

  await interaction.reply({ embeds: [statusEmbed] });
}

async function handleCollectRewards(interaction: ChatInputCommandInteraction, miningService: MiningService, user: any) {
  if (!user.miningActive) {
    await interaction.reply({
      content: '❌ Vous n\'êtes pas en train de miner! Aucune récompense à collecter.',
      ephemeral: true
    });
    return;
  }

  const rewards = await miningService.collectMiningRewards(user.id);

  if (rewards > 0) {
    const collectEmbed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('💰 **RÉCOMPENSES COLLECTÉES!**')
      .setDescription(`Vous avez gagné **${rewards.toFixed(4)} tokens**!`)
      .addFields(
        { name: '✅ Statut', value: 'Minage toujours actif', inline: true },
        { name: '⏱️ Prochaine collecte', value: 'Disponible immédiatement', inline: true }
      )
      .setFooter({ text: 'Le minage continue... Revenez plus tard!' })
      .setTimestamp();

    await interaction.reply({ embeds: [collectEmbed] });
  } else {
    await interaction.reply({
      content: '💤 Aucune récompense à collecter pour le moment. Attendez un peu plus!',
      ephemeral: true
    });
  }
}

// Fonctions pour les boutons interactifs
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
    ? Math.floor((now.getTime() - user.lastMiningCheck.getTime()) / 1000 / 60)
    : 0;

  const statusEmbed = new EmbedBuilder()
    .setColor(user.miningActive ? 0x27AE60 : 0x95A5A6)
    .setTitle(`⛏️ Statut de minage - ${user.miningActive ? '🟢 ACTIF' : '🔴 INACTIF'}`)
    .addFields(
      { name: '🏭 Machines', value: `${stats.totalMachines}`, inline: true },
      { name: '⚡ Production', value: `${stats.tokensPerSecond.toFixed(4)}/sec`, inline: true },
      { name: '⏱️ Temps actif', value: `${miningTime} min`, inline: true }
    );

  await buttonInteraction.reply({ embeds: [statusEmbed], ephemeral: true });
}

async function handleCollectButton(buttonInteraction: any, miningService: MiningService, userId: string) {
  const rewards = await miningService.collectMiningRewards(userId);

  if (rewards > 0) {
    await buttonInteraction.reply({
      content: `💰 **+${rewards.toFixed(4)} tokens** collectés! Le minage continue...`,
      ephemeral: true
    });
  } else {
    await buttonInteraction.reply({
      content: '💤 Aucune récompense à collecter pour le moment.',
      ephemeral: true
    });
  }
}

async function handleStopButton(buttonInteraction: any, miningService: MiningService, userId: string) {
  const result = await miningService.stopMining(userId);

  if (result.success) {
    const stopEmbed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setTitle('🛑 Minage arrêté')
      .setDescription(`💰 **${result.rewards?.toFixed(4) || '0'} tokens** gagnés au total!`)
      .setFooter({ text: 'Vous pouvez redémarrer quand vous voulez' });

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