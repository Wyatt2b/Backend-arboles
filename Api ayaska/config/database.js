const { Pool } = require('pg');

// 1. Configuramos las credenciales usando las variables correctas para Postgres
const dbConfig = {
    host: process.env.DB_SERVER || ' 192.168.11.214', // Postgres usa 'host' en lugar de 'server'
    database: process.env.DB_NAME || 'ayasaka',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'miku',
    port: process.env.DB_PORT || 5000,          // Puerto por defecto de Postgres
    max: 10,
    idleTimeoutMillis: 30000
};

// Creamos una única instancia del Pool
const pool = new Pool(dbConfig);

// 2. Adaptamos la función para verificar la conexión
const getConnection = async () => {
    try {
        console.log('🔌 Conectando a PostgreSQL...');
        console.log(`📍 Servidor: ${dbConfig.host}`);
        console.log(`👤 Usuario: ${dbConfig.user}`);
        
        // Obtenemos un cliente del pool para probar que la conexión funciona
        const client = await pool.connect();
        console.log('✅ Conectado a PostgreSQL exitosamente');
        
        // Liberamos el cliente inmediatamente para que el pool lo pueda reutilizar
        client.release(); 
        
        // Retornamos el pool para poder usarlo en las rutas
        return pool;
    } catch (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
        throw err;
    }
};

// 3. Adaptamos el cierre limpio para cuando detengas el servidor (Ctrl+C)
process.on('SIGINT', async () => {
    try {
        console.log('\n🔌 Cerrando pool de conexiones de PostgreSQL...');
        await pool.end(); // Postgres usa pool.end() en lugar de pool.close()
        process.exit(0);
    } catch (err) {
        console.error('❌ Error cerrando la conexión:', err.message);
        process.exit(1);
    }
});

// Exportamos el pool y la función
module.exports = {
    pool,
    getConnection
};