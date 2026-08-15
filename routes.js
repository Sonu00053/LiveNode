const express = require('express');
const router = express.Router();

const Manage = require('./Controllers/Manage');
const Deposit = require('./Controllers/Deposit');
const Withdraw = require('./Controllers/Withdraw');
const BlockTransaction = require('./Controllers/BlockTransaction');


router.get('/users', Manage.getUsers);
router.get('/deposit', Deposit.depositSuccess);
router.get('/withdraw', Withdraw.Withdrawsuccess);
router.get(
    '/block-transactions',
    BlockTransaction.getTransactions
);
// router.post('/update-wallet', Manage.updateWallet);


module.exports = router;