'use strict';
var mysql = require('mysql'),
    app = require('http').createServer(handleRequest),
    fs = require('fs');
var io = require('socket.io').listen(app);

var pageContent = fs.readFileSync('buttonTemplate.html',"utf8");

var connection = mysql.createConnection({
    user: "Pagels",
    password: "373pagel093",
    host: '50.83.244.38',
    port: 1338,
    database: "Pagels"
});

app.listen(3000, function () {
    console.log('Listening on port 3000.');
});

function handleRequest(request, response){
    function fetchButtons(callback){
        var returnedVal;
        var theButtons = '';
        returnedVal = connection.query('SELECT html FROM buttons');
        returnedVal.on('error', function(err){
            console.log('error:', err);
        });

        returnedVal.on('result', function(result){
            theButtons += result.html + '\n';
        });

        returnedVal.on('end', function(result){
            //connection.end();
            callback(theButtons);
        });
    }

    fetchButtons(function(contents){
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.write(pageContent.replace('DBBUTTONS', contents));
        response.end();
    });
}

io.sockets.on('connection', function (socket){

    console.log('connected');
    update(socket);

    socket.on('clicked', function(id){

        console.log('CLICK', id);
        connection.query('IF EXISTS(SELECT * FROM register WHERE itemID=(SELECT buttonID FROM buttons WHERE buttonIndex=' + id + ')' +
                            'UPDATE register SET amount=amount + 1 WHERE itemID=(SELECT buttonID FROM buttons WHERE buttonIndex=' + id + ')' +
                         'ELSE' +
                             'INSERT INTO register (itemID, label, price, amount, time_stamp) VALUES ((SELECT buttonID FROM buttons WHERE buttonIndex=' + id + '), (SELECT label FROM buttons WHERE buttonIndex=' + id + '), (SELECT price FROM inventory WHERE id=(SELECT buttonID FROM buttons WHERE buttonIndex=' + id + ')), 1, CURRENT_TIMESTAMP)');
        //connection.query('INSERT INTO register (itemID, label, price, amount, time_stamp) VALUES ((SELECT buttonID FROM buttons WHERE buttonIndex=' + id + '), (SELECT label FROM buttons WHERE buttonIndex=' + id + '), (SELECT price FROM inventory WHERE id=(SELECT buttonID FROM buttons WHERE buttonIndex=' + id + ')), 1, CURRENT_TIMESTAMP)');
        update(socket);
    });

    socket.on('remItem', function (value) {
        console.log(value);
        connection.query('DELETE FROM register WHERE register.id=' + value);
    });

    socket.on('completeTransaction', function(employeeID, paymentType){
        var transID;
        var idQuery = connection.query('SELECT MAX(id) AS tId FROM transactions WHERE employeeId=' + employeeID);

        idQuery.on('error', function(err){
            console.log('error:', err);
        });

        idQuery.on('result', function(result){
            console.log('in result' + result.tId);
            transID=result.tId;
            console.log('in complete' + transID);
            connection.query('UPDATE transactions SET endTime=CURRENT_TIMESTAMP WHERE id =' + transID);
            connection.query('INSERT INTO transactionItems (transactionId, itemId, price, quantity, type) SELECT '  + transID + ', itemID, register.price, amount, "item" FROM register');
            connection.query('INSERT INTO paymentItems (type, transactionId) VALUES (' + transID + ', ' + paymentType + ')')
        });

        idQuery.on('end', function(result){
            socket.emit('voidList');
        });


    });

    socket.on('beginTransaction', function(type, tillID, employeeID, customerID){
        console.log(type);
        connection.query('INSERT INTO transactions(type, startTime, tillId, employeeId, customerId) values ("' + type + '", CURRENT_TIMESTAMP, ' + tillID + ', ' + employeeID + ', ' + customerID + ')');
    })

    socket.on('updatePrice', function (){
        update(socket);
    });
});

function update (socket){
    var retLabels = new Array();
    var retVals = new Array();
    var totalPrice = 0.00;
    var label = connection.query('SELECT id, label, price FROM register');

    label.on('error', function(err){
        console.log('error:', err);
    });

    label.on('result', function(result){
        retLabels.push(result.label);
        retVals.push(result.id);
        totalPrice += parseFloat(result.price);
    });

    label.on('end', function(result){
        socket.emit('updateMulti', retLabels, retVals, totalPrice);
        //callback();
    });
}


