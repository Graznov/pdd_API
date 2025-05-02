const express = require("express");
const cors = require('cors')
const { connectToDb, getDb } = require("./db");
const cookieParser = require("cookie-parser");

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

app.get("/pdd/", (req, res) => {

  let arr = []

  db
      .collection("pddcollection")
      .find()
      .forEach(e=>arr.push(e))
      .then((doc)=>{
          res
              .status(200)
              .json(arr)
        })
      .catch(()=> handleError(res, 'Something went wrong.'))

  console.log(arr)

})
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
                    errorQuestions:[]
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
