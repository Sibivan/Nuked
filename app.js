const mysql			= require('mysql');
const syncMysql		=require('sync-mysql');
const CONFIG		= require('./config');
function t01() {
	const connection = mysql.createConnection(CONFIG);
	connection.connect();

	let query = "INSERT INTO player (name) VALUES ('blin') ";

	connection.query(query, function(error, result) {
		if (error) throw error;
		console.log(result);
		//result.forEach(item => console.log(item.name));
		//console.log(result[1]);
	});
	connection.end();
}
t01();

function t02() {
	const connection = new syncMysql(CONFIG);
	let query = "SELECT * FROM player WHERE name = 'Player2'";
	const result = connection.query(query);
	console.log(result);
}
t02();