# 🧪 Marmotte Mining Bot - Fiche Résumé du Projet

## 📋 Vue d'ensemble
**Marmotte Mining Bot** est un bot Discord de jeu de minage de tokens fictifs avec système de battle royale et économie dual (dollars/tokens).

## 🏗️ Architecture Technique

### **Stack Technologique**
- **Runtime**: Node.js 18+ avec TypeScript
- **Framework Discord**: Discord.js v14
- **Base de données**: PostgreSQL via Supabase (cloud)
- **ORM**: Prisma Client
- **Cache**: Redis (Upstash cloud) avec fallback en mémoire
- **Logs**: Winston
- **Validation**: Joi
- **Déploiement**: Docker + scripts automatisés

### **Structure du Projet**
```
src/
├── commands/           # Commandes Discord slash
│   ├── game/          # profile.ts, balance.ts
│   └── utility/       # help.ts
├── services/          # Logique métier
│   ├── database/      # DatabaseService (Prisma)
│   ├── cache/         # RedisService + fallback
│   ├── mining/        # MiningService (à compléter)
│   ├── battle/        # BattleService (à compléter)
│   └── activity/      # ActivityService (fonctionnel)
├── managers/          # CommandManager (chargement automatique)
├── config/            # Configuration avec Joi
└── utils/             # Logger Winston
```

## 🎮 Fonctionnalités Implémentées

### ✅ **Système d'Activité Discord (Fonctionnel)**
- **Messages**: +1$ par message (max 50$/jour)
- **Réactions**: +0.5$ par réaction (max 20/jour) 
- **Vocal**: +2$/heure (max 5h/jour)
- **Connexion quotidienne**: +10$ + bonus streak
- **Multiplicateurs**: Bonus pour mots-clés, longueur messages
- **Stockage**: Base PostgreSQL + cache Redis

### ✅ **Commandes Discord (Fonctionnelles)**
- **`/profile`**: Profil utilisateur avec embed coloré
- **`/balance`**: Solde dollars/tokens avec taux change
- **`/help`**: Guide complet du jeu
- **Auto-création**: Utilisateurs créés automatiquement (100 tokens)

### ✅ **Système de Base (Fonctionnel)**
- **Gestion utilisateurs**: Création auto, profils complets
- **Récompenses visuelles**: Réaction 💰 automatique
- **Logs détaillés**: Winston avec niveaux configurables
- **Résilience**: Fallback cache si Redis fail

## 🚧 Fonctionnalités Prévues (Services créés, pas intégrés)

### **Système de Minage** (MiningService créé)
- **5 types de machines**: BASIC_RIG → MEGA_FARM
- **Calculs automatiques**: Hash rate, efficacité, durabilité
- **Upgrades**: Amélioration niveau par niveau
- **Prix fluctuants**: Influence sur récompenses

### **Battle Royale** (BattleService créé) 
- **Batailles automatiques**: 10 joueurs max
- **Système d'élimination**: Positions basées sur stats
- **Récompenses graduées**: 50% gagnant, 25% 2e, etc.
- **Cooldowns**: Anti-spam entre batailles

### **Économie Dual** (Partiellement implémenté)
- **Dollars ($)**: Gagnés par activité Discord
- **Tokens**: Monnaie du jeu (minage, boutique)
- **Échange**: 10$ = 1 token (configurable)
- **Boutique**: Machines, upgrades, consommables

## 🗄️ Base de Données (Prisma Schema)

### **Tables Principales**
- **`users`**: Profils, tokens, dollars, stats
- **`machines`**: Équipements minage avec niveaux
- **`battles`**: Batailles royales et participants
- **`activity_rewards`**: Historique récompenses Discord
- **`transactions`**: Tous les mouvements financiers
- **`token_prices`**: Historique fluctuations prix

### **Enums Importants**
- **MachineType**: BASIC_RIG, ADVANCED_RIG, QUANTUM_MINER, etc.
- **BattleStatus**: WAITING, ACTIVE, FINISHED, CANCELLED
- **ActivityType**: MESSAGE, REACTION, VOICE_TIME, DAILY_LOGIN
- **TransactionType**: MINING_REWARD, MACHINE_PURCHASE, etc.

## ⚙️ Configuration (.env)

### **Variables Essentielles**
```env
# Discord
DISCORD_TOKEN=bot_token
DISCORD_CLIENT_ID=app_id  
DISCORD_GUILD_ID=server_id

# Supabase (PostgreSQL cloud)
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# Upstash (Redis cloud) - avec fallback
REDIS_URL=redis://default:password@host.upstash.io:6379

# Game Config
TOKEN_BASE_PRICE=1.0
MINING_BASE_RATE=0.1
BATTLE_COOLDOWN=3600
LOG_LEVEL=info
```

## 🔄 État Actuel vs Objectifs

### **✅ Ce qui fonctionne parfaitement**
1. **Bot Discord**: Connexion, slash commands, événements
2. **Base données**: Supabase, migrations Prisma
3. **Récompenses activité**: Dollars gagnés automatiquement
4. **Interface utilisateur**: Embeds Discord, profils
5. **Résilience**: Fallback Redis, gestion erreurs

### **🚧 Ce qui est codé mais pas intégré**
1. **MiningService**: Logique complète mais pas de commandes
2. **BattleService**: Système complet mais pas de commandes  
3. **Échange $/Tokens**: Calculs prêts mais pas d'interface
4. **TokenPriceService**: Fluctuations codées mais pas actives
5. **Événements aléatoires**: Structure prête

### **📝 Prochaines étapes prioritaires**
1. **Commandes minage**: `/shop`, `/mine start/stop`, `/inventory`
2. **Commandes bataille**: `/battle join/create/list`
3. **Système d'échange**: `/exchange` dollars → tokens
4. **Prix dynamiques**: Fluctuations automatiques
5. **Leaderboards**: `/leaderboard tokens/dollars`

## 🛠️ Points Techniques Importants

### **Gestion Redis**
- **Fallback intelligent**: MockRedisService si connexion fail
- **Reconnexion auto**: Gestion déconnexions Upstash
- **Cache stratégique**: Stats quotidiennes, leaderboards, prix

### **Sécurité & Performance**
- **Rate limiting**: Limites quotidiennes activité
- **Validation**: Joi pour config, Prisma pour données
- **Logs structurés**: Winston avec rotation automatique
- **Transactions DB**: Intégrité financière garantie

### **Déploiement**
- **Scripts fournis**: `setup.bat` Windows, `deploy.sh` serveur
- **Docker ready**: Compose pour dev, Dockerfile prod
- **Migrations auto**: Prisma avec rollback possible

## 🎯 Philosophie du Projet

### **Économie Équilibrée**
- **Activité récompensée**: Engagement Discord → dollars
- **Investissement requis**: Dollars → tokens → machines
- **Compétition**: Battles pour multiplier gains
- **Progression**: Machines plus puissantes = plus de tokens

### **Expérience Utilisateur**
- **Feedback immédiat**: Réactions 💰, embeds colorés
- **Progression visible**: Profils détaillés, statistiques
- **Social**: Battles multijoueurs, leaderboards
- **Accessibilité**: Commandes intuitives, aide complète

---

## 🏷️ État du Code: STABLE - Prêt pour développement features

**Dernière mise à jour**: Décembre 2024
**Version**: 1.0.0 (Base fonctionnelle)
**Prochaine version**: 1.1.0 (Minage + Battles)