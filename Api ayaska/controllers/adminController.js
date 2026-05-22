const { getConnection, sql } = require('../config/database');

// GET: Obtener todas las gestiones/escuelas
exports.getAllGestiones = async (req, res) => {
    try {
        const pool = await getConnection();

        const gestiones = await pool.request()
            .query(`
                SELECT g.id, g.ficha_inicio, g.ficha_fin, g.nombre_escuela,
                       g.ubicacion, g.nombre_exterior, g.folio_campania,
                       COUNT(DISTINCT a.id_arbol) as total_arboles,
                       COUNT(DISTINCT al.id_usuario) as total_alumnos,
                       COUNT(DISTINCT c.id) as total_campanias
                FROM Gestion g
                LEFT JOIN Arbol a ON g.id = a.id_gestion
                LEFT JOIN Alumno al ON g.id = al.id_gestion
                LEFT JOIN Campania c ON g.id = c.id_gestion
                GROUP BY g.id, g.ficha_inicio, g.ficha_fin, g.nombre_escuela, 
                         g.ubicacion, g.nombre_exterior, g.folio_campania
                ORDER BY g.nombre_escuela
            `);
        
        res.json(gestiones.recordset);
    } catch (error) {
        console.error('Error en getAllGestiones:', error);
        res.status(500).json({ message: 'Error al obtener gestiones', error: error.message });
    }
};

// POST: Crear nueva gestión/escuela
exports.createGestion = async (req, res) => {
    try {
        const {
            ficha_inicio,
            ficha_fin,
            nombre_escuela,
            ubicacion,
            nombre_exterior,
            folio_campania
        } = req.body;

        const pool = await getConnection();

        const result = await pool.request()
            .input('ficha_inicio', sql.Date, ficha_inicio || new Date())
            .input('ficha_fin', sql.Date, ficha_fin)
            .input('nombre_escuela', sql.VarChar, nombre_escuela)
            .input('ubicacion', sql.VarChar, ubicacion)
            .input('nombre_exterior', sql.VarChar, nombre_exterior)
            .input('folio_campania', sql.VarChar, folio_campania)
            .query(`
                INSERT INTO Gestion 
                (ficha_inicio, ficha_fin, nombre_escuela, ubicacion, nombre_exterior, folio_campania) 
                OUTPUT INSERTED.id
                VALUES (@ficha_inicio, @ficha_fin, @nombre_escuela, @ubicacion, @nombre_exterior, @folio_campania)
            `);

        res.status(201).json({
            message: 'Gestión creada exitosamente',
            id: result.recordset[0].id
        });
    } catch (error) {
        console.error('Error en createGestion:', error);
        res.status(500).json({ message: 'Error al crear gestión', error: error.message });
    }
};

// GET: Obtener todas las campañas
exports.getAllCampanias = async (req, res) => {
    try {
        const pool = await getConnection();

        const campanias = await pool.request()
            .query(`
                SELECT c.id, c.id_gestion, c.nombre, c.descripcion, c.fecha_inicio, c.fecha_fin,
                       g.nombre_escuela
                FROM Campania c
                JOIN Gestion g ON c.id_gestion = g.id
                ORDER BY c.fecha_inicio DESC
            `);
        
        res.json(campanias.recordset);
    } catch (error) {
        console.error('Error en getAllCampanias:', error);
        res.status(500).json({ message: 'Error al obtener campañas', error: error.message });
    }
};

// POST: Crear nueva campaña
exports.createCampania = async (req, res) => {
    try {
        const {
            id_gestion,
            nombre,
            descripcion,
            fecha_inicio,
            fecha_fin
        } = req.body;

        const pool = await getConnection();

        const result = await pool.request()
            .input('id_gestion', sql.Int, id_gestion)
            .input('nombre', sql.VarChar, nombre)
            .input('descripcion', sql.Text, descripcion)
            .input('fecha_inicio', sql.Date, fecha_inicio || new Date())
            .input('fecha_fin', sql.Date, fecha_fin)
            .query(`
                INSERT INTO Campania (id_gestion, nombre, descripcion, fecha_inicio, fecha_fin) 
                OUTPUT INSERTED.id
                VALUES (@id_gestion, @nombre, @descripcion, @fecha_inicio, @fecha_fin)
            `);

        res.status(201).json({
            message: 'Campaña creada exitosamente',
            id: result.recordset[0].id
        });
    } catch (error) {
        console.error('Error en createCampania:', error);
        res.status(500).json({ message: 'Error al crear campaña', error: error.message });
    }
};

// GET: Obtener todos los árboles (admin) - actualizado a 'notas'
exports.getAllArboles = async (req, res) => {
    try {
        const pool = await getConnection();

        const arboles = await pool.request()
            .query(`
                SELECT a.id_arbol, a.fecha_plantado, a.vive, a.notas, a.comentario,
                       a.fecha_registro, a.id_gestion, a.id_especie,
                       e.nombre_comun, e.nombre_cientifico,
                       u.calle, u.colonia, u.numero, u.estado, u.coordenadas,
                       v.altura_actual, v.diametro_actual, v.estado_actual,
                       g.nombre_escuela,
                       STRING_AGG(CONCAT(us.primer_nombre, ' ', us.apellido_paterno), ', ') as alumnos_asignados
                FROM Arbol a
                JOIN Especie e ON a.id_especie = e.id
                JOIN Gestion g ON a.id_gestion = g.id
                LEFT JOIN Ubicacion u ON a.id_arbol = u.id_arbol
                LEFT JOIN Valor v ON a.id_arbol = v.id_arbol AND v.esta_activo = 1
                LEFT JOIN Alumno al ON g.id = al.id_gestion
                LEFT JOIN Usuario us ON al.id_usuario = us.id_usuario
                GROUP BY a.id_arbol, a.fecha_plantado, a.vive, a.id_especie, a.notas,
                         a.fecha_registro, a.comentario, a.id_gestion,
                         e.nombre_comun, e.nombre_cientifico,
                         u.calle, u.colonia, u.numero, u.estado, u.coordenadas, u.id_ubicacion,
                         v.altura_actual, v.diametro_actual, v.estado_actual,
                         g.nombre_escuela
                ORDER BY a.id_arbol DESC
            `);
        
        res.json(arboles.recordset);
    } catch (error) {
        console.error('Error en getAllArboles:', error);
        res.status(500).json({ message: 'Error al obtener árboles', error: error.message });
    }
};

// POST: Crear nuevo árbol (admin) - actualizado a 'notas'
exports.createArbol = async (req, res) => {
    try {
        const {
            id_gestion,
            id_especie,
            fecha_plantado,
            vive,
            notas,
            comentario,
            ubicacion,
            valor_inicial
        } = req.body;

        const pool = await getConnection();

        // Insertar árbol
        const arbolResult = await pool.request()
            .input('id_gestion', sql.Int, id_gestion)
            .input('id_especie', sql.Int, id_especie)
            .input('fecha_plantado', sql.Date, fecha_plantado || new Date())
            .input('vive', sql.Bit, vive !== undefined ? vive : 1)
            .input('notas', sql.Text, notas)
            .input('comentario', sql.Text, comentario)
            .input('fecha_registro', sql.Date, new Date())
            .query(`
                INSERT INTO Arbol 
                (id_gestion, id_especie, fecha_plantado, vive, notas, comentario, fecha_registro) 
                OUTPUT INSERTED.id_arbol
                VALUES (@id_gestion, @id_especie, @fecha_plantado, @vive, @notas, @comentario, @fecha_registro)
            `);

        const id_arbol = arbolResult.recordset[0].id_arbol;

        // Insertar ubicación si se proporciona
        if (ubicacion) {
            await pool.request()
                .input('id_arbol', sql.Int, id_arbol)
                .input('coordenadas', sql.VarChar, ubicacion.coordenadas)
                .input('calle', sql.VarChar, ubicacion.calle)
                .input('colonia', sql.VarChar, ubicacion.colonia)
                .input('numero', sql.VarChar, ubicacion.numero)
                .input('estado', sql.VarChar, ubicacion.estado)
                .query(`
                    INSERT INTO Ubicacion (id_arbol, coordenadas, calle, colonia, numero, estado) 
                    VALUES (@id_arbol, @coordenadas, @calle, @colonia, @numero, @estado)
                `);
        }

        // Insertar valor inicial si se proporciona
        if (valor_inicial) {
            await pool.request()
                .input('id_arbol', sql.Int, id_arbol)
                .input('altura_actual', sql.Float, valor_inicial.altura_actual)
                .input('diametro_actual', sql.Float, valor_inicial.diametro_actual)
                .input('estado_actual', sql.VarChar, valor_inicial.estado_actual)
                .input('ubicacion', sql.VarChar, valor_inicial.ubicacion)
                .input('fecha_plantacion', sql.Date, valor_inicial.fecha_plantacion || fecha_plantado)
                .input('esta_activo', sql.Bit, 1)
                .query(`
                    INSERT INTO Valor 
                    (id_arbol, altura_actual, diametro_actual, estado_actual, ubicacion, 
                     fecha_plantacion, fecha_registro, esta_activo)
                    VALUES (@id_arbol, @altura_actual, @diametro_actual, @estado_actual, @ubicacion,
                            @fecha_plantacion, GETDATE(), @esta_activo)
                `);
        }

        res.status(201).json({
            message: 'Árbol creado exitosamente',
            id: id_arbol
        });
    } catch (error) {
        console.error('Error en createArbol:', error);
        res.status(500).json({ message: 'Error al crear árbol', error: error.message });
    }
};

// POST: Asignar alumno a gestión
exports.asignarAlumnoAGestion = async (req, res) => {
    try {
        const { id_usuario, id_gestion } = req.body;
        const pool = await getConnection();

        // Verificar si el usuario existe y es alumno
        const usuario = await pool.request()
            .input('id_usuario', sql.Int, id_usuario)
            .query('SELECT id_usuario FROM Usuario WHERE id_usuario = @id_usuario AND esta_activo = 1');

        if (usuario.recordset.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar si la gestión existe
        const gestion = await pool.request()
            .input('id_gestion', sql.Int, id_gestion)
            .query('SELECT id FROM Gestion WHERE id = @id_gestion');

        if (gestion.recordset.length === 0) {
            return res.status(404).json({ message: 'Gestión no encontrada' });
        }

        // Verificar si ya tiene asignación
        const existe = await pool.request()
            .input('id_usuario', sql.Int, id_usuario)
            .input('id_gestion', sql.Int, id_gestion)
            .query(`
                SELECT * FROM Alumno 
                WHERE id_usuario = @id_usuario AND id_gestion = @id_gestion
            `);

        if (existe.recordset.length > 0) {
            return res.status(400).json({ message: 'El alumno ya está asignado a esta gestión' });
        }

        await pool.request()
            .input('id_usuario', sql.Int, id_usuario)
            .input('id_gestion', sql.Int, id_gestion)
            .query(`
                INSERT INTO Alumno (id_usuario, id_gestion) 
                VALUES (@id_usuario, @id_gestion)
            `);

        res.status(201).json({ message: 'Alumno asignado a gestión exitosamente' });
    } catch (error) {
        console.error('Error en asignarAlumnoAGestion:', error);
        res.status(500).json({ message: 'Error al asignar alumno', error: error.message });
    }
};

// DELETE: Desasignar alumno de gestión
exports.desasignarAlumnoDeGestion = async (req, res) => {
    try {
        const { id_usuario, id_gestion } = req.params;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_usuario', sql.Int, id_usuario)
            .input('id_gestion', sql.Int, id_gestion)
            .query(`
                DELETE FROM Alumno 
                WHERE id_usuario = @id_usuario AND id_gestion = @id_gestion
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Asignación no encontrada' });
        }

        res.json({ 
            message: 'Alumno desasignado de gestión exitosamente'
        });
    } catch (error) {
        console.error('Error en desasignarAlumnoDeGestion:', error);
        res.status(500).json({ 
            message: 'Error al desasignar alumno', 
            error: error.message 
        });
    }
};

// GET: Obtener todos los alumnos con sus gestiones (incluye teléfono)
exports.getAllAlumnos = async (req, res) => {
    try {
        const pool = await getConnection();

        const alumnos = await pool.request()
            .query(`
                SELECT u.id_usuario, u.primer_nombre, u.segundo_nombre, 
                       u.apellido_paterno, u.apellido_materno, u.correo, u.telefono,
                       u.fecha_registro, u.fecha_nacimiento, u.esta_activo,
                       g.id as id_gestion, g.nombre_escuela,
                       COUNT(DISTINCT a.id_arbol) as total_arboles_gestion
                FROM Usuario u
                JOIN Alumno al ON u.id_usuario = al.id_usuario
                JOIN Gestion g ON al.id_gestion = g.id
                LEFT JOIN Arbol a ON g.id = a.id_gestion
                WHERE u.esta_activo = 1
                GROUP BY u.id_usuario, u.primer_nombre, u.segundo_nombre, 
                         u.apellido_paterno, u.apellido_materno, u.correo, u.telefono,
                         u.fecha_registro, u.fecha_nacimiento, u.esta_activo, 
                         g.id, g.nombre_escuela
                ORDER BY u.primer_nombre
            `);
        
        res.json(alumnos.recordset);
    } catch (error) {
        console.error('Error en getAllAlumnos:', error);
        res.status(500).json({ message: 'Error al obtener alumnos', error: error.message });
    }
};

// GET: Obtener estadísticas completas
exports.getEstadisticas = async (req, res) => {
    try {
        const pool = await getConnection();

        const totalArboles = await pool.request()
            .query('SELECT COUNT(*) as total FROM Arbol');
        
        const totalArbolesVivos = await pool.request()
            .query("SELECT COUNT(*) as total FROM Arbol WHERE vive = 1");
        
        const totalUsuarios = await pool.request()
            .query('SELECT COUNT(*) as total FROM Usuario WHERE esta_activo = 1');
        
        const totalAlumnos = await pool.request()
            .query('SELECT COUNT(*) as total FROM Alumno');
        
        const totalAdministrativos = await pool.request()
            .query('SELECT COUNT(*) as total FROM Administrativa WHERE esta_activo = 1');
        
        const totalGestiones = await pool.request()
            .query('SELECT COUNT(*) as total FROM Gestion');
        
        const totalCampanias = await pool.request()
            .query('SELECT COUNT(*) as total FROM Campania');
        
        const totalCuidados = await pool.request()
            .query('SELECT COUNT(*) as total FROM Arbol_Cuidados');
        
        const totalMediciones = await pool.request()
            .query('SELECT COUNT(*) as total FROM Medicion');
        
        const cuidadosPorTipo = await pool.request()
            .query(`
                SELECT c.descripcion, COUNT(*) as total
                FROM Arbol_Cuidados ac
                JOIN Cuidado c ON ac.id_cuidado = c.id_cuidado
                GROUP BY c.id_cuidado, c.descripcion
            `);

        const arbolesPorEspecie = await pool.request()
            .query(`
                SELECT e.nombre_comun, COUNT(*) as total
                FROM Arbol a
                JOIN Especie e ON a.id_especie = e.id
                GROUP BY e.id, e.nombre_comun
            `);

        res.json({
            totalArboles: totalArboles.recordset[0].total,
            totalArbolesVivos: totalArbolesVivos.recordset[0].total,
            totalUsuarios: totalUsuarios.recordset[0].total,
            totalAlumnos: totalAlumnos.recordset[0].total,
            totalAdministrativos: totalAdministrativos.recordset[0].total,
            totalGestiones: totalGestiones.recordset[0].total,
            totalCampanias: totalCampanias.recordset[0].total,
            totalCuidados: totalCuidados.recordset[0].total,
            totalMediciones: totalMediciones.recordset[0].total,
            cuidadosPorTipo: cuidadosPorTipo.recordset,
            arbolesPorEspecie: arbolesPorEspecie.recordset
        });
    } catch (error) {
        console.error('Error en getEstadisticas:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
    }
};