// scripts/publishMovement.js
const MovementsLog = artifacts.require("MovementsLog");

// JSON estable para hash determinístico
function stableStringify(obj) {
  const keys = [];
  JSON.stringify(obj, (k, v) => (keys.push(k), v));
  keys.sort();
  return JSON.stringify(obj, keys);
}

module.exports = async function (callback) {
  try {
    const accounts = await web3.eth.getAccounts();
    const admin = accounts[0];
    const c = await MovementsLog.deployed();

    const uidHex = "040198C33B4189";
    const movementType = 1; // inbound
    const quantity = 100;
    const locationId = 1;
    const ts = Math.floor(Date.now() / 1000);
    const metadataURI = "https://api.tuapp.com/movements/123";
    const jsonFull = { event_id: 123, sku: "SKU-1", note: "recepción inicial" };

    const uidKey = web3.utils.keccak256(web3.utils.utf8ToHex(uidHex));
    const prevHash = await c.latestHash.call(uidKey);
    const contentHash = web3.utils.keccak256(
      web3.utils.utf8ToHex(stableStringify(jsonFull))
    );

    const tx = await c.logMovement(
      uidKey, movementType, quantity, locationId, ts, metadataURI, prevHash, contentHash,
      { from: admin }
    );

    console.log("TX:", tx.tx);
    callback();
  } catch (err) {
    console.error(err);
    callback(err);
  }
};
