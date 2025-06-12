import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Affiche la liste des commandes et comment jouer');

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🎮 Marmotte Mining - Guide du Joueur')
      .setDescription('Bienvenue dans le jeu de minage le plus addictif de Discord!')
      .addFields(
        {
          name: '💰 Commandes de Base',
          value: '• `/profile` - Votre profil de mineur\n• `/balance` - Vos tokens et dollars\n• `/help` - Ce message d\'aide',
          inline: false
        },
        {
          name: '⛏️ Commandes de Minage (Bientôt)',
          value: '• `/shop` - Boutique de machines\n• `/mine start` - Démarrer le minage\n• `/mine stop` - Arrêter le minage\n• `/inventory` - Vos machines',
          inline: false
        },
        {
          name: '⚔️ Batailles (Bientôt)',
          value: '• `/battle join` - Rejoindre une bataille\n• `/battle create` - Créer une bataille\n• `/battle list` - Voir les batailles actives',
          inline: false
        },
        {
          name: '📊 Statistiques (Bientôt)',
          value: '• `/leaderboard` - Classement des joueurs\n• `/price` - Prix actuel du token\n• `/stats` - Statistiques du serveur',
          inline: false
        },
        {
          name: '💵 Comment gagner des Dollars?',
          value: '🔥 **Actuellement disponible:**\n• **Messages**: +1$ par message (max 50$/jour)\n• **Réactions**: +0.5$ par réaction (max 10$/jour)\n• **Vocal**: +2$/heure (max 5h/jour)\n• **Connexion quotidienne**: +10$ + bonus streak',
          inline: false
        },
        {
          name: '🪙 Comment gagner des Tokens?',
          value: '🔜 **Bientôt disponible:**\n• **Échanger des dollars** contre des tokens\n• **Miner** avec vos machines\n• **Gagner des batailles** royales\n• **Événements spéciaux** aléatoires',
          inline: false
        },
        {
          name: '🎯 Stratégie de jeu',
          value: '1️⃣ Chattez pour gagner des dollars\n2️⃣ Échangez vos dollars contre des tokens\n3️⃣ Achetez une machine de minage\n4️⃣ Minez automatiquement\n5️⃣ Participez aux batailles pour plus de gains',
          inline: false
        },
        {
          name: '🏪 Types de Machines (Bientôt)',
          value: '• **BASIC_RIG** (100 tokens) - Pour débuter\n• **ADVANCED_RIG** (500 tokens) - Plus efficace\n• **QUANTUM_MINER** (2000 tokens) - Technologie avancée\n• **FUSION_REACTOR** (10000 tokens) - Industriel\n• **MEGA_FARM** (50000 tokens) - Le summum!',
          inline: false
        }
      )
      .setFooter({ 
        text: '🚧 Bot en développement actif - Nouvelles fonctionnalités ajoutées régulièrement!',
        iconURL: interaction.client.user?.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in help command:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors de l\'affichage de l\'aide.',
      ephemeral: true
    });
  }
}