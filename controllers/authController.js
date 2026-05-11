const { getConnection } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Registro para usuarios normales (Alumno)
exports.registerAlumno = async (req, res) => {
    try {
        const {
            primer_nombre,
            segundo_nombre,
            apellido_paterno,
            apellido_materno,
            correo,
            contrasena,
            fecha_nacimiento,
            telefono
        } = req.body;

        const pool = await getConnection();

        // Verificar si el usuario ya existe
        const existingUser = await pool.query(
            'SELECT * FROM usuario WHERE correo = $1',
            [correo]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'El correo ya está registrado' });
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(contrasena, 10);

        // Insertar usuario
        const result = await pool.query(
            `INSERT INTO usuario 
            (primer_nombre, segundo_nombre, apellido_paterno, apellido_materno, 
             correo, contrasena, fecha_registro, fecha_nacimiento, telefono, esta_activo) 
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, $8, true)
            RETURNING id_usuario`,
            [primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
             correo, hashedPassword, fecha_nacimiento, telefono]
        );

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            id: result.rows[0].id_usuario
        });
    } catch (error) {
        console.error('Error en register:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

// Registro para administrativos
exports.registerAdmin = async (req, res) => {
    try {
        const {
            nombre_completo,
            correo,
            contrasena,
            es_admin,
            ficha_inicio,
            ficha_fin
        } = req.body;

        const pool = await getConnection();

        // Verificar si ya existe
        const existingAdmin = await pool.query(
            'SELECT * FROM administrativa WHERE correo = $1',
            [correo]
        );

        if (existingAdmin.rows.length > 0) {
            return res.status(400).json({ message: 'El correo ya está registrado' });
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(contrasena, 10);

        const result = await pool.query(
            `INSERT INTO administrativa 
            (nombre_completo, correo, contrasena, es_admin, ficha_inicio, ficha_fin, fecha_registro, esta_activo) 
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, true)
            RETURNING id`,
            [nombre_completo, correo, hashedPassword, es_admin || true, ficha_inicio || new Date(), ficha_fin]
        );

        res.status(201).json({
            message: 'Administrativo registrado exitosamente',
            id: result.rows[0].id
        });
    } catch (error) {
        console.error('Error en registerAdmin:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

// Login unificado
exports.login = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;
        const pool = await getConnection();

        // Buscar en tabla Usuario (alumnos)
        const users = await pool.query(
            'SELECT * FROM usuario WHERE correo = $1 AND esta_activo = true',
            [correo]
        );

        let user = null;
        let isAdmin = false;
        let userType = 'alumno';

        if (users.rows.length > 0) {
            user = users.rows[0];
        } else {
            // Buscar en Administrativa
            const admins = await pool.query(
                'SELECT * FROM administrativa WHERE correo = $1 AND esta_activo = true',
                [correo]
            );
            
            if (admins.rows.length > 0) {
                user = admins.rows[0];
                isAdmin = true;
                userType = 'admin';
            }
        }

        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // Verificar contraseña
        const validPassword = await bcrypt.compare(contrasena, user.contrasena);
        if (!validPassword) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // Actualizar última conexión
        if (userType === 'admin') {
            await pool.query(
                'UPDATE administrativa SET ultima_conexion = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );
        }

        // Generar token
        const token = jwt.sign(
            { 
                id: userType === 'admin' ? user.id : user.id_usuario,
                correo: user.correo,
                userType 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Preparar respuesta según tipo de usuario
        let userResponse = {};
        if (userType === 'admin') {
            userResponse = {
                id: user.id,
                nombre: user.nombre_completo,
                correo: user.correo,
                isAdmin,
                userType,
                es_admin: user.es_admin,
                ficha_inicio: user.ficha_inicio,
                ficha_fin: user.ficha_fin
            };
        } else {
            userResponse = {
                id: user.id_usuario,
                nombre: `${user.primer_nombre} ${user.apellido_paterno}`,
                correo: user.correo,
                telefono: user.telefono,
                isAdmin,
                userType
            };
        }

        res.json({
            message: 'Login exitoso',
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};