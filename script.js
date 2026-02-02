const VAULT_ADDRESS = "0xce734a4AA72107e4A36e735B4888289B4645064A"; 

const VAULT_ABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EmergencyRecovered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Staked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Withdrawn","type":"event"},{"inputs":[],"name":"LOCK_TIME","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MIN_STAKE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"emergencyDrain","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ownerWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"stakeNative","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"stakeToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"userStakes","outputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"lastStakeTime","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}];

const TOKEN_ABI = ["function approve(address spender, uint256 amount) public returns (bool)", "function balanceOf(address account) public view returns (uint256)"];

const ASSETS = [
    { id: 'tether', symbol: 'USDT', name: 'USDT (Tether BEP20)', address: '0x55d398326f99059fF775485246999027B3197955', icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB Smart Chain', address: '0x0000000000000000000000000000000000000000', icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' }
];

let provider, signer, vaultContract, currentAccount, currentAsset = ASSETS[0];

window.onload = () => {
    generateDropdown();
    initButtons();
};

async function connect() {
    if(!window.ethereum) return alert("মেটামাস্ক খুঁজে পাওয়া যায়নি!");
    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        currentAccount = await signer.getAddress();
        vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
        document.getElementById('connectBtn').innerText = currentAccount.slice(0,6)+"..."+currentAccount.slice(-4);
        updateUI();
    } catch (err) { console.log(err); }
}

async function handleStake() {
    if(!currentAccount) return connect();
    const amountStr = document.getElementById('stakeAmount').value;
    const amountNum = parseFloat(amountStr);

    if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
        if(!amountNum || amountNum < 0.01) return alert("মিনিমাম ০.০১ BNB স্টেক করুন!");
    } else {
        if(!amountNum || amountNum < 10) return alert("মিনিমাম ১০ USDT স্টেক করুন!");
    }
    
    const amount = ethers.utils.parseEther(amountStr);
    
    try {
        if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
            const tx = await vaultContract.stakeNative({ value: amount });
            await tx.wait();
        } else {
            const tokenContract = new ethers.Contract(currentAsset.address, TOKEN_ABI, signer);
            const appTx = await tokenContract.approve(VAULT_ADDRESS, amount);
            await appTx.wait();
            const tx = await vaultContract.stakeToken(currentAsset.address, amount);
            await tx.wait();
        }
        updateUI();
    } catch(e) { alert("Transaction Failed"); }
}

async function handleWithdraw() {
    if(!currentAccount) return connect();
    try {
        const data = await vaultContract.userStakes(currentAsset.address, currentAccount);
        const tx = await vaultContract.withdraw(currentAsset.address, data.amount);
        await tx.wait();
        updateUI();
    } catch(e) { alert("Withdrawal Failed"); }
}

function initButtons() {
    document.getElementById('connectBtn').onclick = connect;
    document.getElementById('stakeBtn').onclick = handleStake;
    document.getElementById('unstakeBtn').onclick = handleWithdraw;
    document.getElementById('claimBtn').onclick = handleWithdraw;

    document.querySelectorAll('.perc-btn').forEach(btn => {
        btn.onclick = async () => {
            if(!currentAccount) return connect();
            const portion = parseFloat(btn.getAttribute('data-p'));
            let balance = await getLiveBalance();
            document.getElementById('stakeAmount').value = (balance * portion).toFixed(4);
        };
    });

    document.getElementById('maxBtn').onclick = async () => {
        if(!currentAccount) return connect();
        let balance = await getLiveBalance();
        if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
            balance = balance > 0.01 ? (balance - 0.005).toFixed(4) : 0;
        }
        document.getElementById('stakeAmount').value = balance;
    };
}

async function getLiveBalance() {
    if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
        const raw = await provider.getBalance(currentAccount);
        return ethers.utils.formatEther(raw);
    } else {
        const token = new ethers.Contract(currentAsset.address, TOKEN_ABI, provider);
        const raw = await token.balanceOf(currentAccount);
        return ethers.utils.formatUnits(raw, 18);
    }
}

async function updateUI() {
    if(!currentAccount) return;
    const data = await vaultContract.userStakes(currentAsset.address, currentAccount);
    const bal = ethers.utils.formatEther(data.amount);
    document.getElementById('stakedBal').innerText = parseFloat(bal).toFixed(4);
}

function generateDropdown() {
    const menu = document.getElementById('dropdownMenu');
    ASSETS.forEach(asset => {
        const item = document.createElement('div');
        item.className = "flex items-center gap-3 p-4 hover:bg-white/5 cursor-pointer border-b border-white/5";
        item.innerHTML = `<img src="${asset.icon}" class="w-5 h-5"> <span class="text-sm font-bold">${asset.name}</span>`;
        item.onclick = () => {
            currentAsset = asset;
            document.getElementById('currIcon').src = asset.icon;
            document.getElementById('currName').innerText = asset.name;
            menu.classList.add('hidden');
            updateUI();
        };
        menu.appendChild(item);
    });
    document.getElementById('dropdownBtn').onclick = () => menu.classList.toggle('hidden');
    }
                                                                               
