const { fetchCategories } = require("../services/categories");

async function getCategories(request, response) {
    try {
        console.log("Fetching categories..."); 
        const categories = await fetchCategories();
        response.send({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error(error);
        response.status(500).json({ 
            success: false,
            details: 'Error al obtener categorias.' 
        });
    }
}

module.exports = {
    getCategories
}