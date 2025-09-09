const express = require('express');
const { fetchMovementSnapshotFS } = require('../services/snapshots');
const router = express.Router();

router.get('/public/movements/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });

    // Recupera el snapshot EXACTO (no reconstruido) desde donde lo guardes
    const snap = await fetchMovementSnapshotFS(id); // tu función
    if (!snap) return res.status(404).json({ error: 'snapshot no encontrado' });

    res.json(snap);
  } catch (e) { next(e); }
});

module.exports = router;
