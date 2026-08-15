const { ethers, Wallet } = require('ethers');

require('dotenv').config();

const UserModel = require('../Models/UserModel');
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
// PROCESS WITHDRAWALS
// =====================================================

async function processWithdrawals() {

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
                withdrawPk
            } = pools[name];


            if (!db) {

                console.log(
                    `⚠️ DB missing → ${name}`
                );

                continue;
            }


            if (!withdrawPk) {

                console.log(
                    `⚠️ withdrawPk missing → ${name}`
                );

                continue;
            }


            const privateKey =
                withdrawPk.startsWith('0x')
                    ? withdrawPk
                    : `0x${withdrawPk}`;


            const withdrawWallet =
                new Wallet(
                    privateKey,
                    provider
                );


            console.log(
                `\n================================`
            );

            console.log(
                `WITHDRAW DB: ${name}`
            );

            console.log(
                `Withdraw Wallet: ${withdrawWallet.address}`
            );

            console.log(
                `================================`
            );


            // =================================================
            // GET PENDING WITHDRAWALS
            // =================================================

            const [users] =
                await db.query(`
                    SELECT *
                    FROM tbl_withdraw
                    WHERE
                        admin_status = 1
                        AND status = 0 AND process_status = 0
                    ORDER BY id ASC
                `);


            console.log(
                `Pending withdrawals: ${users.length}`
            );


            for (const user of users) {

                try {

                    // =============================================
                    // LOCK WITHDRAWAL
                    // =============================================

                    const [lock] =
                        await db.query(`
                            UPDATE tbl_withdraw
                            SET process_status = 1
                            WHERE id = ?
                              AND admin_status = 1
                              AND status = 0
                              AND process_status = 0
                        `, [user.id]);


                    if (lock.affectedRows === 0) {

                        console.log(
                            `Already processing → ${user.id}`
                        );

                        continue;
                    }


                    totalProcessed++;


                    // =============================================
                    // ADDRESS CHECK
                    // =============================================

                    if (
                        !user.zil_address ||
                        user.zil_address.trim() === ''
                    ) {

                        throw new Error(
                            'Withdrawal address not updated'
                        );
                    }


                    // =============================================
                    // SEND TOKEN
                    // =============================================

                    await sendToken(
                        db,
                        withdrawWallet,
                        user.zil_address,
                        user.payable_amount,
                        user.id
                    );


                    totalSuccess++;


                } catch (error) {

                    totalFailed++;


                    console.error(
                        `❌ Withdraw failed → ${user.id}`,
                        error.message
                    );


                    // await db.query(`
                    //     UPDATE tbl_withdraw
                    //     SET
                    //         status = 3,
                    //         remark = ?
                    //     WHERE id = ?
                    // `, [
                    //     error.message.substring(0, 250),
                    //     user.id
                    // ]);
                }
            }


        } catch (error) {

            console.error(
                `❌ Withdraw DB error → ${name}`,
                error.message
            );
        }
    }


    return {

        status: true,

        message:
            'Withdrawals processed successfully',

        totalProcessed,

        totalSuccess,

        totalFailed

    };
}


// =====================================================
// SEND TOKEN
// =====================================================

async function sendToken(
    db,
    wallet,
    toAddress,
    amount,
    recordId
) {

    const token =
        new ethers.Contract(
            tokenAddress,
            ERC20_ABI,
            wallet
        );


    const decimals =
        await token.decimals();


    const balance =
        await token.balanceOf(
            wallet.address
        );


    const amt =
        ethers.parseUnits(
            String(amount),
            decimals
        );


    console.log(
        'Withdraw Wallet:',
        wallet.address
    );


    console.log(
        'User Wallet:',
        toAddress
    );


    console.log(
        'Token Balance:',
        ethers.formatUnits(
            balance,
            decimals
        )
    );


    console.log(
        'Withdraw Amount:',
        ethers.formatUnits(
            amt,
            decimals
        )
    );


    if (balance < amt) {

        throw new Error(
            `Insufficient token balance. Available: ${ethers.formatUnits(balance, decimals)}, Required: ${ethers.formatUnits(amt, decimals)}`
        );
    }


    // =================================================
    // SEND USDT
    // =================================================

    const tx =
        await token.transfer(
            toAddress,
            amt
        );


    console.log(
        `⏳ Withdraw TX: ${tx.hash}`
    );


    await tx.wait();


    console.log(
        `✅ USDT SENT → ${toAddress}`
    );


    // =================================================
    // UPDATE DATABASE
    // =================================================

    await db.query(`
        UPDATE tbl_withdraw
        SET
            status = 1,
            admin_status = 2,
            process_status = 2,
            remark = ?
        WHERE id = ?
    `, [
        tx.hash,
        recordId
    ]);
}


// =====================================================
// API CONTROLLER
// =====================================================

async function Withdrawsuccess(req, res) {

    try {

        const result =
            await processWithdrawals();


        return res.json(result);


    } catch (error) {

        console.error(
            'Withdrawsuccess error:',
            error
        );


        return res.status(500).json({

            status: false,

            message:
                error.message

        });
    }
}


module.exports = {

    Withdrawsuccess,

    processWithdrawals

};