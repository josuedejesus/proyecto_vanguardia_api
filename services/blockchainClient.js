const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const { keccak256, toUtf8Bytes } = require("ethers");

const BLOCKCHAIN_URL = process.env.BLOCKCHAIN_URL || "http://127.0.0.1:4001";
const HMAC_SHARED_SECRET = process.env.HMAC_SHARED_SECRET || "supersecreto";

function sign(body, ts) {
  const payload = JSON.stringify(body);
  return crypto.createHmac("sha256", HMAC_SHARED_SECRET).update(payload + ts).digest("hex");
}

function stableStringify(o) {
  const keys = [];
  JSON.stringify(o, (k, v) => (keys.push(k), v));
  keys.sort();
  return JSON.stringify(o, keys);
}

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
  return r.json(); 
}

async function getChainMovements(uidHex) {
  const r = await fetch(`${BLOCKCHAIN_URL}/movements/${uidHex}`);
  if (!r.ok) throw new Error(`blockchain ${r.status}: ${await r.text()}`);
  const { items = [] } = await r.json();
  return items.map(ev => ({
    tx_hash: ev.txHash,
    block_number: Number(ev.blockNumber),
    movement_type: Number(ev.movementType),
    quantity: Number(ev.quantity),
    location_id: Number(ev.locationId),
    ts: Number(ev.ts),                          
    metadata_uri: ev.metadataURI || "",
    content_hash: ev.contentHash || null     
  }));
}

async function getLatestHash(uidHex) {
  const r = await fetch(`${BLOCKCHAIN_URL}/movements/latest/${uidHex}`);
  if (!r.ok) throw new Error(`blockchain ${r.status}: ${await r.text()}`);
  const { latestHash } = await r.json();
  return latestHash;
}

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

async function fetchChainMovementsByUid(uidHex) {
  const url = `${BLOCKCHAIN_URL}/movements/${uidHex}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`blockchain ${r.status}: ${await r.text()}`);
  const { items = [] } = await r.json();

  return items.map(ev => ({
    source: "chain",
    tx_hash: ev.txHash,
    block_number: ev.blockNumber,
    movement_type: Number(ev.movementType),
    quantity: Number(ev.quantity),
    location_id: Number(ev.locationId),
    ts: Number(ev.ts),                       
    at_iso: new Date(Number(ev.ts) * 1000).toISOString(),
    metadata_uri: ev.metadataURI || "",
    content_hash: ev.contentHash || null,
  }));
}

async function verifyChainEvent(ev) {
  if (!ev.metadata_uri || !ev.content_hash) {
    return { ...ev, verified: null }; 
  }
  try {
    const meta = await fetch(ev.metadata_uri).then(r => r.json());
    const localHash = keccak256(toUtf8Bytes(stableStringify(meta)));
    const ok = localHash.toLowerCase() === ev.content_hash.toLowerCase();
    return { ...ev, verified: ok, meta_snapshot: meta };
  } catch {
    return { ...ev, verified: null }; 
  }
}


async function fetchTransactionData(txHash) {
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(String(txHash))) {
    throw new Error("Invalid tx hash");
  }

  const r = await fetch(`${BLOCKCHAIN_URL}/tx/${txHash}`);
  if (!r.ok) {
    // propaga el detalle del backend
    throw new Error(`blockchain ${r.status}: ${await r.text()}`);
  }
  const data = await r.json();

  // Normalización ligera para tipos y estructura
  const toNum = (v) => (v == null ? null : Number(v));
  const toStr = (v) => (v == null ? null : String(v));

  const logs = Array.isArray(data.logs)
    ? data.logs.map((lg) => ({
        name: lg.name,
        logIndex: toNum(lg.logIndex),
        address: toStr(lg.address),
        // args ya vienen decodificados por el backend; los dejamos tal cual
        args: lg.args || {},
      }))
    : [];

  return {
    hash: toStr(data.hash),
    from: toStr(data.from),
    to: toStr(data.to),
    nonce: toNum(data.nonce),
    value_wei: toStr(data.value_wei),
    gasPrice_wei: toStr(data.gasPrice_wei),
    blockNumber: toNum(data.blockNumber),
    status: data.status, // 1 success, 0 failed, null pending
    gasUsed: toStr(data.gasUsed),
    cumulativeGasUsed: toStr(data.cumulativeGasUsed),
    timestamp: toNum(data.timestamp),            // segundos UNIX
    timestamp_iso: toStr(data.timestamp_iso),    // ISO string
    logs,                                        // eventos parseados
    // Si necesitas los crudos para debug, puedes exponerlos también:
    // raw: data.raw
  };
}




module.exports = {
  logMovement,
  getChainMovements,
  getLatestHash,
  verifyChainMovements,
  fetchChainMovementsByUid,
  verifyChainEvent,
  fetchTransactionData
};
