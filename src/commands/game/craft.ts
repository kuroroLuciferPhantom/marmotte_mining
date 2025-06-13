import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ComponentType, ButtonStyle } from 'discord.js';
import { CardService } from '../../services/sabotage/CardService';

export const data = new SlashCommandBuilder()
  .setName('craft')
  .setDescription('🔨 Craftez des cartes à partir de vos fragments')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Type de carte à crafter')
      .addChoices(
        { name: '⚔️ Carte d\'Attaque (5 fragments d\'attaque)', value: 'attackCard' },
        { name: '🛡️ Carte de Défense (5 fragments de défense)', value: 'defenseCard' }
      )
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction, services: Map<string, any>) {
  try {
    const cardService = services.get('cards') as CardService;
    const craftType = interaction.options.getString('type') as 'attackCard' | 'defenseCard';

    // Si aucun type spécifié, afficher l'interface de craft
    if (!craftType) {
      const inventory = await cardService.getUserInventory(interaction.user.id);
      
      const embed = new EmbedBuilder()
        .setColor(0x8B4513)
        .setTitle('🔨 Atelier de Craft')
        .setDescription('Transformez vos fragments en cartes puissantes !\n\n**Recettes disponibles:**')
        .addFields(
          {
            name: '⚔️ Carte d\'Attaque',
            value: '**Coût:** 5 fragments d\'attaque\n' +
                   '**Chances:** 40% Common, 30% Common, 20% Uncommon, 8% Rare, 2% Epic\n' +
                   `**Vos fragments:** ${inventory.fragments.find(f => f.type === 'ATTACK_FRAGMENT')?.quantity || 0}`,
            inline: true
          },
          {
            name: '🛡️ Carte de Défense',
            value: '**Coût:** 5 fragments de défense\n' +
                   '**Chances:** 40% Common, 30% Common, 20% Uncommon, 8% Rare, 2% Epic\n' +
                   `**Vos fragments:** ${inventory.fragments.find(f => f.type === 'DEFENSE_FRAGMENT')?.quantity || 0}`,
            inline: true
          },
          {
            name: '📊 Inventaire Complet',
            value: `⚡ **Énergie:** ${inventory.energy}/100\n` +
                   `🧩 **Fragments totaux:** ${inventory.fragments.reduce((sum, f) => sum + f.quantity, 0)}\n` +
                   `🃏 **Cartes d'attaque:** ${inventory.attackCards.length}\n` +
                   `🛡️ **Cartes de défense:** ${inventory.defenseCards.length}`,
            inline: false
          }
        )
        .setFooter({ text: '💡 Utilisez l\'option "type" pour crafter une carte spécifique' })
        .setTimestamp();

      // Créer les boutons interactifs
      const craftAttackButton = new ButtonBuilder()
        .setCustomId('craft_attack')
        .setLabel('Craft Attaque')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Danger)
        .setDisabled((inventory.fragments.find(f => f.type === 'ATTACK_FRAGMENT')?.quantity || 0) < 5);

      const craftDefenseButton = new ButtonBuilder()
        .setCustomId('craft_defense')
        .setLabel('Craft Défense')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled((inventory.fragments.find(f => f.type === 'DEFENSE_FRAGMENT')?.quantity || 0) < 5);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(craftAttackButton, craftDefenseButton);

      const response = await interaction.reply({ 
        embeds: [embed], 
        components: [row],
        ephemeral: true 
      });

      // Collecteur pour les interactions de boutons
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 1 minute
      });

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({
            content: '❌ Vous ne pouvez pas utiliser les boutons d\'un autre utilisateur !',
            ephemeral: true
          });
          return;
        }

        await buttonInteraction.deferUpdate();

        try {
          const buttonCraftType = buttonInteraction.customId === 'craft_attack' ? 'attackCard' : 'defenseCard';
          const craftResult = await cardService.craftCard(interaction.user.id, buttonCraftType);

          const resultEmbed = new EmbedBuilder()
            .setColor(craftResult.success ? 0x00FF00 : 0xFF0000)
            .setTitle(craftResult.success ? '🎉 Craft Réussi !' : '❌ Craft Impossible')
            .setDescription(craftResult.message);

          if (craftResult.success && craftResult.item) {
            const rarityEmojis = {
              'COMMON': '⚪',
              'UNCOMMON': '🟢',
              'RARE': '🔵',
              'EPIC': '🟣',
              'LEGENDARY': '🟡'
            };

            resultEmbed.addFields({
              name: '🎁 Carte Obtenue',
              value: `${rarityEmojis[craftResult.item.rarity]} **${craftResult.item.cardType}**\n` +
                     `Rareté: ${craftResult.item.rarity}`,
              inline: false
            });
          }

          await buttonInteraction.editReply({ 
            embeds: [resultEmbed], 
            components: [] 
          });

        } catch (error) {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Erreur de Craft')
            .setDescription(error.message || 'Une erreur inattendue s\'est produite.');

          await buttonInteraction.editReply({ 
            embeds: [errorEmbed], 
            components: [] 
          });
        }
      });

      collector.on('end', async () => {
        try {
          await interaction.editReply({ components: [] });
        } catch (error) {
          // Message probablement déjà modifié ou supprimé
        }
      });

      return;
    }

    // Craft direct via option
    await interaction.deferReply();

    const craftResult = await cardService.craftCard(interaction.user.id, craftType);

    const embed = new EmbedBuilder()
      .setColor(craftResult.success ? 0x00FF00 : 0xFF0000)
      .setTitle(craftResult.success ? '🎉 Craft Réussi !' : '❌ Craft Impossible')
      .setDescription(craftResult.message);

    if (craftResult.success && craftResult.item) {
      const rarityEmojis = {
        'COMMON': '⚪',
        'UNCOMMON': '🟢',
        'RARE': '🔵',
        'EPIC': '🟣',
        'LEGENDARY': '🟡'
      };

      embed.addFields(
        {
          name: '🎁 Carte Obtenue',
          value: `${rarityEmojis[craftResult.item.rarity]} **${craftResult.item.cardType}**`,
          inline: true
        },
        {
          name: '⭐ Rareté',
          value: craftResult.item.rarity,
          inline: true
        }
      );
    }

    embed.setFooter({ text: 'Utilisez /inventory pour voir toutes vos cartes' })
         .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in craft command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Erreur de Craft')
      .setDescription(error.message || 'Une erreur inattendue s\'est produite.')
      .setFooter({ text: 'Vérifiez que vous avez assez de fragments' });

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}