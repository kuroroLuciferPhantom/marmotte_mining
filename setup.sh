#!/bin/bash

# 🚀 Script de démarrage rapide pour Marmotte Mining Bot
# Ce script configure automatiquement l'environnement de développement

echo "🚀 Démarrage de Marmotte Mining Bot..."

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher des messages colorés
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérification des prérequis
check_requirements() {
    print_status "Vérification des prérequis..."
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/"
        exit 1
    else
        NODE_VERSION=$(node --version)
        print_success "Node.js installé: $NODE_VERSION"
    fi
    
    # Vérifier npm
    if ! command -v npm &> /dev/null; then
        print_error "npm n'est pas installé."
        exit 1
    else
        NPM_VERSION=$(npm --version)
        print_success "npm installé: $NPM_VERSION"
    fi
    
    # Vérifier Docker (optionnel)
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker disponible: $DOCKER_VERSION"
        USE_DOCKER=true
    else
        print_warning "Docker non trouvé. Installation manuelle de PostgreSQL et Redis requise."
        USE_DOCKER=false
    fi
}

# Installation des dépendances
install_dependencies() {
    print_status "Installation des dépendances npm..."
    npm install
    if [ $? -eq 0 ]; then
        print_success "Dépendances installées avec succès"
    else
        print_error "Échec de l'installation des dépendances"
        exit 1
    fi
}

# Configuration des services avec Docker
setup_docker_services() {
    if [ "$USE_DOCKER" = true ]; then
        print_status "Démarrage des services Docker (PostgreSQL et Redis)..."
        docker-compose up -d postgres redis
        
        if [ $? -eq 0 ]; then
            print_success "Services Docker démarrés"
            # Attendre que PostgreSQL soit prêt
            print_status "Attente de la disponibilité de PostgreSQL..."
            sleep 10
        else
            print_error "Échec du démarrage des services Docker"
            exit 1
        fi
    else
        print_warning "Assurez-vous que PostgreSQL et Redis sont démarrés manuellement"
        read -p "Appuyez sur Entrée pour continuer..."
    fi
}

# Configuration du fichier .env
setup_environment() {
    if [ ! -f ".env" ]; then
        print_status "Création du fichier .env..."
        cp .env.example .env
        
        if [ "$USE_DOCKER" = true ]; then
            # Configuration automatique pour Docker
            sed -i.bak 's|DATABASE_URL=.*|DATABASE_URL="postgresql://marmotte_user:marmotte_password@localhost:5432/marmotte_mining?schema=public"|' .env
            sed -i.bak 's|REDIS_URL=.*|REDIS_URL="redis://localhost:6379"|' .env
            rm .env.bak 2>/dev/null || true
        fi
        
        print_warning "⚠️  IMPORTANT: Configurez votre token Discord dans le fichier .env"
        print_warning "   1. Allez sur https://discord.com/developers/applications"
        print_warning "   2. Créez une application et un bot"
        print_warning "   3. Copiez le token et l'ID client dans .env"
        print_warning "   4. Ajoutez votre serveur Discord ID"
        
        echo ""
        read -p "Avez-vous configuré votre token Discord ? (y/N): " discord_configured
        if [[ ! $discord_configured =~ ^[Yy]$ ]]; then
            print_error "Configuration du token Discord requise avant de continuer"
            print_status "Ouvrez le fichier .env et configurez :"
            print_status "  - DISCORD_TOKEN=votre_token_ici"
            print_status "  - DISCORD_CLIENT_ID=votre_client_id_ici"
            print_status "  - DISCORD_GUILD_ID=votre_serveur_id_ici"
            exit 1
        fi
    else
        print_success "Fichier .env existant trouvé"
    fi
}

# Configuration de la base de données
setup_database() {
    print_status "Configuration de la base de données..."
    
    # Génération du client Prisma
    print_status "Génération du client Prisma..."
    npm run db:generate
    
    # Application des migrations
    print_status "Application des migrations de base de données..."
    npm run db:migrate
    
    if [ $? -eq 0 ]; then
        print_success "Base de données configurée avec succès"
    else
        print_error "Échec de la configuration de la base de données"
        print_error "Vérifiez que PostgreSQL est démarré et accessible"
        exit 1
    fi
}

# Test de la configuration
test_configuration() {
    print_status "Test de la configuration..."
    
    # Test de compilation TypeScript
    print_status "Test de compilation TypeScript..."
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "Compilation TypeScript réussie"
    else
        print_error "Échec de la compilation TypeScript"
        exit 1
    fi
}

# Démarrage du bot
start_bot() {
    print_success "🎉 Configuration terminée avec succès !"
    echo ""
    print_status "Commandes disponibles :"
    print_status "  npm run dev     - Démarrage en mode développement"
    print_status "  npm run build   - Compilation du projet"
    print_status "  npm start       - Démarrage en mode production"
    print_status "  npm run db:studio - Interface graphique de la base"
    echo ""
    
    read -p "Voulez-vous démarrer le bot maintenant ? (Y/n): " start_now
    if [[ ! $start_now =~ ^[Nn]$ ]]; then
        print_status "Démarrage du bot en mode développement..."
        npm run dev
    else
        print_status "Pour démarrer le bot plus tard, utilisez: npm run dev"
    fi
}

# Fonction principale
main() {
    echo "🧪 Marmotte Mining Bot - Configuration automatique"
    echo "================================================="
    echo ""
    
    check_requirements
    install_dependencies
    setup_docker_services
    setup_environment
    setup_database
    test_configuration
    start_bot
}

# Gestion des erreurs
set -e
trap 'print_error "Une erreur est survenue. Vérifiez les logs ci-dessus."' ERR

# Exécution du script principal
main