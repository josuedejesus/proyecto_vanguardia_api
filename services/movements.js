const knex = require('../db/knex');

async function insertMovement(data, trx = null) {
    try {
        const query = trx || knex;

        const result = await query('movements').insert(data).returning('movement_id');

        return result;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    insertMovement
}