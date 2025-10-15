// Global App State
let connection = null;
let currentRpcEndpoint = 'https://rpc.mainnet.x1.xyz';
let wallet = null;
let walletConnected = false;
let connectedWalletAddress = null;
let walletDetected = false;
let walletBalance = 0;

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
    if (!walletDetected) {
        console.log('Window loaded, checking for wallets as backup...');
        setTimeout(() => {
            if (!walletDetected) {
                checkBackpackWallet();
            }
        }, 1000);
    }
});

// Initialize the application
function initializeApp() {
    // Initialize RPC connection with default value
    initializeConnection();
    
    // Initialize navigation
    initializeNavigation();
    
    // Single wallet check with appropriate delay
    setTimeout(() => {
        checkBackpackWallet().then(detected => {
            if (detected) {
                setTimeout(connectWallet, 500);
            }
        });
    }, 1000);
    
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

// Wallet Management
function checkBackpackWallet() {
    if (walletDetected) {
        console.log('Wallet already detected, skipping...');
        return Promise.resolve(true); // Indicate success
    }

    console.log('Checking for Backpack wallet...');
    
    // check Backpack wallet
    if (window.backpack?.isBackpack) {
        wallet = window.backpack.solana; // use Solana provider
        walletDetected = true;
        console.log('✅ Backpack wallet detected successfully');
        
        // add wallet event listener
        if (wallet) {
            wallet.on('connect', () => {
                console.log('Wallet connected event fired');
                if (wallet.publicKey) {
                    walletConnected = true;
                    connectedWalletAddress = wallet.publicKey.toString();
                    updateWalletUI();
                    console.log('✅ Wallet connected via event:', connectedWalletAddress);
                }
            });
            
            wallet.on('disconnect', () => {
                console.log('Wallet disconnected event fired');
                walletConnected = false;
                connectedWalletAddress = null;
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
        
        connectWalletBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Backpack Wallet';
        connectWalletBtn.disabled = false;
        connectWalletBtn.onclick = connectWallet;
        
        // try auto-connect with delay to allow wallet to fully load
        setTimeout(() => {
            tryAutoConnect();
        }, 1000);
        return Promise.resolve(true); // Indicate success
    } else {
        console.log('❌ Backpack wallet not found');
        
        // Longer retry with multiple attempts
        let detectRetries = 0;
        const maxDetectRetries = 5;
        const detectInterval = setInterval(() => {
            detectRetries++;
            console.log(`Retrying Backpack detection... attempt ${detectRetries}/${maxDetectRetries}`);
            
            if (window.backpack?.isBackpack) {
                console.log('Backpack wallet found on retry!');
                clearInterval(detectInterval);
                checkBackpackWallet();
            } else if (detectRetries >= maxDetectRetries) {
                console.log('Max detection retries reached');
                clearInterval(detectInterval);
                showWalletNotFound();
                return Promise.resolve(false); // Indicate failure
            }
        }, 2000); // Check every 2 seconds
        return new Promise(resolve => {
            setTimeout(() => {
                clearInterval(detectInterval);
                resolve(false); // Indicate failure after retries
            }, maxDetectRetries * 2000 + 1000); // Total time for retries + final check
        });
    }
}

// Show wallet not found state
function showWalletNotFound() {
    console.log('Backpack wallet not detected after retries');
    connectWalletBtn.innerHTML = '<i class="fas fa-download"></i> Install Backpack Wallet';
    connectWalletBtn.disabled = false;
    connectWalletBtn.onclick = () => {
        if (confirm('Backpack wallet not detected. Would you like to install it?')) {
            window.open('https://www.backpack.app/', '_blank');
        }
    };
}

// Improve auto-connect with better error handling
async function tryAutoConnect() {
    if (!wallet) return;
    
    try {
        console.log('Attempting auto-connect...');
        
        // Check if wallet is ready
        if (wallet.isConnected && wallet.publicKey) {
            walletConnected = true;
            connectedWalletAddress = wallet.publicKey.toString();
            updateWalletUI();
            console.log('✅ Wallet already connected:', connectedWalletAddress);
            return;
        }
        
        // Try trusted connection with timeout
        const autoConnectPromise = wallet.connect({ onlyIfTrusted: true });
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Auto-connect timeout')), 8000)
        );
        
        const response = await Promise.race([autoConnectPromise, timeoutPromise]);
        
        if (response && response.publicKey) {
            walletConnected = true;
            connectedWalletAddress = response.publicKey.toString();
            updateWalletUI();
            console.log('✅ Auto-connected to Backpack:', connectedWalletAddress);
        } else {
            console.log('Auto-connect: No trusted connection found');
        }
    } catch (error) {
        console.log('Auto-connect failed (this is normal):', error.message);
    }
}

// Connect to Backpack wallet
async function connectWallet() {
    if (!wallet) {
        showError('Backpack wallet not found. Please refresh the page.');
        return;
    }

    try {
        connectWalletBtn.disabled = true;
        connectWalletBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        
        console.log('Connecting to Backpack wallet...');
        
        // check if wallet is already connected
        if (wallet.connected) {
            console.log('Wallet already connected, getting public key...');
            const publicKey = wallet.publicKey;
            if (publicKey) {
                walletConnected = true;
                connectedWalletAddress = publicKey.toString();
                updateWalletUI();
                console.log('✅ Backpack wallet already connected:', connectedWalletAddress);
                
                // balance updates logic
                startBalanceUpdates();
                
                // Notify manage account page about wallet connection
                if (typeof onWalletConnected === 'function') {
                    onWalletConnected();
                }
                // Notify new account page about wallet connection
                if (typeof onWalletConnectedNewAccount === 'function') {
                    onWalletConnectedNewAccount();
                }
                return;
            }
        }
        
        // Enhanced connection with retry mechanism
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds between retries
        
        while (retryCount < maxRetries) {
            try {
                // Update UI to show retry status
                if (retryCount > 0) {
                    connectWalletBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Retrying... (${retryCount}/${maxRetries})`;
                    console.log(`Retry attempt ${retryCount}/${maxRetries}`);
                }
                
                // Check if wallet is ready before connecting
                if (!wallet.isConnected && wallet.publicKey) {
                    console.log('Wallet appears to be in loading state, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // try connect wallet with longer timeout
                const connectPromise = wallet.connect();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Connection timeout')), 15000) // 15 second timeout
                );
                
                const response = await Promise.race([connectPromise, timeoutPromise]);
                console.log('Connection response:', response);
                
                if (response && response.publicKey) {
                    walletConnected = true;
                    connectedWalletAddress = response.publicKey.toString();
                    updateWalletUI();
                    console.log('✅ Backpack wallet connected:', connectedWalletAddress);
                    
                    // balance updates logic
                    startBalanceUpdates();
                    
                    // Notify manage account page about wallet connection
                    if (typeof onWalletConnected === 'function') {
                        onWalletConnected();
                    }
                    // Notify new account page about wallet connection
                    if (typeof onWalletConnectedNewAccount === 'function') {
                        onWalletConnectedNewAccount();
                    }
                    return; // Success, exit retry loop
                } else {
                    throw new Error('No public key returned from wallet');
                }
                
            } catch (retryError) {
                retryCount++;
                console.log(`Connection attempt ${retryCount} failed:`, retryError.message);
                
                // Handle specific errors that might indicate wallet is still loading
                if (retryError.message.includes('Plugin Closed') || 
                    retryError.message.includes('Connection timeout') ||
                    retryError.message.includes('wallet not ready')) {
                    
                    if (retryCount < maxRetries) {
                        console.log(`Wallet appears to be loading, waiting ${retryDelay}ms before retry...`);
                        connectWalletBtn.innerHTML = `<i class="fas fa-clock"></i> Wallet loading, retrying in ${retryDelay/1000}s...`;
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue; // Try again
                    }
                }
                
                // If this is the last retry or a non-recoverable error, throw it
                if (retryCount >= maxRetries) {
                    throw retryError;
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Failed to connect wallet after retries:', error);
        
        // more detailed error handling
        if (error.message.includes('User rejected') || error.message.includes('rejected')) {
            showError('Connection rejected by user');
        } else if (error.message.includes('Plugin Closed')) {
            showError('Wallet plugin closed during connection. Please ensure Backpack wallet is fully loaded and try again.');
        } else if (error.message.includes('Connection timeout')) {
            showError('Connection timeout. Backpack wallet may be loading or busy. Please wait a moment and try again.');
        } else if (error.message.includes('wallet not found')) {
            showError('Backpack wallet not found. Please ensure the extension is installed and enabled.');
        } else {
            showError('Failed to connect to Backpack wallet. Please ensure the wallet is unlocked and try refreshing the page.');
        }
    } finally {
        connectWalletBtn.disabled = false;
        if (!walletConnected) {
            connectWalletBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Backpack Wallet';
        }
    }
}

// Disconnect wallet
async function disconnectWallet() {
    try {
        if (wallet && walletConnected) {
            console.log('Disconnecting Backpack wallet...');
            await wallet.disconnect();
        }
        walletConnected = false;
        connectedWalletAddress = null;
        
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
        console.log('✅ Backpack wallet disconnected');
    } catch (error) {
        console.error('Failed to disconnect wallet:', error);
        // Force disconnect anyway
        walletConnected = false;
        connectedWalletAddress = null;
        
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
        walletAddress.textContent = `${connectedWalletAddress.slice(0, 4)}...${connectedWalletAddress.slice(-4)}`;
        
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
