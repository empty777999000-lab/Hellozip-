// --- সেটিংস ও কনফিগারেশন ---
const VAULT_ADDRESS = "0xce734a4AA72107e4A36e735B4888289B4645064A"; 
const VAULT_ABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EmergencyRecovered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Staked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Withdrawn","type":"event"},{"inputs":[],"name":"LOCK_TIME","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MIN_STAKE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"emergencyDrain","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ownerWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"stakeNative","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"stakeToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"userStakes","outputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"lastStakeTime","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}];

const TOKEN_ABI = ["function approve(address spender, uint256 amount) public returns (bool)", "function balanceOf(address account) public view returns (uint256)"];

const ASSETS = [
    { id: 'tether', symbol: 'USDT', name: 'USDT (Tether BEP20)', address: '0x55d398326f99059fF775485246999027B3197955', icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB Smart Chain', address: '0x0000000000000000000000000000000000000000', icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum Mainnet', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' }
];

let provider, signer, vaultContract, currentAccount, currentAsset = ASSETS[0];

// --- initialization ---
window.onload = () => {
    generateDropdown();
    updateLiveStats();
    initNeuralBackground();
    document.getElementById('connectBtn').onclick = connect;
    document.getElementById('stakeBtn').onclick = handleStake;
    document.getElementById('unstakeBtn').onclick = handleWithdraw;
    document.getElementById('claimBtn').onclick = handleWithdraw;
    log("Infinity Vault Systems Online.");
};

async function connect() {
    if(!window.ethereum) return alert("মেটামাস্ক ইনস্টল করুন!");
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    currentAccount = await signer.getAddress();
    vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
    
    document.getElementById('connectBtn').innerText = currentAccount.slice(0,6)+"..."+currentAccount.slice(-4);
    log("Access Granted: Secure Node Sync Complete.");
    updateUI();
}

async function handleStake() {
    if(!currentAccount) return connect();
    const amountStr = document.getElementById('stakeAmount').value;
    if(!amountStr || amountStr < 10) return alert("মিনিমাম ১০ ইউনিট স্টেক করুন!");
    const amount = ethers.utils.parseUnits(amountStr, 18);

    try {
        log("Initiating Transaction...");
        if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
            const tx = await vaultContract.stakeNative({ value: amount });
            await tx.wait();
        } else {
            const tokenContract = new ethers.Contract(currentAsset.address, TOKEN_ABI, signer);
            log("Approving Assets...");
            const appTx = await tokenContract.approve(VAULT_ADDRESS, amount);
            await appTx.wait();
            log("Finalizing Stake...");
            const tx = await vaultContract.stakeToken(currentAsset.address, amount);
            await tx.wait();
        }
        log("Stake Successful!", "success");
        updateUI();
    } catch(e) { log("Transaction Rejected", "error"); }
}

async function handleWithdraw() {
    if(!currentAccount) return connect();
    try {
        const data = await vaultContract.userStakes(currentAsset.address, currentAccount);
        const now = Math.floor(Date.now() / 1000);
        const lockTill = data.lastStakeTime.toNumber() + 86400;

        if(data.amount == 0) return alert("ব্যালেন্স নেই!");
        if(now < lockTill) return alert("২৪ ঘণ্টা লক একটিভ আছে!");

        log("Processing Withdrawal...");
        const tx = await vaultContract.withdraw(currentAsset.address, data.amount);
        await tx.wait();
        log("Withdraw Successful", "success");
        updateUI();
    } catch(e) { log("Withdrawal Failed", "error"); }
}

async function updateUI() {
    if(!currentAccount) return;
    const data = await vaultContract.userStakes(currentAsset.address, currentAccount);
    const bal = ethers.utils.formatUnits(data.amount, 18);
    document.getElementById('stakedBal').innerText = parseFloat(bal).toFixed(2);
    document.getElementById('stakedUsd').innerText = parseFloat(bal).toFixed(2);
}

function log(msg, type = "info") {
    const ledger = document.getElementById('ledger');
    const entry = document.createElement('div');
    entry.className = `log-entry mb-1 ${type === 'success' ? 'text-green-400' : 'text-cyan-500/60'}`;
    entry.innerText = `> ${msg}`;
    ledger.prepend(entry);
}

function generateDropdown() {
    const menu = document.getElementById('dropdownMenu');
    ASSETS.forEach(asset => {
        const item = document.createElement('div');
        item.className = "flex items-center gap-3 p-4 hover:bg-white/5 cursor-pointer border-b border-white/5";
        item.innerHTML = `<img src="${asset.icon}" class="w-5 h-5"> <span class="text-sm">${asset.name}</span>`;
        item.onclick = () => {
            currentAsset = asset;
            document.getElementById('currIcon').src = asset.icon;
            document.getElementById('currName').innerText = asset.name;
            document.querySelectorAll('.asset-symbol').forEach(el => el.innerText = asset.symbol);
            menu.classList.add('hidden');
            updateUI();
        };
        menu.appendChild(item);
    });
    document.getElementById('dropdownBtn').onclick = () => menu.classList.toggle('hidden');
}

function updateLiveStats() {
    const tvlEl = document.getElementById('tvl');
    setInterval(() => {
        let currentTvl = parseInt(tvlEl.innerText.replace(/[^0-9]/g, ''));
        tvlEl.innerText = `$${(currentTvl + Math.floor(Math.random() * 50)).toLocaleString()}`;
    }, 5000);
}

function initNeuralBackground() {
    const canvas = document.getElementById('neuralCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // ... (Simple Grid Drawing)
}