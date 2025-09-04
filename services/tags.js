const knex = require('../db/knex');

async function fetchTags() {
    try {
        const tags = await knex('tags').select();
        return tags;
    } catch (error) {
        throw error;
    }
}

async function fetchTagByUID(uid) {
    try {
        const tag = await knex('tags').where({ uid }).first();
        return tag;
    } catch (error) {
        throw error;
    } 
}

async function insertTag(data, trx = knex) {
    try {
        const query = trx || knex;
        
        const result = await query('tags').insert(data).returning('uid');
        return result;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    fetchTags,
    insertTag,
    fetchTagByUID
}