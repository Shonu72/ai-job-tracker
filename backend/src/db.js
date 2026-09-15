const { Pool } = require('pg');

// Build pool config from available environment variables.
// Priority: INSTANCE_UNIX_SOCKET (Cloud Run) > individual DB_* params > DATABASE_URL.
function buildPoolConfig() {
  if (process.env.INSTANCE_UNIX_SOCKET) {
    // Cloud Run with Cloud SQL Auth Proxy sidecar
    return {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'job_tracker',
      host: process.env.INSTANCE_UNIX_SOCKET,
    };
  }

  if (process.env.DB_HOST) {
    // Individual connection params (handles passwords with special chars like @)
    const config = {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'job_tracker',
    };
    if (process.env.DB_SSL !== 'false') {
      config.ssl = { rejectUnauthorized: false };
    }
    return config;
  }

  // Fallback: connection string
  return {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  };
}

const pool = new Pool({ ...buildPoolConfig(), connectionTimeoutMillis: 10000 });

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = { pool };
