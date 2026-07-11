-- CreateTable
CREATE TABLE "partner_invites" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_by_id" UUID,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "partner_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_acknowledgments" (
    "id" UUID NOT NULL,
    "partner_user_id" UUID NOT NULL,
    "primary_user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_invites_code_key" ON "partner_invites"("code");

-- CreateIndex
CREATE INDEX "partner_invites_created_by_id_idx" ON "partner_invites"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_acknowledgments_partner_user_id_primary_user_id_dat_key" ON "partner_acknowledgments"("partner_user_id", "primary_user_id", "date");

-- AddForeignKey
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_acknowledgments" ADD CONSTRAINT "partner_acknowledgments_partner_user_id_fkey" FOREIGN KEY ("partner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_acknowledgments" ADD CONSTRAINT "partner_acknowledgments_primary_user_id_fkey" FOREIGN KEY ("primary_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
