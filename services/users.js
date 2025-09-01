const knex = require('../db/knex');

async function fetchUsers() {
    try {
        const users = knex('users').select();

        return users;
    } catch(error) {
        throw error;
    }
}

async function fetchUserByUsername(username) {
    try {
        const user = await knex('users').select().where('username', username).first();
        return user;
    } catch (error) {
        throw error;
    }
}

async function insertUser(data) {
    try {
        const result = await knex('users').insert(data);
        return result;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    fetchUsers,
    fetchUserByUsername,
    insertUser
}