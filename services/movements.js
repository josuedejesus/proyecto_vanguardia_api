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

async function insertItemMovement(data, trx = null) {
    try {
        const query = trx || knex;

        const result = await query('item_movements').insert(data).returning('item_movement_id');

        return result;
    } catch (error) {
        throw error;
    }
}

async function fetchMovementsByItemId(itemId, trx = null) {
    try {
        const query = trx || knex;


        const movements = await knex('movements as m')
            .leftJoin('item_movements as im', 'im.movement_id', 'm.movement_id')
            .leftJoin('locations as l', 'l.location_id', 'm.location_id')
            .where('im.item_id', itemId)
            .select(
                'm.movement_id',
                'm.movement_type',
                'm.created_at',
                'm.uid',
                'l.location_name'
            )
            .orderBy('m.created_at', 'asc')
            .orderBy('m.movement_id', 'asc');


        console.log(movements);
        return movements;
    } catch (error) {
        throw error;
    }
}

async function fetchRawMovementsByItemId(itemId, trx = null) {
    try {
        const query = trx || knex;

        const movements = await query('movements')
            .select()
            .where('item_id', itemId)
            .orderBy('movement_id');

        return movements;
    } catch (error) {
        throw error;
    }
}

async function fetchItemMovements(itemId, trx = null) {
    try {
        const query = trx || knex;

        const movements = await query('item_movements')
            .select()
            .where('item_id', itemId)
            .orderBy('item_movement_id');

        return movements;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    insertMovement,
    fetchMovementsByItemId,
    fetchRawMovementsByItemId,
    insertItemMovement,
    fetchItemMovements
}