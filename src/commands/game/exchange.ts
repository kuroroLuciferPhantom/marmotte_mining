import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { TransactionType } from '@prisma/client';
import { ActivityService } from '../../services/activity/ActivityService';

export const data = new SlashCommandBuilder()
  .setName('exchange')
  .setDescription('💱 Échangez vos dollars contre des tokens pour acheter des machines')
  .addNumberOption(option =>
    option.setName('montant')
      .setDescription('Montant en dollars à échanger (10$ = 1 token)')
      .setRequired(false)
      .setMinValue(1)
  );

const EXCHANGE_RATE = 10; // 10 dollars = 1 token

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const activityService = services.get('activity') as ActivityService;
    const databaseService = services.get('database');
    const amount = interaction.options.getNumber('montant');
    
    // Récupère l'utilisateur actuel
    const user = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id }
    });

    if (!user) {
      await interaction.reply({
        content: '❌ Vous devez d\'abord créer un compte! Utilisez `/profile` ou `/balance`.',
        ephemeral: true
      });
      return;
    }

    // Récupère le solde en dollars
    const dollarBalance = await activityService.getUserDollarBalance(interaction.user.id);

    if (!amount) {
      // Affiche l'interface d'échange
      await showExchangeInterface(interaction, user, dollarBalance);
    } else {
      // Traite l'échange direct
      await processExchange(interaction, user, dollarBalance, amount, databaseService, activityService);
    }

  } catch (error) {
    console.error('Error in exchange command:', error);
    
    const errorMessage = {
      content: '❌ Une erreur est survenue lors de l\'échange.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function showExchangeInterface(interaction: ChatInputCommandInteraction, user: any, dollarBalance: number) {
  const maxExchange = Math.floor(dollarBalance / EXCHANGE_RATE);
  const potentialTokens = dollarBalance / EXCHANGE_RATE;

  const exchangeEmbed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('💱 **BUREAU DE CHANGE**')
    .setDescription('Convertissez vos dollars en tokens pour acheter des machines!')
    .addFields(
      { name: '💵 Votre solde', value: `**${dollarBalance.toFixed(2)}$**`, inline: true },
      { name: '🪙 Tokens actuels', value: `**${user.tokens.toFixed(2)}**`, inline: true },
      { name: '📊 Taux de change', value: `**${EXCHANGE_RATE}$ = 1 token**`, inline: true },
      { name: '🔄 Échange maximum', value: `**${maxExchange} tokens**`, inline: true },
      { name: '💰 Valeur totale', value: `~${potentialTokens.toFixed(2)} tokens`, inline: true },
      { name: '📈 Total après échange', value: `${(user.tokens + potentialTokens).toFixed(2)} tokens`, inline: true }
    );

  if (dollarBalance < EXCHANGE_RATE) {
    exchangeEmbed.addFields({
      name: '❌ Fonds insuffisants',
      value: `Vous avez besoin d'au moins **${EXCHANGE_RATE}$** pour effectuer un échange.\n\n💡 **Comment gagner des dollars?**\n• Écrire des messages (+1$)\n• Ajouter des réactions (+0.5$)\n• Rester en vocal (+2$/heure)\n• Connexion quotidienne (+10$)`,
      inline: false
    });

    await interaction.reply({ embeds: [exchangeEmbed] });
    return;
  }

  // Boutons pour différents montants
  const buttons = [];
  
  // Bouton pour échanger 25% des dollars
  const quarter = Math.floor(dollarBalance * 0.25 / EXCHANGE_RATE) * EXCHANGE_RATE;
  if (quarter >= EXCHANGE_RATE) {
    buttons.push(new ButtonBuilder()
      .setCustomId(`exchange_${quarter}`)
      .setLabel(`25% (${quarter}$ = ${quarter/EXCHANGE_RATE} tokens)`)
      .setStyle(ButtonStyle.Secondary));
  }

  // Bouton pour échanger 50% des dollars
  const half = Math.floor(dollarBalance * 0.5 / EXCHANGE_RATE) * EXCHANGE_RATE;
  if (half >= EXCHANGE_RATE) {
    buttons.push(new ButtonBuilder()
      .setCustomId(`exchange_${half}`)
      .setLabel(`50% (${half}$ = ${half/EXCHANGE_RATE} tokens)`)
      .setStyle(ButtonStyle.Primary));
  }

  // Bouton pour échanger 100% des dollars
  const all = Math.floor(dollarBalance / EXCHANGE_RATE) * EXCHANGE_RATE;
  if (all >= EXCHANGE_RATE) {
    buttons.push(new ButtonBuilder()
      .setCustomId(`exchange_${all}`)
      .setLabel(`MAX (${all}$ = ${all/EXCHANGE_RATE} tokens)`)
      .setStyle(ButtonStyle.Success));
  }

  // Organisez les boutons en lignes (max 5 par ligne)
  const actionRows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(buttons.slice(i, i + 5));
    actionRows.push(row);
  }

  exchangeEmbed.setFooter({ text: 'Choisissez un montant ou utilisez /exchange <montant>' });

  const response = await interaction.reply({
    embeds: [exchangeEmbed],
    components: actionRows,
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
        content: '❌ Vous ne pouvez pas utiliser ce bureau de change!',
        ephemeral: true
      });
      return;
    }

    const amount = parseInt(buttonInteraction.customId.replace('exchange_', ''));
    
    // Récupère les données utilisateur actualisées
    const currentUser = await buttonInteraction.client.services?.get('database')?.client.user.findUnique({
      where: { discordId: interaction.user.id }
    }) || user;

    const currentDollarBalance = await buttonInteraction.client.services?.get('activity')?.getUserDollarBalance(interaction.user.id) || dollarBalance;

    await processExchangeButton(buttonInteraction, currentUser, currentDollarBalance, amount);
  });

  // Nettoyage après expiration
  collector.on('end', async () => {
    try {
      const disabledRows = actionRows.map(row => {
        const disabledButtons = row.components.map(button => 
          ButtonBuilder.from(button).setDisabled(true)
        );
        return new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButtons);
      });

      await interaction.editReply({
        components: disabledRows
      });
    } catch (error) {
      // Ignore les erreurs de modification après expiration
    }
  });
}

async function processExchange(
  interaction: ChatInputCommandInteraction, 
  user: any, 
  dollarBalance: number, 
  amount: number,
  databaseService: any,
  activityService: ActivityService
) {
  if (amount < EXCHANGE_RATE) {
    await interaction.reply({
      content: `❌ Le montant minimum d'échange est de **${EXCHANGE_RATE}$**!`,
      ephemeral: true
    });
    return;
  }

  if (amount > dollarBalance) {
    await interaction.reply({
      content: `❌ Fonds insuffisants! Vous avez **${dollarBalance.toFixed(2)}$** mais tentez d'échanger **${amount}$**.`,
      ephemeral: true
    });
    return;
  }

  // Vérifie que le montant est un multiple du taux de change
  if (amount % EXCHANGE_RATE !== 0) {
    await interaction.reply({
      content: `❌ Le montant doit être un multiple de **${EXCHANGE_RATE}$**! Exemple: ${EXCHANGE_RATE}, ${EXCHANGE_RATE * 2}, ${EXCHANGE_RATE * 3}...`,
      ephemeral: true
    });
    return;
  }

  const tokensToReceive = amount / EXCHANGE_RATE;

  try {
    // Transaction pour l'échange
    await databaseService.client.$transaction(async (tx: any) => {
      // Débite les dollars (via ActivityService)
      await activityService.deductDollars(interaction.user.id, amount);

      // Crédite les tokens
      await tx.user.update({
        where: { id: user.id },
        data: { tokens: { increment: tokensToReceive } }
      });

      // Enregistre la transaction
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.DOLLAR_EXCHANGE,
          amount: tokensToReceive,
          description: `Échange: ${amount}$ → ${tokensToReceive} tokens`
        }
      });
    });

    const successEmbed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle('✅ **ÉCHANGE RÉUSSI!**')
      .setDescription(`Vous avez échangé **${amount}$** contre **${tokensToReceive} tokens**!`)
      .addFields(
        { name: '💵 Dollars dépensés', value: `${amount}$`, inline: true },
        { name: '🪙 Tokens reçus', value: `${tokensToReceive}`, inline: true },
        { name: '📊 Taux appliqué', value: `${EXCHANGE_RATE}$ = 1 token`, inline: true },
        { name: '💰 Nouveau solde', value: `${(user.tokens + tokensToReceive).toFixed(2)} tokens`, inline: false },
        { name: '💡 Prochaine étape', value: 'Utilisez `/shop` pour acheter des machines!', inline: false }
      )
      .setFooter({ text: 'Bon minage! ⛏️' })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });

  } catch (error) {
    console.error('Error processing exchange:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors de l\'échange. Veuillez réessayer.',
      ephemeral: true
    });
  }
}

async function processExchangeButton(buttonInteraction: any, user: any, dollarBalance: number, amount: number) {
  if (amount > dollarBalance) {
    await buttonInteraction.reply({
      content: `❌ Fonds insuffisants! Vous avez **${dollarBalance.toFixed(2)}$** mais tentez d'échanger **${amount}$**.`,
      ephemeral: true
    });
    return;
  }

  const tokensToReceive = amount / EXCHANGE_RATE;

  try {
    const databaseService = buttonInteraction.client.services?.get('database');
    const activityService = buttonInteraction.client.services?.get('activity');

    if (!databaseService || !activityService) {
      throw new Error('Services not available');
    }

    // Transaction pour l'échange
    await databaseService.client.$transaction(async (tx: any) => {
      // Débite les dollars
      await activityService.deductDollars(buttonInteraction.user.id, amount);

      // Crédite les tokens
      await tx.user.update({
        where: { id: user.id },
        data: { tokens: { increment: tokensToReceive } }
      });

      // Enregistre la transaction
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.DOLLAR_EXCHANGE,
          amount: tokensToReceive,
          description: `Échange: ${amount}$ → ${tokensToReceive} tokens`
        }
      });
    });

    const successEmbed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle('✅ Échange réussi!')
      .setDescription(`**${amount}$** → **${tokensToReceive} tokens**`)
      .addFields(
        { name: '🆕 Nouveau solde', value: `${(user.tokens + tokensToReceive).toFixed(2)} tokens`, inline: true },
        { name: '💡 Suggestion', value: 'Visitez `/shop` pour acheter des machines!', inline: true }
      )
      .setFooter({ text: 'Bon minage! ⛏️' });

    await buttonInteraction.update({
      embeds: [successEmbed],
      components: []
    });

  } catch (error) {
    console.error('Error processing exchange button:', error);
    await buttonInteraction.reply({
      content: '❌ Une erreur est survenue lors de l\'échange. Veuillez réessayer.',
      ephemeral: true
    });
  }
}