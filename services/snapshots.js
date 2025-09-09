const path = require('path');
const fs = require('fs/promises');

async function writeMovementSnapshotFS(movementId, snapshot) {
  const dir = path.join(__dirname, '..', 'public', 'movements');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${movementId}.json`);

  await fs.writeFile(file, JSON.stringify(snapshot), 'utf8');

  return `/public/movements/${movementId}.json`;
}

async function fetchMovementSnapshotFS(movementId) {
  try {
    const file = path.join(__dirname, '..', 'public', 'movements', `${movementId}.json`);
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return null; // no existe
  }
}

module.exports = {
  writeMovementSnapshotFS,
  fetchMovementSnapshotFS,
};
