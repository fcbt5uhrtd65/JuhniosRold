const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const relativeFile = process.argv[2];

if (!relativeFile) {
  console.error('Usage: node scripts/run-sql.cjs <sql-file>');
  process.exit(1);
}

const connectionConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'juhnios_rold',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

async function main() {
  const filePath = path.resolve(process.cwd(), relativeFile);
  const sql = fs.readFileSync(filePath, 'utf8');
  const client = new Client(connectionConfig);

  await client.connect();
  try {
    await client.query(sql);
    console.log(`Executed ${relativeFile}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
