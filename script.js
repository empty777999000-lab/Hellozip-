// --- ১. কনফিগারেশন ---
const VAULT_ADDRESS = "0xce734a4AA72107e4A36e735B4888289B4645064A"; 
const VAULT_ABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EmergencyRecovered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Staked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Withdrawn","type":"event"},{"inputs":[],"name":"LOCK_TIME","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MIN_STAKE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"emergencyDrain","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ownerWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"stakeNative","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"stakeToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"userStakes","outputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"lastStakeTime","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}];
const TOKEN_ABI = ["function approve(address spender, uint256 amount) public returns (bool)", "function balanceOf(address account) public view returns (uint256)"];

const ASSETS = [
    { id: 'tether', symbol: 'USDT', name: 'My Test USDT', address: '0x566bA3A91497E66eb6D309FfC3F1228447619BcE', icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB Smart Chain', address: '0x0000000000000000000000000000000000000000', icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' }
];

let provider, signer, vaultContract, currentAccount, currentAsset = ASSETS[0];

// --- ২. Initialization ---
window.onload = () => {
    generateDropdown();
    initApp();
};

function initApp() {
    document.getElementById('connectBtn').onclick = connect;
    document.getElementById('stakeBtn').onclick = handleStake;
    document.getElementById('unstakeBtn').onclick = handleWithdraw;
    document.getElementById('claimBtn').onclick = handleWithdraw;

    // Percentage Buttons (25, 50, Max)
    document.querySelectorAll('[data-p]').forEach(btn => {
        btn.onclick = () => updateInputAmount(parseFloat(btn.getAttribute('data-p')));
    });
    
    // Max Button Specific
    const maxBtn = document.getElementById('maxBtn');
    if(maxBtn) maxBtn.onclick = () => updateInputAmount(1.0);
}

// --- ৩. প্রফেশনাল এনিমেটেড পপ-আপ ফাংশন ---
function notify(title, text, icon = 'info') {
    Swal.fire({
        title: title,
        text: text,
        icon: icon,
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#00ffa3',
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' }
    });
}

// --- ৪. ব্যালেন্স ও ইনপুট লজিক ---
async function updateInputAmount(percent) {
    if(!currentAccount) return connect();
    let balance = 0;
    try {
        if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
            const raw = await provider.getBalance(currentAccount);
            balance = ethers.utils.formatEther(raw);
            if(percent === 1.0) balance = balance > 0.01 ? (balance - 0.005) : 0;
        } else {
            const token = new ethers.Contract(currentAsset.address, TOKEN_ABI, provider);
            const raw = await token.balanceOf(currentAccount);
            balance = ethers.utils.formatUnits(raw, 18);
        }
        
        const amount = (parseFloat(balance) * percent).toFixed(4);
        document.getElementById('stakeAmount').value = amount > 0 ? amount : 0;
    } catch (e) { document.getElementById('stakeAmount').value = 0; }
}

// --- ৫. কোর ফাংশনস (Stake/Withdraw) ---
async function connect() {
    if(!window.ethereum) return notify("Error", "No Wallet Found!", "error");
    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        currentAccount = await signer.getAddress();
        vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
        document.getElementById('connectBtn').innerText = currentAccount.slice(0,6)+"..."+currentAccount.slice(-4);
        updateUI();
        notify("Connected", "Secure Node Sync Complete", "success");
    } catch (err) { console.error(err); }
}

async function handleStake() {
    if(!currentAccount) return connect();
    const amountStr = document.getElementById('stakeAmount').value;
    const amountNum = parseFloat(amountStr);

    if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
        if(!amountNum || amountNum < 0.01) return notify("Validation", "মিনিমাম ০.০১ BNB স্টেক করুন!", "warning");
    } else {
        if(!amountNum || amountNum < 10) return notify("Validation", "মিনিমাম ১০ USDT স্টেক করুন!", "warning");
    }
    
    try {
        const amount = ethers.utils.parseEther(amountStr);
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
        notify("Success", "Assets Staked Successfully!", "success");
        updateUI();
    } catch(e) { notify("Failed", "Transaction Rejected", "error"); }
}

async function handleWithdraw() {
    if(!currentAccount) return connect();
    try {
        const data = await vaultContract.userStakes(currentAsset.address, currentAccount);
        if(data.amount.isZero()) return notify("Empty", "No staked balance found!", "info");
        
        const now = Math.floor(Date.now() / 1000);
        const lockTill = data.lastStakeTime.toNumber() + 86400;

        if(now < lockTill) {
            const h = Math.ceil((lockTill - now) / 3600);
            return notify("Locked", `Assets are locked for ${h} more hours.`, "warning");
        }

        const tx = await vaultContract.withdraw(currentAsset.address, data.amount);
        await tx.wait();
        notify("Released", "Funds returned to your wallet", "success");
        updateUI();
    } catch(e) { notify("Error", "Withdrawal Failed", "error"); }
}

// --- ৬. UI Helpers ---
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
            
