function setCookie(res, refreshToken, time) {
    res.cookie('PDD_refreshToken', refreshToken, { //ставим на фронт refreshToken
        maxAge: time, // Время жизни cookie в миллисекундах (24 часа)
        httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
        secure: true, // Cookie будут отправляться только по HTTPS
        sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
    })
}

function delCookie(res){
    res.cookie('PDD_refreshToken', '', { //ставим на фронт refreshToken
        maxAge: -1, // Время жизни cookie в миллисекундах (60 минут)
        httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
        secure: true, // Cookie будут отправляться только по HTTPS
        sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
    })
}

// exports.generateAccessToken = generateAccessToken;
// exports.generateRefreshToken = generateRefreshToken;
// exports.verifyJWT = verifyJWT;

exports.setCookie = setCookie;
exports.delCookie = delCookie;