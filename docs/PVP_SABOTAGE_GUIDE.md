# 🔥 Système PvP de Sabotage - Guide Complet

Le système de sabotage PvP permet aux joueurs de s'attaquer mutuellement pour perturber leurs opérations de minage et voler des ressources. Ce système s'appuie sur des cartes d'attaque et de défense obtenues via des missions clandestines et un marché noir.

## 📋 Vue d'Ensemble du Système

### 🎯 Objectifs
- **Compétition**: Ajout d'un élément compétitif direct entre joueurs
- **Stratégie**: Équilibrage entre attaque, défense et ressources
- **Progression**: Nouvelles méthodes d'acquisition de cartes rares
- **Immersion**: Univers clandestin du minage de tokens $7N1

### 🔄 Boucle de Gameplay
1. **Obtenir des cartes** via missions ou marché noir
2. **Planifier ses attaques** en ciblant les joueurs vulnérables  
3. **Se défendre** en activant les bonnes protections
4. **Gérer les ressources** (énergie, tokens, fragments)

## ⚔️ Système d'Attaque

### Types d'Attaques Disponibles

| Type | Effet | Durée | Coût | Détection | Contre |
|------|-------|-------|------|-----------|--------|
| 🦠 **Virus Z3-Miner** | -50% hashrate | 2h | 1 carte virus | Moyenne | Antivirus |
| ⚡ **Blackout Ciblé** | Pause mining | 20min | 1 générateur | Haute | Générateur secours |
| 🔧 **Recalibrage Forcé** | -25% efficacité | 1h | 80 énergie | Basse | Logiciel optimisation |
| 🌐 **Détournement DNS** | Vol 10% hashrate | 3h | 1 token rare | Faible | VPN + Firewall |
| 💰 **Vol Brutal** | Vol 5% tokens | Instantané | 1 carte vol | Très haute | Aucune |

### 📜 Commande `/sabotage`
```
/sabotage @joueur [type]
```

**Règles d'attaque:**
- ⏰ **Cooldown**: 3h entre les attaques
- 🛡️ **Immunité**: 20min post-attaque pour la cible
- 📍 **Activité**: Cible doit être active (<48h)
- 🚫 **Limite**: Max 1 attaque par cible toutes les 15min

## 🛡️ Système de Défense

### Types de Défenses

| Défense | Effet | Type |
|---------|-------|------|
| 🦠 **Antivirus** | Bloque tous les virus | Permanent |
| ⚡ **Générateur Secours** | Empêche les blackouts | À usage unique |
| 🔧 **Logiciel Optimisation** | Réduit durée malus 50% | Permanent |
| 🌐 **VPN + Firewall** | 50% éviter attaques réseau | Permanent |
| 🔍 **Détecteur Sabotage** | Révèle l'attaquant | Temporaire |

### 📜 Commande `/defense`
```
/defense [action]
```

**Actions disponibles:**
- `view`: Voir ses défenses actuelles
- `toggle`: Activer/désactiver une défense
- `recycle`: Recycler une carte pour des fragments

## 🕵️ Missions Clandestines

### Types de Missions

| Mission | Difficulté | Coût | Succès | Cooldown | Récompenses |
|---------|------------|------|--------|----------|-------------|
| 🏭 **Infiltration Ferme** | ⭐⭐ | 40 énergie | 70% | 6h | Cartes communes, fragments |
| 🏢 **Piratage Entrepôt** | ⭐⭐⭐ | 60 énergie | 60% | 8h | Cartes rares, 25 tokens |
| 📋 **Vol de Plans** | ⭐⭐⭐⭐ | 80 énergie | 50% | 12h | Cartes épiques, 50 tokens |
| 💥 **Sabotage Concurrent** | ⭐⭐⭐⭐⭐ | 100 énergie | 35% | 24h | Cartes légendaires, 100 tokens |
| 💾 **Récupération Données** | ⭐⭐⭐ | 50 énergie | 65% | 6h | Fragments mixtes, 30 tokens |

### 📜 Commande `/mission`
```
/mission [type]
```

**Bonus de niveau:**
- +2% de succès par niveau au-delà de 1
- Récits narratifs immersifs selon le résultat

## 🔨 Système de Craft

### Recettes de Craft

| Recette | Coût | Résultats Possibles |
|---------|------|---------------------|
| ⚔️ **Carte Attaque** | 5 fragments attaque | 40% Common, 30% Common, 20% Uncommon, 8% Rare, 2% Epic |
| 🛡️ **Carte Défense** | 5 fragments défense | 40% Common, 30% Common, 20% Uncommon, 8% Rare, 2% Epic |

### 📜 Commande `/craft`
```
/craft [type]
```

**Recyclage des cartes:**
- ⚪ Common: 2 fragments
- 🟢 Uncommon: 3 fragments  
- 🔵 Rare: 5 fragments
- 🟣 Epic: 8 fragments
- 🟡 Legendary: 12 fragments

## 🕴️ Marché Noir

### Fonctionnement
- **Refresh**: Toutes les 12h automatiquement
- **Offres**: 3 cartes aléatoires par cycle
- **Limite**: 1 achat par joueur par cycle
- **Prix**: Fluctue selon rareté et demande (10-1000 $7N1)

### 📜 Commande `/marche_noir`
```
/marche_noir [action]
```

**Actions disponibles:**
- `view`: Voir les offres actuelles (défaut)
- `stats`: Statistiques du marché
- `history`: Votre historique d'achats

### Prix Indicatifs

| Rareté | Prix Min | Prix Max |
|--------|----------|----------|
| ⚪ Common | 10 $7N1 | 25 $7N1 |
| 🟢 Uncommon | 30 $7N1 | 60 $7N1 |
| 🔵 Rare | 80 $7N1 | 150 $7N1 |
| 🟣 Epic | 200 $7N1 | 400 $7N1 |
| 🟡 Legendary | 500 $7N1 | 1000 $7N1 |

## 📜 Historique et Logs

### 📜 Commande `/mes_logs`
```
/mes_logs [limite]
```

**Affiche:**
- Attaques données et reçues
- Succès/échecs des actions
- Identité des attaquants (si détectés)
- Dégâts et durées des effets
- Statistiques globales

## ⚡ Système d'Énergie

### Gestion de l'Énergie
- **Maximum**: 100 points
- **Régénération**: +1 point par heure
- **Usage**: Missions clandestines et certaines attaques
- **Récupération**: Certaines récompenses de missions

### Coûts Énergétiques
- 🔧 Recalibrage Forcé: 80 énergie
- 🏭 Infiltration Ferme: 40 énergie
- 🏢 Piratage Entrepôt: 60 énergie
- 📋 Vol de Plans: 80 énergie
- 💥 Sabotage Concurrent: 100 énergie
- 💾 Récupération Données: 50 énergie

## 🛠️ Architecture Technique

### Services Implémentés

#### SabotageService
- Gestion des attaques PvP
- Vérification des cooldowns et immunités
- Application des effets de sabotage
- Nettoyage automatique des effets expirés

#### CardService  
- Système de missions clandestines
- Craft et recyclage des cartes
- Gestion de l'inventaire
- Régénération d'énergie

#### BlackMarketService
- Refresh automatique du marché
- Gestion des achats et stock
- Statistiques et historique
- Nettoyage des anciennes données

### Commandes Discord
- `/sabotage` - Attaques PvP
- `/mission` - Missions clandestines
- `/craft` - Craft de cartes
- `/defense` - Gestion des défenses
- `/marche_noir` - Marché noir
- `/mes_logs` - Historique des actions

### Base de Données
- **Tables**: 9 nouvelles tables pour le système PvP
- **Enums**: Types d'attaques, défenses, raretés, missions
- **Relations**: Liens utilisateurs, cartes, actions
- **Index**: Optimisation des requêtes fréquentes

## 🚀 Installation et Configuration

### 1. Migration Base de Données
```bash
npx prisma migrate deploy
npx prisma generate
```

### 2. Variables d'Environnement
Aucune nouvelle variable requise - utilise la config existante.

### 3. Déploiement
```bash
npm run build
npm start
```

### 4. Tâches Automatiques
- **Nettoyage sabotages**: Toutes les 5 minutes
- **Refresh marché noir**: Toutes les heures (si nécessaire)
- **Régénération énergie**: Toutes les heures
- **Nettoyage général**: Une fois par jour

## 🎮 Guide Stratégique

### Pour les Attaquants
1. **Reconnaissance**: Vérifiez l'activité et les défenses des cibles
2. **Timing**: Attaquez quand les défenses sont faibles
3. **Ressources**: Gérez votre énergie et vos cartes
4. **Diversification**: Variez les types d'attaques

### Pour les Défenseurs
1. **Défenses actives**: Activez les bonnes protections
2. **Détection**: Utilisez les détecteurs pour identifier les attaquants
3. **Récupération**: Planifiez vos missions pendant les immunités
4. **Contre-attaque**: Ripostez stratégiquement

### Conseils Économiques
1. **Missions régulières**: Source principale de cartes
2. **Marché noir**: Pour les cartes spécifiques
3. **Craft intelligent**: Recyclage selon les besoins
4. **Gestion énergie**: Planifiez vos activités

## 🔄 Évolutions Futures

### Extensions Possibles
- **Alliances**: Systèmes de clans et coopération
- **Territoires**: Contrôle de zones de minage
- **Événements**: Sabotages spéciaux et récompenses
- **Classements**: Leaderboards des saboteurs
- **NFTs**: Cartes uniques on-chain

### Équilibrage
- Ajustement des taux de succès selon les statistiques
- Nouveaux types d'attaques et défenses
- Événements saisonniers avec modificateurs
- Système de réputation des joueurs

---

## 📞 Support

Pour tout problème ou suggestion concernant le système PvP:
1. Vérifiez les logs avec `/mes_logs`
2. Consultez votre inventaire avec `/defense`
3. Regardez l'état du marché avec `/marche_noir stats`
4. Contactez les administrateurs si nécessaire

**Le système de sabotage PvP est maintenant prêt à transformer Marmotte Mining en un véritable univers de compétition clandestine !** 🔥