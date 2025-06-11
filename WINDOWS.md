# 🪟 Guide d'Installation Windows - Marmotte Mining Bot

## 🚀 Installation Ultra-Rapide

### **Option 1 : Script automatique (Recommandé)**
1. Ouvrez **PowerShell** ou **Invite de commandes** en tant qu'administrateur
2. Exécutez ces commandes :

```cmd
git clone https://github.com/kuroroLuciferPhantom/marmotte_mining.git
cd marmotte_mining
setup.bat
```

Le script va :
- ✅ Vérifier vos prérequis
- ✅ Installer les dépendances
- ✅ Configurer Docker ou vous guider pour l'installation manuelle
- ✅ Ouvrir automatiquement le fichier `.env` pour configuration
- ✅ Configurer la base de données
- ✅ Démarrer le bot

### **Option 2 : Avec Docker Desktop (Facile)**

1. **Installez Docker Desktop** : [Télécharger ici](https://www.docker.com/products/docker-desktop)
2. **Clonez et configurez** :
```cmd
git clone https://github.com/kuroroLuciferPhantom/marmotte_mining.git
cd marmotte_mining
docker-compose up -d postgres redis
npm install
copy .env.example .env
notepad .env
```
3. **Configurez votre .env** avec vos tokens Discord
4. **Lancez** :
```cmd
npm run db:migrate
npm run dev
```

## 📋 Prérequis Windows

### **Obligatoires :**
- **Node.js 18+** : [Télécharger](https://nodejs.org/en/download/)
- **Git** : [Télécharger](https://git-scm.com/download/win)

### **Pour la base de données (choisissez une option) :**

#### **Option A : Docker Desktop (Recommandé)**
- [Docker Desktop](https://www.docker.com/products/docker-desktop) - Plus simple, tout automatisé

#### **Option B : Installation manuelle**
- **PostgreSQL** : [Télécharger](https://www.postgresql.org/download/windows/)
- **Redis** : [Télécharger](https://github.com/MicrosoftArchive/redis/releases) ou utilisez WSL

## 🔧 Configuration Détaillée

### **1. Configuration PostgreSQL (si installation manuelle)**

Après installation de PostgreSQL :

1. Ouvrez **pgAdmin** ou **SQL Shell (psql)**
2. Créez la base de données :
```sql
CREATE DATABASE marmotte_mining;
CREATE USER marmotte_user WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE marmotte_mining TO marmotte_user;
```

### **2. Configuration Redis (si installation manuelle)**

#### **Avec Redis pour Windows :**
1. Téléchargez depuis [GitHub](https://github.com/MicrosoftArchive/redis/releases)
2. Extrayez et lancez `redis-server.exe`

#### **Avec WSL (Windows Subsystem for Linux) :**
```cmd
wsl --install
# Redémarrer puis :
wsl
sudo apt update
sudo apt install redis-server
redis-server
```

### **3. Configuration Discord Bot**

1. Allez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Créez une **nouvelle application**
3. Allez dans **Bot** → Créez un bot
4. Copiez le **Token**
5. Allez dans **OAuth2** → **General** pour l'**Application ID**
6. Pour l'ID du serveur : Clic droit sur votre serveur Discord → **Copier l'ID**

### **4. Configuration du fichier .env**

Ouvrez `.env` avec le Bloc-notes et configurez :

```env
# Discord Bot Configuration
DISCORD_TOKEN=votre_token_discord_bot_ici
DISCORD_CLIENT_ID=votre_application_id_ici
DISCORD_GUILD_ID=votre_serveur_discord_id_ici

# Database Configuration (Docker)
DATABASE_URL="postgresql://marmotte_user:marmotte_password@localhost:5432/marmotte_mining?schema=public"

# Database Configuration (Manuel - adaptez selon vos paramètres)
# DATABASE_URL="postgresql://marmotte_user:votre_mot_de_passe@localhost:5432/marmotte_mining?schema=public"

# Redis Configuration
REDIS_URL="redis://localhost:6379"

# Application Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

## 🎮 Utilisation

### **Démarrage en développement :**
```cmd
npm run dev
```

### **Compilation et production :**
```cmd
npm run build
npm start
```

### **Interface graphique de la base :**
```cmd
npm run db:studio
```
→ Ouvre http://localhost:5555

### **Commandes utiles :**
```cmd
npm run lint          # Vérification du code
npm run db:migrate     # Appliquer les migrations
git pull              # Mettre à jour le code
```

## 🔧 Outils de Développement Windows

### **Éditeurs recommandés :**
- **Visual Studio Code** : [Télécharger](https://code.visualstudio.com/)
- **WebStorm** : [Télécharger](https://www.jetbrains.com/webstorm/)

### **Extensions VS Code utiles :**
- Prisma
- TypeScript Importer
- Discord.js Snippets
- GitLens

### **Terminal recommandé :**
- **Windows Terminal** : [Microsoft Store](https://www.microsoft.com/store/productId/9N0DX20HK701)
- **PowerShell 7** : [GitHub](https://github.com/PowerShell/PowerShell)

## 🐛 Résolution de Problèmes Windows

### **Erreur "npm n'est pas reconnu"**
- Redémarrez votre terminal après installation de Node.js
- Vérifiez que Node.js est dans votre PATH

### **Erreur de permissions PowerShell**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### **Erreur Docker "Docker Desktop is not running"**
- Lancez Docker Desktop depuis le menu Démarrer
- Attendez que l'icône Docker soit verte

### **Erreur de connexion PostgreSQL**
- Vérifiez que PostgreSQL est démarré (services.msc)
- Testez la connexion avec psql

### **Erreur de connexion Redis**
- Si Docker : `docker ps` pour vérifier que Redis tourne
- Si manuel : Lancez `redis-server.exe`

### **Bot ne répond pas**
1. Vérifiez le token Discord dans `.env`
2. Vérifiez les permissions du bot sur le serveur
3. Regardez les logs dans le dossier `logs/`

### **Erreur lors des migrations**
```cmd
npx prisma migrate reset
npm run db:migrate
```

## 📁 Structure du Projet

```
marmotte_mining/
├── 📁 src/
│   ├── 📁 bot/              # Commandes Discord
│   ├── 📁 services/         # Logique métier
│   ├── 📁 config/           # Configuration
│   └── 📁 utils/            # Utilitaires
├── 📁 prisma/               # Schémas de base
├── 📁 logs/                 # Fichiers de logs
├── 📄 .env                  # Configuration (à créer)
├── 📄 package.json          # Dépendances
└── 📄 docker-compose.yml    # Services Docker
```

## 🎯 Test du Bot

### **1. Vérifications initiales**
- ✅ Bot en ligne sur Discord
- ✅ Pas d'erreurs dans les logs
- ✅ Base de données accessible

### **2. Commandes de test**
```
/profile          # Votre profil (crée l'utilisateur)
/balance          # Solde initial (100 tokens)
/shop machines    # Boutique des machines
/mine start       # Démarre le minage (après achat machine)
/price            # Prix actuel du token
```

### **3. Test de l'activité Discord**
- Envoyez quelques messages → Gagnez des $
- Ajoutez des réactions → Plus de $
- Rejoignez un canal vocal → Encore plus de $

### **4. Test des batailles**
```
/battle join      # Rejoindre/créer une bataille
/battle list      # Voir les batailles actives
```

## 🔄 Mise à Jour

Pour mettre à jour le bot :

```cmd
git pull origin main
npm install
npm run db:migrate
npm run build
```

## 💡 Conseils Windows

1. **Utilisez Windows Terminal** pour une meilleure expérience
2. **Épinglez le dossier** dans l'Explorateur pour accès rapide
3. **Créez un raccourci** pour `npm run dev`
4. **Surveillez les logs** dans `logs/combined.log`
5. **Utilisez Prisma Studio** pour visualiser vos données

## 🆘 Support Spécifique Windows

Si vous avez des problèmes :

1. **Vérifiez les logs** : `logs/error.log`
2. **Testez les connexions** : PostgreSQL et Redis
3. **Variables d'environnement** : Vérifiez votre `.env`
4. **Antivirus** : Ajoutez le dossier aux exceptions
5. **Pare-feu** : Autorisez Node.js et les ports 5432/6379

Bon développement sur Windows ! 🪟🚀