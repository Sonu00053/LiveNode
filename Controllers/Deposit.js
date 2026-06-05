const { ethers, Wallet } = require('ethers');
require('dotenv').config();

const UserModel = require('../Models/UserModel');
const Manage = require('../Controllers/Manage');
const { pools } = require('../db');

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const tokenAddress = process.env.TOKEN_ADDRESS;

const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

// ================= MAIN CONTROLLER =================
async function depositSuccess(req, res) {
    try {

        const dbNames = Object.keys(pools);

        if (!dbNames.length) {
            return res.status(500).json({
                status: false,
                message: "No DB configured in pools"
            });
        }

        for (const name of dbNames) {

            const { db, gas_pk } = pools[name];

            if (!db || !gas_pk) continue;
            const gasWallet = new Wallet(
                gas_pk.startsWith('0x') ? gas_pk : `0x${gas_pk}`,
                provider
            );

            console.log(`\n===== PROCESSING DB: ${name} =====`);

            // ================= FETCH USERS =================
            const users = await new Promise((resolve, reject) => {
                UserModel.get_records(
                    db,
                    'tbl_block_address',
                    { gas_deposit_status: 0, transfer_status: 0 },
                    '*',
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result || []);
                    }
                );
            });

            if (!users.length) {
                console.log('No users found');
                continue;
            }

            for (const user of users) {

                // ================= GET USER PRIVATE KEY =================
                const userPk = await new Promise((resolve, reject) => {
                    UserModel.get_single_record(
                        db,
                        'tbl_users',
                        { user_id: user.user_id },
                        'wallet_private',
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                });

                if (!userPk) continue;
                const privateKey = Manage.decrypt(userPk.wallet_private);
                if (!privateKey) continue;

                const userWallet = new Wallet(privateKey, provider);
                console.log(`User Wallet: ${userWallet.address}`);

                // ================= GAS CHECK =================
                if (user.gas_deposit_status == 0) {
                    await ensureGasForAddress(
                        db,
                        userWallet,
                        user,
                        gasWallet
                    );
                }
            }
        }

        return res.json({
            status: true,
            message: "All Deposit processed successfully"
        });

    } catch (err) {
        return res.status(500).json({
            status: false,
            message: err.message
        });
    }
}

// ================= GAS HANDLER =================
async function ensureGasForAddress(db, userWallet, user, gasWallet) {

    const balance = await provider.getBalance(userWallet.address);
    const feeData = await provider.getFeeData();

    const requiredGas = await getGasFeeForUSDT(
        user.value,
        tokenAddress,
        userWallet.address,
        gasWallet.address
    );

    console.log("Current Balance:", ethers.formatEther(balance));
    console.log("Required Gas:", ethers.formatEther(requiredGas));

    if (balance < requiredGas) {

        const shortage = requiredGas - balance;

        const tx = await gasWallet.sendTransaction({
            to: userWallet.address,
            value: shortage,
            gasLimit: 21000n,
            gasPrice: feeData.gasPrice
        });

        await tx.wait();

        console.log("⛽ GAS SENT →", userWallet.address);

        await new Promise((resolve, reject) => {
            UserModel.update(
                db,
                'tbl_block_address',
                { id: user.id },
                {
                    gas_deposit_status: 1,
                    gas_deposit_hash: tx.hash
                },
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });
    } else {
        var HashMsg = "Gas Already Available";
        await new Promise((resolve, reject) => {
            UserModel.update(
                db,
                'tbl_block_address',
                { id: user.id },
                {
                    gas_deposit_status: 1,
                    gas_deposit_hash: HashMsg
                },
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });
    }

    const userPk = await new Promise((resolve, reject) => {
        UserModel.get_single_record(
            db,
            'tbl_block_address',
            { id: user.id },
            'gas_deposit_status',
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
    });

    // ================= TOKEN TRANSFER =================
    if (userPk.gas_deposit_status == 1 && userPk.transfer_status == 0) {
        await sendToken(
            db,
            userWallet,
            user.value,
            user.id
        );
    } else {
        console.log("Already Deposit this record", user.id);
    }
}

// ================= GAS ESTIMATION =================
async function getGasFeeForUSDT(amountToken, tokenAddress, from, to) {

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    const decimals = await token.decimals();
    const amount = ethers.parseUnits(String(amountToken), decimals);

    const tx = await token.transfer.populateTransaction(to, amount);
    tx.from = from;

    try {
        const gasLimit = await provider.estimateGas(tx);
        const gasPrice = (await provider.getFeeData()).gasPrice;

        return (gasLimit * gasPrice * 120n) / 100n;

    } catch (e) {
        const gasPrice = (await provider.getFeeData()).gasPrice;
        return 60000n * gasPrice;
    }
}

// ================= TOKEN TRANSFER =================
async function sendToken(db, userWallet, amount, recordId) {

    const token = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        userWallet
    );

    const decimals = await token.decimals();

    const balance = await token.balanceOf(userWallet.address);
    const amt = ethers.parseUnits(String(amount), decimals);

    console.log("Token Balance:", ethers.formatUnits(balance, decimals));
    console.log("Send Amount:", ethers.formatUnits(amt, decimals));

    if (balance < amt) {
        throw new Error("Insufficient token balance");
    }

    const tx = await token.transfer(userWallet.address, amt);
    await tx.wait();

    console.log("✅ TOKEN SENT →", userWallet.address);

    await new Promise((resolve, reject) => {
        UserModel.update(
            db,
            'tbl_block_address',
            { id: recordId },
            {
                transfer_status: 1,
                transaction_hash: tx.hash
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
    });
}

// ================= EXPORT =================
module.exports = {
    depositSuccess
};