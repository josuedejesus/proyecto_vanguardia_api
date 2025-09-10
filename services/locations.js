const knex = require('../db/knex');

async function fetchLocations(params) {
    try {
        const locations = await knex('locations').select();

        return locations;
    } catch (error) {
        throw error;
    }
}

async function fetchLocation(id) {
    try {
        const location = await knex('locations').select().where('location_id', id).first();

        return location;
    } catch (error) {
        throw error;
    }
}

async function fetchLocationsByIds(ids, trx = null) {
  const db = trx || knex;

  // Normaliza y deduplica IDs
  const unique = [...new Set((ids || [])
    .map(x => Number(x))
    .filter(Number.isFinite))];

  if (unique.length === 0) return [];

  // 1er intento: PK = `id`
  try {
    const rows = await db("locations")
      .select("id", "location_name")
      .whereIn("id", unique);

    return rows.map(r => ({
      id: Number(r.id),
      location_name: r.location_name
    }));
  } catch (err1) {
    // 2do intento (fallback): PK = `location_id`
    try {
      const rows = await db("locations")
        .select({ id: "location_id" }, "location_name")
        .whereIn("location_id", unique);

      return rows.map(r => ({
        id: Number(r.id),
        location_name: r.location_name
      }));
    } catch (err2) {
      throw new Error(
        `fetchLocationsByIds failed: ${(err2 && err2.message) || (err1 && err1.message) || "unknown error"}`
      );
    }
  }
}

module.exports = {
    fetchLocations,
    fetchLocation,
    fetchLocationsByIds
}