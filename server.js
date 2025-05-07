const express = require("express");
const cors = require('cors')
const { connectToDb, getDb } = require("./db");
const cookieParser = require("cookie-parser");
const {generateAccessToken, generateRefreshToken, verifyJWT} = require("./generToken");
const {ObjectId} = require("mongodb");

const PORT = 3000;

const corsOptions = {
  origin: 'http://localhost:5173',  // Заменить на нужный домен или массив доменов или разрешить все домены '*'
  methods: ['GET', 'POST', 'PATCH', 'DELETE'], // Разрешаем HTTP-методы
  allowedHeaders: ['Content-Type', 'Authorization'],  //Разрешаем заголовки
  credentials: true,              // Разрешить отправку куки и авторизационных данных
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

let db;

connectToDb((err) => {
  if (!err) {
    app.listen(PORT, (err) => {
      err ? console.log(err) : console.log(`Listening port ${PORT}`);
    });

    db = getDb();
  } else {
    console.log(`DB connection error: ${err}`);
  }
});

const handleError = (res, error) => {
  res.status(500).json({ error })
}


//регистрация...
app.post('/user/register', (req, res) => {
  db
      .collection('pdd_collection')
      .findOne( { name:req.body.name } )
      .then(doc => {
        if(doc){
          console.log(1, `Имя ${req.body.name} занято`)
          res
              .status(409)
              .json('имя занято')
        } else {
          console.log(2, `Имя ${req.body.name} свободно`)
          db
              .collection('pdd_collection')
              .insertOne(req.body)
              .then((result)=>{
                db.collection('pdd_collection').updateOne({ _id: result.insertedId }, {
                  $set: {
                    pathImg: '',
                    refreshToken: '',
                    accessToken: '',
                    creatDat: new Date(),
                    starQuestions:[],
                    errorQuestions:[],
                    examTiketsStatus:[{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'},{color:'none'}]
                  } }) //добавление токена и даты создания
                res
                    .status(201)
                    .json("Created")
              })
        }
      })
      .catch(()=> handleError(res, 'Something went wrong.'))
})
//...регистрация

//Авторизация...
app.post('/user/login', async (req, res) => {

    const { name, password } = req.body;

    console.log(name, password);

    try{
        const user = await db.collection('pdd_collection').findOne({ name: name, password: password });
        if(!user) return res.status(400).json({ message: 'Пользователь не найден' })

        const accessToken = generateAccessToken(user._id, name);
        const refreshToken = generateRefreshToken(user._id, name);

        await db.collection('pdd_collection').updateOne(
            { _id: user._id },
            { $set: { accessToken: accessToken, refreshToken: refreshToken } }
        );
        //
        const responseData = {
            name: user.name,
            accessToken: accessToken,
            id: user._id,
            pathImg: user.pathImg,
            starQuestions:user.starQuestions,
            errorQuestions:user.errorQuestions,
            examTiketsStatus:user.examTiketsStatus,
        };
        //
        res.cookie('PDD_refreshToken', refreshToken, { //ставим на фронт refreshToken
            maxAge: 86400000, // Время жизни cookie в миллисекундах (24 часа)
            httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
            secure: true, // Cookie будут отправляться только по HTTPS
            sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
        })
        //
        res.status(200).json(responseData);

    } catch (e) {
        console.error('Ошибка при входе:', e);
        res.status(500).json({ message: 'Ошибка сервера' });
    }

});
//...авторизация

//получение данных акка...
app.get('/user/:id', async (req, res) => {

    const accessToken = req.headers['authorization'];
    const cookies = Object.assign({}, req.cookies);
    const refreshToken = cookies.PDD_refreshToken

    console.log(`accessToken: ${accessToken}\nrefreshToken: ${refreshToken}`);

    try{
        const user = await db.collection('pdd_collection').findOne({_id: new ObjectId (req.params.id)})
        if(!user) return res.status(400).json({message: 'Пользователь не найден'})

        console.log(`userData-OK`)

        if(verifyJWT(accessToken, process.env.VERY_VERY_SECRET_FOR_ACCESS, 'AccessToken')){

        } else {
            if(verifyJWT(refreshToken, process.env.VERY_VERY_SECRET_FOR_REFRESH, 'RefreshToken')){
                console.log(`refreshToken GOOD`)
                //тут смена токенов!!!
                const accessToken = generateAccessToken(user._id, user.email);
                const refreshToken = generateRefreshToken(user._id, user.email);
                await db.collection('pdd_collection').updateOne({_id: new ObjectId (req.params.id)},
                    { $set: { accessToken: accessToken, refreshToken: refreshToken } }
                )

                const responseUser = {
                        name: user.name,
                        accessToken: accessToken,
                        id: user._id,
                        // pathImg: user.pathImg,
                        starQuestions:user.starQuestions,
                        errorQuestions:user.errorQuestions,
                        examTiketsStatus:user.examTiketsStatus,

                }

                res.cookie('PDD_refreshToken', refreshToken, { //ставим на фронт refreshToken
                    maxAge: 86400000, // Время жизни cookie в миллисекундах (24 часа)
                    httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
                    secure: true, // Cookie будут отправляться только по HTTPS
                    sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
                })
                // res.status(200).json(responseUser)
                return res.json(responseUser)
            } else{
                //refreshToken неверен, нужно перелогиниться
                return res.status(400).json({ message:'Токен не совпадает'})
            }
        }

        const responseUser = {
            name: user.name,
            accessToken: accessToken,
            id: user._id,
            // pathImg: user.pathImg,
            starQuestions:user.starQuestions,
            errorQuestions:user.errorQuestions,
            examTiketsStatus:user.examTiketsStatus,

        }
        res.status(200).json(responseUser)
    } catch (error) {
        console.error('Ошибка при входе:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
})
//...получение данных акка

//удаление Cookie с фронта при выходе из аккаунта
app.post('/del-cookie', (req, res) => {

    res.cookie('PDD_refreshToken', '', {
        maxAge: -1, // Время жизни cookie в миллисекундах (15 минут)
        httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
        secure: true, // Cookie будут отправляться только по HTTPS
        sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
    });
    res.send('Cookie has been set!');
    console.log('DELETE_COOKIE')
});
//удаление Cookie с фронта при выходе из аккаунта

//Удаление аккаунта:
app.delete('/user/delete/:id', (req, res) => {

    const accessTokenFont = req.headers['authorization'];
    const cookies = Object.assign({}, req.cookies);
    const refreshTokenFront = cookies.PDD_refreshToken

    const user = db.collection('pdd_collection').findOne({_id: new ObjectId (req.params.id)})
    console.log('delete user')
    if(!user) return res.status(400).json({message: 'Пользователь не найден'})

    if(verifyJWT(accessTokenFont, process.env.VERY_VERY_SECRET_FOR_ACCESS, 'AccessT')
        && verifyJWT(refreshTokenFront, process.env.VERY_VERY_SECRET_FOR_REFRESH, 'RefreshToken')){

        res.cookie('PDD_refreshToken', '', { //ставим на фронт refreshToken
            maxAge: -1, // Время жизни cookie в миллисекундах (60 минут)
            httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
            secure: true, // Cookie будут отправляться только по HTTPS
            sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
        })
        db
            .collection('pdd_collection')
            .deleteOne({ _id: new ObjectId(req.params.id) })
            .then((result)=>{
                res
                    .status(200)
                    .json(result)
            })
    } else {
        res.cookie('PDD_refreshToken', '', { //ставим на фронт refreshToken
            maxAge: -1, // Время жизни cookie в миллисекундах (60 минут)
            httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
            secure: true, // Cookie будут отправляться только по HTTPS
            sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
        })
        res.status(401).json(`result`)
    }
})
//...удаление аккаунта

//Добавление ошибочного вопроса в список ошибок
app.patch('/user/pusherror/:id', async (req, res)=>{

    const accessTokenFont = req.headers['authorization'];
    const cookies = Object.assign({}, req.cookies);
    const refreshTokenFront = cookies.refreshToken
    //
    const user = await db.collection('pdd_collection').findOne({_id: new ObjectId (req.params.id)})
    //

    //
    if(!user) return res.status(400).json({message: 'Пользователь не найден'})

    async function updateBD(){
        await db
            .collection('pdd_collection')
            .updateOne({_id: new ObjectId (req.params.id)}, {$push: {errorQuestions: req.body.id}} )
    }
    //
    if(verifyJWT(accessTokenFont, process.env.VERY_VERY_SECRET_FOR_ACCESS, 'AccessT')){
        await updateBD()
    } else {
    //

        if(verifyJWT(refreshTokenFront, process.env.VERY_VERY_SECRET_FOR_REFRESH, 'RefreshToken')){

            updateBD()

            const accessToken = generateAccessToken(user._id, user.name);
            const refreshToken = generateRefreshToken(user._id, user.name);

            await db.collection('pdd_collection').updateOne({_id: new ObjectId (req.params.id)},
                { $set: { accessToken: accessToken, refreshToken: refreshToken } }
            )

            res.cookie('PDD_refreshToken', refreshToken, { //ставим на фронт refreshToken
                maxAge: 86400000, // Время жизни cookie в миллисекундах (24 часа)
                httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
                secure: true, // Cookie будут отправляться только по HTTPS
                sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
            })

            return res.json({accessToken:accessToken})
        } else {

            res.cookie('PDD_refreshToken', '', { //ставим на фронт refreshToken
                maxAge: -1, // Время жизни cookie в миллисекундах (60 минут)
                httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
                secure: true, // Cookie будут отправляться только по HTTPS
                sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
            })
            return res.status(400).json({ message : 'Токен не совпадает'})
        }
    }
})
// ...Добавление ошибочного вопроса в список ошибок

//Добавление и удаление вопроса из избранного
app.patch('/user/redactstar/:id', async (req, res)=>{

    const accessTokenFont = req.headers['authorization'];
    const cookies = Object.assign({}, req.cookies);
    const refreshTokenFront = cookies.PDD_refreshToken
    //
    const user = await db.collection('pdd_collection').findOne({_id: new ObjectId (req.params.id)})

    if(!user) return res.status(400).json({message: 'Пользователь не найден'})

    async function updateBD(){
        let arr = await db
            .collection('pdd_collection')
            .findOne({_id: new ObjectId (req.params.id)})

        if (arr.starQuestions.includes(req.body.id)){
            let res = arr.starQuestions.reduce((res,item)=>{
                if(item !== req.body.id) res.push(item)
                return res
            },[])
            await db
                .collection('pdd_collection')
                .updateOne({_id: new ObjectId (req.params.id)}, {$set: {starQuestions: res}} )
        } else {
            await db
                .collection('pdd_collection')
                .updateOne({_id: new ObjectId (req.params.id)}, {$push: {starQuestions: req.body.id}} )
        }
    }
    //
    if(verifyJWT(accessTokenFont, process.env.VERY_VERY_SECRET_FOR_ACCESS, 'AccessT')){
        await updateBD()

    } else {

        if(verifyJWT(refreshTokenFront, process.env.VERY_VERY_SECRET_FOR_REFRESH, 'RefreshToken')){

            await updateBD()

            const accessToken = generateAccessToken(user._id, user.name);
            const refreshToken = generateRefreshToken(user._id, user.name);

            await db.collection('pdd_collection').updateOne({_id: new ObjectId (req.params.id)},
                { $set: { accessToken: accessToken, refreshToken: refreshToken } }
            )

            res.cookie('PDD_refreshToken', refreshToken, { //ставим на фронт refreshToken
                maxAge: 86400000, // Время жизни cookie в миллисекундах (24 часа)
                httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
                secure: true, // Cookie будут отправляться только по HTTPS
                sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
            })

            return res.json({accessToken:accessToken})
        } else {

            res.cookie('PDD_refreshToken', '', { //ставим на фронт refreshToken
                maxAge: -1, // Время жизни cookie в миллисекундах (60 минут)
                httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
                secure: true, // Cookie будут отправляться только по HTTPS
                sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
            })
            return res.status(400).json({ message : 'Токен не совпадает'})
        }
    }
})
//...добавление и удаление вопроса из избранного

//Окраска кнопки правильного или неправильного решенного билета...
app.patch('/user/tickets/:id', async (req, res)=>{

    // const accessTokenFont = req.headers['authorization'];
    // const cookies = Object.assign({}, req.cookies);
    // const refreshTokenFront = cookies.PDD_refreshToken
    // //
    const user = await db.collection('pdd_collection').findOne({_id: new ObjectId (req.params.id)})
    //
    if(!user) return res.status(400).json({message: 'Пользователь не найден'})
    //
    //
    console.log(user)

    async function updateBD(){

            await db
                .collection('pdd_collection')
                .updateOne({_id: new ObjectId (req.params.id)}, {$set: {examTiketsStatus: req.body}} )

    }
    // //
    // if(verifyJWT(accessTokenFont, process.env.VERY_VERY_SECRET_FOR_ACCESS, 'AccessT')){

        await updateBD()
    //
    // } else {
    //
    //     if(verifyJWT(refreshTokenFront, process.env.VERY_VERY_SECRET_FOR_REFRESH, 'RefreshToken')){
    //
    //         await updateBD()
    //
    //         const accessToken = generateAccessToken(user._id, user.name);
    //         const refreshToken = generateRefreshToken(user._id, user.name);
    //
    //         await db.collection('pdd_collection').updateOne({_id: new ObjectId (req.params.id)},
    //             { $set: { accessToken: accessToken, refreshToken: refreshToken } }
    //         )
    //
    //         res.cookie('PDD_refreshToken', refreshToken, { //ставим на фронт refreshToken
    //             maxAge: 86400000, // Время жизни cookie в миллисекундах (24 часа)
    //             httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
    //             secure: true, // Cookie будут отправляться только по HTTPS
    //             sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
    //         })
    //
    //         return res.json({accessToken:accessToken})
    //     } else {
    //
    //         res.cookie('PDD_refreshToken', '', { //ставим на фронт refreshToken
    //             maxAge: -1, // Время жизни cookie в миллисекундах (60 минут)
    //             httpOnly: true, // Cookie доступны только на сервере (не через JavaScript на фронтенде)
    //             secure: true, // Cookie будут отправляться только по HTTPS
    //             sameSite: 'strict' // Ограничивает отправку cookie только для запросов с того же сайта
    //         })
    //         return res.status(400).json({ message : 'Токен не совпадает'})
    //     }
    // }
})
//...окраска кнопки правильного или неправильного решенного билета