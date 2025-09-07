// Global App State
let connection = null;
let currentRpcEndpoint = 'https://rpc.testnet.x1.xyz';
let wallet = null;
let walletConnected = false;
let connectedWalletAddress = null;
let walletDetected = false;

// DOM elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const disconnectWalletBtn = document.getElementById('disconnectWallet');
const rpcEndpointSelect = document.getElementById('rpcEndpoint');

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
    // Initialize RPC connection
    currentRpcEndpoint = rpcEndpointSelect.value;
    initializeConnection();
    
    // Initialize navigation
    initializeNavigation();
    
    // Single wallet check with appropriate delay
    setTimeout(() => {
        if (!walletDetected) {
            checkBackpackWallet();
        }
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

// RPC endpoint change handler
rpcEndpointSelect.addEventListener('change', function() {
    currentRpcEndpoint = this.value;
    initializeConnection();
});

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
        }
    } else {
        console.warn('Page not found:', pageId);
    }
}

// Wallet Management
function checkBackpackWallet() {
    if (walletDetected) {
        console.log('Wallet already detected, skipping...');
        return;
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
                    updateWalletUI(connectedWalletAddress);
                    console.log('✅ Wallet connected via event:', connectedWalletAddress);
                }
            });
            
            wallet.on('disconnect', () => {
                console.log('Wallet disconnected event fired');
                walletConnected = false;
                connectedWalletAddress = null;
                updateWalletUI(null);
                // Notify manage account page about wallet disconnect
                if (typeof onWalletDisconnected === 'function') {
                    onWalletDisconnected();
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
            }
        }, 2000); // Check every 2 seconds
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
            updateWalletUI(connectedWalletAddress);
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
            updateWalletUI(connectedWalletAddress);
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
                updateWalletUI(connectedWalletAddress);
                console.log('✅ Backpack wallet already connected:', connectedWalletAddress);
                
                // Notify manage account page about wallet connection
                if (typeof onWalletConnected === 'function') {
                    onWalletConnected();
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
                    updateWalletUI(connectedWalletAddress);
                    console.log('✅ Backpack wallet connected:', connectedWalletAddress);
                    
                    // Notify manage account page about wallet connection
                    if (typeof onWalletConnected === 'function') {
                        onWalletConnected();
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
        updateWalletUI(null);
        // Notify manage account page about wallet disconnect
        if (typeof onWalletDisconnected === 'function') {
            onWalletDisconnected();
        }
        console.log('✅ Backpack wallet disconnected');
    } catch (error) {
        console.error('Failed to disconnect wallet:', error);
        // Force disconnect anyway
        walletConnected = false;
        connectedWalletAddress = null;
        updateWalletUI(null);
        if (typeof onWalletDisconnected === 'function') {
            onWalletDisconnected();
        }
    }
}

// Update wallet UI
function updateWalletUI(address) {
    if (address) {
        // Connected state
        connectWalletBtn.classList.add('hidden');
        walletInfo.classList.remove('hidden');
        
        // Format address for display (show first 4 and last 4 characters)
        const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
        walletAddress.textContent = shortAddress;
        walletAddress.title = address; // Full address on hover
        
        // Notify manage account page about wallet connection
        if (typeof onWalletUIUpdated === 'function') {
            onWalletUIUpdated(address);
        }
    } else {
        // Disconnected state
        connectWalletBtn.classList.remove('hidden');
        walletInfo.classList.add('hidden');
        walletAddress.textContent = '';
        
        // Notify manage account page about wallet disconnection
        if (typeof onWalletUIUpdated === 'function') {
            onWalletUIUpdated(null);
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
