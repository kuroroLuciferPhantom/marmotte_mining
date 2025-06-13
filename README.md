# 🪙 Marmotte Mining Bot - Système de Token $7N1

## 🎯 NOUVELLE FONCTIONNALITÉ : Valeur Dynamique du Token $7N1

Le bot dispose maintenant d'un **système de valorisation dynamique** révolutionnaire pour le token $7N1 ! 

### 🚀 Caractéristiques Principales

✅ **Prix en temps réel** basé sur l'activité des joueurs  
✅ **Formule mathématique complexe** avec facteurs économiques  
✅ **Événements de marché automatiques** pour créer de l'engagement  
✅ **Système de trading** avec commissions  
✅ **Notifications automatiques** des variations importantes  
✅ **Interface intuitive** avec embeds Discord colorés  

## 📊 Formule de Calcul Dynamique

```
Valeur_$7N1 = Base_Price × (1 + H/CT) × (1 - M/CT) × (1 + F)
```

**Où :**
- `H` = Total de tokens détenus par tous les joueurs
- `M` = Total de tokens minés dans les dernières 24h  
- `CT` = Total en circulation
- `F` = Facteur bonus/malus pour événements spéciaux

## 🎮 Nouvelles Commandes

### Pour les Joueurs

#### `/wallet`
Affiche votre portefeuille complet avec :
- 💵 Solde en dollars
- 🪙 Tokens $7N1 possédés
- 💎 Valeur actuelle de vos tokens
- 📊 Cours du token en temps réel
- 📈 Variation sur 24h

#### `/echanger <direction> <montant>`
Échangez vos monnaies :
- 💵 → 🪙 **Dollars vers $7N1** (sans commission)
- 🪙 → 💵 **$7N1 vers Dollars** (commission 1%)
- Taux de change dynamique basé sur le marché

#### `/cours [periode]`
Consultez le marché :
- 📊 Prix actuel et tendance
- 📈 Historique sur 1h/6h/24h/7j
- 💹 Volume et market cap
- 🧮 Facteurs influençant le prix
- 💡 Conseils de trading

### Pour les Administrateurs

#### `/admin-marche`
Commandes d'administration avancées :

- `prix` - Force un recalcul immédiat
- `event <facteur> <duree> <raison>` - Déclenche un événement manuel
- `burn <montant> <raison>` - Brûle des tokens (déflation)
- `channel <canal>` - Configure les notifications automatiques  
- `stats` - Statistiques complètes du marché
- `pump-dump` - Simulation d'événement extrême (test)

## 🤖 Système Automatique

### 📈 Surveillance du Marché
- **Monitoring continu** toutes les 2 minutes
- **Alertes automatiques** pour variations >5%
- **Événements aléatoires** toutes les 30 minutes
- **Rapport quotidien** à 12h00

### 🎯 Types d'Événements
1. **⛏️ Mining Rush** - Activité minière intense (+15%)
2. **🐋 Whale Activity** - Gros investisseur (±10%)  
3. **🔧 Technical Upgrade** - Amélioration technique (+20%)
4. **📊 Market Sentiment** - Changement de sentiment (±10%)

## 🛠️ Installation et Configuration

### 1. Prérequis
```bash
Node.js 18+
PostgreSQL (Supabase)
Redis (Upstash) - optionnel
Discord Bot Token
```

### 2. Variables d'Environnement
```env
# Nouvelles variables pour le système de prix
TOKEN_BASE_PRICE=0.01        # Prix de base du $7N1
MINING_BASE_RATE=0.1         # Taux de minage
BATTLE_COOLDOWN=3600         # Cooldown battles

# Configuration Discord
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id

# Base de données
DATABASE_URL=postgresql://...

# Cache Redis (optionnel)
REDIS_URL=redis://...
```

### 3. Installation
```bash
# Cloner le repository
git clone https://github.com/kuroroLuciferPhantom/marmotte_mining.git
cd marmotte_mining

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# Démarrer le bot
npm start
```

### 4. Configuration du Canal de Marché
```bash
# Une fois le bot lancé, configurez les notifications :
/admin-marche channel #votre-canal-marche
```

## 💡 Guide d'Utilisation

### Pour les Nouveaux Joueurs

1. **Premiers pas** :
   ```
   /profile          # Voir votre profil
   /wallet           # Consulter votre portefeuille
   /cours            # Étudier le marché
   ```

2. **Gagner des dollars** :
   - Participer aux discussions Discord
   - Réagir aux messages
   - Passer du temps en vocal
   - Connexion quotidienne

3. **Investir dans les tokens** :
   ```
   /echanger dollars_to_tokens 10.00    # Acheter des $7N1
   /cours 24                            # Surveiller le marché
   /wallet                              # Voir l'évolution
   ```

### Stratégies de Trading

#### 🏦 HODL (Conserver)
- **Avantage** : Augmente le prix général
- **Risque** : Pas de liquidité immédiate
- **Conseil** : Surveiller `/cours` régulièrement

#### 📈 Trading Actif
- **Avantage** : Profiter des fluctuations
- **Risque** : Commission 1% sur ventes
- **Conseil** : Analyser les tendances

#### ⛏️ Minage Focus
- **Avantage** : Production de tokens
- **Risque** : Pression baissière sur prix
- **Conseil** : Équilibrer minage et détention

## 🎯 Exemples Concrets

### Scénario 1 : Marché Stable
```
Situation :
- 10,000 $7N1 en circulation
- 100 $7N1 minés aujourd'hui
- Aucun événement actif

Calcul :
Prix = $0.01 × (1 + 1.0) × (1 - 0.01) × 1.0
Prix = $0.0198

Action : Bon moment pour acheter
```

### Scénario 2 : Rush de Minage
```
Situation :
- 12,000 $7N1 en circulation
- 2,000 $7N1 minés aujourd'hui
- Événement Mining Rush (+15%)

Calcul :
Prix = $0.01 × (1 + 0.83) × (1 - 0.17) × 1.15
Prix = $0.0175

Action : Prix bas, opportunité d'achat
```

### Scénario 3 : HODL Massif
```
Situation :
- 15,000 $7N1 en circulation
- 50 $7N1 minés aujourd'hui
- 90% des tokens détenus

Calcul :
Prix = $0.01 × (1 + 0.9) × (1 - 0.003) × 1.0
Prix = $0.0189

Action : Prix stable, bonne détention
```

## 📱 Interface Utilisateur

### Embeds Interactifs
- **Couleurs dynamiques** : Vert (hausse) / Rouge (baisse) / Jaune (stable)
- **Emojis contextuels** : 📈📉📊🚀💹
- **Informations détaillées** : Prix, volume, tendances
- **Conseils automatiques** : Suggestions basées sur l'analyse

### Notifications Push
- **Alertes importantes** : Variations >5%
- **Jalons de prix** : Nouveaux records
- **Événements de marché** : Activité exceptionnelle
- **Rapports quotidiens** : Résumé des 24h

## 🔧 Architecture Technique

### Services Principaux

#### TokenPriceService
- Calcul de la valeur dynamique
- Gestion du cache (30s TTL)
- Historique des prix
- API de manipulation

#### TokenMarketService  
- Surveillance automatique
- Génération d'événements
- Notifications Discord
- Rapports automatiques

### Base de Données
```sql
-- Nouvelle table pour l'historique des prix
CREATE TABLE token_prices (
  id          TEXT PRIMARY KEY,
  price       FLOAT NOT NULL,
  volume      FLOAT DEFAULT 0.0,
  change24h   FLOAT DEFAULT 0.0,
  timestamp   TIMESTAMP DEFAULT NOW()
);

-- Table existante étendue pour les événements
CREATE TABLE game_events (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  multiplier  FLOAT DEFAULT 1.0,
  is_active   BOOLEAN DEFAULT true,
  start_time  TIMESTAMP DEFAULT NOW(),
  end_time    TIMESTAMP,
  metadata    JSON
);
```

## 🚀 Prochaines Évolutions

### Version 1.1 - Trading Avancé
- 📊 **Graphiques détaillés** avec Chart.js
- 🎯 **Ordres limités** (achat/vente à prix fixe)  
- 📈 **Indicateurs techniques** (RSI, MACD)
- 🏆 **Leaderboards** des meilleurs traders

### Version 1.2 - Social Trading
- 👥 **Portfolios publics** des top players
- 💬 **Chat de trading** intégré
- 🔔 **Alertes personnalisées** par utilisateur
- 📊 **API publique** pour développeurs

### Version 1.3 - GameFi
- 🎮 **NFT Rewards** pour performances
- 🏪 **Marketplace** d'objets rares
- ⚔️ **Compétitions** de trading
- 🌍 **Multi-serveurs** synchronisés

## 📊 Métriques de Performance

### Objectifs Économiques
- **Engagement** : +50% d'activité Discord
- **Rétention** : +30% de joueurs actifs quotidiens
- **Interactions** : +200% d'utilisation des commandes
- **Communauté** : Discussions stratégiques spontanées

### KPIs Techniques
- **Uptime** : 99.9% de disponibilité
- **Latence** : <2s pour calculs de prix
- **Cache Hit Rate** : >90% sur Redis
- **Erreurs** : <0.1% des transactions

## 🛡️ Sécurité et Stabilité

### Protections Intégrées
- **Limites strictes** : Facteurs bornés (-50% / +100%)
- **Validation inputs** : Joi schemas pour toutes les entrées
- **Transactions atomiques** : Intégrité garantie en DB
- **Logs complets** : Traçabilité de toutes les opérations
- **Rate limiting** : Protection contre spam/abus

### Monitoring
- **Alertes automatiques** : Anomalies détectées
- **Métriques temps réel** : Performance continue
- **Backups réguliers** : Données protégées
- **Tests automatisés** : Qualité assurée

## 📞 Support et Documentation

### Ressources
- 📖 **[Documentation Complète](docs/TOKEN_PRICING_SYSTEM.md)**
- 🎮 **Commande `/help`** dans Discord
- 🐛 **Issues GitHub** pour bugs/suggestions
- 💬 **Canal support** sur le serveur

### Contact
- **Développeur** : kuroroLuciferPhantom
- **Repository** : [GitHub](https://github.com/kuroroLuciferPhantom/marmotte_mining)
- **Licence** : MIT

---

## 🎉 Changelog v1.0.0 - Système de Prix Dynamique

### ✨ Nouvelles Fonctionnalités
- 🪙 **Système de valeur dynamique** pour le token $7N1
- 📊 **Formule mathématique complexe** avec 3 facteurs économiques
- 💱 **Commande `/wallet`** avec portefeuille détaillé
- 🔄 **Commande `/echanger`** pour trading dollars ↔ tokens
- 📈 **Commande `/cours`** avec analyse de marché complète
- 🛠️ **Commande `/admin-marche`** pour administration avancée
- 🤖 **Surveillance automatique** avec événements aléatoires
- 📱 **Notifications Discord** pour alertes de marché
- 📋 **Rapports quotidiens** automatiques

### 🔧 Améliorations Techniques
- 🚀 **Cache Redis intelligent** avec fallback mémoire
- 📊 **Base de données étendue** pour historique des prix
- 🛡️ **Sécurité renforcée** avec validations strictes
- 📝 **Logs détaillés** pour monitoring et debug
- ⚡ **Performance optimisée** avec mise en cache

### 🎯 Impact Gameplay
- 💰 **Économie réaliste** influencée par les actions des joueurs
- 📈 **Stratégies de trading** nouvelles possibilités
- 🎲 **Événements dynamiques** pour maintenir l'engagement
- 🏆 **Compétition économique** entre joueurs
- 📊 **Transparence totale** sur les mécanismes de prix

**Version** : 1.0.0  
**Date** : Juin 2025  
**Statut** : ✅ Production Ready

---

*Le système de valeur dynamique du token $7N1 représente une innovation majeure dans l'économie du jeu, apportant réalisme et engagement tout en maintenant l'équilibre et la transparence.*
