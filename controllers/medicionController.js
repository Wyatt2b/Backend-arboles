const { getConnection } = require('../config/database');

// GET: Obtener mediciones de un árbol
exports.getMediciones = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const mediciones = await pool.query(`
            SELECT m.*, s.nombre as servicio_nombre
            FROM medicion m
            LEFT JOIN clasifica cl ON m.id = cl.id_medicion
            LEFT JOIN servicio s ON cl.id_servicio = s.id
            WHERE m.id_arbol = $1
            ORDER BY m.fecha DESC
        `, [id]);

        res.json(mediciones.rows);
    } catch (error) {
        console.error('Error en getMediciones:', error);
        res.status(500).json({ message: 'Error al obtener mediciones', error: error.message });
    }
};

// POST: Registrar nueva medición
exports.createMedicion = async (req, res) => {
    try {
        const { id } = req.params;
        const { es_un, odometro, altura, diametro_actual, foto, fecha, id_servicio } = req.body;
        const pool = await getConnection();

        // Insertar medición
        const result = await pool.query(
            `INSERT INTO medicion (id_arbol, es_un, odometro, altura, diametro_actual, foto, fecha) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [id, es_un || false, odometro, altura, diametro_actual, foto, fecha || new Date()]
        );

        const id_medicion = result.rows[0].id;

        // Si se proporciona un servicio, registrar en Clasifica
        if (id_servicio) {
            await pool.query(
                'INSERT INTO clasifica (id_servicio, id_medicion) VALUES ($1, $2)',
                [id_servicio, id_medicion]
            );
        }

        res.status(201).json({
            message: 'Medición registrada exitosamente',
            id: id_medicion
        });
    } catch (error) {
        console.error('Error en createMedicion:', error);
        res.status(500).json({ message: 'Error al registrar medición', error: error.message });
    }
};