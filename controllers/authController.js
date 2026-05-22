const { getConnection } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

        console.log('📝 Registrando alumno:', { correo, primer_nombre, apellido_paterno });

        const pool = await getConnection();

        const existingUser = await pool.query(
            'SELECT * FROM usuario WHERE correo = $1',
            [correo]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'El correo ya está registrado' });
        }

        // Generar nombre_completo
        const nombreCompletoParts = [
            primer_nombre,
            segundo_nombre,
            apellido_paterno,
            apellido_materno
        ].filter(part => part && part.trim() !== '');
        
        const nombre_completo = nombreCompletoParts.join(' ');
        const hashedPassword = await bcrypt.hash(contrasena, 10);

        // INSERT en usuario
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
        console.log('✅ Usuario creado con ID:', id_usuario);

        // INSERT en alumno (opcional, si falla no detiene el registro)
        try {
            await pool.query(`INSERT INTO alumnos (id_usuario) VALUES ($1)`, [id_usuario]);
            console.log('✅ Alumno insertado en tabla alumnos');
        } catch (err) {
            try {
                await pool.query(`INSERT INTO alumno (id_usuario) VALUES ($1)`, [id_usuario]);
                console.log('✅ Alumno insertado en tabla alumno');
            } catch (err2) {
                console.log('⚠️ No se insertó en alumno:', err2.message);
            }
        }

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            id: id_usuario,
            nombre_completo: nombre_completo
        });
        
    } catch (error) {
        console.error('❌ Error en registerAlumno:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

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

        const existingUser = await pool.query(
            'SELECT * FROM usuario WHERE correo = $1',
            [correo]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'El correo ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(contrasena, 10);

        let finalNombreCompleto = nombre_completo;
        if (!finalNombreCompleto) {
            const parts = [primer_nombre, segundo_nombre, apellido_paterno, apellido_materno]
                .filter(part => part && part.trim() !== '');
            finalNombreCompleto = parts.join(' ');
        }

        const userResult = await pool.query(
            `INSERT INTO usuario 
            (primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
             nombre_completo, correo, contrasena, tipo_usuario, es_admin, 
             telefono, fecha_nacimiento, fecha_registro, esta_activo) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin', $8, $9, $10, CURRENT_DATE, true)
            RETURNING id_usuario`,
            [primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
             finalNombreCompleto, correo, hashedPassword, es_admin || true,
             telefono || null, fecha_nacimiento || null]
        );

        const id_usuario = userResult.rows[0].id_usuario;

        await pool.query(
            `INSERT INTO administrativa 
            (id_usuario, ficha_inicio, ficha_fin, es_admin, ultima_conexion) 
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [id_usuario, ficha_inicio || new Date(), ficha_fin || null, es_admin || true]
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

exports.login = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;
        
        console.log('🔐 Login intentado para:', correo);
        
        const pool = await getConnection();

        const result = await pool.query(
            `SELECT u.*, 
                    CASE WHEN a.id_usuario IS NOT NULL THEN true ELSE false END as es_admin
             FROM usuario u
             LEFT JOIN administrativa a ON u.id_usuario = a.id_usuario
             WHERE u.correo = $1 AND u.esta_activo = true`,
            [correo]
        );

        if (result.rows.length === 0) {
            console.log('❌ Usuario no encontrado:', correo);
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const usuario = result.rows[0];
        const isAdmin = usuario.es_admin === true;

        const validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
        
        if (!validPassword) {
            console.log('❌ Contraseña incorrecta para:', correo);
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        if (isAdmin) {
            await pool.query(
                'UPDATE administrativa SET ultima_conexion = CURRENT_TIMESTAMP WHERE id_usuario = $1',
                [usuario.id_usuario]
            );
        }

        const token = jwt.sign(
            { 
                id: usuario.id_usuario,
                correo: usuario.correo,
                isAdmin,
                tipo: usuario.tipo_usuario
            },
            process.env.JWT_SECRET || 'secret_key_fallback',
            { expiresIn: '24h' }
        );

        let userResponse = {
            id: usuario.id_usuario,
            correo: usuario.correo,
            isAdmin: isAdmin,
            tipo: usuario.tipo_usuario || 'alumno'
        };

        if (isAdmin) {
            userResponse.nombre = usuario.nombre_completo || `${usuario.primer_nombre || ''} ${usuario.apellido_paterno || ''}`;
        } else {
            userResponse.nombre = `${usuario.primer_nombre || ''} ${usuario.apellido_paterno || ''}`.trim() || 'Usuario';
            userResponse.telefono = usuario.telefono || '';
        }

        console.log('✅ Login exitoso para:', userResponse.nombre);

        res.json({
            message: 'Login exitoso',
            token,
            user: userResponse
        });
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};
