const mysql = require('mysql2/promise');
require('dotenv').config();

let databases = {};

try {
    databases = JSON.parse(process.env.DATABASES || '{}');
} catch (err) {
    console.error("❌ Invalid DATABASES JSON:", err.message);
    databases = {};
}

if (!Object.keys(databases).length) {
    console.warn('⚠️ DATABASES is empty or missing');
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
                port: config.port || 3306,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
            });

            // test connection
            const conn = await pool.getConnection();
            await conn.ping();
            conn.release();

            pools[name] = {
                db: pool,
                gasPk: config.gasPk,
                withdrawPk: config.withdrawPk,
            };

            console.log(`✅ DB Connected → ${name}`);

        } catch (err) {
            console.error(`❌ DB Failed → ${name}:`, err.message);
        }
    }
}

// initialize immediately
initDB();

module.exports = { pools, initDB };