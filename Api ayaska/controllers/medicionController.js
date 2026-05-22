const { getConnection, sql } = require('../config/database');

// GET: Obtener mediciones de un árbol
exports.getMediciones = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const mediciones = await pool.request()
            .input('id_arbol', sql.Int, id)
            .query(`
                SELECT m.*, s.nombre as servicio_nombre
                FROM Medicion m
                LEFT JOIN Clasifica cl ON m.id = cl.id_medicion
                LEFT JOIN Servicio s ON cl.id_servicio = s.id
                WHERE m.id_arbol = @id_arbol
                ORDER BY m.fecha DESC
            `);

        res.json(mediciones.recordset);
    } catch (error) {
        console.error('Error en getMediciones:', error);
        res.status(500).json({ message: 'Error al obtener mediciones', error: error.message });
    }
};

// POST: Registrar nueva medición
exports.createMedicion = async (req, res) => {
    try {
        const { id } = req.params;
        const { es_UN, odometro, altura, diametro_actual, foto, fecha, id_servicio } = req.body;
        const pool = await getConnection();

        // Insertar medición
        const result = await pool.request()
            .input('id_arbol', sql.Int, id)
            .input('es_UN', sql.Bit, es_UN || 0)
            .input('odometro', sql.Float, odometro)
            .input('altura', sql.Float, altura)
            .input('diametro_actual', sql.Float, diametro_actual)
            .input('foto', sql.VarChar, foto)
            .input('fecha', sql.Date, fecha || new Date())
            .query(`
                INSERT INTO Medicion (id_arbol, es_UN, odometro, altura, diametro_actual, foto, fecha) 
                OUTPUT INSERTED.id
                VALUES (@id_arbol, @es_UN, @odometro, @altura, @diametro_actual, @foto, @fecha)
            `);

        const id_medicion = result.recordset[0].id;

        // Si se proporciona un servicio, registrar en Clasifica
        if (id_servicio) {
            await pool.request()
                .input('id_servicio', sql.Int, id_servicio)
                .input('id_medicion', sql.Int, id_medicion)
                .query(`
                    INSERT INTO Clasifica (id_servicio, id_medicion)
                    VALUES (@id_servicio, @id_medicion)
                `);
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