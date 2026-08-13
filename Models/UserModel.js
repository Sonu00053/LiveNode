// class UserModel {

//     // ================= GET RECORDS =================
//     static get_records(db, table, condition = {}, fields = '*', callback) {

//         if (!db || typeof db.query !== 'function') {
//             return callback(new Error('Invalid DB connection'), null);
//         }

//         let sql = `SELECT ${fields} FROM ${table}`;
//         let values = [];

//         if (condition && Object.keys(condition).length > 0) {

//             const whereClause = Object.keys(condition)
//                 .map(key => `${key} = ?`)
//                 .join(' AND ');

//             sql += ` WHERE ${whereClause}`;
//             values = Object.values(condition);
//         }

//         db.query(sql, values, (err, result) => {
//             callback(err, result || []);
//         });
//     }

//     // ================= UPDATE =================
//     static update(db, table, where, data, callback=null) {

//         if (!db || typeof db.query !== 'function') {
//             return callback(new Error('Invalid DB connection'), null);
//         }

//         const whereKey = Object.keys(where)[0];
//         const whereValue = where[whereKey];

//         const setFields = Object.keys(data)
//             .map(key => `${key} = ?`)
//             .join(', ');

//         const values = [
//             ...Object.values(data),
//             whereValue
//         ];

//         const sql = `
//             UPDATE ${table}
//             SET ${setFields}
//             WHERE ${whereKey} = ?
//         `;

//         db.query(sql, values, callback);
//     }

//     // ================= SINGLE RECORD =================
//     static get_single_record(db, table, condition = {}, fields = '*') {

//         return new Promise((resolve, reject) => {

//             if (!db || typeof db.query !== 'function') {
//                 return reject(new Error('Invalid DB connection'));
//             }

//             let sql = `SELECT ${fields} FROM ${table}`;
//             let values = [];

//             if (condition && Object.keys(condition).length > 0) {

//                 const whereClause = Object.keys(condition)
//                     .map(key => `${key} = ?`)
//                     .join(' AND ');

//                 sql += ` WHERE ${whereClause}`;
//                 values = Object.values(condition);
//             }

//             sql += ' LIMIT 1';

//             db.query(sql, values, (err, result) => {
//                 if (err) return reject(err);
//                 resolve(result && result[0] ? result[0] : null);
//             });
//         });
//     }
// }

// module.exports = UserModel;


// Models/UserModel.js

class UserModel {

    static async get_records(db, table, condition = {}, fields = '*') {

        if (!db || typeof db.query !== 'function') {
            throw new Error('Invalid DB connection');
        }

        let sql = `SELECT ${fields} FROM ${table}`;
        const values = [];

        if (condition && Object.keys(condition).length > 0) {

            const whereClause = Object.keys(condition)
                .map(key => `${key} = ?`)
                .join(' AND ');

            sql += ` WHERE ${whereClause}`;
            values.push(...Object.values(condition));
        }

        const [rows] = await db.query(sql, values);

        return rows || [];
    }


    static async update(db, table, condition = {}, data = {}) {

        if (!db || typeof db.query !== 'function') {
            throw new Error('Invalid DB connection');
        }

        const setKeys = Object.keys(data);

        if (!setKeys.length) {
            throw new Error('No data to update');
        }

        const whereKeys = Object.keys(condition);

        if (!whereKeys.length) {
            throw new Error('Update condition required');
        }

        const setClause = setKeys
            .map(key => `${key} = ?`)
            .join(', ');

        const whereClause = whereKeys
            .map(key => `${key} = ?`)
            .join(' AND ');

        const sql = `
            UPDATE ${table}
            SET ${setClause}
            WHERE ${whereClause}
        `;

        const values = [
            ...setKeys.map(key => data[key]),
            ...whereKeys.map(key => condition[key])
        ];

        const [result] = await db.query(sql, values);

        return result;
    }
    static get_single_record(db, table, condition = {}, fields = '*') {

        return new Promise((resolve, reject) => {

            if (!db || typeof db.query !== 'function') {
                return reject(new Error('Invalid DB connection'));
            }

            let sql = `SELECT ${fields} FROM ${table}`;
            let values = [];

            if (condition && Object.keys(condition).length > 0) {

                const whereClause = Object.keys(condition)
                    .map(key => `${key} = ?`)
                    .join(' AND ');

                sql += ` WHERE ${whereClause}`;
                values = Object.values(condition);
            }

            sql += ' LIMIT 1';

            db.query(sql, values, (err, result) => {
                if (err) return reject(err);
                resolve(result && result[0] ? result[0] : null);
            });
        });
    }
}


module.exports = UserModel;