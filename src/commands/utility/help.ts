// src/commands/utility/help.ts - Version mise à jour sans vocal + salaire
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('📚 Guide complet du jeu Marmotte Mining')
  .addStringOption(option =>
    option.setName('section')
      .setDescription('Section spécifique du guide')
      .addChoices(
        { name: '💰 Système d\'activité', value: 'activity' },
        { name: '💵 Salaire hebdomadaire', value: 'salary' },
        { name: '⛏️ Minage (à venir)', value: 'mining' },
        { name: '⚔️ Battles (à venir)', value: 'battles' },
        { name: '📊 Économie', value: 'economy' },
        { name: '🎮 Commandes', value: 'commands' }
      ));

export async function execute(interaction: ChatInputCommandInteraction) {
  const section = interaction.options.getString('section');

  if (section) {
    await showSpecificSection(interaction, section);
  } else {
    await showMainHelp(interaction);
  }
}

async function showMainHelp(interaction: ChatInputCommandInteraction) {
  const mainEmbed = new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle('🎮 Marmotte Mining Bot - Guide Complet')
    .setDescription('Bienvenue dans le monde du minage de tokens fictifs !')
    .addFields(
      {
        name: '💰 Gagner des Dollars',
        value: '• **Messages**: +1$ par message (max 50$/jour)\n• **Réactions**: +0.5$ par réaction (max 20/jour)\n• **Salaire**: +250$ chaque semaine (/salaire)',
        inline: false
      },
      {
        name: '🎯 Multiplicateurs',
        value: '• Messages longs: +20-30% bonus\n• Mots-clés jeu: +10% par mot\n• Emojis spéciaux: +50% réactions',
        inline: false
      },
      {
        name: '📊 Système d\'Économie',
        value: '• **Dollars ($)**: Activité Discord\n• **Tokens**: Minage et jeu\n• **Échange**: 10$ = 1 token',
        inline: false
      },
      {
        name: '🎮 Commandes Principales',
        value: '• `/profile` - Votre profil\n• `/balance` - Vos soldes\n• `/salaire` - Salaire hebdomadaire\n• `/help` - Ce guide',
        inline: false
      },
      {
        name: '🚧 À Venir',
        value: '• ⛏️ Machines de minage\n• ⚔️ Battles royales\n• 🏪 Système de boutique\n• 🏆 Leaderboards',
        inline: false
      }
    )
    .setFooter({ text: 'Utilisez /help <section> pour plus de détails' })
    .setTimestamp();

  await interaction.reply({ embeds: [mainEmbed] });
}

async function showSpecificSection(interaction: ChatInputCommandInteraction, section: string) {
  let embed: EmbedBuilder;

  switch (section) {
    case 'activity':
      embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('💰 Système d\'Activité Discord')
        .setDescription('Gagnez des dollars en étant actif sur le serveur !')
        .addFields(
          {
            name: '📝 Messages',
            value: '• **Base**: +1$ par message\n• **Limite**: 50$/jour maximum\n• **Bonus longueur**: +20% (>50 chars), +30% (>100 chars)\n• **Mots-clés**: +10% par mot lié au jeu\n• **Anti-spam**: Messages courts = -50%',
            inline: false
          },
          {
            name: '👍 Réactions',
            value: '• **Base**: +0.5$ par réaction\n• **Limite**: 20 réactions/jour max\n• **Bonus emojis**: ⛏️💎🚀💰🔥⚔️ = +50%\n• **Feedback**: Réaction 💰 automatique',
            inline: false
          },
          {
            name: '🎯 Mots-clés Bonus',
            value: '`mining`, `minage`, `token`, `battle`, `machine`, `salaire`',
            inline: false
          },
          {
            name: '📊 Suivi',
            value: '• Stats quotidiennes en cache\n• Historique complet en base\n• Réinitialisation automatique',
            inline: false
          }
        )
        .setFooter({ text: 'Les récompenses sont calculées en temps réel !' });
      break;

    case 'salary':
      embed = new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle('💵 Salaire Hebdomadaire')
        .setDescription('Récupérez votre salaire chaque semaine avec des bonus d\'activité !')
        .addFields(
          {
            name: '💰 Salaire de Base',
            value: '**250$** garanti chaque semaine',
            inline: true
          },
          {
            name: '⏰ Fréquence',
            value: 'Disponible **toutes les 7 jours**',
            inline: true
          },
          {
            name: '🎯 Bonus d\'Activité',
            value: '• **Jours actifs**: +7$ par jour (max +50$)\n• **100+ actions**: +25$ bonus\n• **200+ actions**: +50$ bonus\n• **350+ actions**: +100$ bonus\n• **Maximum total**: +100$ bonus',
            inline: false
          },
          {
            name: '📈 Calcul des Actions',
            value: '• 1 message = 1 action\n• 1 réaction = 2 actions\n• Exemple: 200 messages + 75 réactions = 350 actions',
            inline: false
          },
          {
            name: '🎮 Utilisation',
            value: '`/salaire` - Récupérer votre salaire\n\nLe bot vous indique quand il sera disponible !',
            inline: false
          }
        )
        .setFooter({ text: 'Plus vous êtes actif, plus vous gagnez !' });
      break;

    case 'mining':
      embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('⛏️ Système de Minage')
        .setDescription('🚧 **En développement** - Bientôt disponible !')
        .addFields(
          {
            name: '🏭 Machines Prévues',
            value: '• **Basic Rig**: Machine de départ\n• **Advanced Rig**: Plus efficace\n• **Quantum Miner**: Technologie avancée\n• **Fusion Reactor**: Puissance maximale\n• **Mega Farm**: Infrastructure complète',
            inline: false
          },
          {
            name: '⚙️ Fonctionnalités',
            value: '• Hash rate évolutif\n• Système d\'upgrade\n• Gestion de la durabilité\n• Maintenance automatique',
            inline: false
          },
          {
            name: '📊 Économie',
            value: '• Achat avec dollars ($)\n• Production de tokens\n• Prix fluctuants\n• ROI calculé',
            inline: false
          }
        )
        .setFooter({ text: 'Patience, le minage arrive bientôt !' });
      break;

    case 'battles':
      embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('⚔️ Battle Royale')
        .setDescription('🚧 **En développement** - Bientôt disponible !')
        .addFields(
          {
            name: '🎮 Format',
            value: '• **10 joueurs maximum**\n• **Élimination progressive**\n• **Récompenses graduées**\n• **Entrée payante en tokens**',
            inline: false
          },
          {
            name: '🏆 Récompenses',
            value: '• **1er place**: 50% du prize pool\n• **2e place**: 25% du prize pool\n• **3e place**: 15% du prize pool\n• **Autres**: Participation',
            inline: false
          },
          {
            name: '⚡ Mécaniques',
            value: '• Stats de machines\n• Stratégie automatique\n• Cooldown entre battles\n• Classements',
            inline: false
          }
        )
        .setFooter({ text: 'Préparez vos machines pour la bataille !' });
      break;

    case 'economy':
      embed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('📊 Système Économique')
        .setDescription('Comprenez l\'économie dual du jeu !')
        .addFields(
          {
            name: '💵 Dollars ($)',
            value: '• **Source**: Activité Discord + salaire\n• **Usage**: Achat de machines\n• **Échange**: 10$ = 1 token\n• **Stockage**: Illimité',
            inline: false
          },
          {
            name: '🪙 Tokens',
            value: '• **Source**: Minage + battles + échange\n• **Usage**: Entrée battles + upgrades\n• **Fluctuations**: Prix variables\n• **Rareté**: Limitée par le minage',
            inline: false
          },
          {
            name: '🔄 Taux de Change',
            value: '• **Fixe**: 10$ → 1 token\n• **Sens unique**: Pas de retour\n• **Stratégie**: Timing important\n• **Inflation**: Contrôlée',
            inline: false
          },
          {
            name: '📈 Progression',
            value: '1. Gagner des $ via activité\n2. Acheter des machines\n3. Miner des tokens\n4. Participer aux battles\n5. Réinvestir les gains',
            inline: false
          }
        )
        .setFooter({ text: 'Investissez intelligemment !' });
      break;

    case 'commands':
      embed = new EmbedBuilder()
        .setColor('#34495E')
        .setTitle('🎮 Liste des Commandes')
        .setDescription('Toutes les commandes disponibles')
        .addFields(
          {
            name: '📊 Commandes de Base',
            value: '• `/profile` - Affiche votre profil complet\n• `/balance` - Vos soldes dollars et tokens\n• `/help` - Ce guide d\'aide\n• `/salaire` - Récupérer votre salaire hebdomadaire',
            inline: false
          },
          {
            name: '⛏️ Minage (Bientôt)',
            value: '• `/shop` - Boutique de machines\n• `/mine start/stop` - Contrôle du minage\n• `/inventory` - Vos machines\n• `/upgrade` - Améliorer machines',
            inline: false
          },
          {
            name: '⚔️ Battles (Bientôt)',
            value: '• `/battle join` - Rejoindre une bataille\n• `/battle create` - Créer une bataille\n• `/battle list` - Battles disponibles\n• `/leaderboard` - Classements',
            inline: false
          },
          {
            name: '💱 Économie (Bientôt)',
            value: '• `/exchange` - Échanger $ → tokens\n• `/market` - Prix du marché\n• `/history` - Historique transactions',
            inline: false
          }
        )
        .setFooter({ text: 'Les commandes marquées "Bientôt" arrivent dans la prochaine version !' });
      break;

    default:
      embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('❌ Section Inconnue')
        .setDescription('Cette section n\'existe pas. Utilisez `/help` pour voir toutes les sections disponibles.');
  }

  await interaction.reply({ embeds: [embed] });
}