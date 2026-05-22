const { getConnection } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Registro para usuarios normales (Alumno) - CORREGIDO
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

        // ============================================
        // GENERAR NOMBRE_COMPLETO (concatenando los campos)
        // ============================================
        const nombreCompletoParts = [
            primer_nombre,
            segundo_nombre,
            apellido_paterno,
            apellido_materno
        ].filter(part => part && part.trim() !== '');
        
        const nombre_completo = nombreCompletoParts.join(' ');

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(contrasena, 10);

        // Insertar usuario (AHORA CON NOMBRE_COMPLETO)
        const result = await pool.query(
            `INSERT INTO usuario 
            (primer_nombre, segundo_nombre, apellido_paterno, apellido_materno, 
             correo, contrasena, fecha_registro, fecha_nacimiento, telefono, 
             esta_activo, tipo_usuario, nombre_completo) 
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, $8, true, 'alumno', $9)
            RETURNING id_usuario`,
            [primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
             correo, hashedPassword, fecha_nacimiento || null, telefono || null, nombre_completo]
        );

        const id_usuario = result.rows[0].id_usuario;

        // ============================================
        // INSERTAR EN TABLA ALUMNO (¡ESTO ES CRÍTICO!)
        // ============================================
        // Intenta primero con "alumnos" (plural), si falla usa "alumno" (singular)
        try {
            await pool.query(
                `INSERT INTO alumnos (id_usuario, id_gestion) 
                 VALUES ($1, $1)`,
                [id_usuario]
            );
            console.log(`✅ Alumno insertado en tabla alumnos con id_usuario: ${id_usuario}`);
        } catch (insertError) {
            // Si falla con "alumnos", intentar con "alumno"
            console.log('Intentando con tabla alumno...');
            await pool.query(
                `INSERT INTO alumno (id_usuario, id_gestion) 
                 VALUES ($1, $1)`,
                [id_usuario]
            );
            console.log(`✅ Alumno insertado en tabla alumno con id_usuario: ${id_usuario}`);
        }

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            id: id_usuario,
            nombre_completo: nombre_completo
        });
    } catch (error) {
        console.error('Error en registerAlumno:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

// Registro para administrativos (CORREGIDO - recibe campos separados)
exports.registerAdmin = async (req, res) => {
    try {
        const {
            primer_nombre,
            segundo_nombre,
            apellido_paterno,
            apellido_materno,
            nombre_completo,
            correo,
            contrasena,
            es_admin,
            ficha_inicio,
            ficha_fin,
            telefono,
            fecha_nacimiento
        } = req.body;

        const pool = await getConnection();

        // Verificar si ya existe
        const existingUser = await pool.query(
            'SELECT * FROM usuario WHERE correo = $1',
            [correo]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'El correo ya está registrado' });
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(contrasena, 10);

        // Insertar en usuario con TODOS los campos, incluyendo telefono y fecha_nacimiento
        const userResult = await pool.query(
            `INSERT INTO usuario 
            (primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
             nombre_completo, correo, contrasena, tipo_usuario, es_admin, 
             telefono, fecha_nacimiento, fecha_registro, esta_activo) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin', $8, $9, $10, CURRENT_DATE, true)
            RETURNING id_usuario`,
            [primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
             nombre_completo, correo, hashedPassword, es_admin || true,
             telefono || null, fecha_nacimiento || null]
        );

        const id_usuario = userResult.rows[0].id_usuario;

        // Insertar en administrativa
        await pool.query(
            `INSERT INTO administrativa 
            (id_usuario, ficha_inicio, ficha_fin, es_admin) 
            VALUES ($1, $2, $3, $4)`,
            [id_usuario, ficha_inicio || new Date(), ficha_fin, es_admin || true]
        );

        res.status(201).json({
            message: 'Administrador registrado exitosamente',
            id: id_usuario
        });
    } catch (error) {
        console.error('Error en registerAdmin:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

// Login unificado (MODIFICADO)
exports.login = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;
        const pool = await getConnection();

        // Buscar en usuario y verificar si es admin
        const result = await pool.query(
            `SELECT u.*, 
                    CASE WHEN a.id_usuario IS NOT NULL THEN true ELSE false END as es_admin
             FROM usuario u
             LEFT JOIN administrativa a ON u.id_usuario = a.id_usuario
             WHERE u.correo = $1 AND u.esta_activo = true`,
            [correo]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const usuario = result.rows[0];
        const isAdmin = usuario.es_admin === true;

        // Verificar contraseña
        const validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!validPassword) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // Actualizar última conexión si es admin
        if (isAdmin) {
            await pool.query(
                'UPDATE administrativa SET ultima_conexion = CURRENT_TIMESTAMP WHERE id_usuario = $1',
                [usuario.id_usuario]
            );
        }

        // Generar token
        const token = jwt.sign(
            { 
                id: usuario.id_usuario,
                correo: usuario.correo,
                isAdmin,
                tipo: usuario.tipo_usuario
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Preparar respuesta
        let userResponse = {
            id: usuario.id_usuario,
            correo: usuario.correo,
            isAdmin,
            tipo: usuario.tipo_usuario
        };

        if (isAdmin) {
            userResponse.nombre = usuario.nombre_completo;
        } else {
            userResponse.nombre = `${usuario.primer_nombre || ''} ${usuario.apellido_paterno || ''}`;
            userResponse.telefono = usuario.telefono;
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