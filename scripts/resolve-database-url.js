const required = ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"];

const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing required database environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const encode = encodeURIComponent;
const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = process.env;

process.stdout.write(
  `postgresql://${encode(POSTGRES_USER)}:${encode(POSTGRES_PASSWORD)}@postgres:5432/${encode(POSTGRES_DB)}?schema=public`,
);
