# 🚀 Guide d'Installation - Marmotte Mining Bot

## 📋 Prérequis

### Logiciels requis
- **Node.js** (version 18 ou supérieure) - [Télécharger](https://nodejs.org/)
- **PostgreSQL** (version 13 ou supérieure) - [Télécharger](https://www.postgresql.org/download/)
- **Redis** (version 6 ou supérieure) - [Télécharger](https://redis.io/download)
- **Git** - [Télécharger](https://git-scm.com/)

### Compte Discord Developer
1. Allez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Créez une nouvelle application
3. Notez le **Client ID** et le **Token** du bot

## 🛠️ Installation

### 1. Cloner le projet
```bash
git clone https://github.com/kuroroLuciferPhantom/marmotte_mining.git
cd marmotte_mining
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration de la base de données PostgreSQL

#### Windows (avec PostgreSQL installé)
```bash
# Ouvrir psql et créer la base
psql -U postgres
CREATE DATABASE marmotte_mining;
CREATE USER marmotte_user WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE marmotte_mining TO marmotte_user;
\q
```

#### Docker (alternative)
```bash
docker run --name marmotte-postgres -e POSTGRES_DB=marmotte_mining -e POSTGRES_USER=marmotte_user -e POSTGRES_PASSWORD=votre_mot_de_passe -p 5432:5432 -d postgres:13
```

### 4. Configuration Redis

#### Windows
Téléchargez et installez Redis, puis démarrez le service.

#### Docker (alternative)
```bash
docker run --name marmotte-redis -p 6379:6379 -d redis:6
```

### 5. Configuration des variables d'environnement
```bash
# Copiez le fichier d'exemple
cp .env.example .env

# Éditez le fichier .env avec vos configurations
```

Contenu du fichier `.env` à configurer :
```env
# Discord Bot Configuration
DISCORD_TOKEN=votre_token_discord_bot
DISCORD_CLIENT_ID=votre_client_id
DISCORD_GUILD_ID=votre_serveur_discord_id

# Database Configuration
DATABASE_URL="postgresql://marmotte_user:votre_mot_de_passe@localhost:5432/marmotte_mining?schema=public"

# Redis Configuration
REDIS_URL="redis://localhost:6379"

# Application Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Game Configuration
TOKEN_BASE_PRICE=1.0
MINING_BASE_RATE=0.1
BATTLE_COOLDOWN=3600
DAILY_REWARD_RESET=0

# Security
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 6. Configuration de la base de données avec Prisma
```bash
# Génère le client Prisma
npm run db:generate

# Applique les migrations
npm run db:migrate
```

### 7. Inviter le bot sur votre serveur Discord

1. Allez sur le [Discord Developer Portal](https://discord.com/developers/applications)
2. Sélectionnez votre application
3. Allez dans **OAuth2 > URL Generator**
4. Sélectionnez les scopes : `bot` et `applications.commands`
5. Sélectionnez les permissions bot nécessaires :
   - Send Messages
   - Use Slash Commands
   - Read Message History
   - Add Reactions
   - Connect (pour le vocal)
   - Speak (pour le vocal)
6. Copiez l'URL générée et ouvrez-la dans votre navigateur
7. Ajoutez le bot à votre serveur de test

## 🚀 Lancement

### Mode développement
```bash
npm run dev
```

### Mode production
```bash
# Compile le TypeScript
npm run build

# Lance l'application
npm start
```

## 🧪 Test du bot

### 1. Vérifier que le bot est en ligne
Le bot devrait apparaître en ligne sur votre serveur Discord.

### 2. Tester les commandes de base
```
/profile - Voir votre profil de mineur
/shop - Ouvrir la boutique
/mine - Démarrer le minage
/price - Voir le prix actuel du token
/leaderboard - Voir le classement
```

### 3. Tester le système d'activité
- Envoyez des messages dans le chat
- Ajoutez des réactions
- Rejoignez un canal vocal

### 4. Tester le système de bataille
```
/battle join - Rejoindre une bataille royale
/battle info - Voir les informations des batailles
```

## 🔧 Outils de développement

### Prisma Studio (interface graphique pour la DB)
```bash
npm run db:studio
```
Ouvre une interface web sur http://localhost:5555

### Logs
Les logs sont disponibles dans le dossier `logs/` :
- `combined.log` - Tous les logs
- `error.log` - Erreurs uniquement

### Monitoring Redis
```bash
# Si Redis est installé localement
redis-cli monitor
```

## 🐛 Résolution des problèmes courants

### Erreur de connexion PostgreSQL
```bash
# Vérifiez que PostgreSQL est démarré
# Windows : services.msc > PostgreSQL
# Linux/Mac : sudo systemctl status postgresql
```

### Erreur de connexion Redis
```bash
# Vérifiez que Redis est démarré
redis-cli ping
# Devrait retourner "PONG"
```

### Bot ne répond pas aux commandes
1. Vérifiez que le token Discord est correct
2. Vérifiez que le bot a les bonnes permissions
3. Vérifiez les logs d'erreur

### Erreurs de migration Prisma
```bash
# Reset de la base (ATTENTION : supprime toutes les données)
npx prisma migrate reset

# Puis relancer les migrations
npm run db:migrate
```

## 📊 Structure des données

### Tables principales
- `users` - Données des utilisateurs
- `machines` - Machines de minage
- `battles` - Batailles royales
- `transactions` - Historique des transactions
- `token_prices` - Historique des prix
- `activity_rewards` - Récompenses d'activité

### Redis Keys
- `user:{userId}` - Cache utilisateur
- `token:current_price` - Prix actuel
- `leaderboard:tokens` - Classement
- `battle:{battleId}` - État des batailles
- `daily_stats:{userId}:{date}` - Stats quotidiennes

## 🎮 Commandes disponibles

| Commande | Description |
|----------|-------------|
| `/profile` | Affiche votre profil complet |
| `/balance` | Voir vos tokens et dollars |
| `/mine start` | Démarre le minage |
| `/mine stop` | Arrête le minage |
| `/mine status` | État du minage |
| `/shop machines` | Boutique de machines |
| `/shop upgrades` | Améliorations disponibles |
| `/battle join` | Rejoindre une bataille |
| `/battle create` | Créer une bataille |
| `/battle list` | Lister les batailles |
| `/price` | Prix actuel du token |
| `/price history` | Historique des prix |
| `/leaderboard tokens` | Classement tokens |
| `/leaderboard dollars` | Classement dollars |
| `/stats` | Statistiques du jeu |

## 🔄 Mise à jour

```bash
# Récupérer les dernières modifications
git pull origin main

# Mettre à jour les dépendances
npm install

# Appliquer les nouvelles migrations
npm run db:migrate

# Recompiler
npm run build

# Redémarrer
npm start
```

## 🆘 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs dans le dossier `logs/`
2. Consultez la documentation Discord.js
3. Vérifiez la configuration de votre `.env`
4. Testez les connexions DB et Redis

## 🎯 Fonctionnalités testables

### Système de minage
- [x] Achat de machines
- [x] Démarrage/arrêt du minage
- [x] Calcul des récompenses
- [x] Amélioration des machines

### Système économique
- [x] Fluctuation des prix
- [x] Récompenses d'activité Discord
- [x] Échange dollars/tokens

### Batailles royales
- [x] Création de batailles
- [x] Participation
- [x] Distribution des récompenses

### Classements
- [x] Leaderboard tokens
- [x] Leaderboard dollars d'activité
- [x] Statistiques personnelles

Bon développement ! 🚀