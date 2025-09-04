const { response, move } = require("../app");
const knex = require("../db/knex");
const { insertMovement, fetchMovementsByItemId, fetchRawMovementsByItemId, insertItemMovement, fetchItemMovements } = require("../services/movements");

const { fetchProducts, insertBatchType, insertItem, fetchProductBySku, insertProduct, fetchBatchTypes, fetchBatchTypeById, fetchProducById, fetchItem, updateItemStatus, fetchItems, updateItemQuantity, decrementItemQuantity, fetchInventory, fetchItemByUid, fetchProductMovements, fetchItemFamily, fetchItemById, fetchItemsByUid, fetchLocationItem, insertLocationItem, decrementLocationItemQuantity } = require("../services/products");
const { fetchTagByUID, insertTag } = require("../services/tags");
const { decrementTagQuantity } = require("./tags");

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

/*async function divideBatch(request, response) {
    const trx = await knex.transaction();
    try {
        const { itemData } = request.body;

        console.log(itemData);

        const insertResult = await insertItem(itemData, trx);

        if (!insertResult) {
            throw new Error('Error al crear nuevo lote.');
        }

        const updateResult = await decrementItemQuantity(itemData.parent_id, itemData.item_quantity, trx);

        if (!updateResult) {
            throw new Error('Error al actualizar cantidad del lote padre.');
        }

        const parent = await fetchItemById(itemData.parent_id);

        const tagUpdateResult = await decrementTagQuantity(parent.nfc_uid, itemData.item_quantity, trx);

        if (!tagUpdateResult) {
            throw new Error('Error al actualizar etiqueta.');
        }

        const newTag = {
            uid: itemData.nfc_uid,
            product_id: itemData.product_id,
            product_quantity: itemData.item_quantity
        };

        const tagInsertResult = await insertTag(newTag, trx);

        let movements = [];

        console.log('los movimientos del padre ', itemData.parent_id);

        movements = await fetchRawMovementsByItemId(itemData.parent_id);

        console.log(movements);


        for (const movement of movements) {
            const newMovement = {
                item_id: insertResult[0].item_id,
                location_id: movement.location_id,
                block_hash: movement.block_hash,
                created_by: movement.created_by,
                movement_type: movement.movement_type,
                created_at: movement.created_at
            };

            const movementInsertResult = await insertMovement(newMovement, trx);
            if (!movementInsertResult) {
                throw new Error('Error al crear movimientos.');
            }
        }


        if (!tagInsertResult) {
            throw new Error('Error al crear etiqueta.');
        }

        trx.commit();

        response.send({
            success: true,
            details: 'Lote dividido existosamente.'
        });


    } catch (error) {
        trx.rollback();
        console.log(error);
        response.status(500).json({
            success: false,
            details: error.message || 'Error al dividir lote.',
        });
    }
}*/

/*async function moveItem(request, response) {
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


                const existingItem = await fetchItemByUid(uid);

                console.log('Elemento obtenuido por uid', existingItem);

                if (existingItem) {
                    const itemData = {
                        product_id: existingItem.product_id,
                        nfc_uid: existingItem.nfc_uid,
                        location_id: locationId,
                        item_quantity: existingItem.item_quantity,
                        root_id: existingItem.root_id,
                        parent_id: existingItem.parent_id
                    };

                    console.log('new produc: ', existingItem);

                    const itemResult = await insertItem(itemData);

                    if (!itemResult) {
                        throw new Error('Error al crear articulo.');
                    }

                    itemId = itemResult[0].item_id;

                    const movements = await fetchRawMovementsByItemId(existingItem.item_id);
                    console.log('movimientos: ', movements);
                    for (const movement of movements) {
                        const newMovement = {
                            item_id: itemId,
                            location_id: movement.location_id,
                            block_hash: movement.block_hash,
                            created_by: movement.created_by,
                            movement_type: movement.movement_type,
                            created_at: movement.created_at
                        };

                        const movementInsertResult = await insertMovement(newMovement, trx);
                        if (!movementInsertResult) {
                            throw new Error('Error al crear movimientos.');
                        }
                    }
                } else {
                    const itemData = {
                        product_id: product.product_id,
                        nfc_uid: uid,
                        location_id: locationId,
                        item_quantity: tag.product_quantity,
                    };

                    const itemResult = await insertItem(itemData);

                    itemId = itemResult[0].item_id;

                    if (!itemResult) {
                        throw new Error('Error al crear articulo.');
                    }
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
            movement_type: movementType,
            uid: uid
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
}*/

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

        const item = await fetchItemByUid(uid);

        let itemId;

        if (item) {
            itemId = item.item_id;
        } else {
            const itemData = {
                product_id: product.product_id,
                nfc_uid: uid,
                location_id: locationId,
                item_quantity: tag.product_quantity,
            };
            const insertItemResult = await insertItem(itemData, trx);
            console.log('id de insert: ', insertItemResult);
            itemId = insertItemResult[0].item_id;
        }

        const locationItem = await fetchLocationItem(itemId, locationId);


        if (movementType === 'inbound') {
            if (locationItem) {
                if (locationItem.status === 'IN_STOCK') {
                    throw new Error('El articulo ya se encuentra en el almacen.');
                } else if (locationItem.status === 'DISPATCHED') {
                    let updateResult = await updateItemStatus(locationItem.location_item_id, 'IN_STOCK');

                    if (!updateResult) {
                        throw new Error('Error al actualizar estado.');
                    }
                }

            } else {
                const itemData = {
                    location_id: locationId,
                    item_id: itemId,
                    quantity: tag.product_quantity
                };

                console.log('datos a insertart', itemData);

                const locationItemInsert = await insertLocationItem(itemData, trx);

                if (!locationItemInsert) {
                    throw new Error('Error al crear articulo en almacen.');
                }
            }

        } else if (movementType === 'outbound') {
            console.log('location item: ', locationItem)
            if (locationItem) {
                if (locationItem.status === 'DISPATCHED') {
                    throw new Error('El articulo ya no se encuentra en el almacen.');
                } else if (item.status === 'IN_STOCK') {
                    result = await updateItemStatus(locationItem.location_item_id, 'DISPATCHED');
                    console.log(result);
                    if (!result) {
                        throw new Error('Error al actualizar estado del articulo.');
                    }
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
            movement_type: movementType,
            uid: uid
        };

        const movementResult = await insertMovement(newMovement, trx);

        if (!movementResult) {
            return response.status(400).send({
                success: false,
                details: 'Error al crear movimiento.'
            })
        }

        const newItemMovement = {
            item_id: itemId,
            movement_id: movementResult[0].movement_id
        };

        const itemMovementResult = await insertItemMovement(newItemMovement, trx);

        if (!itemMovementResult) {
            return response.status(400).send({
                success: false,
                details: 'Error al crear relacion entre movimiento y articulo.'
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

async function divideBatch(request, response) {
    const trx = await knex.transaction();
    try {
        const { itemData } = request.body;

        const insertResult = await insertItem(itemData, trx);

        if (!insertResult) {
            throw new Error('Error al crear nuevo lote.');
        }

        const newLocationItem = {
            location_id: itemData.location_id,
            item_id: insertResult[0].item_id,
            quantity: itemData.item_quantity
        };



        const locationItemInsert = await insertLocationItem(newLocationItem, trx);

        if (!locationItemInsert) {
            throw new Error('Error al crear enlace de articulo con bodega.');
        }

        const updateResult = await decrementItemQuantity(itemData.parent_id, itemData.item_quantity, trx);

        if (!updateResult) {
            throw new Error('Error al actualizar cantidad del lote padre.');
        }

        const updateLocationItem = await decrementLocationItemQuantity(itemData.parent_id, itemData.item_quantity, itemData.location_id, trx);

        console.log(updateLocationItem);

        if (!updateLocationItem) {
            throw new Error('Error al actualizar cantidad del lote padre.');
        }
        const parent = await fetchItemById(itemData.parent_id);

        const tagUpdateResult = await decrementTagQuantity(parent.nfc_uid, itemData.item_quantity, trx);

        if (!tagUpdateResult) {
            throw new Error('Error al actualizar etiqueta.');
        }

        const newTag = {
            uid: itemData.nfc_uid,
            product_id: itemData.product_id,
            product_quantity: itemData.item_quantity
        };

        const tagInsertResult = await insertTag(newTag, trx);

        if (!tagInsertResult) {
            throw new Error('Error al crear etiqueta.');
        }

        const movements = await fetchItemMovements(itemData.parent_id);


        for (const movement of movements) {
            const newMovement = {
                item_id: insertResult[0].item_id,
                movement_id: movement.movement_id,
            };

            const movementInsertResult = await insertItemMovement(newMovement, trx);

            if (!movementInsertResult) {
                throw new Error('Error al crear relacion entre articulo y movimiento.');
            }
        }

        trx.commit();

        response.send({
            success: true,
            details: 'Lote dividido existosamente.'
        });


    } catch (error) {
        trx.rollback();
        console.log(error);
        response.status(500).json({
            success: false,
            details: error.message || 'Error al dividir lote.',
        });
    }
}
async function getWarehouseItems(request, response) {
    try {
        const { locationId } = request.body;

        const items = await fetchItems(locationId);

        response.send({
            success: true,
            data: items
        });
    } catch (error) {
        console.log(error);
        response.status(400).send({
            success: false,
            details: 'Error al obtener articulos.'
        });
    }
}

async function getInventory(request, response) {
    try {
        const { locationId } = request.body;

        const inventory = await fetchInventory(locationId);

        response.send({
            success: true,
            data: inventory
        });
    } catch (error) {
        response.status(400).send({
            success: false,
            details: 'Error al obtener inventario.'
        });
    }
}

async function getProductHistory(request, response) {
    try {
        const { uid } = request.body;

        const tag = await fetchTagByUID(uid);

        const items = await fetchItemsByUid(uid);

        const product = await fetchProducById(items[0].product_id);

        let member;
        let movements = [];
        let lineage = [];
        let parentId;


        memeberMovements = await fetchMovementsByItemId(items[items.length - 1].item_id);
        movements.push(...memeberMovements);

        for (const item of items) {

            parentId = item.parent_id;


            lineage.push(item);

            while (parentId != null) {
                member = await fetchItemById(parentId);

                lineage.push(member);

                parentId = member.parent_id;
            }
        }



        movements.sort((a, b) => a.movement_id - b.movement_id);
        lineage.sort((a, b) =>
            Date.parse(b.updated_at || b.created_at || 0) -
            Date.parse(a.updated_at || a.created_at || 0)
        );

        const seen = new Set();
        lineage = lineage.filter(x => {
            const key = x.nfc_uid || String(x.item_id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        lineage.sort((a, b) => a.item_id - b.item_id);


        const data = {
            uid: uid,
            sku: product.sku,
            product_name: product.product_name,
            quantity: items[items.length - 1].item_quantity,
            movements: movements,
            lineage: lineage
        };


        response.send({
            success: true,
            data: data
        });
    } catch (error) {
        console.log(error);
        response.status(400).send({
            success: false,
            details: 'Error al obtener historial del producto.'
        });
    }
}

module.exports = {
    getProducts,
    registerProductEntry,
    createProduct,
    getBatchTypes,
    createBatchType,
    moveItem,
    getWarehouseItems,
    divideBatch,
    getInventory,
    getProductHistory
}