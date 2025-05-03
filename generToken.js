// const { MongoClient } = require("mongodb");
const jwt = require('jsonwebtoken');
require('dotenv').config()


const secretAccessKey = process.env.VERY_VERY_SECRET_FOR_ACCESS;
const secretRefreshKey = process.env.VERY_VERY_SECRET_FOR_REFRESH;

function generateAccessToken(a, b) {
    const payload = { id: a, email: b };
    console.log(`Run generateAccessToken(a, b)`)
    return jwt.sign(payload, secretAccessKey, { expiresIn: '10m' }); // Токен истекает через 10 минут
}

function generateRefreshToken(a, b) {
    const payload = { id: a, email: b };
    console.log(`Run generateRefreshToken(a, b)`)
    return jwt.sign(payload, secretRefreshKey, { expiresIn: '1440m' }); // Токен истекает через 24 часа
}

function verifyJWT(token, secret, type) {
    try {
        const decoded = jwt.verify(token, secret);
        console.log(`generToken.js ${type} TOKEN GOOD`)
        return true;
    } catch (error) {
        console.log(`generToken.js ${type} TOKEN BAD`)
        return false;
    }
}

exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyJWT = verifyJWT;