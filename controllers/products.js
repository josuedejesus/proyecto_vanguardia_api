const { response, move } = require("../app");
const knex = require("../db/knex");
const { insertMovement } = require("../services/movements");

const { fetchProducts, insertBatchType, insertItem, fetchProductBySku, insertProduct, fetchBatchTypes, fetchBatchTypeById, fetchProducById, fetchItem, updateItemStatus } = require("../services/products");
const { fetchTagByUID } = require("../services/tags");

async function createProduct(request, response) {
    try {
        const productData = request.body;

        const skuResult = await fetchProductBySku(productData.sku);
        if (skuResult) {
            return response.status(400).json({
                success: false,
                details: 'El SKU ya existe.'
            });
        }

        const productResult = await insertProduct(productData);
        if (!productResult) {
            return response.status(500).json({
                success: false,
                details: 'Error al crear producto.'
            });
        }

        response.send({
            success: true,
            details: 'Producto creado exitosamente.',
            product_id: productResult[0].product_id
        });
    } catch (error) {
        response.status(500).json({
            success: false,
            details: 'Error al crear producto.'
        });
    }
}
async function getProducts(request, response) {
    try {
        const products = await fetchProducts();


        response.send({
            success: true,
            data: products
        });
    } catch (error) {
        response.status(500).json({
            success: false,
            details: 'Error al obtener categorias.'
        });
    }
}

async function registerProductEntry(request, response) {
    const trx = await knex.transaction();
    try {
        const { entryData } = request.body;

        const newBatchType = {
            product_id: entryData.product_id,
            batch_type_name: entryData.batch_type_name,
            batch_type_multiplier: entryData.batch_type_multiplier
        }

        const batchInsertResult = await insertBatchType(newBatchType, trx);

        if (!batchInsertResult) {
            throw new Error('Error al crear tipo de lote.');
        }

        const batchTypeId = batchInsertResult[0].batch_type_id;

        const newItem = {
            product_id: entryData.product_id,
            batch_type_id: batchTypeId,
            nfc_uid: entryData.nfc_uid,
        };

        console.log(newBatchType);

        console.log(newItem);

        const itemInsertResult = await insertItem(newItem, trx);

        if (!itemInsertResult) {
            throw new Error('Error al ingresar producto.');
        }

        await trx.commit();

        response.send({
            success: true,
            details: 'Producto ingresado exitosamente.'
        });
    } catch (error) {
        await trx.rollback();
        response.status(500).json({
            success: false,
            details: 'Error al ingresar producto.'
        });
    }
}

async function getBatchTypes(request, response) {
    try {
        const batchTypes = await fetchBatchTypes();
        response.send({
            success: true,
            data: batchTypes
        });
    } catch (error) {
        console.error(error);
        response.status(500).json({
            success: false,
            details: 'Error al obtener tipos de lote.'
        });
    }
}

async function createBatchType(request, response) {
    try {
        const batchType = request.body;

        const result = await insertBatchType(batchType);

        response.send({
            success: true,
            details: 'Tipo de lote creado exitosamente.'
        });
    } catch (error) {
        console.error(error);
        response.status(500).json({
            success: false,
            details: 'Error al obtener tipos de lote.'
        });
    }
}

async function moveItem(request, response) {
    const trx = await knex.transaction();

    try {
        const { uid, locationId, movementType, userId } = request.body;

        const tag = await fetchTagByUID(uid);

        if (!tag) {
            return response.status(400).send({
                success: false,
                details: 'La etiqueta es invalida.'
            });
        }

        const product = await fetchProducById(tag.product_id);

        if (!product) {
            return response.status(400).json({
                success: false,
                details: 'El producto asociado a la etiqueta no existe.'
            });
        }

        const item = await fetchItem(uid, locationId);

        let itemId;

        if (movementType === 'inbound') {
            if (item) {
                itemId = item.item_id;
                if (item.status === 'IN_STOCK') {
                    throw new Error('El articulo ya se encuentra en el almacen.');
                } else if (item.status === 'DISPATCHED') {
                    let updateResult = await updateItemStatus(item.item_id, 'IN_STOCK');
                }

            } else {
                const itemData = {
                    product_id: product.product_id,
                    nfc_uid: uid,
                    location_id: locationId,
                    item_quantity: tag.product_quantity
                };

                const itemResult = await insertItem(itemData);

                itemId = itemResult[0].item_id;

                if (!itemResult) {
                    throw new Error('Error al crear articulo.');
                }
            }

        } else if (movementType === 'outbound') {
            if (item) {
                itemId = item.item_id;
                if (item.status === 'DISPATCHED') {
                    throw new Error('El articulo ya no se encuentra en el almacen.');
                } else if (item.status === 'IN_STOCK') {
                    result = await updateItemStatus(item.item_id, 'DISPATCHED');
                }
            } else {
                throw new error('El articulo no existe en el almacen.')
            }
        }

        const newMovement = {
            item_id: itemId,
            location_id: locationId,
            block_hash: 'test',
            created_by: userId,
            movement_type: movementType
        };

        const movementResult = await insertMovement(newMovement);

        if (!movementResult) {
            return response.status(400).send({
                success: false,
                details: 'Error al crear movimiento.'
            })
        }
        
        await trx.commit();

        return response.send({
            success: true,
            details: 'Movimiento creado exitosamente',
            data: {
                tag,
                product,
                movementType: movementType
            }
        })

    } catch (error) {
        console.log(error);
        trx.rollback();
        response.status(500).json({
            success: false,
            details: error.message || 'Error al crear item.',
        });
    }
}

module.exports = {
    getProducts,
    registerProductEntry,
    createProduct,
    getBatchTypes,
    createBatchType,
    moveItem
}