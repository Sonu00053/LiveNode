const { ethers, Wallet } = require('ethers');
require('dotenv').config();
const UserModel = require('../Models/UserModel');
const { pools } = require('../db');

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const tokenAddress = process.env.TOKEN_ADDRESS;
const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

// ================= MAIN =================
async function Withdrawsuccess(req, res) {
    try {
        const dbNames = Object.keys(pools);

        if (!dbNames.length) {
            return res.status(500).json({
                status: false,
                message: "No databases found"
            });
        }
        for (const name of dbNames) {
            const { db, withdrawPk } = pools[name];
            if (!withdrawPk) continue;
            const privateKey = withdrawPk.startsWith('0x')
                ? withdrawPk
                : `0x${withdrawPk}`;

            const wallet = new Wallet(privateKey, provider);
            console.log(`\n===== DB: ${name} =====`);

            // ================= GET USERS =================
            const users = await new Promise((resolve, reject) => {
                UserModel.get_records(
                    db,
                    'tbl_withdraw',
                    { admin_status: 1, status: 0 },
                    '*',
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result || []);
                    }
                );
            });

            if (!users.length) {
                console.log('No withdrawals');
                continue;
            }

            for (const user of users) {
                if (user.zil_address != "") {
                    await sendToken(
                        db,
                        wallet,
                        user.zil_address,
                        user.payable_amount,
                        18,
                        user.id
                    );
                }else{
                    console.log('Adress Not Updated');
                }
            }
        }

        return res.json({
            status: true,
            message: "Withdraw processed successfully"
        });

    } catch (err) {
        return res.status(500).json({
            status: false,
            message: err.message
        });
    }
}

// ================= SEND TOKEN =================
async function sendToken(db, wallet, toAddress, amount, decimals, recordId) {

    const token = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        wallet
    );

    const balance = await token.balanceOf(wallet.address);
    const amt = ethers.parseUnits(String(amount), decimals);
    console.log("Withdraw Wallet:", wallet.address);
    console.log("User Wallet:", toAddress);
    console.log("Balance:", ethers.formatUnits(balance, decimals));
    console.log("Amount:", ethers.formatUnits(amt, decimals));

    if (balance < amt) {
        throw new Error("Insufficient token balance");
    }

    const tx = await token.transfer(toAddress, amt);
    await tx.wait();

    console.log(`✅ SENT → ${toAddress} | TX: ${tx.hash}`);

    await new Promise((resolve, reject) => {
        UserModel.update(
            db,
            'tbl_withdraw',
            { id: recordId },
            {
                status: 1,
                admin_status: 2,
                remark: tx.hash
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
    });
}

module.exports = {
    Withdrawsuccess
};