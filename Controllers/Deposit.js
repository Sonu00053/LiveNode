const { ethers, Wallet } = require('ethers');
require('dotenv').config();

const UserModel = require('../Models/UserModel');
const Manage = require('./Manage');
const { pools } = require('../db');


const provider =
    new ethers.JsonRpcProvider(
        process.env.RPC_URL
    );


const tokenAddress =
    process.env.TOKEN_ADDRESS;


const ERC20_ABI = [

    "function decimals() view returns (uint8)",

    "function balanceOf(address) view returns (uint256)",

    "function transfer(address to, uint256 amount) returns (bool)"

];


// =====================================================
// PROCESS DEPOSITS
// =====================================================

async function processDeposits() {

    const dbNames =
        Object.keys(pools || {});


    if (!dbNames.length) {

        throw new Error(
            'No databases configured'
        );
    }


    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;


    for (const name of dbNames) {

        try {

            const {
                db,
                gasPk,
                reciever_wallet
            } = pools[name];


            if (!db) {

                console.log(
                    `⚠️ DB missing → ${name}`
                );

                continue;
            }


            if (!gasPk) {

                console.log(
                    `⚠️ gasPk missing → ${name}`
                );

                continue;
            }


            if (!reciever_wallet) {

                console.log(
                    `⚠️ reciever_wallet missing → ${name}`
                );

                continue;
            }


            const gasPrivateKey =
                gasPk.startsWith('0x')
                    ? gasPk
                    : `0x${gasPk}`;


            const gasWallet =
                new Wallet(
                    gasPrivateKey,
                    provider
                );


            console.log(
                `\n================================`
            );

            console.log(
                `DEPOSIT DB: ${name}`
            );

            console.log(
                `Gas Wallet: ${gasWallet.address}`
            );

            console.log(
                `Receiver: ${reciever_wallet}`
            );

            console.log(
                `================================`
            );


            const [users] =
                await db.query(`
                    SELECT *
                    FROM tbl_block_address
                    WHERE
                        gas_deposit_status = 0
                        AND transfer_status = 0
                    ORDER BY id ASC
                `);


            console.log(
                `Pending deposits: ${users.length}`
            );


            for (const user of users) {

                try {

                    // =========================================
                    // LOCK RECORD
                    // =========================================

                    // const [lock] =
                    //     await db.query(`
                    //         UPDATE tbl_block_address
                    //         SET gas_deposit_status = 2
                    //         WHERE id = ?
                    //           AND gas_deposit_status = 0
                    //           AND transfer_status = 0
                    //     `, [user.id]);


                    // if (lock.affectedRows === 0) {

                    //     console.log(
                    //         `Already processing → ${user.id}`
                    //     );

                    //     continue;
                    // }


                    totalProcessed++;


                    // =========================================
                    // USER PRIVATE KEY
                    // =========================================

                    const [userRows] =
                        await db.query(`
                            SELECT wallet_private
                            FROM tbl_users
                            WHERE user_id = ?
                            LIMIT 1
                        `, [user.user_id]);


                    if (!userRows.length) {

                        throw new Error(
                            'User wallet not found'
                        );
                    }


                    const encryptedPrivateKey =
                        userRows[0].wallet_private;


                    if (!encryptedPrivateKey) {

                        throw new Error(
                            'Wallet private key missing'
                        );
                    }


                    const privateKey =
                        Manage.decrypt(
                            encryptedPrivateKey
                        );


                    const userWallet =
                        new Wallet(
                            privateKey,
                            provider
                        );


                    console.log(
                        `User Wallet: ${userWallet.address}`
                    );


                    // =========================================
                    // GAS
                    // =========================================

                    await ensureGasForAddress(
                        db,
                        userWallet,
                        user,
                        gasWallet,
                        reciever_wallet
                    );


                    // =========================================
                    // CHECK STATUS
                    // =========================================

                    const [rows] =
                        await db.query(`
                            SELECT
                                gas_deposit_status,
                                transfer_status
                            FROM tbl_block_address
                            WHERE id = ?
                            LIMIT 1
                        `, [user.id]);


                    if (!rows.length) {

                        throw new Error(
                            'Deposit record not found'
                        );
                    }


                    const record =
                        rows[0];


                    // =========================================
                    // TOKEN TRANSFER
                    // =========================================

                    if (
                        Number(record.gas_deposit_status) === 1 &&
                        Number(record.transfer_status) === 0
                    ) {

                        await sendToken(
                            db,
                            userWallet,
                            user.value,
                            user.id,
                            reciever_wallet
                        );


                        totalSuccess++;


                    } else {

                        console.log(
                            `Transfer skipped → ${user.id}`
                        );
                    }


                } catch (error) {

                    totalFailed++;


                    console.error(
                        `❌ Deposit failed → ${user.id}`,
                        error.message
                    );


                    // await db.query(`
                    //     UPDATE tbl_block_address
                    //     SET transfer_status = 3
                    //     WHERE id = ?
                    // `, [user.id]);
                }
            }


        } catch (error) {

            console.error(
                `❌ Deposit DB error → ${name}`,
                error.message
            );
        }
    }


    return {

        status: true,

        message:
            'Deposits processed successfully',

        totalProcessed,

        totalSuccess,

        totalFailed

    };
}


// =====================================================
// GAS
// =====================================================

async function ensureGasForAddress(
    db,
    userWallet,
    user,
    gasWallet,
    receiver
) {

    const balance =
        await provider.getBalance(
            userWallet.address
        );


    const requiredGas =
        await getGasFeeForUSDT(
            user.value,
            userWallet.address,
            receiver
        );


    console.log(
        'BNB Balance:',
        ethers.formatEther(balance)
    );


    console.log(
        'Required BNB:',
        ethers.formatEther(requiredGas)
    );


    if (balance < requiredGas) {

        const shortage =
            requiredGas - balance;


        const feeData =
            await provider.getFeeData();


        if (!feeData.gasPrice) {

            throw new Error(
                'Gas price unavailable'
            );
        }


        const tx =
            await gasWallet.sendTransaction({

                to: userWallet.address,

                value: shortage,

                gasLimit: 21000n,

                gasPrice:
                    feeData.gasPrice

            });


        console.log(
            `⛽ Gas TX: ${tx.hash}`
        );


        await tx.wait();


        console.log(
            `✅ GAS SENT → ${userWallet.address}`
        );


        await db.query(`
            UPDATE tbl_block_address
            SET
                gas_deposit_status = 1,
                gas_deposit_hash = ?
            WHERE id = ?
        `, [
            tx.hash,
            user.id
        ]);


    } else {

        await db.query(`
            UPDATE tbl_block_address
            SET
                gas_deposit_status = 1,
                gas_deposit_hash = ?
            WHERE id = ?
        `, [
            'Gas Already Available',
            user.id
        ]);
    }
}


// =====================================================
// GAS ESTIMATION
// =====================================================

async function getGasFeeForUSDT(
    amountToken,
    from,
    to
) {

    const token =
        new ethers.Contract(
            tokenAddress,
            ERC20_ABI,
            provider
        );


    const decimals =
        await token.decimals();


    const amount =
        ethers.parseUnits(
            String(amountToken),
            decimals
        );


    const tx =
        await token.transfer.populateTransaction(
            to,
            amount
        );


    tx.from = from;


    try {

        const gasLimit =
            await provider.estimateGas(tx);


        const feeData =
            await provider.getFeeData();


        if (!feeData.gasPrice) {

            throw new Error(
                'Gas price unavailable'
            );
        }


        return (
            gasLimit *
            feeData.gasPrice *
            120n
        ) / 100n;


    } catch (error) {

        console.log(
            'Gas estimation fallback:',
            error.message
        );


        const feeData =
            await provider.getFeeData();


        if (!feeData.gasPrice) {

            throw new Error(
                'Gas price unavailable'
            );
        }


        return (
            60000n *
            feeData.gasPrice
        );
    }
}


// =====================================================
// TOKEN TRANSFER
// =====================================================

async function sendToken(
    db,
    userWallet,
    amount,
    recordId,
    receiver
) {

    const token =
        new ethers.Contract(
            tokenAddress,
            ERC20_ABI,
            userWallet
        );


    const decimals =
        await token.decimals();


    const balance =
        await token.balanceOf(
            userWallet.address
        );


    const amt =
        ethers.parseUnits(
            String(amount),
            decimals
        );


    console.log(
        'Token Balance:',
        ethers.formatUnits(
            balance,
            decimals
        )
    );


    console.log(
        'Transfer Amount:',
        ethers.formatUnits(
            amt,
            decimals
        )
    );


    if (balance < amt) {

        throw new Error(
            'Insufficient token balance'
        );
    }


    const tx =
        await token.transfer(
            receiver,
            amt
        );


    console.log(
        `⏳ Deposit TX: ${tx.hash}`
    );


    await tx.wait();


    console.log(
        `✅ USDT SENT → ${receiver}`
    );


    await db.query(`
        UPDATE tbl_block_address
        SET
            transfer_status = 1,
            transaction_hash = ?
        WHERE id = ?
    `, [
        tx.hash,
        recordId
    ]);
}


// =====================================================
// API CONTROLLER
// =====================================================

async function depositSuccess(req, res) {

    try {

        const result =
            await processDeposits();


        return res.json(result);


    } catch (error) {

        return res.status(500).json({

            status: false,

            message:
                error.message

        });
    }
}


module.exports = {

    depositSuccess,

    processDeposits

};