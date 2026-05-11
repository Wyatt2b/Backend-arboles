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

// POST: Registrar nuevo cuidado
exports.createCuidado = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_cuidado, fecha, comentario } = req.body;
        const pool = await getConnection();

        await pool.query(
            `INSERT INTO arbol_cuidados (id_arbol, id_cuidado, fecha, comentario) 
            VALUES ($1, $2, $3, $4)`,
            [id, id_cuidado, fecha || new Date(), comentario]
        );

        res.status(201).json({ message: 'Cuidado registrado exitosamente' });
    } catch (error) {
        console.error('Error en createCuidado:', error);
        res.status(500).json({ message: 'Error al registrar cuidado', error: error.message });
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