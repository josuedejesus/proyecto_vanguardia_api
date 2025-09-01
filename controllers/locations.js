const { fetchLocations } = require("../services/locations")

async function getLocations(request, response) {
    try {
        const locations = await fetchLocations();

        response.send({
            success: true,
            data: locations
        });
    } catch (error) {
        response.status(400).send({
            success: false,
            details: 'Error al obtener ubicaciones.'
        });
    }
}

module.exports = {
    getLocations
}