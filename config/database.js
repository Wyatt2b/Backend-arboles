const { Pool } = require('pg');

// Configuración para PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
});

// Probar conexión al iniciar
pool.on('connect', () => {
    console.log('✅ Conectado a PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Error en conexión PostgreSQL:', err.message);
});

const getConnection = () => pool;

process.on('SIGINT', async () => {
    await pool.end();
    console.log('🔌 Conexión a PostgreSQL cerrada');
    process.exit(0);
});

module.exports = { getConnection };