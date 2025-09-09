// services/blockchainClient.js
const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
// Para verificación del hash (keccak256) – mismo algoritmo que on-chain
const { keccak256, toUtf8Bytes } = require("ethers");

const BLOCKCHAIN_URL = process.env.BLOCKCHAIN_URL || "http://127.0.0.1:4001";
const HMAC_SHARED_SECRET = process.env.HMAC_SHARED_SECRET || "supersecreto";

function sign(body, ts) {
  const payload = JSON.stringify(body);
  return crypto.createHmac("sha256", HMAC_SHARED_SECRET).update(payload + ts).digest("hex");
}

// Ordena claves para que el hash sea estable
function stableStringify(o) {
  const keys = [];
  JSON.stringify(o, (k, v) => (keys.push(k), v));
  keys.sort();
  return JSON.stringify(o, keys);
}

/** ---- POST: publicar movimiento ---- */
async function logMovement(body) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = sign(body, ts);
  const r = await fetch(`${BLOCKCHAIN_URL}/movements/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": ts,
      "X-Signature": sig,
      "X-Client-Id": "inventory-api"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`blockchain ${r.status}: ${await r.text()}`);
  return r.json(); // { txHash, blockNumber, latestHash }
}

/** ---- GET: timeline on-chain para un UID ---- */
async function getChainMovements(uidHex) {
  const r = await fetch(`${BLOCKCHAIN_URL}/movements/${uidHex}`);
  if (!r.ok) throw new Error(`blockchain ${r.status}: ${await r.text()}`);
  const { items = [] } = await r.json();
  // Normaliza tipos numéricos
  return items.map(ev => ({
    tx_hash: ev.txHash,
    block_number: Number(ev.blockNumber),
    movement_type: Number(ev.movementType),
    quantity: Number(ev.quantity),
    location_id: Number(ev.locationId),
    ts: Number(ev.ts),                          // UNIX seconds
    metadata_uri: ev.metadataURI || "",
    content_hash: ev.contentHash || null        // asegúrate de exponerlo en el servicio
  }));
}

/** ---- GET: latestHash (cabeza) para un UID ---- */
async function getLatestHash(uidHex) {
  const r = await fetch(`${BLOCKCHAIN_URL}/movements/latest/${uidHex}`);
  if (!r.ok) throw new Error(`blockchain ${r.status}: ${await r.text()}`);
  const { latestHash } = await r.json();
  return latestHash;
}

/** ---- Verificar eventos contra su metadataURI ---- */
async function verifyChainMovements(movs) {
  return Promise.all(movs.map(async ev => {
    if (!ev.metadata_uri || !ev.content_hash) return { ...ev, verified: null };
    try {
      const meta = await fetch(ev.metadata_uri).then(r => r.json());
      const local = keccak256(toUtf8Bytes(stableStringify(meta)));
      const ok = local.toLowerCase() === ev.content_hash.toLowerCase();
      return { ...ev, verified: ok, meta_snapshot: meta };
    } catch {
      return { ...ev, verified: null };
    }
  }));
}

function stableStringify(o) {
  const keys = [];
  JSON.stringify(o, (k, v) => (keys.push(k), v));
  keys.sort();
  return JSON.stringify(o, keys);
}

// trae timeline on-chain para un UID (desde tu blockchain-service)
async function fetchChainMovementsByUid(uidHex) {
  const url = `${BLOCKCHAIN_URL}/movements/${uidHex}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`blockchain ${r.status}: ${await r.text()}`);
  const { items = [] } = await r.json();

  // Normaliza a un shape consistente y numérico
  return items.map(ev => ({
    source: "chain",
    tx_hash: ev.txHash,
    block_number: ev.blockNumber,
    movement_type: Number(ev.movementType),
    quantity: Number(ev.quantity),
    location_id: Number(ev.locationId),
    ts: Number(ev.ts),                       // segundos UNIX
    at_iso: new Date(Number(ev.ts) * 1000).toISOString(),
    metadata_uri: ev.metadataURI || "",
    // contentHash es clave para verificación; asegúrate de exponerlo en el servicio:
    // event.args.contentHash -> incluirlo como ev.contentHash
    content_hash: ev.contentHash || null,
  }));
}

// intenta verificar un evento on-chain comparando el hash del metadataURI
async function verifyChainEvent(ev) {
  if (!ev.metadata_uri || !ev.content_hash) {
    return { ...ev, verified: null }; // no verificable (falta data)
  }
  try {
    const meta = await fetch(ev.metadata_uri).then(r => r.json());
    const localHash = keccak256(toUtf8Bytes(stableStringify(meta)));
    const ok = localHash.toLowerCase() === ev.content_hash.toLowerCase();
    return { ...ev, verified: ok, meta_snapshot: meta };
  } catch {
    return { ...ev, verified: null }; // metadata inaccesible
  }
}

module.exports = {
  logMovement,
  getChainMovements,
  getLatestHash,
  verifyChainMovements,
  fetchChainMovementsByUid,
  verifyChainEvent
};
