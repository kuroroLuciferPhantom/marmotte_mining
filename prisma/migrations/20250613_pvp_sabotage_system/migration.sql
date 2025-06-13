/*
  Migration pour le système PvP de sabotage
  
  Cette migration ajoute toutes les tables nécessaires pour :
  - Les cartes d'attaque et de défense
  - Le système de sabotage PvP
  - Les missions clandestines  
  - Le marché noir
  - La gestion des fragments et de l'énergie
*/

-- CreateEnum
CREATE TYPE "AttackType" AS ENUM ('VIRUS_Z3_MINER', 'BLACKOUT_TARGETED', 'FORCED_RECALIBRATION', 'DNS_HIJACKING', 'BRUTAL_THEFT');

-- CreateEnum
CREATE TYPE "DefenseType" AS ENUM ('ANTIVIRUS', 'BACKUP_GENERATOR', 'OPTIMIZATION_SOFTWARE', 'VPN_FIREWALL', 'SABOTAGE_DETECTOR');

-- CreateEnum
CREATE TYPE "CardRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "FragmentType" AS ENUM ('ATTACK_FRAGMENT', 'DEFENSE_FRAGMENT', 'RARE_FRAGMENT');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('INFILTRATE_FARM', 'HACK_WAREHOUSE', 'STEAL_BLUEPRINT', 'SABOTAGE_COMPETITOR', 'RESCUE_DATA');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'SABOTAGE_COST';
ALTER TYPE "TransactionType" ADD VALUE 'MISSION_REWARD';
ALTER TYPE "TransactionType" ADD VALUE 'BLACK_MARKET_PURCHASE';
ALTER TYPE "TransactionType" ADD VALUE 'CARD_CRAFT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dollars" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "energy" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "lastMission" TIMESTAMP(3),
ADD COLUMN     "lastSabotage" TIMESTAMP(3),
ADD COLUMN     "sabotagesBlocked" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sabotagesReceived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sabotagesSuccessful" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "machines" ADD COLUMN     "efficiencyDebuff" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "hashrateDebuff" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "sabotageEndTime" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "attack_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AttackType" NOT NULL,
    "rarity" "CardRarity" NOT NULL DEFAULT 'COMMON',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attack_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defense_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DefenseType" NOT NULL,
    "rarity" "CardRarity" NOT NULL DEFAULT 'COMMON',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defense_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_fragments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FragmentType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_fragments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sabotage_actions" (
    "id" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "AttackType" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "damage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "cost" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "detected" BOOLEAN NOT NULL DEFAULT false,
    "logMessage" TEXT,

    CONSTRAINT "sabotage_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sabotage_defenses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defenseType" "DefenseType" NOT NULL,
    "sabotageId" TEXT,
    "success" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sabotage_defenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sabotage_immunities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "sabotage_immunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionType" "MissionType" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reward" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "narrative" TEXT,

    CONSTRAINT "mission_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "black_market_offers" (
    "id" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "rarity" "CardRarity" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "black_market_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "black_market_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "black_market_purchases_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "attack_cards" ADD CONSTRAINT "attack_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_cards" ADD CONSTRAINT "defense_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_fragments" ADD CONSTRAINT "card_fragments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sabotage_actions" ADD CONSTRAINT "sabotage_actions_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "users"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sabotage_actions" ADD CONSTRAINT "sabotage_actions_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sabotage_defenses" ADD CONSTRAINT "sabotage_defenses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sabotage_immunities" ADD CONSTRAINT "sabotage_immunities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_attempts" ADD CONSTRAINT "mission_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "black_market_purchases" ADD CONSTRAINT "black_market_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "black_market_purchases" ADD CONSTRAINT "black_market_purchases_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "black_market_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "attack_cards_userId_idx" ON "attack_cards"("userId");
CREATE INDEX "defense_cards_userId_idx" ON "defense_cards"("userId");
CREATE INDEX "card_fragments_userId_idx" ON "card_fragments"("userId");
CREATE INDEX "sabotage_actions_attackerId_idx" ON "sabotage_actions"("attackerId");
CREATE INDEX "sabotage_actions_targetId_idx" ON "sabotage_actions"("targetId");
CREATE INDEX "sabotage_actions_timestamp_idx" ON "sabotage_actions"("timestamp");
CREATE INDEX "mission_attempts_userId_idx" ON "mission_attempts"("userId");
CREATE INDEX "black_market_offers_expiresAt_idx" ON "black_market_offers"("expiresAt");
CREATE INDEX "black_market_purchases_userId_idx" ON "black_market_purchases"("userId");

-- Insert initial black market offers
INSERT INTO "black_market_offers" ("id", "cardType", "rarity", "price", "stock", "expiresAt") VALUES
('init1', 'VIRUS_Z3_MINER', 'COMMON', 15, 2, NOW() + INTERVAL '12 hours'),
('init2', 'ANTIVIRUS', 'COMMON', 18, 1, NOW() + INTERVAL '12 hours'),
('init3', 'BLACKOUT_TARGETED', 'UNCOMMON', 45, 1, NOW() + INTERVAL '12 hours');