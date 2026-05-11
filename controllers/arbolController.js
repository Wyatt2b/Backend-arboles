const { getConnection } = require('../config/database');

// GET: Obtener árboles del alumno actual
exports.getMisArboles = async (req, res) => {
    try {
        const pool = await getConnection();

        // Verificar que el usuario es alumno
        const alumno = await pool.query(
            'SELECT id_usuario, id_gestion FROM alumno WHERE id_usuario = $1',
            [req.userId]
        );

        if (alumno.rows.length === 0 && !req.isAdmin) {
            return res.status(403).json({ message: 'Usuario no es alumno' });
        }

        const arboles = await pool.query(`
            SELECT a.id_arbol, a.fecha_plantado, a.vive, a.notas, a.comentario,
                   a.fecha_registro, a.id_gestion, a.id_especie,
                   e.nombre_comun, e.nombre_cientifico, e.descripcion as especie_descripcion,
                   u.coordenadas, u.calle, u.colonia, u.numero, u.estado,
                   v.altura_actual, v.diametro_actual, v.estado_actual, v.ubicacion as valor_ubicacion,
                   v.fecha_plantacion, v.fecha_actualizacion,
                   g.nombre_escuela, g.ubicacion as escuela_ubicacion
            FROM alumno al
            JOIN gestion g ON al.id_gestion = g.id
            JOIN arbol a ON g.id = a.id_gestion
            JOIN especie e ON a.id_especie = e.id
            LEFT JOIN ubicacion u ON a.id_arbol = u.id_arbol
            LEFT JOIN valor v ON a.id_arbol = v.id_arbol AND v.esta_activo = true
            WHERE al.id_usuario = $1 AND (g.ficha_fin IS NULL OR g.ficha_fin >= CURRENT_DATE)
        `, [req.userId]);
        
        res.json(arboles.rows);
    } catch (error) {
        console.error('Error en getMisArboles:', error);
        res.status(500).json({ message: 'Error al obtener árboles', error: error.message });
    }
};

// GET: Obtener detalles de un árbol específico
exports.getArbolDetalle = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const arbol = await pool.query(`
            SELECT a.id_arbol, a.fecha_plantado, a.vive, a.notas, a.comentario,
                   a.fecha_registro, a.id_gestion, a.id_especie,
                   e.nombre_comun, e.nombre_cientifico, e.descripcion as especie_descripcion,
                   u.coordenadas, u.calle, u.colonia, u.numero, u.estado,
                   v.altura_actual, v.diametro_actual, v.estado_actual, 
                   v.ubicacion as valor_ubicacion, v.fecha_plantacion,
                   v.fecha_registro as valor_fecha_registro, v.fecha_actualizacion,
                   g.nombre_escuela, g.ubicacion as escuela_ubicacion,
                   c.nombre as campania_nombre
            FROM arbol a
            JOIN especie e ON a.id_especie = e.id
            JOIN gestion g ON a.id_gestion = g.id
            LEFT JOIN ubicacion u ON a.id_arbol = u.id_arbol
            LEFT JOIN valor v ON a.id_arbol = v.id_arbol AND v.esta_activo = true
            LEFT JOIN campania c ON g.id = c.id_gestion AND c.fecha_inicio <= CURRENT_DATE AND (c.fecha_fin IS NULL OR c.fecha_fin >= CURRENT_DATE)
            WHERE a.id_arbol = $1
        `, [id]);

        if (arbol.rows.length === 0) {
            return res.status(404).json({ message: 'Árbol no encontrado' });
        }

        res.json(arbol.rows[0]);
    } catch (error) {
        console.error('Error en getArbolDetalle:', error);
        res.status(500).json({ message: 'Error al obtener detalles del árbol', error: error.message });
    }
};

// PUT: Actualizar datos de un árbol
exports.updateArbol = async (req, res) => {
    try {
        const { id } = req.params;
        const { notas, comentario, id_especie, ubicacion, valores } = req.body;
        const pool = await getConnection();

        // Actualizar árbol
        await pool.query(
            `UPDATE arbol 
            SET notas = $1, comentario = $2, id_especie = $3
            WHERE id_arbol = $4`,
            [notas, comentario, id_especie, id]
        );

        // Actualizar ubicación si se proporciona
        if (ubicacion) {
            const existeUbicacion = await pool.query(
                'SELECT id_ubicacion FROM ubicacion WHERE id_arbol = $1',
                [id]
            );

            if (existeUbicacion.rows.length > 0) {
                await pool.query(
                    `UPDATE ubicacion 
                    SET calle = $1, colonia = $2, numero = $3, estado = $4, coordenadas = $5
                    WHERE id_arbol = $6`,
                    [ubicacion.calle, ubicacion.colonia, ubicacion.numero, ubicacion.estado, ubicacion.coordenadas, id]
                );
            } else {
                await pool.query(
                    `INSERT INTO ubicacion (id_arbol, calle, colonia, numero, estado, coordenadas)
                    VALUES ($1, $2, $3, $4, $5, $6)`,
                    [id, ubicacion.calle, ubicacion.colonia, ubicacion.numero, ubicacion.estado, ubicacion.coordenadas]
                );
            }
        }

        // Actualizar valores si se proporcionan
        if (valores) {
            await pool.query(
                'UPDATE valor SET esta_activo = false WHERE id_arbol = $1',
                [id]
            );

            await pool.query(
                `INSERT INTO valor 
                (id_arbol, altura_actual, diametro_actual, estado_actual, ubicacion, 
                 fecha_plantacion, fecha_registro, esta_activo)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, true)`,
                [id, valores.altura_actual, valores.diametro_actual, valores.estado_actual, 
                 valores.ubicacion, valores.fecha_plantacion]
            );
        }

        res.json({ message: 'Árbol actualizado exitosamente' });
    } catch (error) {
        console.error('Error en updateArbol:', error);
        res.status(500).json({ message: 'Error al actualizar árbol', error: error.message });
    }
};

// GET: Obtener especies disponibles
exports.getEspecies = async (req, res) => {
    try {
        const pool = await getConnection();
        const especies = await pool.query(
            'SELECT id, nombre_comun, nombre_cientifico, descripcion FROM especie ORDER BY nombre_comun'
        );
        
        res.json(especies.rows);
    } catch (error) {
        console.error('Error en getEspecies:', error);
        res.status(500).json({ message: 'Error al obtener especies', error: error.message });
    }
};