const knex = require('../db/knex');

async function fetchProducts() {
    try {
        const products = await knex('products').select();
        return products;
    } catch (error) {
        throw error;
    }
}

async function insertBatchType(data, trx = null) {
    try {
        const query = trx || knex;

        const result = await query('product_batch_types').insert(data).returning('batch_type_id');

        return result;
    } catch (error) {
        throw error;
    }
}



async function fetchProductBySku(sku) {
    try {
        const product = await knex('products').where({ sku }).first();
        return product;
    } catch (error) {
        throw error;
    }
}

async function insertProduct(data) {
    try {
        const result = await knex('products').insert(data).returning('product_id');
        return result;
    } catch (error) {
        throw error;
    }
}

async function fetchBatchTypes() {
    try {
        const batchTypes = await knex('product_batch_types').select();
        return batchTypes;
    } catch (error) {
        throw error;
    }
}

async function insertBatchType(data) {
    try {
        const result = await knex('product_batch_types').insert(data);
        return result;
    } catch (error) {
        throw error;
    }
}

async function fetchProducById(product_id) {
    try {
        const product = await knex('products').where({ product_id }).first();
        return product;
    } catch (error) {
        throw error;
    }
}

async function fetchBatchTypeById(batch_type_id) {
    try {
        const batchType = await knex('product_batch_types').where({ batch_type_id }).first();
        return batchType;
    } catch (error) {
        throw error;
    }
}

async function fetchLocationItems(locationId) {
    try {
        const items = await knex('items').select().where('location_id', locationId);
        return items;
    } catch (error) {
        throw error;
    }
}

async function fetchItem(UID, locationId) {
    try {
        const item = await knex('items').select().where('nfc_uid', UID).andWhere('location_id', locationId).first();
        return item;
    } catch (error) {
        throw error;
    }
}

async function insertItem(data, trx = null) {
    try {
        const query = trx || knex;

        const result = await query('items').insert(data).returning('item_id');

        return result;
    } catch (error) {
        throw error;
    }
}

async function updateItemStatus(id, status, trx = null) {
    try {
        const query = trx || knex;

        const result = await query('items').update('status', status).where('item_id', id);
        
        return result;
    } catch(error) {
        throw error;
    }
}


module.exports = {
    fetchProducts,
    insertBatchType,
    insertItem,
    fetchProductBySku,
    insertProduct,
    fetchBatchTypes,
    insertBatchType,
    fetchProducById,
    fetchBatchTypeById,
    fetchLocationItems,
    fetchItem,
    updateItemStatus
}