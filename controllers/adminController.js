const { getConnection } = require('../config/database');

// GET: Obtener todas las gestiones/escuelas
exports.getAllGestiones = async (req, res) => {
    try {
        const pool = await getConnection();

        const gestiones = await pool.query(`
            SELECT g.id, g.ficha_inicio, g.ficha_fin, g.nombre_escuela,
                   g.ubicacion, g.nombre_exterior, g.folio_campania,
                   COUNT(DISTINCT a.id_arbol) as total_arboles,
                   COUNT(DISTINCT al.id_usuario) as total_alumnos,
                   COUNT(DISTINCT c.id) as total_campanias
            FROM gestion g
            LEFT JOIN arbol a ON g.id = a.id_gestion
            LEFT JOIN alumno al ON g.id = al.id_gestion
            LEFT JOIN campania c ON g.id = c.id_gestion
            GROUP BY g.id, g.ficha_inicio, g.ficha_fin, g.nombre_escuela, 
                     g.ubicacion, g.nombre_exterior, g.folio_campania
            ORDER BY g.nombre_escuela
        `);
        
        res.json(gestiones.rows);
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

        const result = await pool.query(
            `INSERT INTO gestion 
            (ficha_inicio, ficha_fin, nombre_escuela, ubicacion, nombre_exterior, folio_campania) 
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id`,
            [ficha_inicio || new Date(), ficha_fin, nombre_escuela, ubicacion, nombre_exterior, folio_campania]
        );

        res.status(201).json({
            message: 'Gestión creada exitosamente',
            id: result.rows[0].id
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

        const campanias = await pool.query(`
            SELECT c.id, c.id_gestion, c.nombre, c.descripcion, c.fecha_inicio, c.fecha_fin,
                   g.nombre_escuela
            FROM campania c
            JOIN gestion g ON c.id_gestion = g.id
            ORDER BY c.fecha_inicio DESC
        `);
        
        res.json(campanias.rows);
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

        const result = await pool.query(
            `INSERT INTO campania (id_gestion, nombre, descripcion, fecha_inicio, fecha_fin) 
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            [id_gestion, nombre, descripcion, fecha_inicio || new Date(), fecha_fin]
        );

        res.status(201).json({
            message: 'Campaña creada exitosamente',
            id: result.rows[0].id
        });
    } catch (error) {
        console.error('Error en createCampania:', error);
        res.status(500).json({ message: 'Error al crear campaña', error: error.message });
    }
};

// GET: Obtener todos los árboles (admin)
exports.getAllArboles = async (req, res) => {
    try {
        const pool = await getConnection();

        const arboles = await pool.query(`
            SELECT a.id_arbol, a.fecha_plantado, a.vive, a.notas, a.comentario,
                   a.fecha_registro, a.id_gestion, a.id_especie,
                   e.nombre_comun, e.nombre_cientifico,
                   u.calle, u.colonia, u.numero, u.estado, u.coordenadas,
                   v.altura_actual, v.diametro_actual, v.estado_actual,
                   g.nombre_escuela,
                   STRING_AGG(CONCAT(us.primer_nombre, ' ', us.apellido_paterno), ', ') as alumnos_asignados
            FROM arbol a
            JOIN especie e ON a.id_especie = e.id
            JOIN gestion g ON a.id_gestion = g.id
            LEFT JOIN ubicacion u ON a.id_arbol = u.id_arbol
            LEFT JOIN valor v ON a.id_arbol = v.id_arbol AND v.esta_activo = true
            LEFT JOIN alumno al ON g.id = al.id_gestion
            LEFT JOIN usuario us ON al.id_usuario = us.id_usuario
            GROUP BY a.id_arbol, a.fecha_plantado, a.vive, a.id_especie, a.notas,
                     a.fecha_registro, a.comentario, a.id_gestion,
                     e.nombre_comun, e.nombre_cientifico,
                     u.calle, u.colonia, u.numero, u.estado, u.coordenadas, u.id_ubicacion,
                     v.altura_actual, v.diametro_actual, v.estado_actual,
                     g.nombre_escuela
            ORDER BY a.id_arbol DESC
        `);
        
        res.json(arboles.rows);
    } catch (error) {
        console.error('Error en getAllArboles:', error);
        res.status(500).json({ message: 'Error al obtener árboles', error: error.message });
    }
};

// POST: Crear nuevo árbol (admin)
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
        const arbolResult = await pool.query(
            `INSERT INTO arbol 
            (id_gestion, id_especie, fecha_plantado, vive, notas, comentario, fecha_registro) 
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
            RETURNING id_arbol`,
            [id_gestion, id_especie, fecha_plantado || new Date(), vive !== undefined ? vive : true, notas, comentario]
        );

        const id_arbol = arbolResult.rows[0].id_arbol;

        // Insertar ubicación si se proporciona
        if (ubicacion) {
            await pool.query(
                `INSERT INTO ubicacion (id_arbol, coordenadas, calle, colonia, numero, estado) 
                VALUES ($1, $2, $3, $4, $5, $6)`,
                [id_arbol, ubicacion.coordenadas, ubicacion.calle, ubicacion.colonia, ubicacion.numero, ubicacion.estado]
            );
        }

        // Insertar valor inicial si se proporciona
        if (valor_inicial) {
            await pool.query(
                `INSERT INTO valor 
                (id_arbol, altura_actual, diametro_actual, estado_actual, ubicacion, 
                 fecha_plantacion, fecha_registro, esta_activo)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, true)`,
                [id_arbol, valor_inicial.altura_actual, valor_inicial.diametro_actual, 
                 valor_inicial.estado_actual, valor_inicial.ubicacion, valor_inicial.fecha_plantacion || fecha_plantado]
            );
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
        const usuario = await pool.query(
            'SELECT id_usuario FROM usuario WHERE id_usuario = $1 AND esta_activo = true',
            [id_usuario]
        );

        if (usuario.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar si la gestión existe
        const gestion = await pool.query(
            'SELECT id FROM gestion WHERE id = $1',
            [id_gestion]
        );

        if (gestion.rows.length === 0) {
            return res.status(404).json({ message: 'Gestión no encontrada' });
        }

        // Verificar si ya tiene asignación
        const existe = await pool.query(
            'SELECT * FROM alumno WHERE id_usuario = $1 AND id_gestion = $2',
            [id_usuario, id_gestion]
        );

        if (existe.rows.length > 0) {
            return res.status(400).json({ message: 'El alumno ya está asignado a esta gestión' });
        }

        await pool.query(
            'INSERT INTO alumno (id_usuario, id_gestion) VALUES ($1, $2)',
            [id_usuario, id_gestion]
        );

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

        const result = await pool.query(
            'DELETE FROM alumno WHERE id_usuario = $1 AND id_gestion = $2',
            [id_usuario, id_gestion]
        );

        if (result.rowCount === 0) {
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

// GET: Obtener todos los alumnos con sus gestiones
exports.getAllAlumnos = async (req, res) => {
    try {
        const pool = await getConnection();

        const alumnos = await pool.query(`
            SELECT u.id_usuario, u.primer_nombre, u.segundo_nombre, 
                   u.apellido_paterno, u.apellido_materno, u.correo, u.telefono,
                   u.fecha_registro, u.fecha_nacimiento, u.esta_activo,
                   g.id as id_gestion, g.nombre_escuela,
                   COUNT(DISTINCT a.id_arbol) as total_arboles_gestion
            FROM usuario u
            JOIN alumno al ON u.id_usuario = al.id_usuario
            JOIN gestion g ON al.id_gestion = g.id
            LEFT JOIN arbol a ON g.id = a.id_gestion
            WHERE u.esta_activo = true
            GROUP BY u.id_usuario, u.primer_nombre, u.segundo_nombre, 
                     u.apellido_paterno, u.apellido_materno, u.correo, u.telefono,
                     u.fecha_registro, u.fecha_nacimiento, u.esta_activo, 
                     g.id, g.nombre_escuela
            ORDER BY u.primer_nombre
        `);
        
        res.json(alumnos.rows);
    } catch (error) {
        console.error('Error en getAllAlumnos:', error);
        res.status(500).json({ message: 'Error al obtener alumnos', error: error.message });
    }
};

// GET: Obtener estadísticas completas
exports.getEstadisticas = async (req, res) => {
    try {
        const pool = await getConnection();

        const totalArboles = await pool.query('SELECT COUNT(*) as total FROM arbol');
        const totalArbolesVivos = await pool.query("SELECT COUNT(*) as total FROM arbol WHERE vive = true");
        const totalUsuarios = await pool.query('SELECT COUNT(*) as total FROM usuario WHERE esta_activo = true');
        const totalAlumnos = await pool.query('SELECT COUNT(*) as total FROM alumno');
        const totalAdministrativos = await pool.query('SELECT COUNT(*) as total FROM administrativa WHERE esta_activo = true');
        const totalGestiones = await pool.query('SELECT COUNT(*) as total FROM gestion');
        const totalCampanias = await pool.query('SELECT COUNT(*) as total FROM campania');
        const totalCuidados = await pool.query('SELECT COUNT(*) as total FROM arbol_cuidados');
        const totalMediciones = await pool.query('SELECT COUNT(*) as total FROM medicion');
        
        const cuidadosPorTipo = await pool.query(`
            SELECT c.descripcion, COUNT(*) as total
            FROM arbol_cuidados ac
            JOIN cuidado c ON ac.id_cuidado = c.id_cuidado
            GROUP BY c.id_cuidado, c.descripcion
        `);

        const arbolesPorEspecie = await pool.query(`
            SELECT e.nombre_comun, COUNT(*) as total
            FROM arbol a
            JOIN especie e ON a.id_especie = e.id
            GROUP BY e.id, e.nombre_comun
        `);

        res.json({
            totalArboles: parseInt(totalArboles.rows[0].total),
            totalArbolesVivos: parseInt(totalArbolesVivos.rows[0].total),
            totalUsuarios: parseInt(totalUsuarios.rows[0].total),
            totalAlumnos: parseInt(totalAlumnos.rows[0].total),
            totalAdministrativos: parseInt(totalAdministrativos.rows[0].total),
            totalGestiones: parseInt(totalGestiones.rows[0].total),
            totalCampanias: parseInt(totalCampanias.rows[0].total),
            totalCuidados: parseInt(totalCuidados.rows[0].total),
            totalMediciones: parseInt(totalMediciones.rows[0].total),
            cuidadosPorTipo: cuidadosPorTipo.rows,
            arbolesPorEspecie: arbolesPorEspecie.rows
        });
    } catch (error) {
        console.error('Error en getEstadisticas:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
    }
};