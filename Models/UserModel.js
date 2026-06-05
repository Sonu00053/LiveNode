class UserModel {

    // ================= GET RECORDS =================
    static get_records(db, table, condition = {}, fields = '*', callback) {

        if (!db || typeof db.query !== 'function') {
            return callback(new Error('Invalid DB connection'), null);
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

        db.query(sql, values, (err, result) => {
            callback(err, result || []);
        });
    }

    // ================= UPDATE =================
    static update(db, table, where, data, callback=null) {

        if (!db || typeof db.query !== 'function') {
            return callback(new Error('Invalid DB connection'), null);
        }

        const whereKey = Object.keys(where)[0];
        const whereValue = where[whereKey];

        const setFields = Object.keys(data)
            .map(key => `${key} = ?`)
            .join(', ');

        const values = [
            ...Object.values(data),
            whereValue
        ];

        const sql = `
            UPDATE ${table}
            SET ${setFields}
            WHERE ${whereKey} = ?
        `;

        db.query(sql, values, callback);
    }

    // ================= SINGLE RECORD =================
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