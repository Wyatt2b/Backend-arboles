const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt'); // <-- Añadido para encriptar las contraseñas
const jwt = require('jsonwebtoken'); // <-- Añadido para crear las sesiones
require('dotenv').config();

// Muevo la importación de la base de datos hacia arriba para poder usarla en el registro
const { getConnection } = require('./config/database'); 

// Comentamos esta línea porque pondremos la ruta de auth directamente aquí
// const authRoutes = require('./routes/authRoutes'); 
const arbolRoutes = require('./routes/arbolRoutes');
const medicionRoutes = require('./routes/medicionRoutes');
const cuidadoRoutes = require('./routes/cuidadoRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// RUTA DE REGISTRO (Integrada directamente)
// ==========================================
app.post('/api/auth/registro', async (req, res) => {
    try {
        // 1. Extraemos los datos que nos enviará Kotlin
        const { primerNombre, apellidoPaterno, apellidoMaterno, correo, contrasena, telefono } = req.body;

        // 2. Encriptamos la contraseña por seguridad
        const salt = await bcrypt.genSalt(10);
        const contrasenaHash = await bcrypt.hash(contrasena, salt);

        // 3. Nos conectamos a PostgreSQL y preparamos el INSERT
        const db = await getConnection();
        const query = `
            INSERT INTO usuario (
                primer_nombre, apellido_paterno, apellido_materno, 
                correo, contrasena, telefono
            ) VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id_usuario, correo, tipo_usuario;
        `;
        
        // Pasamos las variables al query de PostgreSQL
        const values = [primerNombre, apellidoPaterno, apellidoMaterno, correo, contrasenaHash, telefono];
        
        const result = await db.query(query, values);

        // 4. Respondemos a Kotlin que todo salió bien
        res.status(201).json({ 
            exito: true,
            mensaje: 'Usuario registrado correctamente',
            usuario: result.rows[0]
        });

    } catch (error) {
        console.error("Error en registro:", error);
        
        // Manejo específico si el correo ya existe (PostgreSQL arroja el código 23505)
        if (error.code === '23505') { 
            return res.status(400).json({ exito: false, mensaje: 'El correo ya está registrado' });
        }

        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// ==========================================
// RUTA DE LOGIN (Inicio de sesión)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    try {
        // 1. Recibimos el correo y contraseña desde Kotlin
        const { correo, contrasena } = req.body;

        // Validamos que no vengan vacíos
        if (!correo || !contrasena) {
            return res.status(400).json({ exito: false, mensaje: 'Faltan datos' });
        }

        const db = await getConnection();

        // 2. Buscamos al usuario en PostgreSQL por su correo
        const query = `
            SELECT id_usuario, correo, contrasena, primer_nombre, tipo_usuario 
            FROM usuario 
            WHERE correo = $1;
        `;
        const result = await db.query(query, [correo]);

        // Si no hay resultados, el correo no existe
        if (result.rows.length === 0) {
            // Usamos un mensaje genérico por seguridad (para que no adivinen correos)
            return res.status(401).json({ exito: false, mensaje: 'Correo o contraseña incorrectos' });
        }

        const usuarioBD = result.rows[0];

        // 3. Comparamos la contraseña enviada con la encriptada en la BD
        const contrasenaValida = await bcrypt.compare(contrasena, usuarioBD.contrasena);

        if (!contrasenaValida) {
            return res.status(401).json({ exito: false, mensaje: 'Correo o contraseña incorrectos' });
        }

        // 4. Si todo es correcto, creamos el Token JWT (El pase VIP)
        // NOTA: 'secreto_super_seguro' idealmente debería ir en tu archivo .env
        const token = jwt.sign(
            { id: usuarioBD.id_usuario, rol: usuarioBD.tipo_usuario },
            process.env.JWT_SECRET || 'secreto_super_seguro', 
            { expiresIn: '30d' } // El usuario se mantendrá logueado por 30 días
        );

        // 5. Respondemos a Kotlin con el token y datos básicos
        res.status(200).json({
            exito: true,
            mensaje: 'Inicio de sesión exitoso',
            token: token,
            usuario: {
                id: usuarioBD.id_usuario,
                nombre: usuarioBD.primer_nombre,
                correo: usuarioBD.correo,
                rol: usuarioBD.tipo_usuario
            }
        });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// Rutas restantes
// app.use('/api/auth', authRoutes); // Desactivado temporalmente
app.use('/api/arboles', arbolRoutes);
app.use('/api/mediciones', medicionRoutes);
app.use('/api/cuidados', cuidadoRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de bienvenida
app.get('/', (req, res) => {
    res.json({ message: 'API de Árboles - Versión 2.0' });
});

// Probar conexión a la base de datos al iniciar
getConnection().then(() => {
    console.log('✅ Conexión a BD verificada al iniciar');
}).catch(err => {
    console.error('❌ Error al conectar a BD:', err.message);
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
//sb_publishable_9Gju13Bvhc7UuQld-YZdRw_0Bu1zC7d