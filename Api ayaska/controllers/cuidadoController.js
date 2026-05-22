const { getConnection, sql } = require('../config/database');

// GET: Obtener todos los cuidados de un árbol
exports.getCuidadosArbol = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const cuidados = await pool.request()
            .input('id_arbol', sql.Int, id)
            .query(`
                SELECT ac.*, c.descripcion, c.ficha_inicio, c.ficha_fin,
                       s.nombre as servicio_nombre, s.url_icono,
                       ts.nombre as tipo_servicio
                FROM Arbol_Cuidados ac
                JOIN Cuidado c ON ac.id_cuidado = c.id_cuidado
                LEFT JOIN Servicio s ON c.id_servicio = s.id
                LEFT JOIN TIPO_SERVICIO ts ON s.id_tipo_servicio = ts.id
                WHERE ac.id_arbol = @id_arbol
                ORDER BY ac.fecha DESC
            `);

        res.json(cuidados.recordset);
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

        const cuidado = await pool.request()
            .input('id_arbol', sql.Int, id)
            .input('fecha', sql.Date, fecha)
            .query(`
                SELECT ac.*, c.descripcion, c.ficha_inicio, c.ficha_fin,
                       s.nombre as servicio_nombre, s.url_icono,
                       ts.nombre as tipo_servicio
                FROM Arbol_Cuidados ac
                JOIN Cuidado c ON ac.id_cuidado = c.id_cuidado
                LEFT JOIN Servicio s ON c.id_servicio = s.id
                LEFT JOIN TIPO_SERVICIO ts ON s.id_tipo_servicio = ts.id
                WHERE ac.id_arbol = @id_arbol AND ac.fecha = @fecha
            `);

        if (cuidado.recordset.length === 0) {
            return res.status(404).json({ message: 'Cuidado no encontrado' });
        }

        res.json(cuidado.recordset[0]);
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

        await pool.request()
            .input('id_arbol', sql.Int, id)
            .input('id_cuidado', sql.Int, id_cuidado)
            .input('fecha', sql.Date, fecha || new Date())
            .input('comentario', sql.Text, comentario)
            .query(`
                INSERT INTO Arbol_Cuidados (id_arbol, id_cuidado, fecha, comentario) 
                VALUES (@id_arbol, @id_cuidado, @fecha, @comentario)
            `);

        res.status(201).json({ message: 'Cuidado registrado exitosamente' });
    } catch (error) {
        console.error('Error en createCuidado:', error);
        res.status(500).json({ message: 'Error al registrar cuidado', error: error.message });
    }
};

// GET: Obtener tipos de cuidados disponibles (con servicios)
exports.getTiposCuidados = async (req, res) => {
    try {
        const pool = await getConnection();
        const cuidados = await pool.request()
            .query(`
                SELECT c.*, s.nombre as servicio_nombre, s.url_icono,
                       ts.nombre as tipo_servicio
                FROM Cuidado c
                LEFT JOIN Servicio s ON c.id_servicio = s.id
                LEFT JOIN TIPO_SERVICIO ts ON s.id_tipo_servicio = ts.id
                WHERE (c.ficha_fin IS NULL OR c.ficha_fin >= GETDATE())
                ORDER BY c.descripcion
            `);
        
        res.json(cuidados.recordset);
    } catch (error) {
        console.error('Error en getTiposCuidados:', error);
        res.status(500).json({ message: 'Error al obtener tipos de cuidados', error: error.message });
    }
};