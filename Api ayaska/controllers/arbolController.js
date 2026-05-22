const { getConnection, sql } = require('../config/database');

// GET: Obtener árboles del alumno actual
exports.getMisArboles = async (req, res) => {
    try {
        const pool = await getConnection();

        // Verificar que el usuario es alumno (tiene registro en Alumno)
        const alumno = await pool.request()
            .input('id_usuario', sql.Int, req.userId)
            .query('SELECT id_usuario, id_gestion FROM Alumno WHERE id_usuario = @id_usuario');

        if (alumno.recordset.length === 0 && !req.isAdmin) {
            return res.status(403).json({ message: 'Usuario no es alumno' });
        }

        const arboles = await pool.request()
            .input('id_usuario', sql.Int, req.userId)
            .query(`
                SELECT a.id_arbol, a.fecha_plantado, a.vive, a.notas, a.comentario,
                       a.fecha_registro, a.id_gestion, a.id_especie,
                       e.nombre_comun, e.nombre_cientifico, e.descripcion as especie_descripcion,
                       u.coordenadas, u.calle, u.colonia, u.numero, u.estado,
                       v.altura_actual, v.diametro_actual, v.estado_actual, v.ubicacion as valor_ubicacion,
                       v.fecha_plantacion, v.fecha_actualizacion,
                       g.nombre_escuela, g.ubicacion as escuela_ubicacion
                FROM Alumno al
                JOIN Gestion g ON al.id_gestion = g.id
                JOIN Arbol a ON g.id = a.id_gestion
                JOIN Especie e ON a.id_especie = e.id
                LEFT JOIN Ubicacion u ON a.id_arbol = u.id_arbol
                LEFT JOIN Valor v ON a.id_arbol = v.id_arbol AND v.esta_activo = 1
                WHERE al.id_usuario = @id_usuario AND (g.ficha_fin IS NULL OR g.ficha_fin >= GETDATE())
            `);
        
        res.json(arboles.recordset);
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

        const arbol = await pool.request()
            .input('id_arbol', sql.Int, id)
            .query(`
                SELECT a.id_arbol, a.fecha_plantado, a.vive, a.notas, a.comentario,
                       a.fecha_registro, a.id_gestion, a.id_especie,
                       e.nombre_comun, e.nombre_cientifico, e.descripcion as especie_descripcion,
                       u.coordenadas, u.calle, u.colonia, u.numero, u.estado,
                       v.altura_actual, v.diametro_actual, v.estado_actual, 
                       v.ubicacion as valor_ubicacion, v.fecha_plantacion,
                       v.fecha_registro as valor_fecha_registro, v.fecha_actualizacion,
                       g.nombre_escuela, g.ubicacion as escuela_ubicacion,
                       c.nombre as campania_nombre
                FROM Arbol a
                JOIN Especie e ON a.id_especie = e.id
                JOIN Gestion g ON a.id_gestion = g.id
                LEFT JOIN Ubicacion u ON a.id_arbol = u.id_arbol
                LEFT JOIN Valor v ON a.id_arbol = v.id_arbol AND v.esta_activo = 1
                LEFT JOIN Campania c ON g.id = c.id_gestion AND c.fecha_inicio <= GETDATE() AND (c.fecha_fin IS NULL OR c.fecha_fin >= GETDATE())
                WHERE a.id_arbol = @id_arbol
            `);

        if (arbol.recordset.length === 0) {
            return res.status(404).json({ message: 'Árbol no encontrado' });
        }

        res.json(arbol.recordset[0]);
    } catch (error) {
        console.error('Error en getArbolDetalle:', error);
        res.status(500).json({ message: 'Error al obtener detalles del árbol', error: error.message });
    }
};

// PUT: Actualizar datos de un árbol (ahora usa 'notas' en lugar de 'caracteristicas')
exports.updateArbol = async (req, res) => {
    try {
        const { id } = req.params;
        const { notas, comentario, id_especie, ubicacion, valores } = req.body;
        const pool = await getConnection();

        // Actualizar árbol
        await pool.request()
            .input('notas', sql.Text, notas)
            .input('comentario', sql.Text, comentario)
            .input('id_especie', sql.Int, id_especie)
            .input('id_arbol', sql.Int, id)
            .query(`
                UPDATE Arbol 
                SET notas = @notas, 
                    comentario = @comentario,
                    id_especie = @id_especie
                WHERE id_arbol = @id_arbol
            `);

        // Actualizar ubicación si se proporciona
        if (ubicacion) {
            // Verificar si ya existe ubicación
            const existeUbicacion = await pool.request()
                .input('id_arbol', sql.Int, id)
                .query('SELECT id_ubicacion FROM Ubicacion WHERE id_arbol = @id_arbol');

            if (existeUbicacion.recordset.length > 0) {
                // Actualizar
                await pool.request()
                    .input('calle', sql.VarChar, ubicacion.calle)
                    .input('colonia', sql.VarChar, ubicacion.colonia)
                    .input('numero', sql.VarChar, ubicacion.numero)
                    .input('estado', sql.VarChar, ubicacion.estado)
                    .input('coordenadas', sql.VarChar, ubicacion.coordenadas)
                    .input('id_arbol', sql.Int, id)
                    .query(`
                        UPDATE Ubicacion 
                        SET calle = @calle, colonia = @colonia, numero = @numero, 
                            estado = @estado, coordenadas = @coordenadas
                        WHERE id_arbol = @id_arbol
                    `);
            } else {
                // Insertar nueva
                await pool.request()
                    .input('id_arbol', sql.Int, id)
                    .input('calle', sql.VarChar, ubicacion.calle)
                    .input('colonia', sql.VarChar, ubicacion.colonia)
                    .input('numero', sql.VarChar, ubicacion.numero)
                    .input('estado', sql.VarChar, ubicacion.estado)
                    .input('coordenadas', sql.VarChar, ubicacion.coordenadas)
                    .query(`
                        INSERT INTO Ubicacion (id_arbol, calle, colonia, numero, estado, coordenadas)
                        VALUES (@id_arbol, @calle, @colonia, @numero, @estado, @coordenadas)
                    `);
            }
        }

        // Actualizar valores si se proporcionan
        if (valores) {
            // Desactivar valores anteriores
            await pool.request()
                .input('id_arbol', sql.Int, id)
                .query('UPDATE Valor SET esta_activo = 0 WHERE id_arbol = @id_arbol');

            // Insertar nuevo valor
            await pool.request()
                .input('id_arbol', sql.Int, id)
                .input('altura_actual', sql.Float, valores.altura_actual)
                .input('diametro_actual', sql.Float, valores.diametro_actual)
                .input('estado_actual', sql.VarChar, valores.estado_actual)
                .input('ubicacion', sql.VarChar, valores.ubicacion)
                .input('fecha_plantacion', sql.Date, valores.fecha_plantacion)
                .input('esta_activo', sql.Bit, 1)
                .query(`
                    INSERT INTO Valor 
                    (id_arbol, altura_actual, diametro_actual, estado_actual, ubicacion, 
                     fecha_plantacion, fecha_registro, esta_activo)
                    VALUES (@id_arbol, @altura_actual, @diametro_actual, @estado_actual, @ubicacion,
                            @fecha_plantacion, GETDATE(), @esta_activo)
                `);
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
        const especies = await pool.request()
            .query('SELECT id, nombre_comun, nombre_cientifico, descripcion FROM Especie ORDER BY nombre_comun');
        
        res.json(especies.recordset);
    } catch (error) {
        console.error('Error en getEspecies:', error);
        res.status(500).json({ message: 'Error al obtener especies', error: error.message });
    }
};