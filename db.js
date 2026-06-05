// const mysql = require('mysql2');
// require('dotenv').config();
// const databases = JSON.parse(process.env.DATABASES || '{}');
// if (!Object.keys(databases).length) {
//     throw new Error('DATABASES missing in .env');
// }
// const pools = {};
// for (const [name, config] of Object.entries(databases)) {
//     pools[name] = {
//         db: mysql.createPool({
//             host: config.host,
//             user: config.user,
//             password: config.password,
//             database: config.database,
//             port: config.port
//         }),
//         gasPk: config.gasPk,
//         withdrawPk: config.Withdrawpk
//     };
//     console.log(`✅ Data Base Connectesd → ${name}`);

// }
// module.exports = { pools };

const mysql = require('mysql2/promise');
require('dotenv').config();

const databases = JSON.parse(process.env.DATABASES || '{}');

if (!Object.keys(databases).length) {
    throw new Error('DATABASES missing in .env');
}

const pools = {};

async function initDB() {
    for (const [name, config] of Object.entries(databases)) {
        try {
            const pool = mysql.createPool({
                host: config.host,
                user: config.user,
                password: config.password,
                database: config.database,
                port: config.port,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
            });

            // REAL CONNECTION TEST
            const conn = await pool.getConnection();
            await conn.ping();
            conn.release();

            pools[name] = {
                db: pool,
                gasPk: config.gasPk,
                withdrawPk: config.withdrawPk, // FIXED
            };

            console.log(`✅ Database Connected Successfully → ${name}`);

        } catch (err) {
            console.error(`❌ DB Connection Failed → ${name}`, err.message);
        }
    }
}

initDB();

module.exports = { pools };