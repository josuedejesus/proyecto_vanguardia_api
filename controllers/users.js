const { encryptPassword } = require("../crypto/encryption");
const { fetchLocation } = require("../services/locations");
const { fetchUsers, fetchUserByUsername, insertUser } = require("../services/users")
const jwt = require('jsonwebtoken');

async function getUsers(request, response) {
    try {
        const users = await fetchUsers();

        response.send({
            success: true,
            data: users
        });
    } catch (error) {
        response.status(400).send({
            success: false,
            details: 'Error al obtener usuarios.'
        });
    }
}

async function createUser(request, response) {
    const errorMessages = [];
    try {
        const { newUser } = request.body;


        if (newUser.password !== newUser.retyped_password) {
            return response.status(400).send({
                success: false,
                details: 'Las contrasenas deben coincidir.'
            });
        }



        const user = await fetchUserByUsername(newUser.username);
        if (user) {
            return response.status(422).send({
                success: false,
                details: 'El usuario ya existe.'
            });
        }


        const encryptedPassword = encryptPassword(newUser.password, '');


        const userData = {
            name: newUser.first_name,
            lastname: newUser.lastname,
            username: newUser.username,
            password_hash: encryptedPassword,
            user_role: newUser.user_role,
            location_id: newUser.location_id
        };


        const result = await insertUser(userData);

        if (!result) {
            return response.status(422).send({
                succes: false,
                details: 'Error al crear usuario.'
            });
        }



        return response.send({
            success: true,
            details: 'Usuario creado exitosamente.'
        });

    } catch (error) {
        console.error(error);
        errorMessages.push('Error interno del servidor.');
        return response.status(500).send({
            success: false,
            details: errorMessages
        });
    }
}


async function login(request, response) {
    try {
        const { username, password } = request.body;

        const user = await fetchUserByUsername(username);

        if (!user) {
            return response.status(400).send({
                success: false,
                details: 'Credenciales invalidas.'
            });
        }

        const hashedPassword = encryptPassword(password, '');

        if (hashedPassword !== user.password_hash) {
            return response.status(400).send({
                success: false,
                details: 'Credenciales invalidas.'
            });
        }

        const location = await fetchLocation(user.location_id);
        
        const accessToken = jwt.sign(
            {
                user_id: user.user_id,
                name: user.name,
                lastname: user.lastname,
                username: user.username,
                user_role: user.user_role,
                location_id: location.location_id
            },
            process.env.ACCESS_TOKEN_SECRET,
            {
                expiresIn: process.env.ACCESS_TOKEN_EXPIRATION,
            }
        );

        console.log(accessToken);

        response.send({
            success: true,
            data: accessToken
        })

    } catch (error) {
        console.log(error);
        response.status(400).send({
            succes: false,
            details: 'Credenciales invalidas.'
        });
    }
}
module.exports = {
    getUsers,
    createUser,
    login
}