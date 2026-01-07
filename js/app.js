// Global App State
let connection = null;
let currentRpcEndpoint = 'https://rpc.mainnet.x1.xyz';
let wallet = null;
let walletConnected = false;
let connectedWalletAddress = null;
let walletType = null; // 'x1' or 'backpack'
let walletBalance = 0;

// Wallet detection state
let x1WalletDetected = false;
let backpackWalletDetected = false;

// DOM elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const disconnectWalletBtn = document.getElementById('disconnectWallet');

// Message elements
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const infoMessage = document.getElementById('infoMessage');
const infoText = document.getElementById('infoText');
const warningMessage = document.getElementById('warningMessage');
const warningText = document.getElementById('warningText');
const successMessage = document.getElementById('successMessage');
const successText = document.getElementById('successText');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    initializeApp();
});

// Listen for window load as backup
window.addEventListener('load', function() {
    console.log('Window loaded, checking for wallets...');
    setTimeout(() => {
        checkAvailableWallets();
    }, 1000);
});

// Initialize the application
function initializeApp() {
    // Initialize RPC connection with default value
    initializeConnection();
    
    // Initialize navigation
    initializeNavigation();
    
    // Check for available wallets (no auto-connect)
    setTimeout(() => {
        checkAvailableWallets();
    }, 500);
    
    console.log('X1 Validator Management Suite initialized');
}

// Initialize Solana connection
function initializeConnection() {
    try {
        connection = new solanaWeb3.Connection(currentRpcEndpoint, 'confirmed');
        console.log('Connected to:', currentRpcEndpoint);
    } catch (error) {
        console.error('Failed to initialize connection:', error);
        showError('Failed to connect to RPC endpoint');
    }
}

// Navigation System
function initializeNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetPage = this.getAttribute('data-page');
            switchPage(targetPage);
            
            // Update active nav button
            navBtns.forEach(navBtn => navBtn.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function switchPage(pageId) {
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        console.log('Switched to page:', pageId);
        
        // Clear any messages when switching pages
        hideAllMessages();
        
        // Page-specific initialization
        if (pageId === 'manage-account') {
            // Initialize manage account page if needed
            if (typeof initializeManageAccount === 'function') {
                initializeManageAccount();
            }
        } else if (pageId === 'new-account') {
            // Initialize new account page
            if (typeof initializeNewAccount === 'function') {
                initializeNewAccount();
            }
        }
    } else {
        console.warn('Page not found:', pageId);
    }
}

// Check for available wallets
function checkAvailableWallets() {
    console.log('Checking for available wallets...');
    
    // Check X1 Wallet - provider is window.x1
    if (window.x1) {
        x1WalletDetected = true;
        console.log('✅ X1 Wallet detected', window.x1);
    } else {
        x1WalletDetected = false;
        console.log('❌ X1 Wallet not detected');
    }
    
    // Check Backpack Wallet - provider is window.backpack
    if (window.backpack?.isBackpack) {
        backpackWalletDetected = true;
        console.log('✅ Backpack Wallet detected');
    } else {
        backpackWalletDetected = false;
        console.log('❌ Backpack Wallet not detected');
    }
    
    // Update connect button state
    if (x1WalletDetected || backpackWalletDetected) {
        connectWalletBtn.disabled = false;
        console.log('At least one wallet detected');
    } else {
        connectWalletBtn.disabled = true;
        connectWalletBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No Wallet Detected';
    }
}

// Setup wallet event listeners
function setupWalletEvents(walletProvider, type) {
    if (!walletProvider) return;
    
    walletProvider.on('connect', () => {
        console.log(`${type} wallet connected event fired`);
        if (walletProvider.publicKey) {
            walletConnected = true;
            connectedWalletAddress = walletProvider.publicKey.toString();
            walletType = type;
            updateWalletUI();
            console.log(`✅ ${type} wallet connected:`, connectedWalletAddress);
        }
    });
    
    walletProvider.on('disconnect', () => {
        console.log(`${type} wallet disconnected event fired`);
        walletConnected = false;
        connectedWalletAddress = null;
        walletType = null;
        updateWalletUI();
        
        // Notify manage account page about wallet disconnect
        if (typeof onWalletDisconnected === 'function') {
            onWalletDisconnected();
        }
        // Notify new account page about wallet disconnect
        if (typeof onWalletDisconnectedNewAccount === 'function') {
            onWalletDisconnectedNewAccount();
        }
    });
}

// Show wallet selection modal
function connectWallet() {
    showWalletSelectionModal();
}

// Show wallet selection modal
function showWalletSelectionModal() {
    const modal = document.getElementById('walletSelectionModal');
    const x1Status = document.getElementById('x1WalletStatus');
    const backpackStatus = document.getElementById('backpackWalletStatus');
    const x1Option = document.getElementById('x1WalletOption');
    const backpackOption = document.getElementById('backpackWalletOption');
    
    if (!modal) return;
    
    // Update wallet status
    if (x1WalletDetected) {
        x1Status.textContent = 'Ready to connect';
        x1Status.className = 'wallet-status detected';
        x1Option.classList.remove('disabled');
    } else {
        x1Status.textContent = 'Not detected';
        x1Status.className = 'wallet-status not-detected';
        x1Option.classList.add('disabled');
        x1Option.onclick = () => {
            if (confirm('X1 Wallet not detected. Would you like to install it?')) {
                window.open('https://x1wallet.com/', '_blank');
            }
        };
    }
    
    if (backpackWalletDetected) {
        backpackStatus.textContent = 'Ready to connect';
        backpackStatus.className = 'wallet-status detected';
        backpackOption.classList.remove('disabled');
    } else {
        backpackStatus.textContent = 'Not detected';
        backpackStatus.className = 'wallet-status not-detected';
        backpackOption.classList.add('disabled');
        backpackOption.onclick = () => {
            if (confirm('Backpack Wallet not detected. Would you like to install it?')) {
                window.open('https://www.backpack.app/', '_blank');
            }
        };
    }
    
    modal.classList.remove('hidden');
}

// Hide wallet selection modal
function hideWalletSelectionModal() {
    const modal = document.getElementById('walletSelectionModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Connect to specific wallet type
async function connectWalletByType(type) {
    if (type === 'x1' && !x1WalletDetected) {
        return;
    }
    if (type === 'backpack' && !backpackWalletDetected) {
        return;
    }
    
    hideWalletSelectionModal();
    
    try {
        connectWalletBtn.disabled = true;
        connectWalletBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        
        let walletProvider;
        let walletName;
        
        if (type === 'x1') {
            // X1 Wallet provider is window.x1
            walletProvider = window.x1;
            walletName = 'X1 Wallet';
        } else if (type === 'backpack') {
            // Backpack Wallet provider is window.backpack
            walletProvider = window.backpack;
            walletName = 'Backpack Wallet';
        }
        
        if (!walletProvider) {
            throw new Error(`${walletName} provider not found`);
        }
        
        console.log(`Connecting to ${walletName}...`, walletProvider);
        
        // Setup event listeners for this wallet
        setupWalletEvents(walletProvider, type);
        
        // Check if already connected
        if (walletProvider.connected && walletProvider.publicKey) {
            console.log(`${walletName} already connected`);
            walletConnected = true;
            connectedWalletAddress = walletProvider.publicKey.toString();
            walletType = type;
            wallet = walletProvider;
            updateWalletUI();
            
            startBalanceUpdates();
            notifyWalletConnection();
            return;
        }
        
        // Connect wallet
        const response = await walletProvider.connect();
        
        if (response && response.publicKey) {
            walletConnected = true;
            connectedWalletAddress = response.publicKey.toString();
            walletType = type;
            wallet = walletProvider;
            updateWalletUI();
            console.log(`✅ ${walletName} connected:`, connectedWalletAddress);
            
            startBalanceUpdates();
            notifyWalletConnection();
        } else {
            throw new Error('No public key returned from wallet');
        }
        
    } catch (error) {
        console.error('❌ Failed to connect wallet:', error);
        
        if (error.message.includes('User rejected') || error.message.includes('rejected')) {
            showError('连接被用户拒绝');
        } else {
            showError(`连接钱包失败: ${error.message}`);
        }
    } finally {
        connectWalletBtn.disabled = false;
        if (!walletConnected) {
            connectWalletBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
        }
    }
}

// Notify other components about wallet connection
function notifyWalletConnection() {
    if (typeof onWalletConnected === 'function') {
        onWalletConnected();
    }
    if (typeof onWalletConnectedNewAccount === 'function') {
        onWalletConnectedNewAccount();
    }
}

// Disconnect wallet
async function disconnectWallet() {
    try {
        if (wallet && walletConnected) {
            const walletName = walletType === 'x1' ? 'X1 Wallet' : 'Backpack Wallet';
            console.log(`Disconnecting ${walletName}...`);
            await wallet.disconnect();
        }
        walletConnected = false;
        connectedWalletAddress = null;
        walletType = null;
        wallet = null;
        
        // stop balance updates logic
        stopBalanceUpdates();
        
        updateWalletUI();
        // Notify manage account page about wallet disconnect
        if (typeof onWalletDisconnected === 'function') {
            onWalletDisconnected();
        }
        // Notify new account page about wallet disconnect
        if (typeof onWalletDisconnectedNewAccount === 'function') {
            onWalletDisconnectedNewAccount();
        }
        console.log('✅ Wallet disconnected');
    } catch (error) {
        console.error('Failed to disconnect wallet:', error);
        // Force disconnect anyway
        walletConnected = false;
        connectedWalletAddress = null;
        walletType = null;
        wallet = null;
        
        // stop balance updates logic
        stopBalanceUpdates();
        
        updateWalletUI();
        if (typeof onWalletDisconnected === 'function') {
            onWalletDisconnected();
        }
        if (typeof onWalletDisconnectedNewAccount === 'function') {
            onWalletDisconnectedNewAccount();
        }
    }
}

// Update wallet UI
function updateWalletUI() {
    if (walletConnected && connectedWalletAddress) {
        connectWalletBtn.classList.add('hidden');
        walletInfo.classList.remove('hidden');
        
        // Show wallet type and address
        const walletName = walletType === 'x1' ? 'X1' : 'Backpack';
        walletAddress.textContent = `${walletName}: ${connectedWalletAddress.slice(0, 4)}...${connectedWalletAddress.slice(-4)}`;
        
        // get and display wallet balance
        fetchWalletBalance(connectedWalletAddress).then(balance => {
            updateWalletBalanceDisplay(balance);
        });
        
        // notify other wallet status update
        if (typeof onWalletUIUpdated === 'function') {
            onWalletUIUpdated(connectedWalletAddress);
        }

        // notify new account page about wallet connection
        if (typeof onWalletUIUpdatedNewAccount === 'function') {
            onWalletUIUpdatedNewAccount(connectedWalletAddress);
        }
        
        // if in manage account page, update related status
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection && !resultsSection.classList.contains('hidden')) {
            // update vote account authority check
            if (typeof checkWithdrawAuthorityMatch === 'function') {
                setTimeout(() => checkWithdrawAuthorityMatch(), 100);
            }
            
            // update stake account authority check
            const activeTab = getCurrentActiveTab();
            if (activeTab && activeTab.startsWith('stake-') && typeof checkStakeAuthorities === 'function') {
                setTimeout(() => {
                    checkStakeAuthorities(activeTab);
                }, 100);
            }
        }
    } else {
        connectWalletBtn.classList.remove('hidden');
        connectWalletBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
        walletInfo.classList.add('hidden');
        walletAddress.textContent = '';
        
        // clear balance display
        updateWalletBalanceDisplay(0);
        
        // notify other wallet disconnected
        if (typeof onWalletUIUpdated === 'function') {
            onWalletUIUpdated(null);
        }
        
        // notify new account page about wallet disconnect
        if (typeof onWalletUIUpdatedNewAccount === 'function') {
            onWalletUIUpdatedNewAccount(null);
        }
    }
}

// Wallet event listeners
connectWalletBtn.addEventListener('click', connectWallet);
disconnectWalletBtn.addEventListener('click', disconnectWallet);

// Close wallet selection modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('walletSelectionModal');
    if (modal && e.target === modal) {
        hideWalletSelectionModal();
    }
});

// Message Management
function showLoading() {
    hideAllMessages();
    loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

function showError(message) {
    hideAllMessages();
    errorText.innerHTML = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function showSuccess(message) {
    hideAllMessages();
    successText.innerHTML = message;
    successMessage.classList.remove('hidden');
}

function hideSuccess() {
    successMessage.classList.add('hidden');
}

function showInfo(message, loading = false) {
    hideAllMessages();
    infoText.innerHTML = message;
    infoMessage.classList.remove('hidden');
    
    // add loading animation if specified
    if (loading) {
        infoMessage.classList.add('loading');
        const icon = infoMessage.querySelector('i');
        if (icon) icon.className = 'fas fa-spinner';
    } else {
        infoMessage.classList.remove('loading');
        const icon = infoMessage.querySelector('i');
        if (icon) icon.className = 'fas fa-info-circle';
    }
}

function hideInfo() {
    infoMessage.classList.add('hidden');
    infoMessage.classList.remove('loading');
}

function showWarning(message) {
    hideAllMessages();
    warningText.innerHTML = message;
    warningMessage.classList.remove('hidden');
}

function hideWarning() {
    warningMessage.classList.add('hidden');
}

function hideAllMessages() {
    hideLoading();
    hideError();
    hideSuccess();
    hideInfo();
    hideWarning();
}

// Format utility functions
function formatNumber(num) {
    if (num === 'N/A' || num === 'Unknown' || num === null || num === undefined) return 'N/A';
    return parseInt(num).toLocaleString();
}

function formatCommission(commission) {
    if (commission === 'N/A' || commission === 'Unknown' || commission === null || commission === undefined) return 'N/A';
    return `${commission}%`;
}

function formatBalance(balance) {
    if (balance === 'N/A' || balance === 'Unknown' || balance === null || balance === undefined) return 'N/A';
    return `${balance.toFixed(4)} XNT`;
}

console.log('App.js loaded successfully');

// Custom RPC functionality
let savedCustomRpc = null;
let currentSelectedRpc = 'https://rpc.testnet.x1.xyz';

function initializeRpcSelector() {
    const rpcSelected = document.getElementById('rpcSelected');
    const rpcOptions = document.getElementById('rpcOptions');
    const selectedRpcText = document.getElementById('selectedRpcText');
    const customRpcUrl = document.getElementById('customRpcUrl');
    const applyCustomRpcBtn = document.getElementById('applyCustomRpc');
    const editCustomRpcBtn = document.getElementById('editCustomRpc');
    
    if (!rpcSelected || !rpcOptions) {
        console.warn('RPC selector elements not found');
        return;
    }
    
    // load saved custom rpc
    loadSavedCustomRpc();
    updateCustomRpcDisplay();
    
    // click selector to open/close dropdown
    rpcSelected.addEventListener('click', function() {
        toggleRpcDropdown();
    });
    
    // click outside to close dropdown
    document.addEventListener('click', function(e) {
        if (!rpcSelected.contains(e.target) && !rpcOptions.contains(e.target)) {
            closeRpcDropdown();
        }
    });
    
    // regular options click
    const regularOptions = rpcOptions.querySelectorAll('.rpc-option[data-value]');
    regularOptions.forEach(option => {
        option.addEventListener('click', function() {
            selectRpc(this.dataset.value, this.textContent.trim());
        });
    });
    
    // Custom RPC Apply
    if (applyCustomRpcBtn) {
        applyCustomRpcBtn.addEventListener('click', applyCustomRpc);
    }
    
    // Custom RPC Edit
    if (editCustomRpcBtn) {
        editCustomRpcBtn.addEventListener('click', editCustomRpc);
    }
    
    // custom rpc url select (when set)
    const customRpcSelectOption = document.getElementById('customRpcSelectOption');
    if (customRpcSelectOption) {
        customRpcSelectOption.addEventListener('click', function() {
            if (savedCustomRpc) {
                selectRpc(savedCustomRpc, `Custom: ${savedCustomRpc}`);
            }
        });
    }
    
    // Enter key apply
    if (customRpcUrl) {
        customRpcUrl.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyCustomRpc();
            }
        });
    }
}

function loadSavedCustomRpc() {
    const saved = localStorage.getItem('customRpcUrl');
    if (saved) {
        savedCustomRpc = saved;
        console.log('Loaded saved custom RPC:', saved);
    }
}

function saveCustomRpc(url) {
    savedCustomRpc = url;
    localStorage.setItem('customRpcUrl', url);
    console.log('Saved custom RPC:', url);
}

function updateCustomRpcDisplay() {
    const customRpcInput = document.getElementById('customRpcInput');
    const customRpcDisplay = document.getElementById('customRpcDisplay');
    const customRpcUrlText = document.getElementById('customRpcUrlText');
    const customRpcSelectOption = document.getElementById('customRpcSelectOption');
    
    if (savedCustomRpc) {
        // display set rpc
        if (customRpcInput) customRpcInput.classList.add('hidden');
        if (customRpcDisplay) customRpcDisplay.classList.remove('hidden');
        if (customRpcUrlText) customRpcUrlText.textContent = `Custom: ${savedCustomRpc}`;
        if (customRpcSelectOption) customRpcSelectOption.dataset.value = savedCustomRpc;
    } else {
        // display input section
        if (customRpcInput) customRpcInput.classList.remove('hidden');
        if (customRpcDisplay) customRpcDisplay.classList.add('hidden');
    }
}

function toggleRpcDropdown() {
    const rpcSelected = document.getElementById('rpcSelected');
    const rpcOptions = document.getElementById('rpcOptions');
    
    if (rpcOptions.classList.contains('hidden')) {
        // when opening dropdown, check and update custom rpc display status
        updateCustomRpcDisplay();
        
        rpcOptions.classList.remove('hidden');
        rpcSelected.classList.add('open');
    } else {
        closeRpcDropdown();
    }
}

function closeRpcDropdown() {
    const rpcSelected = document.getElementById('rpcSelected');
    const rpcOptions = document.getElementById('rpcOptions');
    
    rpcOptions.classList.add('hidden');
    rpcSelected.classList.remove('open');
}

function selectRpc(url, displayText) {
    const selectedRpcText = document.getElementById('selectedRpcText');
    
    currentSelectedRpc = url;
    if (selectedRpcText) {
        selectedRpcText.textContent = displayText;
    }
    
    closeRpcDropdown();
    updateRpcConnection(url);
}

function applyCustomRpc() {
    const customRpcUrl = document.getElementById('customRpcUrl');
    
    if (!customRpcUrl) return;
    
    const url = customRpcUrl.value.trim();
    
    if (!url) {
        showError('Please enter a valid RPC URL');
        return;
    }
    
    try {
        new URL(url);
    } catch (error) {
        showError('Please enter a valid RPC URL');
        return;
    }
    
    // save and update display
    saveCustomRpc(url);
    updateCustomRpcDisplay();
    
    // select this rpc
    selectRpc(url, `Custom: ${url}`);
    
    showInfo(`✅ Connected to custom RPC: ${url}`);
    setTimeout(() => hideInfo(), 3000);
}

function editCustomRpc() {
    const customRpcUrl = document.getElementById('customRpcUrl');
    
    // pre-fill current value
    if (customRpcUrl && savedCustomRpc) {
        customRpcUrl.value = savedCustomRpc;
    }
    
    // switch to input mode
    updateCustomRpcDisplay();
    
    // re-display input section
    const customRpcInput = document.getElementById('customRpcInput');
    const customRpcDisplay = document.getElementById('customRpcDisplay');
    
    if (customRpcInput) customRpcInput.classList.remove('hidden');
    if (customRpcDisplay) customRpcDisplay.classList.add('hidden');
    
    // focus input field
    if (customRpcUrl) {
        customRpcUrl.focus();
        customRpcUrl.select();
    }
}

function updateRpcConnection(rpcUrl) {
    console.log('🔧 updateRpcConnection called with:', rpcUrl);
    
    try {
        new URL(rpcUrl);
        
        // Update currentRpcEndpoint
        currentRpcEndpoint = rpcUrl;
        
        if (window.connection) {
            window.connection = new solanaWeb3.Connection(rpcUrl, 'confirmed');
            console.log('✅ RPC connection updated to:', rpcUrl);
        } else {
            window.connection = new solanaWeb3.Connection(rpcUrl, 'confirmed');
            console.log('✅ Created new RPC connection to:', rpcUrl);
        }
        
        if (typeof connection !== 'undefined') {
            connection = new solanaWeb3.Connection(rpcUrl, 'confirmed');
        }
        
        if (typeof currentStakeAccounts !== 'undefined') {
            currentStakeAccounts = [];
        }
        
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection && !resultsSection.classList.contains('hidden')) {
            resultsSection.classList.add('hidden');
        }
        
        // fetch wallet balance again（if wallet is connected）
        if (walletConnected && connectedWalletAddress) {
            console.log('🔄 Refreshing wallet balance after RPC change...');
            fetchWalletBalance(connectedWalletAddress).then(balance => {
                walletBalance = balance;
                updateWalletBalanceDisplay(balance);
                console.log('✅ Wallet balance refreshed:', balance, 'XNT');
            }).catch(error => {
                console.error('Failed to refresh wallet balance:', error);
            });
        }
        
    } catch (error) {
        console.error('Failed to update RPC connection:', error);
        showError(`Failed to connect to RPC endpoint: ${error.message}`);
    }
}

// Get explorer URL based on current RPC endpoint
function getExplorerUrl(txSignature = '') {
    let explorerBase;
    
    // Check if current RPC is testnet
    if (currentRpcEndpoint.includes('testnet')) {
        explorerBase = 'https://explorer.testnet.x1.xyz';
    } 
    // Check if current RPC is mainnet
    else if (currentRpcEndpoint.includes('mainnet')) {
        explorerBase = 'https://explorer.mainnet.x1.xyz';
    } 
    // Default to mainnet for custom RPC
    else {
        explorerBase = 'https://explorer.mainnet.x1.xyz';
    }
    
    // Return full URL with transaction signature if provided
    if (txSignature) {
        return `${explorerBase}/tx/${txSignature}`;
    }
    
    return explorerBase;
}

// Initialize RPC selector when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const defaultRpc = 'https://rpc.mainnet.x1.xyz';
    updateRpcConnection(defaultRpc);
    
    initializeRpcSelector();
});

// add function to get wallet balance
async function fetchWalletBalance(address) {
    try {
        if (!connection || !address) {
            return 0;
        }
        
        const publicKey = new solanaWeb3.PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;
        
        console.log(`💰 Wallet balance: ${solBalance} XNT`);
        return solBalance;
    } catch (error) {
        console.error('Failed to fetch wallet balance:', error);
        return 0;
    }
}

// update wallet balance display
function updateWalletBalanceDisplay(balance) {
    const walletBalanceEl = document.getElementById('walletBalance');
    if (walletBalanceEl) {
        walletBalance = balance;
        walletBalanceEl.textContent = `${balance.toFixed(6)} XNT`;
    }
}

// add helper function to get current active tab
function getCurrentActiveTab() {
    const activeTabBtn = document.querySelector('.tab-btn.active[data-tab-id]');
    return activeTabBtn ? activeTabBtn.getAttribute('data-tab-id') : null;
}

// optional: add periodic update balance function
let balanceUpdateInterval = null;

function startBalanceUpdates() {
    // update balance every 30 seconds
    balanceUpdateInterval = setInterval(() => {
        if (walletConnected && connectedWalletAddress) {
            fetchWalletBalance(connectedWalletAddress).then(balance => {
                updateWalletBalanceDisplay(balance);
            });
        }
    }, 30000);
}

function stopBalanceUpdates() {
    if (balanceUpdateInterval) {
        clearInterval(balanceUpdateInterval);
        balanceUpdateInterval = null;
    }
}
