const { fetchTags, insertTag, fetchTagByUID } = require("../services/tags");

async function getTags(request, response) {
    try {
        const tags = await fetchTags();
        response.send({
            success: true,
            data: tags
        });
    } catch (error) {
        console.error(error);
        response.status(500).json({ 
            success: false,
            details: 'Error al obtener etiquetas.' 
        });
    }
}

async function createTag(request, response) {
    try {
        const tagData = request.body;

        const tagExists = await fetchTagByUID(tagData.uid);

        if (tagExists) {
            return response.status(400).json({
                success: false,
                details: 'Etiqueta con este UID ya existe.'
            });
        }
        
        const result = await insertTag(tagData);

        if (!result) {
            return response.status(500).json({ 
                success: false,
                details: 'Error al crear etiqueta.' 
            });
        }

        response.send({
            success: true,
            details: 'Etiqueta creada exitosamente.'
        })
    } catch (error) {
        console.error(error);
        response.status(500).json({ 
            success: false,
            details: 'Error al crear etiqueta.' 
        });
    }
}

async function  getTag(request, response) {
    try {
        const { uid } = request.body;

        const tag = await fetchTagByUID(uid);

        if (!tag) {
            return response.send({
                success: true,
                data: null
            });
        } 

        return response.send({
            success: true,
            data: tag
        });
    } catch (error) {
        response.send({
            success: false,
            details: 'Error al obtener etiqueta.'
        })
    }
}

module.exports = {
    getTags,
    createTag,
    getTag
}