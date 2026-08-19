ALTER TABLE "transactions" ADD COLUMN "amount_raw" text;
ALTER TABLE "transactions" ADD COLUMN "asset" text DEFAULT 'USDC' NOT NULL;
ALTER TABLE "transactions" ADD COLUMN "network" text DEFAULT 'worldchain' NOT NULL;
ALTER TABLE "transactions" ADD COLUMN "sender_wallet" text;
