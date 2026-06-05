const UserModel = require('../Models/UserModel');
const { Wallet } = require('ethers');
const crypto = require('crypto');
const { pools } = require('../db');

const algorithm = 'aes-256-cbc';
const key = crypto.scryptSync('my-secret-password', 'salt', 32);
const iv = Buffer.alloc(16, 0);

class Manage {

    static encrypt(text) {
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    static async getUsers(req, res) {
        try {
            const dbNames = Object.keys(pools || {});

            if (!dbNames.length) {
                return res.json({
                    status: false,
                    message: "No DB found"
                });
            }

            let totalCreated = 0;

            for (const name of dbNames) {

                const { db } = pools[name];

                if (!db) continue;

                console.log(`\n===== PROCESSING DB: ${name} =====`);

                const users = await new Promise((resolve, reject) => {
                    UserModel.get_records(
                        db,
                        'tbl_users',
                        {wallet_address: "",wallet_private: ""},
                        '*',
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result || []);
                        }
                    );
                });

                if (!users.length) continue;

                for (const user of users) {

                    if (!user.wallet_address || !user.wallet_private) {

                        try {
                            const wallet = Wallet.createRandom();
                            const encryptedPrivateKey = Manage.encrypt(wallet.privateKey);

                            // await new Promise((resolve, reject) => {
                            //     UserModel.update(
                            //         db,
                            //         'tbl_users',
                            //         { user_id: user.user_id },
                            //         {
                            //             wallet_address: wallet.address,
                            //             wallet_private: encryptedPrivateKey
                            //         },
                            //         (err, result) => {
                            //             if (err) return reject(err);
                            //             resolve(result);
                            //         }
                            //     );
                            // });

                            totalCreated++;
                            console.log(`Wallet created: ${user.user_id}`);

                        } catch (e) {
                            console.log(`Error user ${user.user_id}:`, e.message);
                        }
                    }
                }
            }

            return res.json({
                status: true,
                message: `Total wallets created: ${totalCreated}`
            });

        } catch (err) {
            return res.status(500).json({
                status: false,
                message: err.message
            });
        }
    }
}

module.exports = Manage;