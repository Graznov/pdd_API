const express = require("express");
const { connectToDb, getDb } = require("./db");

const PORT = 3000;

const app = express();
// app.use(cors(corsOptions));
app.use(express.json());
// app.use(cookieParser());

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