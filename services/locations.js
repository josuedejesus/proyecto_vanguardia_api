const knex = require('../db/knex');

async function fetchLocations(params) {
    try {
        const locations = await knex('locations').select();

        return locations;
    } catch (error) {
        throw error;
    }
}

async function fetchLocation(id) {
    try {
        const location = await knex('locations').select().where('location_id', id).first();

        return location;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    fetchLocations,
    fetchLocation
}