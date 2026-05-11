const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const arbolRoutes = require('./routes/arbolRoutes');
const medicionRoutes = require('./routes/medicionRoutes');
const cuidadoRoutes = require('./routes/cuidadoRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check para Railway
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/arboles', arbolRoutes);
app.use('/api/mediciones', medicionRoutes);
app.use('/api/cuidados', cuidadoRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de bienvenida
app.get('/', (req, res) => {
    res.json({ 
        message: 'API de Árboles - Versión 2.0',
        environment: process.env.NODE_ENV,
        timestamp: new Date()
    });
});

// Probar conexión a la base de datos al iniciar
const { getConnection } = require('./config/database');

// Solo conectar si estamos en producción
if (process.env.NODE_ENV === 'production') {
    const pool = getConnection();
    pool.connect().then(() => {
        console.log('✅ Conexión a PostgreSQL verificada al iniciar');
    }).catch(err => {
        console.error('❌ Error al conectar a PostgreSQL:', err.message);
    });
} else {
    console.log('⚠️ Modo desarrollo: No se verifica conexión a BD remota');
}

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err.stack);
    res.status(500).json({ 
        message: 'Error interno del servidor', 
        error: process.env.NODE_ENV === 'production' ? 'Error interno' : err.message 
    });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

module.exports = app;