import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { MachineType, TransactionType } from '@prisma/client';

export const data = new SlashCommandBuilder()
  .setName('register')
  .setDescription('🎮 Rejoignez le monde du minage de tokens! Créez votre compte de mineur');

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const databaseService = services.get('database');
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await databaseService.client.user.findUnique({
      where: { discordId: interaction.user.id },
      include: { machines: true }
    });

    if (existingUser) {
      const alreadyRegisteredEmbed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('🎮 Déjà inscrit!')
        .setDescription(`Bonjour **${existingUser.username}** ! Vous êtes déjà un mineur expérimenté.`)
        .addFields(
          { name: '📍 Votre lieu', value: existingUser.location, inline: true },
          { name: '🪙 Tokens', value: `${existingUser.tokens.toFixed(2)}`, inline: true },
          { name: '💵 Dollars', value: `${existingUser.dollars.toFixed(2)}$`, inline: true },
          { name: '🏭 Machines', value: `${existingUser.machines.length} machine(s)`, inline: true },
          { name: '⚡ Énergie', value: `${existingUser.energy}/100`, inline: true },
          { name: '📊 Niveau', value: `${existingUser.level}`, inline: true }
        )
        .addFields({
          name: '💡 Commandes utiles',
          value: '• `/profile` - Voir votre profil\n• `/shop` - Boutique générale\n• `/mine status` - État du minage\n• `/help` - Guide complet',
          inline: false
        })
        .setFooter({ text: 'Bon minage! ⛏️' })
        .setTimestamp();

      await interaction.reply({ embeds: [alreadyRegisteredEmbed] });
      return;
    }

    // Afficher l'interface d'inscription
    await showRegistrationInterface(interaction, services);

  } catch (error) {
    console.error('Error in register command:', error);
    
    const errorMessage = {
      content: '❌ Une erreur est survenue lors de l\'inscription.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function showRegistrationInterface(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('🎮 **BIENVENUE DANS MARMOTTE MINING!** 🎮')
    .setDescription(`Salut **${interaction.user.displayName || interaction.user.username}** ! Prêt à devenir un mineur de tokens légendaire?`)
    .addFields(
      {
        name: '🏠 **VOTRE DÉBUT**',
        value: `📍 **Lieu de départ**: Chambre chez maman\n🏭 **Équipement**: 1x Basic Rig (offerte!)\n💰 **Budget**: 0 tokens (mais pas de panique!)`,
        inline: false
      },
      {
        name: '💰 **COMMENT GAGNER DE L\'ARGENT**',
        value: `💬 **Messages Discord**: +1$ par message\n😊 **Réactions**: +0.5$ par réaction\n🎤 **Vocal**: +2$/heure\n📅 **Connexion quotidienne**: +10$ + bonus`,
        inline: false
      },
      {
        name: '🎯 **VOS OBJECTIFS**',
        value: `1️⃣ Chattez pour gagner des dollars\n2️⃣ Échangez vos dollars contre des tokens\n3️⃣ Achetez de meilleures machines\n4️⃣ Devenez le roi du minage!`,
        inline: false
      },
      {
        name: '⚔️ **FONCTIONNALITÉS AVANCÉES**',
        value: `🦠 **PvP**: Sabotez vos concurrents\n🛡️ **Défenses**: Protégez vos investissements\n🎲 **Missions**: Gagnez des récompenses\n🏆 **Battles Royale**: Compétitions épiques`,
        inline: false
      },
      {
        name: '🚀 **PRÊT POUR L\'AVENTURE?**',
        value: `Cliquez sur **"Commencer l'aventure"** pour créer votre compte de mineur et recevoir votre machine de départ gratuite!`,
        inline: false
      }
    )
    .setFooter({ text: 'Une fois inscrit, tapez /help pour le guide complet!' })
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  // Boutons d'inscription
  const startButton = new ButtonBuilder()
    .setCustomId('register_confirm')
    .setLabel('🚀 Commencer l\'aventure!')
    .setStyle(ButtonStyle.Success);

  const infoButton = new ButtonBuilder()
    .setCustomId('register_info')
    .setLabel('ℹ️ Plus d\'infos')
    .setStyle(ButtonStyle.Secondary);

  const cancelButton = new ButtonBuilder()
    .setCustomId('register_cancel')
    .setLabel('❌ Annuler')
    .setStyle(ButtonStyle.Danger);

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(startButton, infoButton, cancelButton);

  const response = await interaction.reply({
    embeds: [welcomeEmbed],
    components: [actionRow],
    fetchReply: true
  });

  // Collecteur d'interactions
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
      case 'register_confirm':
        await handleRegistration(buttonInteraction, services);
        break;
      case 'register_info':
        await showMoreInfo(buttonInteraction);
        break;
      case 'register_cancel':
        await buttonInteraction.update({
          content: '👋 Inscription annulée. Vous pouvez revenir quand vous voulez avec `/register`!',
          embeds: [],
          components: []
        });
        break;
    }
  });

  // Nettoyage après expiration
  collector.on('end', async () => {
    try {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          startButton.setDisabled(true),
          infoButton.setDisabled(true),
          cancelButton.setDisabled(true)
        );

      await interaction.editReply({
        components: [disabledRow]
      });
    } catch (error) {
      // Ignore les erreurs de modification après expiration
    }
  });
}

async function handleRegistration(buttonInteraction: any, services: Map<string, any>) {
  const databaseService = services.get('database');
  
  try {
    // Créer l'utilisateur et lui donner une machine de départ
    const newUser = await databaseService.client.$transaction(async (tx: any) => {
      // Créer l'utilisateur
      const user = await tx.user.create({
        data: {
          discordId: buttonInteraction.user.id,
          username: buttonInteraction.user.displayName || buttonInteraction.user.username,
          tokens: 0.0,
          dollars: 0.0,
          energy: 100,
          location: "Chambre chez maman",
          experience: 0,
          level: 1
        }
      });

      // Ajouter la machine de départ gratuite
      await tx.machine.create({
        data: {
          userId: user.id,
          type: MachineType.BASIC_RIG,
          level: 1,
          efficiency: 100.0,
          durability: 100.0
        }
      });

      // Enregistrer la transaction pour la machine gratuite
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.REGISTRATION_BONUS,
          amount: 0,
          description: "Machine de départ gratuite: BASIC RIG"
        }
      });

      return user;
    });

    // Embed de confirmation d'inscription
    const successEmbed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle('🎉 **INSCRIPTION RÉUSSIE!** 🎉')
      .setDescription(`Félicitations **${newUser.username}** ! Votre aventure de mineur commence maintenant!`)
      .addFields(
        { name: '📍 Votre lieu', value: '🏠 Chambre chez maman', inline: true },
        { name: '🏭 Votre machine', value: '🔧 Basic Rig (niveau 1)', inline: true },
        { name: '⚡ Votre énergie', value: '100/100', inline: true },
        { name: '💰 Votre budget', value: '0 tokens | 0$', inline: true },
        { name: '📊 Votre niveau', value: 'Niveau 1 (débutant)', inline: true },
        { name: '🎯 Statut', value: 'Prêt à miner!', inline: true }
      )
      .addFields({
        name: '🚀 **PREMIERS PAS RECOMMANDÉS**',
        value: `1️⃣ Tapez \`/mine start\` pour commencer à miner\n2️⃣ Chattez dans Discord pour gagner des dollars\n3️⃣ Utilisez \`/exchange\` pour convertir $ → tokens\n4️⃣ Explorez \`/shop\` pour améliorer votre équipement\n5️⃣ Consultez \`/help\` pour le guide complet`,
        inline: false
      })
      .addFields({
        name: '💡 **CONSEIL DE MINEUR EXPERT**',
        value: `Votre Basic Rig génère **0.1 tokens/seconde**. Même modeste, elle peut vous rapporter ~360 tokens/heure ! Laissez-la tourner et revenez collecter vos gains régulièrement.`,
        inline: false
      })
      .setFooter({ text: 'Bienvenue dans la communauté des mineurs! 🎮⛏️' })
      .setThumbnail(buttonInteraction.user.displayAvatarURL())
      .setTimestamp();

    // Boutons d'actions rapides
    const startMiningButton = new ButtonBuilder()
      .setCustomId('quick_start_mining')
      .setLabel('⛏️ Commencer à miner')
      .setStyle(ButtonStyle.Success);

    const viewProfileButton = new ButtonBuilder()
      .setCustomId('quick_view_profile')
      .setLabel('👤 Voir mon profil')
      .setStyle(ButtonStyle.Primary);

    const visitShopButton = new ButtonBuilder()
      .setCustomId('quick_visit_shop')
      .setLabel('🛒 Visiter la boutique')
      .setStyle(ButtonStyle.Secondary);

    const quickActionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(startMiningButton, viewProfileButton, visitShopButton);

    await buttonInteraction.update({
      embeds: [successEmbed],
      components: [quickActionRow]
    });

    // Collecteur pour les actions rapides
    const quickCollector = buttonInteraction.message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    quickCollector.on('collect', async (quickInteraction) => {
      if (quickInteraction.user.id !== buttonInteraction.user.id) {
        await quickInteraction.reply({
          content: '❌ Ces boutons ne sont pas pour vous!',
          ephemeral: true
        });
        return;
      }

      switch (quickInteraction.customId) {
        case 'quick_start_mining':
          await quickInteraction.reply({
            content: '⛏️ **Tapez `/mine start` pour démarrer votre machine!**\n💡 *Votre Basic Rig va commencer à générer des tokens automatiquement.*',
            ephemeral: true
          });
          break;
        case 'quick_view_profile':
          await quickInteraction.reply({
            content: '👤 **Tapez `/profile` pour voir votre profil complet!**\n📊 *Vous y trouverez toutes vos statistiques et informations.*',
            ephemeral: true
          });
          break;
        case 'quick_visit_shop':
          await quickInteraction.reply({
            content: '🛒 **Tapez `/shop` pour explorer la boutique!**\n💡 *Découvrez toutes les machines, cartes et objets disponibles.*',
            ephemeral: true
          });
          break;
      }
    });

    console.log(`New user registered: ${newUser.username} (${newUser.discordId})`);

  } catch (error) {
    console.error('Error during registration:', error);
    
    await buttonInteraction.update({
      content: '❌ Une erreur est survenue lors de l\'inscription. Veuillez réessayer.',
      embeds: [],
      components: []
    });
  }
}

async function showMoreInfo(buttonInteraction: any) {
  const infoEmbed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('ℹ️ **GUIDE DU DÉBUTANT** ℹ️')
    .setDescription('Tout ce que vous devez savoir avant de commencer!')
    .addFields(
      {
        name: '💰 **SYSTÈME ÉCONOMIQUE**',
        value: `**Dollars ($)**: Gagnés par activité Discord\n**Tokens**: Monnaie principale du jeu\n**Taux de change**: 10$ = 1 token\n**Minage**: Les machines génèrent des tokens automatiquement`,
        inline: false
      },
      {
        name: '🏭 **MACHINES DE MINAGE**',
        value: `**Basic Rig**: 0.1 tokens/sec (gratuite au début)\n**Advanced Rig**: 0.5 tokens/sec (500 tokens)\n**Quantum Miner**: 2.0 tokens/sec (2000 tokens)\n**Fusion Reactor**: 10.0 tokens/sec (10000 tokens)\n**Mega Farm**: 50.0 tokens/sec (50000 tokens)`,
        inline: false
      },
      {
        name: '⚔️ **SYSTÈME PvP**',
        value: `**Cartes d'attaque**: Sabotez les machines ennemies\n**Cartes de défense**: Protégez-vous des attaques\n**Missions**: Gagnez des cartes et fragments\n**Énergie**: Nécessaire pour les actions spéciales`,
        inline: false
      },
      {
        name: '🎮 **PROGRESSION**',
        value: `**Niveaux**: Montez en expérience pour débloquer des bonus\n**Lieux**: Améliorez votre lieu de minage\n**Battles Royale**: Compétitions pour de gros gains\n**Leaderboards**: Classements des meilleurs mineurs`,
        inline: false
      },
      {
        name: '💡 **CONSEILS PRO**',
        value: `• Commencez par chattez pour gagner des dollars\n• Votre machine gratuite génère des tokens même hors ligne\n• Investissez dans des défenses rapidement\n• Participez aux événements pour des bonus\n• Gérez votre énergie intelligemment`,
        inline: false
      }
    )
    .setFooter({ text: 'Prêt à commencer votre aventure?' });

  // Bouton pour revenir à l'inscription
  const backButton = new ButtonBuilder()
    .setCustomId('back_to_registration')
    .setLabel('🔙 Retour à l\'inscription')
    .setStyle(ButtonStyle.Primary);

  const confirmRegistrationButton = new ButtonBuilder()
    .setCustomId('register_confirm')
    .setLabel('🚀 Je suis prêt!')
    .setStyle(ButtonStyle.Success);

  const infoActionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(backButton, confirmRegistrationButton);

  await buttonInteraction.update({
    embeds: [infoEmbed],
    components: [infoActionRow]
  });
}
