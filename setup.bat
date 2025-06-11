@echo off
REM 🚀 Script de démarrage rapide pour Marmotte Mining Bot - Windows
REM Ce script configure automatiquement l'environnement de développement

echo 🚀 Démarrage de Marmotte Mining Bot pour Windows...
echo ================================================
echo.

REM Couleurs pour les messages (compatible Windows)
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

REM Vérification des prérequis
echo %BLUE%[INFO]%NC% Vérification des prérequis...

REM Vérifier Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Node.js n'est pas installé.
    echo Téléchargez et installez Node.js depuis: https://nodejs.org/
    echo Redémarrez votre terminal après l'installation.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo %GREEN%[SUCCESS]%NC% Node.js installé: %NODE_VERSION%
)

REM Vérifier npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% npm n'est pas installé.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo %GREEN%[SUCCESS]%NC% npm installé: v%NPM_VERSION%
)

REM Vérifier Docker (optionnel)
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('docker --version') do set DOCKER_VERSION=%%i
    echo %GREEN%[SUCCESS]%NC% Docker disponible: %DOCKER_VERSION%
    set USE_DOCKER=true
) else (
    echo %YELLOW%[WARNING]%NC% Docker non trouvé. Installation manuelle de PostgreSQL et Redis requise.
    set USE_DOCKER=false
)

echo.

REM Installation des dépendances
echo %BLUE%[INFO]%NC% Installation des dépendances npm...
call npm install
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Échec de l'installation des dépendances
    pause
    exit /b 1
)
echo %GREEN%[SUCCESS]%NC% Dépendances installées avec succès

echo.

REM Configuration des services
if "%USE_DOCKER%"=="true" (
    echo %BLUE%[INFO]%NC% Démarrage des services Docker (PostgreSQL et Redis)...
    docker-compose up -d postgres redis
    if %errorlevel% neq 0 (
        echo %RED%[ERROR]%NC% Échec du démarrage des services Docker
        pause
        exit /b 1
    )
    echo %GREEN%[SUCCESS]%NC% Services Docker démarrés
    echo %BLUE%[INFO]%NC% Attente de la disponibilité de PostgreSQL...
    timeout /t 10 /nobreak >nul
) else (
    echo %YELLOW%[WARNING]%NC% Docker non disponible. Instructions pour installation manuelle:
    echo.
    echo PostgreSQL:
    echo 1. Téléchargez depuis: https://www.postgresql.org/download/windows/
    echo 2. Installez avec les paramètres par défaut
    echo 3. Créez une base 'marmotte_mining'
    echo.
    echo Redis:
    echo 1. Téléchargez depuis: https://github.com/MicrosoftArchive/redis/releases
    echo 2. Ou utilisez WSL: wsl --install puis sudo apt install redis-server
    echo.
    set /p continue="Appuyez sur Entrée après avoir installé PostgreSQL et Redis..."
)

echo.

REM Configuration du fichier .env
if not exist ".env" (
    echo %BLUE%[INFO]%NC% Création du fichier .env...
    copy .env.example .env >nul
    
    if "%USE_DOCKER%"=="true" (
        REM Configuration automatique pour Docker
        powershell -Command "(Get-Content .env) -replace 'DATABASE_URL=.*', 'DATABASE_URL=\"postgresql://marmotte_user:marmotte_password@localhost:5432/marmotte_mining?schema=public\"' | Set-Content .env"
        powershell -Command "(Get-Content .env) -replace 'REDIS_URL=.*', 'REDIS_URL=\"redis://localhost:6379\"' | Set-Content .env"
    )
    
    echo %GREEN%[SUCCESS]%NC% Fichier .env créé
    echo.
    echo %YELLOW%[WARNING]%NC% ⚠️  IMPORTANT: Configurez votre token Discord dans le fichier .env
    echo   1. Allez sur https://discord.com/developers/applications
    echo   2. Créez une application et un bot
    echo   3. Copiez le token et l'ID client dans .env
    echo   4. Ajoutez votre serveur Discord ID
    echo.
    echo Le fichier .env va s'ouvrir automatiquement...
    timeout /t 3 /nobreak >nul
    notepad .env
    echo.
    set /p discord_configured="Avez-vous configuré votre token Discord ? (o/N): "
    if /i not "%discord_configured%"=="o" (
        echo %RED%[ERROR]%NC% Configuration du token Discord requise avant de continuer
        echo Ouvrez le fichier .env et configurez:
        echo   - DISCORD_TOKEN=votre_token_ici
        echo   - DISCORD_CLIENT_ID=votre_client_id_ici
        echo   - DISCORD_GUILD_ID=votre_serveur_id_ici
        pause
        exit /b 1
    )
) else (
    echo %GREEN%[SUCCESS]%NC% Fichier .env existant trouvé
)

echo.

REM Configuration de la base de données
echo %BLUE%[INFO]%NC% Configuration de la base de données...

echo %BLUE%[INFO]%NC% Génération du client Prisma...
call npm run db:generate
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Échec de la génération du client Prisma
    pause
    exit /b 1
)

echo %BLUE%[INFO]%NC% Application des migrations de base de données...
call npm run db:migrate
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Échec de la configuration de la base de données
    echo Vérifiez que PostgreSQL est démarré et accessible
    pause
    exit /b 1
)

echo %GREEN%[SUCCESS]%NC% Base de données configurée avec succès

echo.

REM Test de la configuration
echo %BLUE%[INFO]%NC% Test de la configuration...
call npm run build
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Échec de la compilation TypeScript
    pause
    exit /b 1
)

echo %GREEN%[SUCCESS]%NC% Compilation TypeScript réussie

echo.

REM Démarrage du bot
echo %GREEN%[SUCCESS]%NC% 🎉 Configuration terminée avec succès !
echo.
echo %BLUE%[INFO]%NC% Commandes disponibles:
echo   npm run dev     - Démarrage en mode développement
echo   npm run build   - Compilation du projet
echo   npm start       - Démarrage en mode production
echo   npm run db:studio - Interface graphique de la base
echo.

set /p start_now="Voulez-vous démarrer le bot maintenant ? (O/n): "
if /i not "%start_now%"=="n" (
    echo %BLUE%[INFO]%NC% Démarrage du bot en mode développement...
    call npm run dev
) else (
    echo %BLUE%[INFO]%NC% Pour démarrer le bot plus tard, utilisez: npm run dev
)

pause