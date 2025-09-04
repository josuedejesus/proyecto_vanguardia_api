const express = require("express");
const router = express.Router();

const clients = new Set();

let lastByReader = {};       
let lastAny = { uid: null }; 

const SUPPRESS_INITIAL_UID = true;

router.get("/sse", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.flushHeaders();

  res.write(`retry: 2000\n\n`);

  res.write(`event: ping\ndata: {}\n\n`);

  const hb = setInterval(() => {
    res.write(`:hb ${Date.now()}\n\n`);
  }, 15000);

  clients.add(res);
  req.on("close", () => {
    clearInterval(hb);
    clients.delete(res);
  });
});

router.get("/uid", (req, res) => {
  if (SUPPRESS_INITIAL_UID) {
    return res.json({ uid: null, reader: null, present: false, server_ts: Date.now() });
  }
  if (lastAny && lastAny.server_ts) {
    return res.json(lastAny);
  }
  return res.json({ uid: null, reader: null, present: false, server_ts: Date.now() });
});

router.get("/uid/all", (req, res) => {
  res.json(lastByReader);
});

function broadcast(evt) {
  const data = JSON.stringify(evt);

  for (const res of clients) {
    res.write(`event: ${evt.type || "nfc"}\n`);
    res.write(`data: ${data}\n\n`);
  }
}

function sendNfc(evt) {
  const now = { ...evt, server_ts: Date.now() };


  const key = now.reader || "default";
  lastByReader[key] = now;

  if (!now.present || !now.uid) {
    lastAny = { uid: null, reader: key, present: false, server_ts: now.server_ts };
  } else {
    lastAny = now;
  }

  broadcast(now);
}

module.exports = { router, sendNfc };
