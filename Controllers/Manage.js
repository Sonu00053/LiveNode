const { Wallet } = require('ethers');
const crypto = require('crypto');
const { pools } = require('../db');
const UserModel = require('../Models/UserModel');
const CryptoHelper = require('../Helper/CryptoHelper');


const algorithm = 'aes-256-cbc';

const key = crypto.scryptSync(
    'my-secret-password',
    'salt',
    32
);

const iv = Buffer.alloc(16, 0);


class Manage {

    // =====================================================
    // ENCRYPT
    // =====================================================

   


    // =====================================================
    // PROCESS USERS
    // CRON FUNCTION
    // =====================================================

    static async processUsers() {

        const dbNames =
            Object.keys(pools || {});


        if (!dbNames.length) {

            return {
                status: false,
                message: 'No DB found',
                totalCreated: 0,
                usersProcessed: 0
            };
        }


        let totalCreated = 0;
        let totalUsers = 0;


        for (const name of dbNames) {

            try {

                const { db } =
                    pools[name];


                if (!db) {

                    console.log(
                        `⚠️ DB not found: ${name}`
                    );

                    continue;
                }


                console.log(
                    `\n===== MANAGE DB: ${name} =====`
                );


                const [users] =
                    await db.query(`
                        SELECT
                            user_id,
                            wallet_address,
                            wallet_private
                        FROM tbl_users
                        WHERE
                            wallet_address IS NULL
                            OR wallet_address = ''
                            OR wallet_private IS NULL
                            OR wallet_private = ''
                    `);


                console.log(
                    `Users without wallet: ${users.length}`
                );


                totalUsers += users.length;


                for (const user of users) {

                    try {

                        const wallet =
                            Wallet.createRandom();


                        const encryptedPrivateKey =
                            CryptoHelper.encrypt(
                                wallet.privateKey
                            );


                        const [result] =
                            await db.query(`
                                UPDATE tbl_users
                                SET
                                    wallet_address = ?,
                                    wallet_private = ?
                                WHERE user_id = ?
                                  AND (
                                    wallet_address IS NULL
                                    OR wallet_address = ''
                                    OR wallet_private IS NULL
                                    OR wallet_private = ''
                                  )
                            `, [
                                wallet.address,
                                encryptedPrivateKey,
                                user.user_id
                            ]);


                        if (result.affectedRows > 0) {

                            totalCreated++;


                            console.log(
                                `✅ Wallet created → ${user.user_id} → ${wallet.address}`
                            );

                        } else {

                            console.log(
                                `⚠️ Wallet update skipped → ${user.user_id}`
                            );
                        }


                    } catch (error) {

                        console.error(
                            `❌ User wallet error → ${user.user_id}`,
                            error.message
                        );
                    }
                }


            } catch (error) {

                console.error(
                    `❌ Manage DB error → ${name}`,
                    error.message
                );
            }
        }


        return {

            status: true,

            message:
                `Total wallets created: ${totalCreated}`,

            usersProcessed:
                totalUsers,

            totalCreated

        };
    }


    // =====================================================
    // EXPRESS API
    // =====================================================

    static async getUsers(req, res) {

        try {

            const result =
                await Manage.processUsers();


            return res.json(result);


        } catch (error) {

            console.error(
                'getUsers error:',
                error
            );


            return res.status(500).json({

                status: false,

                message:
                    error.message

            });
        }
    }
}


module.exports = Manage;