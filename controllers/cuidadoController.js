const { getConnection } = require('../config/database');

// GET: Obtener todos los cuidados de un árbol
exports.getCuidadosArbol = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const cuidados = await pool.query(`
            SELECT ac.*, c.descripcion, c.ficha_inicio, c.ficha_fin,
                   s.nombre as servicio_nombre, s.url_icono,
                   ts.nombre as tipo_servicio
            FROM arbol_cuidados ac
            JOIN cuidado c ON ac.id_cuidado = c.id_cuidado
            LEFT JOIN servicio s ON c.id_servicio = s.id
            LEFT JOIN tipo_servicio ts ON s.id_tipo_servicio = ts.id
            WHERE ac.id_arbol = $1
            ORDER BY ac.fecha DESC
        `, [id]);

        res.json(cuidados.rows);
    } catch (error) {
        console.error('Error en getCuidadosArbol:', error);
        res.status(500).json({ message: 'Error al obtener cuidados', error: error.message });
    }
};

// GET: Obtener un cuidado específico
exports.getCuidadoDetalle = async (req, res) => {
    try {
        const { id, fecha } = req.params;
        const pool = await getConnection();

        const cuidado = await pool.query(`
            SELECT ac.*, c.descripcion, c.ficha_inicio, c.ficha_fin,
                   s.nombre as servicio_nombre, s.url_icono,
                   ts.nombre as tipo_servicio
            FROM arbol_cuidados ac
            JOIN cuidado c ON ac.id_cuidado = c.id_cuidado
            LEFT JOIN servicio s ON c.id_servicio = s.id
            LEFT JOIN tipo_servicio ts ON s.id_tipo_servicio = ts.id
            WHERE ac.id_arbol = $1 AND ac.fecha = $2
        `, [id, fecha]);

        if (cuidado.rows.length === 0) {
            return res.status(404).json({ message: 'Cuidado no encontrado' });
        }

        res.json(cuidado.rows[0]);
    } catch (error) {
        console.error('Error en getCuidadoDetalle:', error);
        res.status(500).json({ message: 'Error al obtener cuidado', error: error.message });
    }
};

// POST: Registrar nuevo cuidado (con validaciones)
exports.createCuidado = async (req, res) => {
    try {
        const { id } = req.params; // id del árbol
        const { id_servicio, comentario, fecha } = req.body;
        
        const pool = await getConnection();

        // Validar que el árbol existe
        const arbolExistente = await pool.query(
            'SELECT id_arbol FROM arbol WHERE id_arbol = $1',
            [id]
        );

        if (arbolExistente.rows.length === 0) {
            return res.status(404).json({ message: 'Árbol no encontrado' });
        }

        // Validar que el servicio existe
        const servicioExistente = await pool.query(
            'SELECT id FROM servicio WHERE id = $1',
            [id_servicio]
        );

        if (servicioExistente.rows.length === 0) {
            return res.status(404).json({ message: 'Servicio no encontrado' });
        }

        // PASO 1: Insertar en tabla cuidado (catálogo)
        const cuidadoResult = await pool.query(
            `INSERT INTO cuidado (id_servicio, descripcion, ficha_inicio) 
             VALUES ($1, $2, $3)
             RETURNING id_cuidado`,
            [id_servicio, comentario, fecha || new Date()]
        );

        const id_cuidado = cuidadoResult.rows[0].id_cuidado;

        // PASO 2: Insertar en tabla arbol_cuidados (relación árbol-cuidado)
        await pool.query(
            `INSERT INTO arbol_cuidados (id_arbol, id_cuidado, fecha, comentario) 
             VALUES ($1, $2, $3, $4)`,
            [id, id_cuidado, fecha || new Date(), comentario]
        );

        res.status(201).json({ 
            message: 'Cuidado registrado exitosamente',
            id_cuidado: id_cuidado,
            id_arbol: id
        });
    } catch (error) {
        console.error('Error en createCuidado:', error);
        res.status(500).json({ 
            message: 'Error al registrar cuidado', 
            error: error.message 
        });
    }
};

// GET: Obtener tipos de cuidados disponibles
exports.getTiposCuidados = async (req, res) => {
    try {
        const pool = await getConnection();
        const cuidados = await pool.query(`
            SELECT c.*, s.nombre as servicio_nombre, s.url_icono,
                   ts.nombre as tipo_servicio
            FROM cuidado c
            LEFT JOIN servicio s ON c.id_servicio = s.id
            LEFT JOIN tipo_servicio ts ON s.id_tipo_servicio = ts.id
            WHERE (c.ficha_fin IS NULL OR c.ficha_fin >= CURRENT_DATE)
            ORDER BY c.descripcion
        `);
        
        res.json(cuidados.rows);
    } catch (error) {
        console.error('Error en getTiposCuidados:', error);
        res.status(500).json({ message: 'Error al obtener tipos de cuidados', error: error.message });
    }
};