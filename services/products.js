const knex = require('../db/knex');
const { fetchTagByUID } = require('./tags');

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
        const items = await knex('items').select().where('location_id', locationId).orderBy('item_id');
        return items;
    } catch (error) {
        throw error;
    }
}

async function fetchItem(itemId) {
    try {
        const item = await knex('items').select().where('item_id', itemId).first();
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

async function insertLocationItem(data, trx = null) {
    try {
        const query = trx || knex;

        const result = await query('location_items').insert(data).returning('location_item_id');

        return result;
    } catch (error) {
        throw error;
    }
}

async function updateItemStatus(id, status, trx = null) {
    try {
        const query = trx || knex;

        const result = await query('location_items').update('status', status).where('location_item_id', id);

        return result;
    } catch (error) {
        throw error;
    }
}

async function decrementItemQuantity(id, quantity, trx = null) {
    try {
        const query = trx || knex;

        const result = await query('items').where('item_id', id).decrement('item_quantity', quantity);

        return result;
    } catch (error) {
        throw error;
    }
}

async function decrementLocationItemQuantity(id, quantity, location, trx = null) {
    try {
        const query = trx || knex;

        const result = await query('location_items').where('item_id', id).andWhere('location_id', location).decrement('quantity', quantity);

        return result;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function fetchItems(locationId) {
    try {
        const rows = await knex('location_items as li')
            .join('items as i', 'i.item_id', 'li.item_id')
            .join('products as p', 'p.product_id', 'i.product_id')
            .where('li.location_id', locationId)
            .select(
                'li.location_id',
                'li.item_id',
                'li.status',
                'li.quantity',
                'p.base_uom',
                'i.nfc_uid',
                'i.created_at',
                'p.sku',
                'p.product_name',
                'p.product_id'
            )
            .orderBy('p.product_name', 'asc');
        return rows;

    } catch (error) {
        throw error;
    }
}

async function fetchInventory(locationId) {
    try {
        const items = await knex('products as p')
            .leftJoin('items as it', 'it.product_id', 'p.product_id')
            .leftJoin('location_items as i', 'i.item_id', 'it.item_id')
            .groupBy('p.product_id', 'p.product_name')
            .select('p.product_id', 'p.sku', 'p.product_category', 'p.product_name')
            .select(
                knex.raw(
                    "COALESCE(SUM(CASE WHEN i.status = 'IN_STOCK' THEN i.quantity ELSE 0 END), 0) AS in_stock_qty"
                )
            )
            .orderBy('p.product_name')
            .where('i.location_id', locationId);

        return items;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function fetchItemByUid(uid) {
    try {
        const item = await knex('items').select().where('nfc_uid', uid).first();


        return item;
    } catch (error) {
        throw error;
    }
}

async function fetchItemsByUid(uid) {
    try {
        const items = await knex('items').select().where('nfc_uid', uid);


        return items;
    } catch (error) {
        throw error;
    }
}

async function fetchItemById(id) {
    try {
        const item = await knex('items').select().where('item_id', id).first();


        return item;
    } catch (error) {
        throw error;
    }
}

async function fetchItemFamily(rootId) {
    try {
        const movements = await knex('items').select().where('root_id', rootId);
        return movements;
    } catch (error) {
        throw error;
    }
}

async function fetchLocationItem(productId, locationId) {
    try {
        const product = await knex('location_items')
            .select()
            .where('item_id', productId)
            .andWhere('location_id', locationId)
            .first();

        return product;
    } catch (error) {
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
    updateItemStatus,
    fetchItems,
    decrementItemQuantity,
    fetchInventory,
    fetchItemByUid,
    fetchItemFamily,
    fetchItemById,
    fetchItemsByUid,
    fetchLocationItem,
    insertLocationItem,
    decrementLocationItemQuantity
}