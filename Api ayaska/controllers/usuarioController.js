const { getConnection, sql } = require('../config/database');

// GET: Obtener perfil del usuario actual
exports.getPerfil = async (req, res) => {
    try {
        const pool = await getConnection();

        const usuario = await pool.request()
            .input('id_usuario', sql.Int, req.userId)
            .query(`
                SELECT id_usuario, primer_nombre, segundo_nombre, apellido_paterno, 
                       apellido_materno, correo, telefono, fecha_registro, fecha_nacimiento, esta_activo
                FROM Usuario WHERE id_usuario = @id_usuario
            `);

        if (usuario.recordset.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Obtener la gestión del alumno
        const gestion = await pool.request()
            .input('id_usuario', sql.Int, req.userId)
            .query(`
                SELECT g.id, g.nombre_escuela, g.ubicacion
                FROM Alumno a
                JOIN Gestion g ON a.id_gestion = g.id
                WHERE a.id_usuario = @id_usuario
            `);

        // Obtener estadísticas del usuario
        const stats = await pool.request()
            .input('id_usuario', sql.Int, req.userId)
            .query(`
                SELECT 
                    COUNT(DISTINCT a.id_arbol) as total_arboles,
                    COUNT(DISTINCT ac.id_arbol) as total_cuidados,
                    COUNT(DISTINCT m.id) as total_mediciones
                FROM Alumno al
                JOIN Gestion g ON al.id_gestion = g.id
                LEFT JOIN Arbol a ON g.id = a.id_gestion
                LEFT JOIN Arbol_Cuidados ac ON a.id_arbol = ac.id_arbol
                LEFT JOIN Medicion m ON a.id_arbol = m.id_arbol
                WHERE al.id_usuario = @id_usuario
            `);

        res.json({
            ...usuario.recordset[0],
            gestion: gestion.recordset[0] || null,
            estadisticas: stats.recordset[0] || { total_arboles: 0, total_cuidados: 0, total_mediciones: 0 }
        });
    } catch (error) {
        console.error('Error en getPerfil:', error);
        res.status(500).json({ message: 'Error al obtener perfil', error: error.message });
    }
};

// PUT: Actualizar perfil (incluye teléfono)
exports.updatePerfil = async (req, res) => {
    try {
        const {
            primer_nombre,
            segundo_nombre,
            apellido_paterno,
            apellido_materno,
            fecha_nacimiento,
            telefono
        } = req.body;

        const pool = await getConnection();

        await pool.request()
            .input('primer_nombre', sql.VarChar, primer_nombre)
            .input('segundo_nombre', sql.VarChar, segundo_nombre)
            .input('apellido_paterno', sql.VarChar, apellido_paterno)
            .input('apellido_materno', sql.VarChar, apellido_materno)
            .input('fecha_nacimiento', sql.Date, fecha_nacimiento)
            .input('telefono', sql.VarChar, telefono)
            .input('id_usuario', sql.Int, req.userId)
            .query(`
                UPDATE Usuario 
                SET primer_nombre = @primer_nombre, 
                    segundo_nombre = @segundo_nombre,
                    apellido_paterno = @apellido_paterno, 
                    apellido_materno = @apellido_materno,
                    fecha_nacimiento = @fecha_nacimiento,
                    telefono = @telefono
                WHERE id_usuario = @id_usuario
            `);

        res.json({ message: 'Perfil actualizado exitosamente' });
    } catch (error) {
        console.error('Error en updatePerfil:', error);
        res.status(500).json({ message: 'Error al actualizar perfil', error: error.message });
    }
};