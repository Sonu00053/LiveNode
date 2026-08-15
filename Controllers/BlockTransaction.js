const { pools } = require('../db');

const MORALIS_API_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImEyOGNmZGI2LTdjMWMtNDA4NS1iNDZmLWUwZWUzY2QyMmFkNiIsIm9yZ0lkIjoiNDg3OTAwIiwidXNlcklkIjoiNTAxOTc5IiwidHlwZUlkIjoiZDgwODAwMzUtMWExNy00NThiLTlhNWEtY2Y0OGY0NTdkYWY2IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjcwMDM1NTAsImV4cCI6NDkyMjc2MzU1MH0.ToDiSQmjuw92qp7Up3ABDe-nbyJsKlhwRVj6w5f7AHc";

const USDT_CONTRACT =
    '0x55d398326f99059fF775485246999027B3197955';


class BlockTransaction {

    // =====================================================
    // GET MORALIS TRANSACTIONS
    // =====================================================

    static async fetchMoralis(address) {

        const url =
            `https://deep-index.moralis.io/api/v2.2/${address}` +
            `/erc20/transfers?chain=bsc&limit=100`;


        const response = await fetch(
            url,
            {
                method: 'GET',

                headers: {
                    'X-API-Key':
                        MORALIS_API_KEY,

                    'Accept':
                        'application/json'
                }
            }
        );


        if (!response.ok) {

            const error =
                await response.text();

            throw new Error(
                `Moralis ${response.status}: ${error}`
            );
        }


        return await response.json();
    }


    // =====================================================
    // SAVE TRANSACTION
    // =====================================================

    static async saveTransaction(
        db,
        userId,
        transaction
    ) {

        const hash =
            transaction.transaction_hash;


        if (!hash) {
            return false;
        }


        // Duplicate check

        const [exists] =
            await db.query(`
                SELECT id
                FROM tbl_block_address
                WHERE hash = ?
                LIMIT 1
            `, [
                hash
            ]);


        if (exists.length > 0) {
            return false;
        }


        // Timestamp

        let timestamp = 0;

        if (transaction.block_timestamp) {

            timestamp =
                Math.floor(
                    new Date(
                        transaction.block_timestamp
                    ).getTime() / 1000
                );
        }


        // Save

        await db.query(`
            INSERT INTO tbl_block_address
            (
                user_id,
                timeStamp,
                hash,
                blockHash,
                \`from\`,
                \`to\`,
                value,
                tokenName,
                tokenDecimal
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [

            userId,

            timestamp,

            transaction.transaction_hash,

            transaction.block_hash || '',

            transaction.from_address || '',

            transaction.to_address || '',

            transaction.value || '0',

            transaction.token_symbol || 'USDT',

            transaction.token_decimals || 18

        ]);


        return true;
    }


    // =====================================================
    // PROCESS ALL DATABASES
    // =====================================================

    static async processTransactions() {

        const dbNames =
            Object.keys(pools || {});


        let totalUsers = 0;
        let totalTransactions = 0;
        let totalSaved = 0;


        for (const dbName of dbNames) {

            try {

                const { db } =
                    pools[dbName];


                if (!db) {
                    continue;
                }


                console.log(
                    `\n===== DATABASE: ${dbName} =====`
                );


                // Get all wallet users

                const [users] =
                    await db.query(`
                        SELECT
                            user_id,
                            wallet_address
                        FROM tbl_users
                        WHERE
                            wallet_address IS NOT NULL
                            AND wallet_address != ''
                    `);


                totalUsers +=
                    users.length;


                for (const user of users) {

                    try {

                        console.log(
                            `Checking user ${user.user_id}`
                        );

                        console.log(
                            `Wallet: ${user.wallet_address}`
                        );


                        // ---------------------------------
                        // MORALIS
                        // ---------------------------------

                        const data =
                            await BlockTransaction
                                .fetchMoralis(
                                    user.wallet_address
                                );


                        console.log(
                            'Moralis response:',
                            data
                        );


                        const transfers =
                            data?.result || [];


                        totalTransactions +=
                            transfers.length;


                        // ---------------------------------
                        // SAVE ONLY USDT
                        // ---------------------------------

                        for (
                            const transaction
                            of transfers
                        ) {

                            /*
                             * Moralis returns all ERC20
                             * transfers of this wallet.
                             *
                             * We only save USDT.
                             */

                            if (
                                transaction.token_address &&
                                transaction.token_address
                                    .toLowerCase() !==
                                USDT_CONTRACT.toLowerCase()
                            ) {

                                continue;
                            }


                            const saved =
                                await BlockTransaction
                                    .saveTransaction(
                                        db,
                                        user.user_id,
                                        transaction
                                    );


                            if (saved) {

                                totalSaved++;

                                console.log(
                                    `✅ Saved → ${transaction.transaction_hash}`
                                );

                            }

                        }


                    } catch (error) {

                        console.error(
                            `❌ User ${user.user_id}:`,
                            error.message
                        );
                    }
                }


            } catch (error) {

                console.error(
                    `❌ DB ${dbName}:`,
                    error.message
                );
            }
        }


        return {

            status: true,

            totalDatabases:
                dbNames.length,

            totalUsers,

            totalTransactions,

            totalSaved

        };
    }


    // =====================================================
    // URL
    // =====================================================

    static async getTransactions(req, res) {

        try {

            const result =
                await BlockTransaction
                    .processTransactions();


            return res.json(
                result
            );


        } catch (error) {

            console.error(
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


module.exports = BlockTransaction;