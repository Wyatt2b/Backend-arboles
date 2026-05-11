const { getConnection } = require('../config/database');

// GET: Obtener perfil del usuario actual
exports.getPerfil = async (req, res) => {
    try {
        const pool = await getConnection();

        const usuario = await pool.query(
            `SELECT id_usuario, primer_nombre, segundo_nombre, apellido_paterno, 
                    apellido_materno, correo, telefono, fecha_registro, fecha_nacimiento, esta_activo
            FROM usuario WHERE id_usuario = $1`,
            [req.userId]
        );

        if (usuario.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Obtener la gestión del alumno
        const gestion = await pool.query(`
            SELECT g.id, g.nombre_escuela, g.ubicacion
            FROM alumno a
            JOIN gestion g ON a.id_gestion = g.id
            WHERE a.id_usuario = $1
        `, [req.userId]);

        // Obtener estadísticas del usuario
        const stats = await pool.query(`
            SELECT 
                COUNT(DISTINCT a.id_arbol) as total_arboles,
                COUNT(DISTINCT ac.id_arbol) as total_cuidados,
                COUNT(DISTINCT m.id) as total_mediciones
            FROM alumno al
            JOIN gestion g ON al.id_gestion = g.id
            LEFT JOIN arbol a ON g.id = a.id_gestion
            LEFT JOIN arbol_cuidados ac ON a.id_arbol = ac.id_arbol
            LEFT JOIN medicion m ON a.id_arbol = m.id_arbol
            WHERE al.id_usuario = $1
        `, [req.userId]);

        res.json({
            ...usuario.rows[0],
            gestion: gestion.rows[0] || null,
            estadisticas: stats.rows[0] || { total_arboles: 0, total_cuidados: 0, total_mediciones: 0 }
        });
    } catch (error) {
        console.error('Error en getPerfil:', error);
        res.status(500).json({ message: 'Error al obtener perfil', error: error.message });
    }
};

// PUT: Actualizar perfil
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

        await pool.query(
            `UPDATE usuario 
            SET primer_nombre = $1, segundo_nombre = $2,
                apellido_paterno = $3, apellido_materno = $4,
                fecha_nacimiento = $5, telefono = $6
            WHERE id_usuario = $7`,
            [primer_nombre, segundo_nombre, apellido_paterno, apellido_materno, fecha_nacimiento, telefono, req.userId]
        );

        res.json({ message: 'Perfil actualizado exitosamente' });
    } catch (error) {
        console.error('Error en updatePerfil:', error);
        res.status(500).json({ message: 'Error al actualizar perfil', error: error.message });
    }
};