const knex = require('../db/knex');

async function fetchCategories() {
    try {
        const categories = await knex('categories').select();
        return categories;
    } catch (error) {
        throw error;
    } 
}

module.exports = {
    fetchCategories
}