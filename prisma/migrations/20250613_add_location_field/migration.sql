-- AddLocationField
-- Cette migration ajoute le champ location au modèle User

ALTER TABLE "users" ADD COLUMN "location" VARCHAR(255) DEFAULT 'Chambre chez maman';