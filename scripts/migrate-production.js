const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

const migrations = {
  initial: "20260606000000_init",
  enhancements: "20260606100000_add_crm_enhancements",
  extensibility: "20260901150000_add_custom_fields_webhooks",
};

const initialTables = [
  "User",
  "Project",
  "Membership",
  "Pipeline",
  "Stage",
  "Lead",
  "Tag",
  "Task",
  "Activity",
  "WebhookEndpoint",
  "WebhookLog",
  "WhatsAppInstance",
  "Conversation",
  "Message",
  "_LeadToTag",
];

const enhancementTables = [
  "Origin",
  "LostStatus",
  "CustomFieldDefinition",
  "CustomFieldValue",
];

const enhancementColumns = [
  "Lead.originId",
  "Lead.lostStatusId",
  "WebhookEndpoint.originId",
  "WhatsAppInstance.type",
  "Message.messageType",
  "Message.mediaUrl",
];

const extensibilityColumns = [
  "CustomFieldDefinition.internalName",
  "CustomFieldDefinition.helpText",
  "CustomFieldDefinition.defaultValue",
  "CustomFieldDefinition.validationRules",
  "CustomFieldDefinition.required",
  "CustomFieldDefinition.isActive",
  "CustomFieldDefinition.order",
  "CustomFieldDefinition.deletedAt",
  "CustomFieldDefinition.createdAt",
  "CustomFieldDefinition.updatedAt",
  "WebhookEndpoint.direction",
  "WebhookEndpoint.url",
  "WebhookEndpoint.method",
  "WebhookEndpoint.isActive",
  "WebhookEndpoint.events",
  "WebhookEndpoint.payloadFields",
  "WebhookEndpoint.headersEncrypted",
  "WebhookEndpoint.timeoutMs",
  "WebhookEndpoint.deletedAt",
  "WebhookEndpoint.updatedAt",
  "WebhookLog.event",
  "WebhookLog.statusCode",
  "WebhookLog.responseBody",
  "WebhookLog.attempt",
  "WebhookLog.durationMs",
];

const extensibilityIndexes = [
  "CustomFieldDefinition_projectId_internalName_key",
  "CustomFieldDefinition_projectId_isActive_order_idx",
  "CustomFieldValue_fieldDefinitionId_leadId_key",
  "CustomFieldValue_leadId_idx",
  "WebhookEndpoint_projectId_direction_isActive_idx",
  "WebhookLog_webhookId_createdAt_idx",
];

function runPrisma(args) {
  const result = spawnSync("npx", ["prisma", ...args], {
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Prisma command failed: prisma ${args.join(" ")}`);
  }
}

async function readDatabaseState(prisma) {
  const tables = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const columns = await prisma.$queryRawUnsafe(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  );
  const indexes = await prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
  );

  const tableSet = new Set(tables.map((row) => row.table_name));
  const columnSet = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
  const indexSet = new Set(indexes.map((row) => row.indexname));

  let appliedMigrations = new Set();
  if (tableSet.has("_prisma_migrations")) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    appliedMigrations = new Set(rows.map((row) => row.migration_name));
  }

  return { tableSet, columnSet, indexSet, appliedMigrations };
}

function missingFrom(required, actual) {
  return required.filter((item) => !actual.has(item));
}

async function countLeads(prisma) {
  const [row] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "Lead"`);
  return row.count;
}

async function repairKnownLegacyDrift(prisma, state) {
  const missingColumns = missingFrom(enhancementColumns, state.columnSet);

  if (
    missingColumns.length === 1 &&
    missingColumns[0] === "Lead.lostStatusId" &&
    state.tableSet.has("LostStatus")
  ) {
    console.log("Repairing known legacy drift: Lead.lostStatusId");
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lostStatusId" TEXT`,
    );
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Lead_lostStatusId_fkey'
        ) THEN
          ALTER TABLE "Lead"
          ADD CONSTRAINT "Lead_lostStatusId_fkey"
          FOREIGN KEY ("lostStatusId") REFERENCES "LostStatus"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END
      $$
    `);
    return readDatabaseState(prisma);
  }

  return state;
}

async function assertNoUniquenessConflicts(prisma) {
  const duplicateValues = await prisma.$queryRawUnsafe(`
    SELECT 1
    FROM "CustomFieldValue"
    GROUP BY "fieldDefinitionId", "leadId"
    HAVING COUNT(*) > 1
    LIMIT 1
  `);

  const duplicateGeneratedNames = await prisma.$queryRawUnsafe(`
    SELECT 1
    FROM "CustomFieldDefinition"
    GROUP BY "projectId", REPLACE(SUBSTRING(id FROM 1 FOR 12), '-', '')
    HAVING COUNT(*) > 1
    LIMIT 1
  `);

  if (duplicateValues.length || duplicateGeneratedNames.length) {
    throw new Error(
      "Migration preflight found duplicate custom-field data. No schema change was applied.",
    );
  }
}

async function main() {
  let prisma = new PrismaClient();
  await prisma.$connect();

  const beforeCount = await countLeads(prisma);
  let state = await readDatabaseState(prisma);

  const missingInitial = missingFrom(initialTables, state.tableSet);
  const missingEnhancementTables = missingFrom(enhancementTables, state.tableSet);

  if (missingInitial.length || missingEnhancementTables.length) {
    throw new Error(
      `Legacy database does not match the expected CRM baseline. Missing artifacts: ${[
        ...missingInitial,
        ...missingEnhancementTables,
      ].join(", ")}`,
    );
  }

  state = await repairKnownLegacyDrift(prisma, state);
  const missingEnhancementColumns = missingFrom(enhancementColumns, state.columnSet);

  if (missingEnhancementColumns.length) {
    throw new Error(
      `Legacy database does not match the expected CRM baseline. Missing artifacts: ${missingEnhancementColumns.join(", ")}`,
    );
  }

  const presentExtensibilityColumns = extensibilityColumns.filter((item) =>
    state.columnSet.has(item),
  );
  const presentExtensibilityIndexes = extensibilityIndexes.filter((item) =>
    state.indexSet.has(item),
  );
  const extensibilityAbsent =
    presentExtensibilityColumns.length === 0 && presentExtensibilityIndexes.length === 0;
  const extensibilityComplete =
    presentExtensibilityColumns.length === extensibilityColumns.length &&
    presentExtensibilityIndexes.length === extensibilityIndexes.length;

  if (!extensibilityAbsent && !extensibilityComplete) {
    throw new Error(
      "The extensibility migration is partially present. No automatic migration was attempted.",
    );
  }

  await assertNoUniquenessConflicts(prisma);
  await prisma.$disconnect();

  const baselines = [
    [migrations.initial, true],
    [migrations.enhancements, true],
    [migrations.extensibility, extensibilityComplete],
  ];

  for (const [migration, schemaAlreadyPresent] of baselines) {
    if (schemaAlreadyPresent && !state.appliedMigrations.has(migration)) {
      console.log(`Recording existing schema baseline: ${migration}`);
      runPrisma(["migrate", "resolve", "--applied", migration]);
    }
  }

  runPrisma(["migrate", "deploy"]);

  prisma = new PrismaClient();
  await prisma.$connect();
  const afterCount = await countLeads(prisma);
  await prisma.$disconnect();

  if (afterCount !== beforeCount) {
    throw new Error(`Lead count changed during migration (${beforeCount} -> ${afterCount}).`);
  }

  console.log(`Database migration verified; preserved ${afterCount} lead(s).`);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
