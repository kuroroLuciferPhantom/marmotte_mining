# 🧪 Marmotte Mining Bot

Bot Discord pour une compétition de minage de tokens fictifs avec battle royales et système d'investissement.

## 🚀 Démarrage Rapide

### Option 1: Script automatique (Recommandé)
```bash
git clone https://github.com/kuroroLuciferPhantom/marmotte_mining.git
cd marmotte_mining
chmod +x setup.sh
./setup.sh
```

### Option 2: Docker seulement (pour les services)
```bash
git clone https://github.com/kuroroLuciferPhantom/marmotte_mining.git
cd marmotte_mining
docker-compose up -d postgres redis
npm install
cp .env.example .env
# Configurez votre .env avec vos tokens Discord
npm run db:migrate
npm run dev
```

### Option 3: Installation manuelle
Consultez [INSTALLATION.md](./INSTALLATION.md) pour les instructions détaillées.

## 🎮 Fonctionnalités

### 💰 Système Économique Dual
- **Dollars fictifs ($)** - Gagnés par l'activité Discord
- **Tokens** - Monnaie du jeu pour la boutique et le minage

### ⛏️ Système de Minage
- Achetez des machines avec des tokens
- Minez automatiquement des tokens
- Améliorez vos machines pour plus d'efficacité
- Prix des tokens fluctuants en temps réel

### ⚔️ Battle Royale
- Affrontez-vous dans des compétitions
- Frais d'entrée basés sur votre niveau
- Récompenses distribuées selon les positions
- Système de cooldown pour éviter le spam

### 📈 Activité Discord Récompensée
- **Messages** : +1$ par message (max 50$/jour)
- **Réactions** : +0.5$ par réaction
- **Temps vocal** : +2$/heure
- **Connexion quotidienne** : +10$ + bonus streak
- **Échangez vos $ contre des tokens**

### 🏪 Boutique Complète
- Machines de minage (5 types différents)
- Infrastructures pour plus de machines
- Sources d'énergie pour réduire les coûts
- Améliorations et modules
- Objets consommables et rares

## 🎯 Commandes Discord

| Commande | Description |
|----------|-------------|
| `/profile` | Votre profil complet de mineur |
| `/balance` | Solde tokens et dollars |
| `/mine start/stop` | Contrôle du minage |
| `/shop` | Boutique d'équipements |
| `/battle join` | Rejoindre une bataille |
| `/price` | Prix actuel et historique |
| `/leaderboard` | Classements |
| `/activity` | Stats d'activité Discord |

## 🏗️ Architecture Technique

- **Backend**: Node.js + TypeScript + Discord.js v14
- **Base de données**: PostgreSQL + Prisma ORM
- **Cache**: Redis pour les sessions et leaderboards
- **Planification**: node-cron pour les tâches automatiques
- **Queues**: Bull pour les tâches asynchrones

## 📊 Structure des Données

### Modèles Principaux
- **Users** - Profils des joueurs avec tokens et dollars
- **Machines** - Équipements de minage avec niveaux
- **Battles** - Batailles royales et participants
- **TokenPrices** - Historique des fluctuations
- **ActivityRewards** - Récompenses d'activité Discord

## 🎛️ Configuration

### Variables d'environnement requises
```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_server_id
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### Permissions Discord nécessaires
- Send Messages
- Use Slash Commands
- Read Message History
- Add Reactions
- Connect & Speak (pour le vocal)

## 🧪 Développement

### Scripts disponibles
```bash
npm run dev          # Mode développement avec hot-reload
npm run build        # Compilation TypeScript
npm start            # Mode production
npm run db:migrate   # Appliquer les migrations
npm run db:studio    # Interface graphique Prisma
npm run lint         # Vérification du code
```

### Structure du projet
```
src/
├── bot/                 # Commandes et événements Discord
├── services/            # Logique métier
│   ├── mining/          # Système de minage
│   ├── battle/          # Batailles royales
│   ├── activity/        # Récompenses d'activité
│   ├── economy/         # Prix des tokens
│   └── database/        # Gestion BDD
├── utils/               # Utilitaires
└── config/              # Configuration
```

## 🎮 Gameplay

### Progression du Joueur
1. **Démarrage** : 100 tokens gratuits
2. **Activité Discord** : Gagnez des dollars
3. **Achat de tokens** : Échangez $ contre tokens
4. **Première machine** : Achetez une BASIC_RIG
5. **Minage** : Générez des tokens automatiquement
6. **Amélioration** : Machines plus puissantes
7. **Batailles** : Participez aux compétitions
8. **Classements** : Dominez les leaderboards

### Stratégie Économique
- Les **dollars** récompensent l'engagement communautaire
- Les **tokens** sont la vraie monnaie de jeu
- Le **prix des tokens** fluctue selon l'offre/demande
- L'**arbitrage** entre $ et tokens peut être profitable

## 🤝 Contribution

1. Fork le projet
2. Créez votre branche feature (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 Licence

Distribué sous licence MIT. Voir `LICENSE` pour plus d'informations.

## 🆘 Support

- Consultez [INSTALLATION.md](./INSTALLATION.md) pour l'installation
- Ouvrez une issue pour les bugs
- Vérifiez les logs dans le dossier `logs/`

## 🔮 Roadmap

- [ ] Interface web pour les statistiques
- [ ] Système de guildes/équipes
- [ ] Événements spéciaux automatiques
- [ ] Marketplace entre joueurs
- [ ] Système de prêts et intérêts
- [ ] Intégration NFT (peut-être)

---

**Créé avec ❤️ pour la communauté Discord gaming**