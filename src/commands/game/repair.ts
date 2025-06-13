import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ComponentType,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { MiningService } from '../../services/mining/MiningService';

export const data = new SlashCommandBuilder()
  .setName('repair')
  .setDescription('🔧 Gérez la maintenance de vos machines')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('📋 Voir l\'état de toutes vos machines')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('all')
      .setDescription('🔧 Réparer toutes les machines endommagées')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('machine')
      .setDescription('🔧 Réparer une machine spécifique')
      .addStringOption(option =>
        option
          .setName('machine_id')
          .setDescription('ID de la machine à réparer')
          .setRequired(true)
      )
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

    if (user.machines.length === 0) {
      const noMachinesEmbed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('❌ Aucune machine à réparer')
        .setDescription('Vous ne possédez aucune machine!')
        .addFields(
          { name: '🛒 Comment acheter?', value: 'Utilisez `/shop` pour voir la boutique', inline: true }
        );

      await interaction.reply({ embeds: [noMachinesEmbed], ephemeral: true });
      return;
    }

    switch (subcommand) {
      case 'list':
        await handleListMachines(interaction, user, miningService);
        break;
      case 'all':
        await handleRepairAll(interaction, miningService, user);
        break;
      case 'machine':
        await handleRepairMachine(interaction, miningService, user);
        break;
    }

  } catch (error) {
    console.error('Error in repair command:', error);
    
    const errorMessage = {
      content: '❌ Une erreur est survenue lors de l\'exécution de la commande réparation.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function handleListMachines(interaction: ChatInputCommandInteraction, user: any, miningService: MiningService) {
  const machinesInfo = user.machines.map((machine: any, index: number) => {
    const statusIcon = getStatusIcon(machine.durability, machine.efficiency);
    const durabilityBar = createProgressBar(machine.durability, 100);
    const efficiencyBar = createProgressBar(machine.efficiency, 100);

    return {
      name: `${statusIcon} ${machine.type} (Niveau ${machine.level})`,
      value: `🔧 Durabilité: ${durabilityBar} ${machine.durability.toFixed(1)}%
⚙️ Efficacité: ${efficiencyBar} ${machine.efficiency.toFixed(1)}%
🆔 ID: \`${machine.id}\``,
      inline: false
    };
  });

  const damagedCount = user.machines.filter((m: any) => m.durability < 100).length;
  const criticalCount = user.machines.filter((m: any) => m.durability <= 20).length;
  const brokenCount = user.machines.filter((m: any) => m.durability <= 0).length;

  const listEmbed = new EmbedBuilder()
    .setColor(criticalCount > 0 ? 0xE74C3C : damagedCount > 0 ? 0xF39C12 : 0x27AE60)
    .setTitle('🔧 **ÉTAT DE VOS MACHINES**')
    .setDescription(`Vous possédez **${user.machines.length}** machine(s)`)
    .addFields(machinesInfo)
    .addFields(
      { name: '📊 Résumé', value: `🟢 Bon état: ${user.machines.length - damagedCount}
🟡 Endommagées: ${damagedCount - criticalCount}
🔴 Critiques: ${criticalCount - brokenCount}
💀 En panne: ${brokenCount}`, inline: true },
      { name: '💰 Solde actuel', value: `${user.tokens.toFixed(2)} tokens`, inline: true }
    );

  if (damagedCount > 0) {
    listEmbed.addFields(
      { name: '💡 Actions disponibles', value: '• `/repair all` - Réparer toutes les machines\n• `/repair machine <id>` - Réparer une machine spécifique', inline: false }
    );
  }

  listEmbed.setFooter({ text: 'Les machines en panne ne peuvent pas miner!' })
          .setTimestamp();

  // Boutons d'action si nécessaire
  if (damagedCount > 0) {
    const repairAllButton = new ButtonBuilder()
      .setCustomId('repair_all')
      .setLabel(`🔧 Réparer tout (${damagedCount})`)
      .setStyle(ButtonStyle.Primary);

    const selectButton = new ButtonBuilder()
      .setCustomId('repair_select')
      .setLabel('🎯 Réparer machine spécifique')
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(repairAllButton, selectButton);

    const response = await interaction.reply({
      embeds: [listEmbed],
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

      if (buttonInteraction.customId === 'repair_all') {
        await handleRepairAllButton(buttonInteraction, miningService, user.id);
      } else if (buttonInteraction.customId === 'repair_select') {
        await handleSelectMachineButton(buttonInteraction, user, miningService);
      }
    });

  } else {
    await interaction.reply({ embeds: [listEmbed] });
  }
}

async function handleRepairAll(interaction: ChatInputCommandInteraction, miningService: MiningService, user: any) {
  const result = await miningService.repairAllMachines(user.id);

  if (result.success) {
    const successEmbed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle('🔧 **RÉPARATION COMPLÈTE RÉUSSIE!**')
      .setDescription(result.message)
      .addFields(
        { name: '🛠️ Machines réparées', value: `${result.repairedCount} machine(s)`, inline: true },
        { name: '💰 Coût total', value: `${result.totalCost?.toFixed(2)} tokens`, inline: true },
        { name: '✅ État', value: 'Toutes les machines sont opérationnelles!', inline: true }
      )
      .setFooter({ text: 'Vos machines sont maintenant prêtes à miner efficacement!' })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });
  } else {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('❌ Réparation impossible')
      .setDescription(result.message);

    if (result.totalCost) {
      errorEmbed.addFields(
        { name: '💰 Coût requis', value: `${result.totalCost.toFixed(2)} tokens`, inline: true },
        { name: '💡 Solution', value: 'Gagnez plus de tokens avec l\'activité Discord ou le minage!', inline: true }
      );
    }

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleRepairMachine(interaction: ChatInputCommandInteraction, miningService: MiningService, user: any) {
  const machineId = interaction.options.getString('machine_id', true);
  
  // Vérifie que la machine existe
  const machine = user.machines.find((m: any) => m.id === machineId);
  if (!machine) {
    await interaction.reply({
      content: `❌ Machine avec l'ID \`${machineId}\` non trouvée! Utilisez \`/repair list\` pour voir vos machines.`,
      ephemeral: true
    });
    return;
  }

  if (machine.durability >= 100) {
    await interaction.reply({
      content: `✅ La machine **${machine.type}** est déjà en parfait état!`,
      ephemeral: true
    });
    return;
  }

  const result = await miningService.repairMachine(user.id, machineId);

  if (result.success) {
    const successEmbed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle('🔧 **MACHINE RÉPARÉE!**')
      .setDescription(result.message)
      .addFields(
        { name: '🤖 Machine', value: `${machine.type} (Niveau ${machine.level})`, inline: true },
        { name: '💰 Coût', value: `${result.cost?.toFixed(2)} tokens`, inline: true },
        { name: '✨ Bonus', value: '+20% efficacité!', inline: true }
      )
      .setFooter({ text: 'Machine prête à miner à nouveau!' })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });
  } else {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('❌ Réparation impossible')
      .setDescription(result.message);

    if (result.cost) {
      errorEmbed.addFields(
        { name: '💰 Coût requis', value: `${result.cost.toFixed(2)} tokens`, inline: true }
      );
    }

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleRepairAllButton(buttonInteraction: any, miningService: MiningService, userId: string) {
  const result = await miningService.repairAllMachines(userId);

  if (result.success) {
    const successEmbed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle('🔧 Réparation complète réussie!')
      .setDescription(`✅ ${result.repairedCount} machines réparées pour ${result.totalCost?.toFixed(2)} tokens`)
      .setFooter({ text: 'Toutes vos machines sont opérationnelles!' });

    await buttonInteraction.update({
      embeds: [successEmbed],
      components: []
    });
  } else {
    await buttonInteraction.reply({
      content: `❌ ${result.message}`,
      ephemeral: true
    });
  }
}

async function handleSelectMachineButton(buttonInteraction: any, user: any, miningService: MiningService) {
  const damagedMachines = user.machines.filter((m: any) => m.durability < 100);
  
  if (damagedMachines.length === 0) {
    await buttonInteraction.reply({
      content: '✅ Toutes vos machines sont en parfait état!',
      ephemeral: true
    });
    return;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_machine_repair')
    .setPlaceholder('Choisissez une machine à réparer...')
    .addOptions(
      damagedMachines.map((machine: any) => ({
        label: `${machine.type} (Niveau ${machine.level})`,
        description: `Durabilité: ${machine.durability.toFixed(1)}% • Efficacité: ${machine.efficiency.toFixed(1)}%`,
        value: machine.id,
        emoji: getStatusEmoji(machine.durability)
      }))
    );

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);

  const response = await buttonInteraction.update({
    content: '🎯 **Sélectionnez la machine à réparer:**',
    components: [selectRow]
  });

  // Collecteur pour le menu de sélection
  const selectCollector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 60000 // 1 minute
  });

  selectCollector.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
    if (selectInteraction.user.id !== buttonInteraction.user.id) {
      await selectInteraction.reply({
        content: '❌ Vous ne pouvez pas utiliser ce menu!',
        ephemeral: true
      });
      return;
    }

    const machineId = selectInteraction.values[0];
    const result = await miningService.repairMachine(user.id, machineId);

    if (result.success) {
      const machine = user.machines.find((m: any) => m.id === machineId);
      const successEmbed = new EmbedBuilder()
        .setColor(0x27AE60)
        .setTitle('🔧 Machine réparée!')
        .setDescription(`✅ **${machine.type}** réparée pour ${result.cost?.toFixed(2)} tokens`)
        .addFields(
          { name: '✨ Bonus', value: '+20% efficacité!', inline: true }
        );

      await selectInteraction.update({
        embeds: [successEmbed],
        components: []
      });
    } else {
      await selectInteraction.update({
        content: `❌ ${result.message}`,
        components: []
      });
    }
  });
}

// Fonctions utilitaires
function getStatusIcon(durability: number, efficiency: number): string {
  if (durability <= 0) return '💀';
  if (durability <= 20) return '🔴';
  if (durability <= 50) return '🟡';
  if (efficiency >= 90) return '✨';
  return '🟢';
}

function getStatusEmoji(durability: number): string {
  if (durability <= 0) return '💀';
  if (durability <= 20) return '🔴';
  if (durability <= 50) return '🟡';
  return '🟢';
}

function createProgressBar(current: number, max: number, length: number = 10): string {
  const percentage = Math.max(0, Math.min(1, current / max));
  const filledLength = Math.round(length * percentage);
  const emptyLength = length - filledLength;
  
  let bar = '';
  for (let i = 0; i < filledLength; i++) {
    bar += '█';
  }
  for (let i = 0; i < emptyLength; i++) {
    bar += '░';
  }
  
  return `\`${bar}\``;
}