var express = require('express');
var http = require('http');
var jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');
var mysql = require('mysql');
const router = express.Router();

const privateKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Im9zY2FyIiwiaWF0IjoxNTE2MDY4OTI4LCJleHAiOjE1MTYxNTUzMjh9.zucLW085AiZ8VWojwNFFcMz0yv1H4RbeCMQy7lVjS7s'

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: 'events'
});

var app = express()
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({ limit: '10mb' }))

let validateAuth = function (req, res, next) {
    var token = req.headers['authorization']
    if (!token) return res.status(401).send("Access denied. No token provided.");
    try {
        token = token.replace('Bearer ', '');
        jwt.verify(token, privateKey, function (err, user) {
            if (err) {
                res.status(401).send({
                    error: 'Invalid token'
                });
            } else {
                req.user = user;
                next();
            }
        })
    } catch (ex) {
        res.status(400).send("Invalid token.");
    }
};

app.get('/', (req, res) => {
    res.status(200).send('Ok')
});

router.get("/categories", validateAuth, async (req, res) => {
    const sql = 'SELECT eventCategoryId, description FROM EventCategories';
    execQuery(sql, res);
});

router.get("/types", validateAuth, async (req, res) => {
    const sql = 'SELECT eventTypeId, description FROM EVENTTYPES';
    execQuery(sql, res);
});

router.get("/users", async (req, res) => {
    const sql = 'SELECT userId, email, password, dateCreated FROM Users';
    execQuery(sql, res);
});

router.post("/users", async (req, res) => {
    const sql = 'INSERT INTO Users (email, password) VALUES (?, ?)';
    execQuery(sql, res,
        [
            req.body.username,
            req.body.password
        ]);
});

router.post("/login", async (req, res) => {
	console.log(req.body);
    const sql = 'SELECT userId, email AS username FROM Users WHERE email = ? AND password = ?';
    try {
        con.connect(function (err) {
            con.query(sql, [req.body.username, req.body.password], function (err, result) {
                if (!result) {
                    res.status(400).send({ error: 'Usuario o contraseña inválidos.' });
                    return;
                }
                var tokenData = {
                    userId: result.userId,
                    username: result.username
                };
                var token = jwt.sign(tokenData, privateKey, {
                    expiresIn: 60 * 60 * 24 // expires in 24 hours
                });
                res.send({ token });
            });
        });
    }
    catch (err) {
        con.end();
        res.status(500).send({ error: err });
    }
});

router.get("/users/:username", async (req, res) => {
    const sql = 'SELECT userId FROM Users WHERE email = ?';
    execQuery(sql, res,
        [
            req.params.username
        ]);
});

router.get("/events", validateAuth, async (req, res) => {
    const sql = `select e.name, 
                        e.place, 
                        e.address, 
                        e.startDate, 
                        e.finishDate, 
                        ec.description AS category, 
                        et.description AS type 
                FROM    Events e
                INNER JOIN eventCategories ec
                    ON  e.eventCategoryId = ec.eventCategoryId
                INNER JOIN eventTypes et
                    ON  e.eventTypeId = et.eventTypeId
                WHERE   e.UserCreaterId = ?`;
    execQuery(sql, res, [req.user.userId]);
});

router.post("/events", validateAuth, async (req, res) => {
    const sql = 'INSERT INTO Events (name, place, address, startDate, finishDate, eventCategoryId, eventTypeId) VALUES (?, ?, ?, ?, ?, ?, ?)';
    execQuery(sql, res,
        [
            req.params.name,
            req.params.place,
            req.params.address,
            req.params.startDate,
            req.params.finishDate,
            req.params.eventCategoryId,
            req.params.eventTypeId
        ]);
});

router.put("/events/:eventId", validateAuth, async (req, res) => {
    const sql = `UPDATE Events 
                    SET name = ?,
                        place = ?,
                        address = ?,
                        startDate = ?,
                        finishDate = ?,
                        eventCategoryId = ?,
                        eventTypeId = ?
                WHERE   eventId = ?`;
    execQuery(sql, res, [
        req.params.name,
        req.params.place,
        req.params.address,
        req.params.startDate,
        req.params.finishDate,
        req.params.eventCategoryId,
        req.params.eventTypeId,
        req.params.eventTypeId
    ]);
});

router.delete("/events/:eventId", validateAuth, async (req, res) => {
    const sql = 'DELETE FROM Events WHERE eventId = ?';
    execQuery(sql, res, [req.params.eventTypeId]);
});

let allowCrossDomain = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', "*");
  res.header('Access-Control-Allow-Headers', "*");
  next();
}
app.use(allowCrossDomain);

app.use("/api", router);

http.createServer(app).listen(8001, () => {
    console.log('Server started at http://localhost:8001')
})

function execQuery(sql, res, params) {
    try {
        con.connect(function (err) {
            con.query(sql, params, function (err, result) {
                res.send(result);
            });
        });
    }
    catch (err) {
        con.end();
        res.status(500).send({ error: err });
    }
}