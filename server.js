const express = require("express");
const cors = require('cors')
const { connectToDb, getDb } = require("./db");
const cookieParser = require("cookie-parser");
const {generateAccessToken, generateRefreshToken, verifyJWT} = require("./generToken");
const {ObjectId} = require("mongodb");
const {delCookie, setCookie} = require("./setDelCookies");

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

const timeRefToken = 604800000 //Время жизни cookie в миллисекундах (7 суток)

//регистрация...
app.post('/user/register', (req, res) => {
  db
      .collection('pdd_collection')
      .findOne( { name:req.body.name } )
      .then(doc => {
        if(doc){

          console.log(1, `Имя ${req.body.name} занято`)
          return res
              .status(409)
              .json({message : 'имя занято'})

        } else {
          console.log(2, `Имя ${req.body.name} свободно`)

            const userData = {
                name: req.body.name,
                password: req.body.password,
                pathImg: '',
                refreshToken: '',
                accessToken: '',
                creatDat: new Date(),
                starQuestions: [],
                errorQuestions: [],
                examTiketsStatus: Array(40).fill({ color: 'none' })
            };

            db.collection('pdd_collection').insertOne(userData)

            return res.status(201).json({
                message:'The account was created',
            });

        }
      })
      .catch(err => {
          console.error('Ошибка регистрации:', err);
          res.status(500).json('Something went wrong.');
      });
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

        setCookie(res, refreshToken, timeRefToken)

        res.status(200).json(responseData);

    } catch (e) {
        console.error('Ошибка при входе:', e);
        res.status(500).json({ message: 'Ошибка сервера' });
    }

});
//...авторизация


//получение данных акка...
app.get('/user/:id', async (req, res) => {
    try {
        const accessToken = req.headers['authorization'];
        const cookies = Object.assign({}, req.cookies);
        const refreshToken = cookies.PDD_refreshToken;

        // console.log(`accessToken: ${accessToken}\nrefreshToken: ${refreshToken}`);

        const user = await db.collection('pdd_collection').findOne({ _id: new ObjectId(req.params.id) });
        if (!user) return res.status(400).json({ message: 'Пользователь не найден' });

        const responseUser = {
            name: user.name,
            accessToken: accessToken,
            id: user._id.toString(),
            starQuestions: user.starQuestions,
            errorQuestions: user.errorQuestions,
            examTiketsStatus: user.examTiketsStatus,
        };

        console.log(`userData-OK`);

        if (!accessToken) {
            return res.status(401).json({ message: 'Токен отсутствует' });
        }

        if (verifyJWT(accessToken, process.env.VERY_VERY_SECRET_FOR_ACCESS, 'AccessToken')) {
            return res.status(200).json(responseUser);
        } else {
            if (verifyJWT(refreshToken, process.env.VERY_VERY_SECRET_FOR_REFRESH, 'RefreshToken')) {
                // console.log(`refreshToken GOOD`);
                const newAccessToken = generateAccessToken(user._id, user.email);
                const newRefreshToken = generateRefreshToken(user._id, user.email);

                await db.collection('pdd_collection').updateOne(
                    { _id: new ObjectId(req.params.id) },
                    { $set: { accessToken: newAccessToken, refreshToken: newRefreshToken } }
                );

                setCookie(res, newRefreshToken, timeRefToken);
                responseUser.accessToken = newAccessToken;

                return res.status(200).json(responseUser);
            } else {
                return res.status(400).json({ message: 'Токен не совпадает' });
            }
        }
    } catch (error) {
        console.error('Ошибка при входе:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
//...получение данных акка

//удаление Cookie с фронта при выходе из аккаунта
app.post('/del-cookie', (req, res) => {
    delCookie(res)
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

        delCookie(res)
        db
            .collection('pdd_collection')
            .deleteOne({ _id: new ObjectId(req.params.id) })
            .then((result)=>{
                res
                    .status(200)
                    .json(result)
            })
    } else {
        delCookie(res)
        res.status(401).json(`result`)
    }
})
//...удаление аккаунта

//Добавление ошибочного вопроса в список ошибок
app.patch('/user/pusherror/:id', async (req, res)=>{

    const accessTokenFont = req.headers['authorization'];
    const cookies = Object.assign({}, req.cookies);
    const refreshTokenFront = cookies.PDD_refreshToken
    //
    const user = await db.collection('pdd_collection').findOne({_id: new ObjectId (req.params.id)})
    //
    console.log(`\n###########\nreq.body: ${JSON.stringify(req.body)}\nrefreshTokenFront: ${refreshTokenFront}\n#############\n`)

    if(!user) return res.status(400).json({message: 'Пользователь не найден'})

    async function updateBD(){



        if(req.body.correct){
            if(req.body.wind==='error'){


                await db
                    .collection('pdd_collection')
                    .updateOne(
                        { _id: new ObjectId(req.params.id) },
                        { $pull: { errorQuestions: req.body.id } }
                    )
                console.log('DELETE ERROR ARR')
                //удаление вопроса из списка ошибочных
            }
            console.log(`\n###########\nThe right answer\n#############\n`)
        } else {
            console.log(`\n###########\nThe wrong answer\n#############\n`)

            const arr = await db
                .collection('pdd_collection')
                .findOne({_id: new ObjectId (req.params.id)})

            console.log(`retry id: ${arr.errorQuestions.includes(req.body.id)}\nbody: ${JSON.stringify(req.body)}`)

            if(!arr.errorQuestions.includes(req.body.id)){
                await db
                    .collection('pdd_collection')
                    .updateOne({_id: new ObjectId (req.params.id)}, {$push: {errorQuestions: req.body.id}} )
            }
        }

    }
    //
    if(verifyJWT(accessTokenFont, process.env.VERY_VERY_SECRET_FOR_ACCESS, 'AccessT')){
        await updateBD()
        return res.status(204).json({ message : 'No Content!'})
    } else {
    //
        if(verifyJWT(refreshTokenFront, process.env.VERY_VERY_SECRET_FOR_REFRESH, 'RefreshToken')){

            await updateBD()

            const accessToken = generateAccessToken(user._id, user.name);
            const refreshToken = generateRefreshToken(user._id, user.name);

            await db.collection('pdd_collection').updateOne({_id: new ObjectId (req.params.id)},
                { $set: { accessToken: accessToken, refreshToken: refreshToken } }
            )

            setCookie(res, refreshToken, timeRefToken)

            return res.json({accessToken:accessToken})
        } else {
            delCookie(res)
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

    console.log(`\n###########\n/user/redactstar/:id\n-----------------------\nrefreshTokenFront: ${refreshTokenFront}\n#############\n`)
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
            console.log(`Answ id: ${req.body.id} DELETE in starQuestions`)
        } else {
            console.log(`Answ id: ${req.body.id} PUSH in starQuestions`)

            await db
                .collection('pdd_collection')
                .updateOne({_id: new ObjectId (req.params.id)}, {$push: {starQuestions: req.body.id}} )
        }
    }
    //
    if(verifyJWT(accessTokenFont, process.env.VERY_VERY_SECRET_FOR_ACCESS, 'AccessT')){
        await updateBD()
        // return res.status(204).json({ message : 'No Content!'})
        return res.status(204)

    } else {

        if(verifyJWT(refreshTokenFront, process.env.VERY_VERY_SECRET_FOR_REFRESH, 'RefreshToken')){

            await updateBD()

            const accessToken = generateAccessToken(user._id, user.name);
            const refreshToken = generateRefreshToken(user._id, user.name);

            await db.collection('pdd_collection').updateOne({_id: new ObjectId (req.params.id)},
                { $set: { accessToken: accessToken, refreshToken: refreshToken } }
            )

            setCookie(res, refreshToken, timeRefToken)

            return res.json({accessToken:accessToken})
        } else {
            delCookie(res)
            return res.status(400).json({ message : 'Токен не совпадает'})
        }
    }
})
//...добавление и удаление вопроса из избранного

// Окраска кнопки правильного или неправильного решенного билета...
app.patch('/user/settickets/:id', async (req, res)=>{

    const accessTokenFont = req.headers['authorization'];
    const cookies = Object.assign({}, req.cookies);
    const refreshTokenFront = cookies.PDD_refreshToken
    //
    const user = await db.collection('pdd_collection').findOne({_id: new ObjectId (req.params.id)})

    if(!user) return res.status(400).json({message: 'Пользователь не найден'})


    // console.log(user)

    async function updateBD(){

        console.log(`###########\n/user/settickets/:id\nbody: ${JSON.stringify(req.body)}\n###########\n`)

        await db
            .collection('pdd_collection')
            .updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { [`examTiketsStatus.${req.body.ticketNumber}.color`]: req.body.res } }
            )

        const arr = await db
            .collection('pdd_collection')
            .findOne({_id: new ObjectId (req.params.id)})

        console.log(arr.examTiketsStatus)

    }
    //
    if(verifyJWT(accessTokenFont, process.env.VERY_VERY_SECRET_FOR_ACCESS, 'AccessT')){

        updateBD()

    } else {

        if(verifyJWT(refreshTokenFront, process.env.VERY_VERY_SECRET_FOR_REFRESH, 'RefreshToken')){

            await updateBD()

            const accessToken = generateAccessToken(user._id, user.name);
            const refreshToken = generateRefreshToken(user._id, user.name);

            await db.collection('pdd_collection').updateOne({_id: new ObjectId (req.params.id)},
                { $set: { accessToken: accessToken, refreshToken: refreshToken } }
            )

            setCookie(res, refreshToken, timeRefToken)

            return res.json({accessToken:accessToken})
        } else {

            delCookie(res)
            return res.status(400).json({ message : 'Токен не совпадает'})
        }
    }
})
// ...окраска кнопки правильного или неправильного решенного билета