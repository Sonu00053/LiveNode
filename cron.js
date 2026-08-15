const cron = require('node-cron');

const Manage = require('./Controllers/Manage');
const Deposit = require('./Controllers/Deposit');
const Withdraw = require('./Controllers/Withdraw');


// =====================================================
// CRON LOCK
// Prevent same cron from running twice simultaneously
// =====================================================

let cronRunning = false;


cron.schedule('* * * * * *', async () => {

    if (cronRunning) {

        console.log(
            '⏳ Previous cron still running, skipping...'
        );

        return;
    }


    cronRunning = true;


    console.log(
        '\n========================================'
    );

    console.log(
        'CRON START:',
        new Date().toLocaleString('en-IN')
    );

    console.log(
        '========================================'
    );


    // =================================================
    // MANAGE
    // =================================================

    try {

        const result =
            await Manage.processUsers();
        if (result) {
            console.log(
                '👤 Manage:',
                result
            );
        }

    } catch (error) {

        console.error(
            '❌ Manage cron error:',
            error.message
        );

    }


    // =================================================
    // DEPOSIT
    // =================================================

    try {

        const result =
            await Deposit.processDeposits();
        if (result) {
            console.log(
                '💰 Deposit:',
                result
            );
        }

    } catch (error) {

        console.error(
            '❌ Deposit cron error:',
            error.message
        );

    }


    // =================================================
    // WITHDRAW
    // =================================================

    try {

        const result =
            await Withdraw.processWithdrawals();
        if (result) {
            console.log(
                '💸 Withdraw:',
                result
            );
        }

    } catch (error) {

        console.error(
            '❌ Withdraw cron error:',
            error.message
        );

    }


    console.log(
        '========================================'
    );

    console.log(
        'CRON END:',
        new Date().toLocaleString('en-IN')
    );

    console.log(
        '========================================\n'
    );


    cronRunning = false;

});