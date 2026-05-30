const { getConnection } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// REGISTRO - guarda correo en minúsculas
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

        // ============================================
        // NORMALIZAR CORREO (minúsculas y sin espacios)
        // ============================================
        const correo_normalizado = correo.toLowerCase().trim();

        const pool = await getConnection();

        const existingUser = await pool.query(
            'SELECT * FROM usuario WHERE correo = $1',
            [correo_normalizado]
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

        // INSERT en usuario con correo normalizado
        const result = await pool.query(
            `INSERT INTO usuario 
            (primer_nombre, segundo_nombre, apellido_paterno, apellido_materno, 
             correo, contrasena, fecha_registro, fecha_nacimiento, telefono, 
             esta_activo, tipo_usuario, nombre_completo) 
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, $8, true, 'alumno', $9)
            RETURNING id_usuario`,
            [primer_nombre, segundo_nombre, apellido_paterno, apellido_materno,
             correo_normalizado, hashedPassword, fecha_nacimiento || null, telefono || null, nombre_completo]
        );

        const id_usuario = result.rows[0].id_usuario;

        // Insert en alumno (opcional)
        try {
            await pool.query(`INSERT INTO alumnos (id_usuario) VALUES ($1)`, [id_usuario]);
            console.log(`✅ Alumno insertado en tabla alumnos con id_usuario: ${id_usuario}`);
        } catch (err) {
            try {
                await pool.query(`INSERT INTO alumno (id_usuario) VALUES ($1)`, [id_usuario]);
                console.log(`✅ Alumno insertado en tabla alumno con id_usuario: ${id_usuario}`);
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
        console.error('Error en registerAlumno:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

// Registro para administrativos
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

        // ============================================
        // NORMALIZAR CORREO (minúsculas y sin espacios)
        // ============================================
        const correo_normalizado = correo.toLowerCase().trim();

        const pool = await getConnection();

        const existingUser = await pool.query(
            'SELECT * FROM usuario WHERE correo = $1',
            [correo_normalizado]
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
             finalNombreCompleto, correo_normalizado, hashedPassword, es_admin || true,
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

// LOGIN - buscar con correo normalizado
exports.login = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;
        
        // ============================================
        // NORMALIZAR CORREO (minúsculas y sin espacios)
        // ============================================
        const correo_normalizado = correo.toLowerCase().trim();
        
        console.log('🔐 Login intentado para:', correo_normalizado);
        
        const pool = await getConnection();

        const result = await pool.query(
            `SELECT u.*, 
                    CASE WHEN a.id_usuario IS NOT NULL THEN true ELSE false END as es_admin
             FROM usuario u
             LEFT JOIN administrativa a ON u.id_usuario = a.id_usuario
             WHERE u.correo = $1 AND u.esta_activo = true`,
            [correo_normalizado]
        );

        if (result.rows.length === 0) {
            console.log('❌ Usuario no encontrado:', correo_normalizado);
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const usuario = result.rows[0];
        const isAdmin = usuario.es_admin === true;

        const validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
        
        if (!validPassword) {
            console.log('❌ Contraseña incorrecta para:', correo_normalizado);
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
            process.env.JWT_SECRET || 'secret_key_fallback',
            { expiresIn: '24h' }
        );

        // Preparar respuesta
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

// =============================================
// RECUPERACIÓN DE CONTRASEÑA (NUEVOS MÉTODOS)
// =============================================

// PASO 1: Solicitar código de recuperación
exports.solicitarRecuperacion = async (req, res) => {
    try {
        const { correo } = req.body;
        const pool = await getConnection();

        // Normalizar correo
        const correo_normalizado = correo.toLowerCase().trim();

        // Verificar si el usuario existe
        const userResult = await pool.query(
            'SELECT id_usuario, correo FROM usuario WHERE correo = $1 AND esta_activo = true',
            [correo_normalizado]
        );

        if (userResult.rows.length === 0) {
            // Por seguridad, no revelamos si el correo existe o no
            return res.status(200).json({ 
                message: 'Si el correo existe, se enviará un código de recuperación' 
            });
        }

        // Generar código de 6 dígitos
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Guardar código en la base de datos (expira en 15 minutos)
        await pool.query(
            `UPDATE usuario 
             SET codigo_recuperacion = $1, 
                 expiracion_codigo = NOW() + INTERVAL '15 minutes'
             WHERE correo = $2`,
            [codigo, correo_normalizado]
        );

        // Aquí enviarías el código por correo electrónico
        // Por ahora lo devolvemos en la respuesta (solo para pruebas)
        console.log(`📧 Código de recuperación para ${correo_normalizado}: ${codigo}`);

        res.status(200).json({ 
            message: 'Código de recuperación enviado',
            codigo: process.env.NODE_ENV === 'development' ? codigo : undefined
        });
    } catch (error) {
        console.error('Error en solicitarRecuperacion:', error);
        res.status(500).json({ message: 'Error al solicitar recuperación', error: error.message });
    }
};

// PASO 2: Verificar código de recuperación
exports.verificarCodigo = async (req, res) => {
    try {
        const { correo, codigo } = req.body;
        const pool = await getConnection();

        const correo_normalizado = correo.toLowerCase().trim();

        const userResult = await pool.query(
            `SELECT id_usuario FROM usuario 
             WHERE correo = $1 
               AND codigo_recuperacion = $2 
               AND expiracion_codigo > NOW()
               AND esta_activo = true`,
            [correo_normalizado, codigo]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Código inválido o expirado' });
        }

        res.status(200).json({ 
            message: 'Código válido',
            id_usuario: userResult.rows[0].id_usuario
        });
    } catch (error) {
        console.error('Error en verificarCodigo:', error);
        res.status(500).json({ message: 'Error al verificar código', error: error.message });
    }
};

// PASO 3: Cambiar contraseña usando código de recuperación
exports.cambiarContrasenaConCodigo = async (req, res) => {
    try {
        const { correo, codigo, nueva_contrasena } = req.body;
        const pool = await getConnection();

        const correo_normalizado = correo.toLowerCase().trim();

        // Verificar código
        const userResult = await pool.query(
            `SELECT id_usuario FROM usuario 
             WHERE correo = $1 
               AND codigo_recuperacion = $2 
               AND expiracion_codigo > NOW()
               AND esta_activo = true`,
            [correo_normalizado, codigo]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Código inválido o expirado' });
        }

        // Validar nueva contraseña
        if (!nueva_contrasena || nueva_contrasena.length < 6) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
        }

        // Encriptar nueva contraseña
        const hashedPassword = await bcrypt.hash(nueva_contrasena, 10);

        // Actualizar contraseña y limpiar código de recuperación
        await pool.query(
            `UPDATE usuario 
             SET contrasena = $1,
                 codigo_recuperacion = NULL,
                 expiracion_codigo = NULL
             WHERE correo = $2`,
            [hashedPassword, correo_normalizado]
        );

        res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
        console.error('Error en cambiarContrasenaConCodigo:', error);
        res.status(500).json({ message: 'Error al cambiar contraseña', error: error.message });
    }
};

// PASO 4: Cambiar contraseña (usuario autenticado - para perfil)
exports.cambiarContrasenaAutenticado = async (req, res) => {
    try {
        const { contrasena_actual, nueva_contrasena } = req.body;
        const userId = req.userId;
        const pool = await getConnection();

        // Obtener usuario actual
        const userResult = await pool.query(
            'SELECT contrasena FROM usuario WHERE id_usuario = $1 AND esta_activo = true',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar contraseña actual
        const validPassword = await bcrypt.compare(contrasena_actual, userResult.rows[0].contrasena);
        if (!validPassword) {
            return res.status(401).json({ message: 'Contraseña actual incorrecta' });
        }

        // Validar nueva contraseña
        if (!nueva_contrasena || nueva_contrasena.length < 6) {
            return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        // Encriptar nueva contraseña
        const hashedPassword = await bcrypt.hash(nueva_contrasena, 10);

        // Actualizar contraseña
        await pool.query(
            'UPDATE usuario SET contrasena = $1 WHERE id_usuario = $2',
            [hashedPassword, userId]
        );

        res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
        console.error('Error en cambiarContrasenaAutenticado:', error);
        res.status(500).json({ message: 'Error al cambiar contraseña', error: error.message });
    }
};