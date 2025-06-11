#!/bin/bash

# 🚀 Script de déploiement pour serveur de production
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
echo "🚀 Déploiement en environnement: $ENVIRONMENT"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
check_prerequisites() {
    print_status "Vérification des prérequis..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js n'est pas installé"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm n'est pas installé"
        exit 1
    fi
    
    if [ ! -f ".env.${ENVIRONMENT}" ] && [ ! -f ".env" ]; then
        print_error "Fichier .env manquant"
        exit 1
    fi
}

# Sauvegarde de la base de données
backup_database() {
    print_status "Sauvegarde de la base de données..."
    
    if [ -f ".env.${ENVIRONMENT}" ]; then
        source ".env.${ENVIRONMENT}"
    else
        source ".env"
    fi
    
    mkdir -p backups
    
    # Extraction des paramètres de connexion
    DB_HOST=$(echo $DATABASE_URL | sed 's/.*@\([^:]*\).*/\1/')
    DB_NAME=$(echo $DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/')
    DB_USER=$(echo $DATABASE_URL | sed 's/.*:\/\/\([^:]*\).*/\1/')
    
    BACKUP_FILE="backups/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if command -v pg_dump &> /dev/null; then
        pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
        print_success "Sauvegarde créée: $BACKUP_FILE"
    else
        print_warning "pg_dump non disponible, sauvegarde ignorée"
    fi
}

# Arrêt des services
stop_services() {
    print_status "Arrêt des services..."
    
    # PM2
    if command -v pm2 &> /dev/null; then
        pm2 stop marmotte-mining || true
    fi
    
    # Systemd
    if systemctl is-active --quiet marmotte-bot; then
        sudo systemctl stop marmotte-bot
    fi
    
    # Docker
    if [ -f "docker-compose.yml" ]; then
        docker-compose down || true
    fi
}

# Mise à jour du code
update_code() {
    print_status "Mise à jour du code..."
    
    # Stash local changes
    git stash push -m "Auto-stash before deployment $(date)"
    
    # Pull latest changes
    git pull origin main
    
    print_success "Code mis à jour"
}

# Installation des dépendances
install_dependencies() {
    print_status "Installation des dépendances..."
    
    # Production dependencies only
    npm ci --only=production
    
    print_success "Dépendances installées"
}

# Build de l'application
build_application() {
    print_status "Compilation de l'application..."
    
    # Install dev dependencies for build
    npm install --only=dev
    
    # Generate Prisma client
    npx prisma generate
    
    # Build TypeScript
    npm run build
    
    # Remove dev dependencies
    npm prune --production
    
    print_success "Application compilée"
}

# Migration de la base de données
migrate_database() {
    print_status "Migration de la base de données..."
    
    # Deploy migrations
    npx prisma migrate deploy
    
    print_success "Migrations appliquées"
}

# Démarrage des services
start_services() {
    print_status "Démarrage des services..."
    
    case "$ENVIRONMENT" in
        "docker")
            docker-compose up -d --build
            ;;
        "pm2")
            pm2 start ecosystem.config.js --env production
            ;;
        "systemd")
            sudo systemctl start marmotte-bot
            sudo systemctl enable marmotte-bot
            ;;
        *)
            # Default: PM2 if available, otherwise direct start
            if command -v pm2 &> /dev/null; then
                pm2 start npm --name "marmotte-mining" -- start
            else
                nohup npm start > logs/app.log 2>&1 &
                echo $! > marmotte.pid
            fi
            ;;
    esac
    
    print_success "Services démarrés"
}

# Vérification de santé
health_check() {
    print_status "Vérification de santé..."
    
    sleep 5
    
    # Check if bot is responding
    if [ -f "marmotte.pid" ]; then
        PID=$(cat marmotte.pid)
        if ps -p $PID > /dev/null; then
            print_success "Bot en cours d'exécution (PID: $PID)"
        else
            print_error "Bot ne répond pas"
            exit 1
        fi
    fi
    
    # Check logs for errors
    if [ -f "logs/error.log" ]; then
        ERROR_COUNT=$(tail -100 logs/error.log | grep -c "ERROR" || true)
        if [ $ERROR_COUNT -gt 0 ]; then
            print_warning "$ERROR_COUNT erreurs détectées dans les logs"
        fi
    fi
    
    print_success "Vérification de santé terminée"
}

# Nettoyage
cleanup() {
    print_status "Nettoyage..."
    
    # Remove old logs (keep last 10)
    find logs/ -name "*.log.*" -type f | sort | head -n -10 | xargs rm -f || true
    
    # Remove old backups (keep last 5)
    find backups/ -name "backup_*.sql" -type f | sort | head -n -5 | xargs rm -f || true
    
    print_success "Nettoyage terminé"
}

# Rollback en cas d'erreur
rollback() {
    print_error "Erreur détectée, rollback..."
    
    # Restore last git state
    git reset --hard HEAD~1
    
    # Restore database if backup exists
    LATEST_BACKUP=$(ls -t backups/backup_*.sql 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        print_status "Restauration de la base: $LATEST_BACKUP"
        psql "$DATABASE_URL" < "$LATEST_BACKUP"
    fi
    
    # Restart services
    start_services
    
    print_error "Rollback terminé"
    exit 1
}

# Fonction principale
main() {
    echo "🚀 Déploiement Marmotte Mining Bot"
    echo "=================================="
    echo ""
    
    # Trap errors for rollback
    trap rollback ERR
    
    check_prerequisites
    backup_database
    stop_services
    update_code
    install_dependencies
    build_application
    migrate_database
    start_services
    health_check
    cleanup
    
    print_success "🎉 Déploiement terminé avec succès!"
    echo ""
    print_status "Commandes utiles:"
    print_status "  - Logs: tail -f logs/combined.log"
    print_status "  - Status: pm2 status (si PM2)"
    print_status "  - Restart: pm2 restart marmotte-mining"
    print_status "  - Monitor: pm2 monit"
}

# Exécution
main "$@"