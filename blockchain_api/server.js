// server.js
require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { ethers } = require("ethers");

// ABI compilado por Truffle
const MovementsLog = require(
  path.resolve(__dirname, "..", "2nd_Ganache_Test", "build", "contracts", "MovementsLog.json")
);

const {
  GANACHE_RPC_URL = "http://127.0.0.1:7545",
  MOVEMENTS_LOG_ADDR,
  ADMIN_PK,
  HMAC_SHARED_SECRET = "dev-secret",
  PORT = 4001
} = process.env;

if (!MOVEMENTS_LOG_ADDR || !ADMIN_PK) {
  throw new Error("Faltan MOVEMENTS_LOG_ADDR o ADMIN_PK en .env");
}

/* -------------------- Ethers + NonceManager -------------------- */
const provider = new ethers.JsonRpcProvider(GANACHE_RPC_URL);
const baseWallet = new ethers.Wallet(ADMIN_PK, provider);
const wallet = new ethers.NonceManager(baseWallet); // v6

// Arrancar desde el nonce "pending" (¡clave para que no quede stale!)
async function syncPendingNonce() {
  const pending = await provider.getTransactionCount(baseWallet.address, "pending");
  wallet.setTransactionCount(pending);
}
syncPendingNonce().catch(() => { /* noop */ });

const contract = new ethers.Contract(MOVEMENTS_LOG_ADDR, MovementsLog.abi, wallet);

// Cola simple para serializar tx (evita colisiones de nonce si llegan requests en paralelo)
let queue = Promise.resolve();
function enqueue(fn) {
  const run = () => fn().catch((e) => { throw e; });
  const p = queue.then(run, run);
  queue = p.catch(() => {}); // mantiene la cola aunque falle
  return p;
}

/* -------------------- Helpers -------------------- */
const uidKey = (uidHex) => ethers.keccak256(ethers.toUtf8Bytes(String(uidHex).toUpperCase()));

const stableStringify = (obj) => {
  const keys = [];
  JSON.stringify(obj, (k, v) => (keys.push(k), v));
  keys.sort();
  return JSON.stringify(obj, keys);
};

const contentHash = (obj) =>
  ethers.keccak256(ethers.toUtf8Bytes(stableStringify(obj)));

const nowSec = () => Math.floor(Date.now() / 1000);

/* -------------------- HMAC middleware -------------------- */
function verifyHmac(req, res, next) {
  try {
    const ts = req.header("X-Timestamp");
    const sig = req.header("X-Signature");
    if (!ts || !sig) return res.status(401).json({ error: "missing auth headers" });

    // expira si pasan >5 minutos
    if (Math.abs(nowSec() - Number(ts)) > 300) return res.status(401).json({ error: "stale request" });

    const bodyStr = JSON.stringify(req.body || {});
    const mac = crypto.createHmac("sha256", HMAC_SHARED_SECRET)
      .update(bodyStr + ts).digest("hex");
    if (sig !== mac) return res.status(401).json({ error: "bad signature" });
    next();
  } catch {
    res.status(401).json({ error: "auth failed" });
  }
}

/* -------------------- App -------------------- */
const app = express();
app.use(express.json());

// Idempotencia in-memory (dev). En prod, usar Redis/DB.
const seen = new Map();

/* -------------------- Rutas -------------------- */

// health
app.get("/health", (_req, res) => res.json({ ok: true }));

// timeline por UID
app.get("/movements/:uidHex", async (req, res) => {
  try {
    const key = uidKey(req.params.uidHex);
    const filter = contract.filters.MovementLogged(key);
    const logs = await contract.queryFilter(filter, 0, "latest");
    const items = logs.map((ev) => {
      const v = ev.args;
      return {
        blockNumber: ev.blockNumber,
        txHash: ev.transactionHash,
        movementHash: v.movementHash,
        prevHash: v.prevHash,
        movementType: Number(v.movementType),
        quantity: Number(v.quantity),
        locationId: Number(v.locationId),
        ts: Number(v.ts),
        metadataURI: v.metadataURI,
        actor: v.actor,
        // si tu evento tiene contentHash en el ABI, expónlo también:
        contentHash: v.contentHash ? String(v.contentHash) : undefined
      };
    });
    res.json({ uidHex: req.params.uidHex, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// latest head por UID
app.get("/movements/latest/:uidHex", async (req, res) => {
  try {
    const latest = await contract.latestHash(uidKey(req.params.uidHex));
    res.json({ latestHash: latest });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// publicar movimiento (HMAC)
app.post("/movements/log", verifyHmac, async (req, res) => {
  const {
    uidHex,
    movementType,
    quantity = 0,
    locationId = 0,
    ts,
    metadataURI = "",
    jsonFull = {},
    idempotencyKey
  } = req.body || {};

  // validación mínima
  if (!uidHex || movementType === undefined || movementType === null || ts === undefined || ts === null) {
    return res.status(400).json({ error: "uidHex, movementType y ts son requeridos" });
  }

  // idempotencia (best-effort en memoria)
  if (idempotencyKey && seen.has(idempotencyKey)) {
    return res.json(seen.get(idempotencyKey));
  }

  try {
    const key = uidKey(uidHex);
    let prev = await contract.latestHash(key);

    // hash del contenido (si no quieres snapshots, puedes hashear solo los campos básicos)
    const ch = jsonFull && Object.keys(jsonFull).length
      ? contentHash(jsonFull)
      : contentHash({
          movementType: Number(movementType),
          quantity: Number(quantity) || 0,
          locationId: Number(locationId) || 0,
          ts: Number(ts)
        });

    // función que arma y envía la tx
    const sendTx = async () => contract.logMovement(
      key,
      Number(movementType),
      Number(quantity) || 0,
      Number(locationId) || 0,
      Number(ts),
      String(metadataURI),
      prev,
      ch
    );

    // Enviar serializado y reintentar si hay error de nonce
    const receipt = await enqueue(async () => {
      try {
        const tx = await sendTx();
        return await tx.wait();
      } catch (e) {
        const msg = String(e?.error?.message || e.message || "");
        // si Ganache se queja del nonce, resincroniza y reintenta 1 vez
        if (msg.includes("correct nonce") || msg.includes("nonce")) {
          await syncPendingNonce();
          const tx2 = await sendTx();
          return await tx2.wait();
        }
        // si el prevHash quedó viejo por concurrencia, refresca y reintenta 1 vez
        if (msg.includes("bad prevHash") || msg.includes("prevHash")) {
          prev = await contract.latestHash(key);
          const tx2 = await sendTx();
          return await tx2.wait();
        }
        throw e;
      }
    });

    const out = {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      latestHash: await contract.latestHash(key)
    };

    if (idempotencyKey) seen.set(idempotencyKey, out);
    return res.json(out);
  } catch (e) {
    return res.status(502).json({ error: e.reason || e.message || String(e) });
  }
});

app.get("/tx/:hash", async (req, res) => {
  try {
    const { hash } = req.params;
    console.log(hash);
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      return res.status(400).json({ error: "hash inválido" });
    }

    const tx = await provider.getTransaction(hash);
    if (!tx) return res.status(404).json({ error: "tx no encontrada" });

    const receipt = await provider.getTransactionReceipt(hash);
    const blockNum = receipt?.blockNumber ?? tx.blockNumber ?? null;
    const block = blockNum != null ? await provider.getBlock(blockNum) : null;

    // Parseo de logs con el ABI (solo los que correspondan al contrato MovementsLog)
    const parsedLogs = [];
    if (receipt && Array.isArray(receipt.logs)) {
      for (const log of receipt.logs) {
        if (log.address?.toLowerCase() !== contract.target.toLowerCase()) continue;
        try {
          const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });

          // Mapea args con nombres (ethers v6)
          const args = {};
          parsed.fragment.inputs.forEach((inp, idx) => {
            const v = parsed.args[idx];
            // normaliza BigInt -> string
            args[inp.name] = (typeof v === "bigint") ? v.toString() : v;
          });

          parsedLogs.push({
            name: parsed.name,              // p.ej. "MovementLogged"
            args,
            logIndex: log.logIndex,
            address: log.address
          });
        } catch (e) {
          // no parseable por esta ABI; lo omitimos
        }
      }
    }

    // Normaliza valores (ethers v6 usa bigint)
    const toStr = (v) => (typeof v === "bigint" ? v.toString() : v ?? null);

    res.json({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      nonce: tx.nonce,
      value_wei: toStr(tx.value),
      gasPrice_wei: toStr(tx.gasPrice),
      blockNumber: blockNum,
      status: receipt?.status ?? null,
      gasUsed: toStr(receipt?.gasUsed),
      cumulativeGasUsed: toStr(receipt?.cumulativeGasUsed),
      // tiempos
      timestamp: block?.timestamp ?? null,
      timestamp_iso: block?.timestamp ? new Date(block.timestamp * 1000).toISOString() : null,
      // logs
      logs: parsedLogs,
      // crudos (opcional para debug)
      raw: {
        tx,
        receipt: receipt ?? null
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.reason || e.message || "tx lookup failed" });
  }
});


app.listen(PORT, () => console.log(`blockchain-service on :${PORT}`));
