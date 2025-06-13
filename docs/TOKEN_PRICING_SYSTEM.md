# 🪙 Système de Valeur Dynamique du Token $7N1

## 📋 Vue d'ensemble

Le token $7N1 utilise un système de valorisation dynamique basé sur une formule mathématique qui prend en compte plusieurs facteurs économiques réels du jeu. Contrairement à un taux de change fixe, le prix fluctue en temps réel selon l'activité des joueurs et les événements du marché.

## 🧮 Formule de Calcul

```
Valeur_$7N1 = Base_Price × (1 + H/CT) × (1 - M/CT) × (1 + F)
```

### Variables :
- **`Base_Price`** : Prix de base configuré (défaut: $0.01)
- **`H`** : Total de tokens détenus par tous les joueurs
- **`M`** : Total de tokens minés dans les dernières 24h
- **`CT`** : Total en circulation (somme de tous les tokens des joueurs)
- **`F`** : Facteur bonus/malus (-50% à +100%)

## 📊 Facteurs d'Influence

### 1. 📈 Holding Factor `(1 + H/CT)`
- **Impact** : Plus les joueurs conservent leurs tokens, plus le prix augmente
- **Logique** : Simule la rareté et la demande de détention
- **Exemple** : Si 80% des tokens sont détenus → bonus de 80%

### 2. ⛏️ Mining Penalty `(1 - M/CT)`
- **Impact** : Plus il y a de minage récent, plus la pression baissière est forte
- **Logique** : Simule l'inflation due à la création de nouveaux tokens
- **Protection** : Minimum de 10% pour éviter les valeurs nulles

### 3. 🎯 Bonus Factor `(1 + F)`
- **Impact** : Événements spéciaux qui modifient temporairement le prix
- **Sources** :
  - Événements de jeu (PRICE_BOOST, MINING_BONUS)
  - Actions administratives manuelles
  - Événements aléatoires du marché

## 🔄 Déclenchement du Calcul

Le prix est recalculé automatiquement lors de :
- `/wallet` - Consultation du portefeuille
- `/echanger` - Échange dollars ↔ tokens
- `/cours` - Consultation du cours
- Actions de minage importantes
- Événements de marché

**Cache** : Résultat mis en cache pendant 30 secondes pour optimiser les performances.

## 📈 Système de Monitoring

### Surveillance Automatique
- **Fréquence** : Vérification toutes les 2 minutes
- **Alertes** : Variations >5%, jalons de prix, pics de volume
- **Événements** : Déclenchement aléatoire toutes les 30 minutes (30% de chance)

### Types d'Événements Automatiques
1. **Mining Rush** (+15%, 60min) - Activité minière intense
2. **Whale Activity** (±10%, 30min) - Gros investisseur
3. **Technical Upgrade** (+20%, 120min) - Amélioration technique
4. **Market Sentiment** (±10%, 45min) - Changement de sentiment

## 🎮 Commandes Utilisateur

### `/wallet`
- Affiche le portefeuille avec valeur en temps réel
- Calcule automatiquement la valeur des tokens détenus
- Montre les statistiques de marché

### `/echanger`
- Échange dollars ↔ tokens au prix actuel
- Commission de 1% sur ventes de tokens
- Taux de change dynamique

### `/cours`
- Cours actuel avec historique
- Analyse de marché et conseils
- Graphique ASCII de tendance
- Facteurs de prix détaillés

## 🛠️ Commandes Administrateur

### `/admin-marche`
Commandes réservées aux administrateurs :

#### `prix`
Force le recalcul immédiat du prix

#### `event <facteur> <duree> <raison>`
Déclenche un événement manuel :
- Facteur : -50% à +100%
- Durée : 1 à 1440 minutes
- Raison : Description de l'événement

#### `burn <montant> <raison>`
Brûle des tokens pour créer de la déflation

#### `channel <canal>`
Configure le canal de notifications automatiques

#### `stats`
Statistiques complètes du marché

#### `pump-dump`
Simulation d'événement extrême (test uniquement)

## 📊 Exemples de Calcul

### Exemple 1 : Marché Stable
```
Base_Price = $0.01
H = 10,000 tokens détenus
M = 100 tokens minés 24h
CT = 10,000 tokens circulation
F = 0 (aucun événement)

Prix = $0.01 × (1 + 10000/10000) × (1 - 100/10000) × (1 + 0)
Prix = $0.01 × 2.0 × 0.99 × 1.0
Prix = $0.0198
```

### Exemple 2 : Rush de Minage
```
Base_Price = $0.01
H = 10,000 tokens détenus
M = 2,000 tokens minés 24h
CT = 12,000 tokens circulation
F = 0

Prix = $0.01 × (1 + 10000/12000) × (1 - 2000/12000) × 1.0
Prix = $0.01 × 1.833 × 0.833 × 1.0
Prix = $0.0153 (baisse due au minage intensif)
```

### Exemple 3 : Événement Positif
```
Base_Price = $0.01
H = 15,000 tokens détenus
M = 50 tokens minés 24h
CT = 15,000 tokens circulation
F = 0.2 (événement +20%)

Prix = $0.01 × (1 + 15000/15000) × (1 - 50/15000) × (1 + 0.2)
Prix = $0.01 × 2.0 × 0.9967 × 1.2
Prix = $0.0239
```

## 🔧 Configuration Technique

### Variables d'Environnement
```env
TOKEN_BASE_PRICE=0.01        # Prix de base en dollars
MINING_BASE_RATE=0.1         # Taux de minage de base
BATTLE_COOLDOWN=3600         # Cooldown battles (secondes)
```

### Cache Redis
- **Clé** : `token_price`
- **TTL** : 30 secondes
- **Fallback** : Stockage en mémoire si Redis indisponible

### Base de Données
- **Table** : `token_prices` - Historique des prix
- **Table** : `transactions` - Toutes les opérations
- **Table** : `game_events` - Événements actifs

## 📱 Notifications Automatiques

### Canal de Marché
Messages automatiques envoyés dans un canal dédié :

#### Alertes en Temps Réel
- 🚀 Forte hausse (>5%)
- 📉 Forte baisse (>5%)
- 🎯 Jalons de prix atteints
- 💹 Pics de volume
- ⚡ Événements de marché

#### Rapport Quotidien (12h00)
- Résumé des 24h
- Plus hauts/plus bas
- Volume et market cap
- Analyse de tendance

### Cooldown
- **Anti-spam** : 5 minutes entre notifications
- **Limite** : Messages importants uniquement

## 🎯 Stratégies de Jeu

### Pour les Joueurs

#### Accumuler (HODL)
- **Avantage** : Augmente le holding factor
- **Risque** : Pas de liquidité immédiate
- **Conseil** : Surveiller les événements de marché

#### Trading Actif
- **Avantage** : Profiter des fluctuations
- **Risque** : Commission de 1% sur les ventes
- **Conseil** : Utiliser `/cours` pour l'analyse

#### Minage Intensif
- **Avantage** : Génération de tokens
- **Risque** : Pression baissière sur le prix
- **Conseil** : Équilibrer production et détention

### Pour les Administrateurs

#### Gestion des Événements
- Utiliser les événements pour créer de l'engagement
- Équilibrer les phases haussières et baissières
- Communiquer les raisons des événements

#### Monitoring du Marché
- Surveiller la volatilité excessive
- Intervenir en cas de manipulation
- Maintenir l'équilibre économique

## 🚀 Évolutions Futures

### Fonctionnalités Prévues
1. **Leaderboards** - Classements des plus gros holders
2. **API Publique** - Accès aux données de marché
3. **Graphiques Avancés** - Visualisations détaillées
4. **Événements Programmés** - Calendrier d'événements
5. **NFT Integration** - Tokens spéciaux pour récompenses

### Améliorations Techniques
1. **Machine Learning** - Prédiction de tendances
2. **WebSockets** - Mises à jour en temps réel
3. **Multi-serveurs** - Synchronisation entre guildes
4. **Mobile App** - Application dédiée

## 🛡️ Sécurité et Stabilité

### Protections Implémentées
- **Limites de facteurs** : F entre -50% et +100%
- **Minimum de prix** : Protection contre valeurs nulles
- **Cache intelligent** : Évite les recalculs excessifs
- **Logs détaillés** : Traçabilité complète
- **Transactions DB** : Intégrité garantie

### Monitoring
- **Alertes automatiques** : Anomalies détectées
- **Sauvegarde historique** : Données préservées
- **Rollback possible** : Retour en arrière si nécessaire

---

## 📞 Support

Pour toute question ou problème :
1. Consulter cette documentation
2. Utiliser `/help` dans Discord
3. Contacter les administrateurs
4. Vérifier les logs pour diagnostic

**Version** : 1.0.0  
**Dernière MAJ** : Juin 2025  
**Statut** : ✅ Opérationnel
