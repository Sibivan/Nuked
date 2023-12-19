var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

const mysql = require('mysql');
const CONFIG = require('./config');

var querystring = require('querystring');

server.listen(3000);

app.get('/', function (request, response) {
    response.sendFile(__dirname + '/chat.html');
});

app.get('/game', function (request, response) {
    response.sendFile(__dirname + '/game.html');
});
app.get('/checkGameStatus', function (req, res) {
    // Получаем имя игрока из запроса
    const playerName = req.query.name;

    // Проверяем статус игры, например, наличие активного таймера
    const gameStarted = checkIfGameStarted(playerName); // Ваша функция проверки статуса игры

    // Отправляем статус игры обратно на клиент
    res.json({ gameStarted });
});

function exec(query, withResult = false) {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection(CONFIG);
        connection.connect();

        connection.query(query, function (error, result) {
            if (error) {
                reject(error);
            } else {
                if (withResult) {
                    console.log(result);
                    resolve(result);
                } else {
                    console.log("Query executed successfully");
                    resolve();
                }
            }
        });

        connection.end();
    });
}

function objToString(obj) {
    var str = '';
    for (var p in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, p)) {
            str += p + '::' + obj[p] + '\n';
        }
    }
    return str;
}

function extractIdFromQueryString(inputString) {
    const idMatch = inputString.match(/id=([^&]+)/);
    return idMatch ? idMatch[1] : null;
}

let del = "DELETE FROM player";
exec(del)
    .then(() => {
        console.log("DELETE query executed successfully");
    })
    .catch((error) => {
        console.error("Error executing DELETE query:", error);
    });

let autoinc = "ALTER TABLE player AUTO_INCREMENT = 1";
exec(autoinc)
    .then(() => {
        console.log("ALTER TABLE query executed successfully");
    })
    .catch((error) => {
        console.error("Error executing ALTER TABLE query:", error);
    });
let playerslist;
let gameTimer;
let isGameStarted = false;
io.sockets.on('connection', function (socket) {
    var playerName = socket.handshake.query.playerName;
    let str = querystring.stringify(socket);
    let str2 = extractIdFromQueryString(str);
    let query = "INSERT INTO player (name, idsocket) VALUES ('" + playerName + "','" + str2 + "') ";
    exec(query)
        .then(() => {
            console.log("INSERT query executed successfully");

            // Выполните exec(selectQuery, true) после успешного завершения exec(query)
            let selectQuery = "SELECT * FROM player";
            return exec(selectQuery, true);
        })
        .then((result) => {
            // Обработка результатов SELECT-запроса
            result.forEach(item => console.log(item.name));

            // Отправка данных на клиентскую сторону
            io.emit('update playerslist', result);
        })
        .catch((error) => {
            console.error("Error executing INSERT query:", error);
        });

    socket.on('disconnect', function (data) {
        let str3 = querystring.stringify(socket);
        let str4 = extractIdFromQueryString(str3);
        let query2 = "DELETE FROM player WHERE idsocket='" + str4 + "'";
        console.log(query2);
        exec(query2)
            .then(() => {
                console.log("DELETE query executed successfully");

                // Выполните exec(selectQuery, true) после успешного завершения exec(query)
                let selectQuery = "SELECT * FROM player";
                return exec(selectQuery, true);
            })
            .then((result) => {
                // Обработка результатов SELECT-запроса
                result.forEach(item => console.log(item.name));

                // Отправка данных на клиентскую сторону
                io.emit('update playerslist', result);
            })
            .catch((error) => {
                console.error("Error executing DELETE query:", error);
            });
    });
    socket.on('send mess', function (data) {
    var recipients = data.recipients || []; // Получаем массив idsocket-ов получателей сообщения
    if (recipients.length === 0 || recipients.includes('all')) {
        // Отправка всем
        io.sockets.emit('add mess', { mess: `<span>${data.name}:</span> ${data.mess}`, name: data.name });
    } else {
        // Отправка выбранным участникам
        recipients.forEach(recipientId => {
            const getNameQuery = `SELECT name FROM player WHERE idsocket='${recipientId}'`;

            exec(getNameQuery, true)
                .then((result) => {
                    const recipientName = result.length > 0 ? result[0].name : 'Неизвестный игрок';
                    io.to(recipientId).emit('add mess', { mess: `<span style="color: red;">${data.name} для ${recipientName}:</span> ${data.mess}`, name: data.name });
                    socket.emit('add mess', { mess: `<span style="color: red;">Вы для ${recipientName}:</span> ${data.mess}`, name: data.name });
                })
                .catch((error) => {
                    console.error("Error fetching recipient name:", error);
                });
        });
    }
});
    socket.on('start game', function() {
        isGameStarted = true;
        // Отправляем событие начала игры всем клиентам
        io.sockets.emit('game started');

        // Запускаем таймер игры
        startGameTimer();
    });
    socket.on('update player options', function(selectedOptions) {
        // Обрабатываем данные об игроках и выбранных чекбоксах
        selectedOptions.forEach(function (optionData) {
            console.log(optionData);
            var playerId = optionData.playerId;
            var option = optionData.option;
            console.log(playerId, option);
            // Выполняем соответствующий exec-запрос в базу данных
            if (option === 'reform') {
                console.log("UPDATE player SET refnum = refnum + 1 WHERE idsocket = '" + playerId + "'");
                exec("UPDATE player SET refnum = refnum + 1 WHERE idsocket = '" + playerId + "'");
            } else if (option === 'bomb') {
                console.log("UPDATE player SET bombnum = bombnum + 1 WHERE idsocket = '" + playerId + "'");
                exec("UPDATE player SET bombnum = bombnum + 1 WHERE idsocket = '" + playerId + "'");
            } else if (option === 'shield') {
                console.log("UPDATE player SET shieldnum = shieldnum + 1 WHERE idsocket = '" + playerId + "'");
                exec("UPDATE player SET shieldnum = shieldnum + 1 WHERE idsocket = '" + playerId + "'");
             } else if (option.length === 20) { // Новое условие
                console.log("UPDATE player SET bombnum = bombnum - 1 WHERE idsocket = '" + playerId + "'");
                exec("UPDATE player SET bombnum = bombnum - 1 WHERE idsocket = '" + playerId + "'");
                exec("UPDATE player SET shieldnum = shieldnum - 1 WHERE idsocket = '" + option + "'");
                
        }

        console.log("SELECT bombnum, refnum, shieldnum FROM player WHERE idsocket = '" + playerId + "'");
        setTimeout(() => {
        exec("SELECT bombnum, refnum, shieldnum FROM player WHERE idsocket = '" + playerId + "'", true)
            .then((result) => {
                // Отправляем данные на клиент
                console.log({ bombnum: result[0].bombnum, refnum: result[0].refnum, shieldnum: result[0].shieldnum });
                socket.emit('update player stats', { bombnum: result[0].bombnum, refnum: result[0].refnum, shieldnum: result[0].shieldnum });
            })
            .catch((error) => {
                console.error("Error executing SELECT query:", error);
            });
        }, 5000); // 5000 миллисекунд (5 секунд)
            });
    });
    socket.on('remove player', function(data) {
    var idsocketToRemove = data.idsocket;
    // Ваш код для удаления игрока с idsocketToRemove из общего списка на сервере
    console.log(idsocketToRemove);
    // Отправляем сигнал клиентам о необходимости удалить строку
    io.emit('remove player', { idsocket: idsocketToRemove });
});
    socket.on('stop game timer', function (data) {
    // Если таймер уже запущен, останавливаем его
    if (gameTimer) {
        clearInterval(gameTimer);
    }
    var idsocketwin = data.idsocket;
    exec("SELECT name FROM player WHERE idsocket = '" + idsocketwin + "'", true)
            .then((result) => {
                io.emit('player win', { name: result[0].name, id: idsocketwin });
            })
});
});
function checkIfGameStarted(playerName) {
    // Возвращаем значение флага isGameStarted
    return isGameStarted;
}
function startGameTimer() {
    // Если таймер уже запущен, останавливаем его
    if (gameTimer) {
        clearInterval(gameTimer);
    }

    // Запускаем таймер игры каждые 30 секунд
    gameTimer = setInterval(function() {
        // Добавляем событие, которое выполнится по истечении времени таймера
        io.sockets.emit('game timer finished');
        console.log("Событие: Игра завершена!");
    }, 420000);
}