const { response, move } = require("../app");
const knex = require("../db/knex");
const { logMovement, fetchChainMovementsByUid, verifyChainEvent, getTransactionData, fetchTransactionData } = require("../services/blockchainClient");
const { fetchLocationsByIds } = require("../services/locations");
const { insertMovement, fetchMovementsByItemId, fetchRawMovementsByItemId, insertItemMovement, fetchItemMovements, updateMovementHash } = require("../services/movements");

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


                const locationItemInsert = await insertLocationItem(itemData, trx);

                if (!locationItemInsert) {
                    throw new Error('Error al crear articulo en almacen.');
                }
            }

        } else if (movementType === 'outbound') {
            if (locationItem) {
                if (locationItem.status === 'DISPATCHED') {
                    throw new Error('El articulo ya no se encuentra en el almacen.');
                } else if (item.status === 'IN_STOCK') {
                    result = await updateItemStatus(locationItem.location_item_id, 'DISPATCHED');
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

        //parte del blockchain
        const ts = Math.floor(new Date(movementResult[0].created_at).getTime() / 1000);

        const movementData = {
            uidHex: String(uid).toUpperCase(),

            movementType: movementType === 'inbound' ? 1 : 2,
            quantity: tag.product_quantity || 0,
            locationId: locationId || 0,
            ts,
            metadataURI: `${process.env.API_BASE_URL}/movements/${movementResult[0].movement_id}`,
            jsonFull: {
                movement_id: movementResult[0].movement_id,
                sku: product.sku,
                note: null
            },
            idempotencyKey: `mov-${movementResult[0].movement_id}`
        };


        const res = await logMovement(movementData);

        const hashRes = await updateMovementHash(movementResult[0].movement_id, res.txHash, trx);

        if (!hashRes) {
            throw new Error('Error al actualizar hash.');
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
        trx.rollback();
        response.status(500).json({
            success: false,
            details: error.message || 'Error al crear item.',
        });
    }
}


/*async function divideBatch(request, response) {
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

            //parte del blockchain
            const ts = Math.floor(new Date(movementResult[0].created_at).getTime() / 1000);

            const movementData = {
                uidHex: String(uid).toUpperCase(),

                movementType: movementType === 'inbound' ? 1 : 2,
                quantity: tag.product_quantity || 0,
                locationId: locationId || 0,
                ts,
                metadataURI: `${process.env.API_BASE_URL}/movements/${movementResult[0].movement_id}`,
                jsonFull: {
                    movement_id: movementResult[0].movement_id,
                    sku: product.sku,
                    note: null
                },
                idempotencyKey: `mov-${movementResult[0].movement_id}`
            };


            const res = await logMovement(movementData);

            const hashRes = await updateMovementHash(movementResult[0].movement_id, res.txHash, trx);

            if (!hashRes) {
                throw new Error('Error al actualizar hash.');
            }

        }

        trx.commit();

        response.send({
            success: true,
            details: 'Lote dividido existosamente.'
        });


    } catch (error) {
        trx.rollback();
        response.status(500).json({
            success: false,
            details: error.message || 'Error al dividir lote.',
        });
    }
}*/

async function divideBatch(request, response) {
  const trx = await knex.transaction();
  try {
    const { itemData } = request.body;

    const insertResult = await insertItem(itemData, trx);
    if (!insertResult) throw new Error('Error al crear nuevo lote.');
    const newItemId = insertResult[0].item_id;

    const newLocationItem = {
      location_id: itemData.location_id,
      item_id: newItemId,
      quantity: itemData.item_quantity
    };
    const locationItemInsert = await insertLocationItem(newLocationItem, trx);
    if (!locationItemInsert) throw new Error('Error al crear enlace de articulo con bodega.');

    const updateResult = await decrementItemQuantity(itemData.parent_id, itemData.item_quantity, trx);
    if (!updateResult) throw new Error('Error al actualizar cantidad del lote padre.');

    const updateLocationItem = await decrementLocationItemQuantity(
      itemData.parent_id, itemData.item_quantity, itemData.location_id, trx
    );
    if (!updateLocationItem) throw new Error('Error al actualizar cantidad del lote padre.');

    const parent = await fetchItemById(itemData.parent_id);
    const tagUpdateResult = await decrementTagQuantity(parent.nfc_uid, itemData.item_quantity, trx);
    if (!tagUpdateResult) throw new Error('Error al actualizar etiqueta.');

    const newTag = {
      uid: itemData.nfc_uid,             
      product_id: itemData.product_id,
      product_quantity: itemData.item_quantity
    };
    const tagInsertResult = await insertTag(newTag, trx);
    if (!tagInsertResult) throw new Error('Error al crear etiqueta.');

    const movements = await fetchItemMovements(itemData.parent_id);
    for (const movement of movements) {
      const newMovementRel = { item_id: newItemId, movement_id: movement.movement_id };
      const movementInsertResult = await insertItemMovement(newMovementRel, trx);
      if (!movementInsertResult) throw new Error('Error al crear relacion entre articulo y movimiento.');
    }

    const ts = Math.floor(Date.now() / 1000);
    const qty = Number(itemData.item_quantity) || 0;
    const locId = Number(itemData.location_id) || 0;

    const parentEvent = {
      uidHex: String(parent.nfc_uid).toUpperCase(),
      movementType: 6,                 // 6 = Fraccionado (SPLIT)
      quantity: qty,                   // cantidad que salió del padre
      locationId: locId,
      ts,
      metadataURI: "",                 // sin snapshot
      jsonFull: {                      // info mínima para auditar relación
        action: "split_out",
        parent_item_id: itemData.parent_id,
        child_item_id: newItemId,
        parent_uid: String(parent.nfc_uid).toUpperCase(),
        child_uid: String(itemData.nfc_uid).toUpperCase(),
        quantity: qty,
        location_id: locId
      },
      idempotencyKey: `split-out-${itemData.parent_id}-${newItemId}-${ts}`
    };

    // b) Evento para el HIJO (split_in)
    const childEvent = {
      uidHex: String(itemData.nfc_uid).toUpperCase(),
      movementType: 6,                 // mismo código 'Fraccionado'
      quantity: qty,                   // cantidad con la que nace el hijo
      locationId: locId,
      ts,
      metadataURI: "",                 // sin snapshot
      jsonFull: {
        action: "split_in",
        parent_item_id: itemData.parent_id,
        child_item_id: newItemId,
        parent_uid: String(parent.nfc_uid).toUpperCase(),
        child_uid: String(itemData.nfc_uid).toUpperCase(),
        quantity: qty,
        location_id: locId
      },
      idempotencyKey: `split-in-${itemData.parent_id}-${newItemId}-${ts}`
    };

    // Ejecuta ambos (si falla alguno, lanzamos error y hacemos rollback)
    const bcParent = await logMovement(parentEvent); // { txHash, blockNumber, latestHash }
    const bcChild  = await logMovement(childEvent);

    // (Opcional) guarda los txHash en alguna tabla para referencia rápida:
    // await insertChainAudit({
    //   item_id: itemData.parent_id, kind: 'split_out', tx_hash: bcParent.txHash, ... }, trx);
    // await insertChainAudit({
    //   item_id: newItemId, kind: 'split_in', tx_hash: bcChild.txHash, ... }, trx);

    await trx.commit();
    return response.send({
      success: true,
      details: 'Lote dividido exitosamente (on-chain registrado).',
      data: {
        parent_tx: bcParent.txHash,
        child_tx: bcChild.txHash,
        child_item_id: newItemId
      }
    });

  } catch (error) {
    await trx.rollback();
    return response.status(500).json({
      success: false,
      details: error.message || 'Error al dividir lote.'
    });
  }
}

async function getProductHistory(request, response) {
  try {
    const rawUid = request.body?.uid ?? request.params?.uid;
    const uid = String(rawUid || "").toUpperCase().trim();
    if (!uid) {
      return response.status(400).send({ success: false, details: "UID requerido." });
    }

    const [tag, items] = await Promise.all([
      fetchTagByUID(uid),
      fetchItemsByUid(uid)
    ]);

    if (!tag) {
      return response.status(404).send({ success: false, details: "Etiqueta no encontrada." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return response.status(404).send({ success: false, details: "No hay ítems asociados a este UID." });
    }

    const itemsSorted = items
      .slice()
      .sort((a, b) =>
        Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0) ||
        (a.item_id - b.item_id)
      );

    const lastItem = itemsSorted[itemsSorted.length - 1];

    const product = await fetchProducById(itemsSorted[0].product_id);
    if (!product) {
      return response.status(404).send({ success: false, details: "Producto asociado no existe." });
    }

    const locationItem = await fetchLocationItem(lastItem.item_id, lastItem.location_id).catch(() => null);

    const lineageAll = [];
    const visited = new Set(); 
    for (const it of itemsSorted) {
      let cur = it;
      while (cur && !visited.has(cur.item_id)) {
        lineageAll.push(cur);
        visited.add(cur.item_id);
        if (cur.parent_id == null) break;
        cur = await fetchItemById(cur.parent_id);
      }
    }

    lineageAll.sort(
      (a, b) =>
        Date.parse(b.updated_at || b.created_at || 0) -
        Date.parse(a.updated_at || a.created_at || 0)
    );
    const seenKeys = new Set(); 
    const lineageDedup = lineageAll
      .filter((x) => {
        const key = x.nfc_uid || String(x.item_id);
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .sort((a, b) => a.item_id - b.item_id); 

    const lineageAsc = lineageDedup; 
    const seenMovIds = new Set();
    let movementsDbComposite = [];

    for (let i = 0; i < lineageAsc.length; i++) {
      const node = lineageAsc[i];
      const next = lineageAsc[i + 1] || null;

      const cutoff = next
        ? Date.parse(next.created_at || next.updated_at || 0)
        : Infinity;

      const nodeMovs = await fetchMovementsByItemId(node.item_id).catch(() => []);
      for (const mv of (nodeMovs || [])) {
        const ts = Date.parse(mv.created_at || mv.ts || 0);
        if (ts <= cutoff) {
          if (!seenMovIds.has(mv.movement_id)) {
            movementsDbComposite.push({
              ...mv,
              source_item_id: node.item_id,
              is_ancestor: Boolean(next)
            });
            seenMovIds.add(mv.movement_id);
          }
        }
      }
    }

    movementsDbComposite.sort(
      (a, b) => Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0)
    );

    let movementsChain = [];
    try {
      const raw = await fetchChainMovementsByUid(uid);       
      const verified = await Promise.all(raw.map(verifyChainEvent)); 
      movementsChain = verified.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
    } catch (e) {
      console.warn("Blockchain fetch failed:", e?.message || e);
      movementsChain = [];
    }

    const locIds = new Set();
    for (const mv of movementsDbComposite) {
      if (mv.location_id != null) locIds.add(Number(mv.location_id));
    }
    for (const mv of movementsChain) {
      if (mv.location_id != null) locIds.add(Number(mv.location_id));
    }
    if (locationItem?.location_id != null) {
      locIds.add(Number(locationItem.location_id));
    }

    let locNameById = {};
    if (locIds.size > 0) {
      const rows = await fetchLocationsByIds([...locIds]).catch(() => []);
      locNameById = Object.fromEntries(
        (rows || []).map(r => [String(r.id), r.location_name])
      );
    }

    const movementsDbEnriched = movementsDbComposite.map(m => ({
      ...m,
      location_name: m.location_name ?? locNameById[String(m.location_id)] ?? null
    }));

    const movementsChainEnriched = movementsChain.map(m => ({
      ...m,
      location_name: m.location_name ?? locNameById[String(m.location_id)] ?? null
    }));

    const data = {
      uid,
      sku: product.sku,
      product_name: product.product_name,
      quantity: locationItem?.quantity ?? lastItem.item_quantity ?? tag.product_quantity ?? 0,
      status: locationItem?.status ?? lastItem.status ?? null,
      movements: movementsDbEnriched,          
      movements_chain: movementsChainEnriched, 
      lineage: lineageDedup           
    };

    return response.send({ success: true, data });

  } catch (error) {
    console.error(error);
    return response.status(400).send({
      success: false,
      details: "Error al obtener historial del producto."
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


/*async function getProductHistory(request, response) {
    try {
        const { uid } = request.body;

        const tag = await fetchTagByUID(uid);

        const items = await fetchItemsByUid(uid);

        const item = await fetchLocationItem(items[items.length - 1].item_id, items[items.length - 1].location_id);

        console.log('Este es el item que estas viendo.', item);

        const product = await fetchProducById(items[0].product_id);

        let member;
        let movements = [];
        let lineage = [];
        let parentId;


        movements = await fetchMovementsByItemId(item.item_id);

        console.log('moviemientos del item: ', movements);


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
            quantity: item.quantity,
            status: item.status,
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
}*/

//helpers

function tsFrom(val) {
  if (!val) return NaN;
  const n = Date.parse(val);
  return Number.isFinite(n) ? n : NaN;
}

async function firstMovementTs(itemId) {
  const arr = await fetchMovementsByItemId(itemId).catch(() => []);
  if (!arr || arr.length === 0) return NaN;
  const first = arr.slice().sort((a,b) => tsFrom(a.created_at) - tsFrom(b.created_at))[0];
  const t = tsFrom(first?.created_at);
  return Number.isFinite(t) ? t : NaN;
}

// helpers

async function getProductHistory(request, response) {
  try {
    const tsFromMs = (val) => {
      if (!val) return NaN;
      const n = Date.parse(val);
      return Number.isFinite(n) ? n : NaN;
    };

    const firstChainTsMs = async (uidHex) => {
      const arr = await fetchChainMovementsByUid(uidHex).catch(() => []);
      if (!arr || arr.length === 0) return NaN;
      const minSec = arr.reduce((m, e) => Math.min(m, Number(e.ts) || Infinity), Infinity);
      return Number.isFinite(minSec) ? minSec * 1000 : NaN;
    };

    const buildLinearLineage = async (lastItem) => {
      const chain = [];
      const guard = new Set();
      let cur = lastItem;
      while (cur && !guard.has(cur.item_id)) {
        chain.push(cur);
        guard.add(cur.item_id);
        if (cur.parent_id == null) break;
        cur = await fetchItemById(cur.parent_id);
      }
      return chain.reverse();
    };

    const buildCompositeChainTimeline = async (lineageRootToChild) => {
      let out = [];
      for (let i = 0; i < lineageRootToChild.length; i++) {
        const node = lineageRootToChild[i];
        const next = lineageRootToChild[i + 1] || null;

        let cutoffMs = Infinity;
        if (next) {
          const c1 = await firstChainTsMs(String(next.nfc_uid || "").toUpperCase());
          const c2 = tsFromMs(next.created_at) || tsFromMs(next.updated_at);
          cutoffMs = Number.isFinite(c1) ? c1 : (Number.isFinite(c2) ? c2 : Infinity);
        }

        const nodeUid = String(node.nfc_uid || "").toUpperCase();
        if (!nodeUid) continue;

        const raw = await fetchChainMovementsByUid(nodeUid).catch(() => []);
        const verified = await Promise.all(raw.map(verifyChainEvent));

        const filtered = verified
          .filter(ev => !next || (((ev.ts ?? 0) * 1000) <= cutoffMs))
          .map(ev => ({
            ...ev,
            source_uid: nodeUid,
            is_ancestor: Boolean(next)
          }));

        out = out.concat(filtered);
      }
      out.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)); // por segundos UNIX
      return out;
    };

    const rawUid = request.body?.uid ?? request.params?.uid;
    const uid = String(rawUid || "").toUpperCase().trim();
    if (!uid) {
      return response.status(400).send({ success: false, details: "UID requerido." });
    }

    const [tag, items] = await Promise.all([
      fetchTagByUID(uid),
      fetchItemsByUid(uid)
    ]);

    if (!tag) {
      return response.status(404).send({ success: false, details: "Etiqueta no encontrada." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return response.status(404).send({ success: false, details: "No hay ítems asociados a este UID." });
    }

    const itemsSorted = items.slice().sort(
      (a, b) =>
        tsFromMs(a.created_at) - tsFromMs(b.created_at) ||
        (a.item_id - b.item_id)
    );
    const lastItem = itemsSorted[itemsSorted.length - 1];

    const product = await fetchProducById(itemsSorted[0].product_id);
    if (!product) {
      return response.status(404).send({ success: false, details: "Producto asociado no existe." });
    }

    const locationItem = await fetchLocationItem(lastItem.item_id, lastItem.location_id).catch(() => null);

    const lineage = await buildLinearLineage(lastItem);

    const movementsChainComposite = await buildCompositeChainTimeline(lineage);

    const locIds = new Set();
    for (const mv of movementsChainComposite) {
      if (mv.location_id != null) locIds.add(Number(mv.location_id));
    }
    if (locationItem?.location_id != null) locIds.add(Number(locationItem.location_id));

    let locNameById = {};
    if (locIds.size > 0) {
      const rows = await fetchLocationsByIds([...locIds]).catch(() => []);
      locNameById = Object.fromEntries(
        (rows || []).map(r => [String(r.id), r.location_name])
      );
    }

    const movementsChainEnriched = movementsChainComposite.map(m => ({
      ...m,
      location_name: m.location_name ?? locNameById[String(m.location_id)] ?? null
    }));

    const data = {
      uid,
      sku: product.sku,
      product_name: product.product_name,
      quantity: locationItem?.quantity ?? lastItem.item_quantity ?? tag.product_quantity ?? 0,
      status: locationItem?.status ?? lastItem.status ?? null,
      lineage,                          // root → … → hijo (de tu DB)
      movements_chain: movementsChainEnriched // SOLO blockchain
    };

    return response.send({ success: true, data });

  } catch (error) {
    console.error(error);
    return response.status(400).send({
      success: false,
      details: "Error al obtener historial del producto (on-chain)."
    });
  }
}


async function getTransaction(request, response) {
    try {
        const { hash } = request.body;

        const data = await fetchTransactionData(hash);

        response.send({
            success: true,
            data: data
        })

        console.log(data);
    } catch (error) {
        response.status(400).send({
            success: false,
            details: 'Error al obtener datos de transaccion.'
        })
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
    getProductHistory,
    getTransaction
}