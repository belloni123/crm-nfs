-- CreateTable
CREATE TABLE "Origin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "Origin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostStatus" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "LostStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'LEAD',
    "options" TEXT,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "originId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "lostStatusId" TEXT;

-- AlterTable
ALTER TABLE "WebhookEndpoint" ADD COLUMN "originId" TEXT;

-- AlterTable
ALTER TABLE "WhatsAppInstance" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'WHATSAPP';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "messageType" TEXT NOT NULL DEFAULT 'TEXT';
ALTER TABLE "Message" ADD COLUMN "mediaUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Origin" ADD CONSTRAINT "Origin_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostStatus" ADD CONSTRAINT "LostStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Origin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_lostStatusId_fkey" FOREIGN KEY ("lostStatusId") REFERENCES "LostStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Origin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
