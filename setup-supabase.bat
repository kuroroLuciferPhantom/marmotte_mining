@echo off
REM Setup rapide avec Supabase + Redis local

echo 🚀 Setup Marmotte Mining avec Supabase...
echo ==========================================

REM Installation des dépendances
echo [1/5] Installation des dépendances...
call npm install

REM Démarrage Redis local avec Docker
echo [2/5] Démarrage de Redis local...
docker run -d --name redis-marmotte -p 6379:6379 redis:6-alpine
if %errorlevel% equ 0 (
    echo ✅ Redis démarré sur localhost:6379
) else (
    echo ❌ Erreur Redis - Vérifiez que Docker est installé et démarré
    echo Alternative: Utilisez un Redis cloud comme Upstash
)

REM Configuration .env
echo [3/5] Configuration .env...
if not exist ".env" (
    copy .env.example .env
    echo ✅ Fichier .env créé
) else (
    echo ✅ Fichier .env existant
)

echo.
echo 🌊 CONFIGURATION SUPABASE:
echo 1. Allez sur https://supabase.com/
echo 2. Créez un nouveau projet
echo 3. Settings ^> Database ^> Connection string ^> URI
echo 4. Copiez l'URL et remplacez [YOUR-PASSWORD]
echo.
echo 📝 Le fichier .env va s'ouvrir pour configuration...
timeout /t 3 /nobreak >nul
notepad .env

echo.
echo [4/5] Configuration de la base de données...
call npm run db:generate
call npm run db:migrate

echo.
echo [5/5] Test de démarrage...
echo ✅ Configuration terminée !
echo.
echo 🎯 ÉTAPES SUIVANTES:
echo 1. Configurez Discord Bot: https://discord.com/developers/applications
echo 2. Invitez le bot sur votre serveur
echo 3. Lancez: npm run dev
echo.
set /p start_now="Démarrer le bot maintenant ? (o/N): "
if /i "%start_now%"=="o" (
    call npm run dev
) else (
    echo Pour démarrer: npm run dev
)

pause