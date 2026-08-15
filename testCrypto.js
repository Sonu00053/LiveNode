const { Wallet } = require('ethers');
const CryptoHelper = require('./Helper/CryptoHelper');

console.log('================================');
console.log('GENERATE + ENCRYPT PRIVATE KEY');
console.log('================================');

try {

    // Generate new wallet
    const wallet = Wallet.createRandom();

    const privateKey = wallet.privateKey;
    const address = wallet.address;

    // Encrypt private key
    const encryptedPrivateKey =
        CryptoHelper.encrypt(privateKey);

    // Decrypt to verify
    const decryptedPrivateKey =
        CryptoHelper.decrypt(encryptedPrivateKey);

    console.log('\nWallet Address:');
    console.log(address);

    console.log('\nPrivate Key:');
    console.log(privateKey);

    console.log('\nEncrypted Private Key:');
    console.log(encryptedPrivateKey);

    console.log('\nDecrypted Private Key:');
    console.log(decryptedPrivateKey);

    console.log('\n================================');

    if (privateKey === decryptedPrivateKey) {
        console.log('✅ ENCRYPT / DECRYPT SUCCESS');
    } else {
        console.log('❌ ENCRYPT / DECRYPT FAILED');
    }

    console.log('================================');

} catch (error) {

    console.error('❌ ERROR:', error.message);

}