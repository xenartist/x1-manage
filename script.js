// Global variables
let connection = null;
let currentRpcEndpoint = 'https://rpc-testnet.x1.wiki';
let wallet = null;
let walletConnected = false;
let connectedWalletAddress = null;
let walletDetected = false;

// DOM elements
const voteAccountInput = document.getElementById('voteAccount');
const rpcEndpointSelect = document.getElementById('rpcEndpoint');
const searchBtn = document.getElementById('searchBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const resultsSection = document.getElementById('resultsSection');

// Wallet elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const disconnectWalletBtn = document.getElementById('disconnectWallet');
const useWalletAddressBtn = document.getElementById('useWalletAddress');

// Result display elements
const validatorIdentityEl = document.getElementById('validatorIdentity');
const withdrawAuthorityEl = document.getElementById('withdrawAuthority');
const creditsEl = document.getElementById('credits');
const commissionEl = document.getElementById('commission');

// Event listeners
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

searchBtn.addEventListener('click', handleSearch);
voteAccountInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

rpcEndpointSelect.addEventListener('change', function() {
    currentRpcEndpoint = this.value;
    initializeConnection();
});

// Wallet event listeners
connectWalletBtn.addEventListener('click', connectWallet);
disconnectWalletBtn.addEventListener('click', disconnectWallet);
useWalletAddressBtn.addEventListener('click', useWalletAddress);

// Initialize the application
function initializeApp() {
    currentRpcEndpoint = rpcEndpointSelect.value;
    initializeConnection();
    
    // Single wallet check with appropriate delay
    setTimeout(() => {
        if (!walletDetected) {
            checkBackpackWallet();
        }
    }, 500);
    
    console.log('X1 Vote Account Explorer initialized');
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

// Check if Backpack wallet is available (only run once)
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
                removeWithdrawAuthorityMatch();
            });
        }
        
        connectWalletBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Backpack Wallet';
        connectWalletBtn.disabled = false;
        connectWalletBtn.onclick = connectWallet;
        
        // try auto-connect
        tryAutoConnect();
    } else {
        console.log('❌ Backpack wallet not found');
        
        // only retry once, longer delay
        setTimeout(() => {
            if (!walletDetected && window.backpack?.isBackpack) {
                console.log('Retrying Backpack detection...');
                checkBackpackWallet();
            } else if (!walletDetected) {
                // final fallback
                showWalletNotFound();
            }
        }, 2000);
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

// Try to auto-connect if previously connected
async function tryAutoConnect() {
    if (!wallet) return;
    
    try {
        console.log('Attempting auto-connect...');
        const response = await wallet.connect({ onlyIfTrusted: true });
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
                
                // Re-check current results if any
                if (!resultsSection.classList.contains('hidden')) {
                    checkWithdrawAuthorityMatch();
                }
                return;
            }
        }
        
        // try connect wallet
        const response = await wallet.connect();
        console.log('Connection response:', response);
        
        if (response && response.publicKey) {
            walletConnected = true;
            connectedWalletAddress = response.publicKey.toString();
            updateWalletUI(connectedWalletAddress);
            console.log('✅ Backpack wallet connected:', connectedWalletAddress);
            
            // Re-check current results if any
            if (!resultsSection.classList.contains('hidden')) {
                checkWithdrawAuthorityMatch();
            }
        } else {
            throw new Error('No public key returned from wallet');
        }
    } catch (error) {
        console.error('❌ Failed to connect wallet:', error);
        
        // more detailed error handling
        if (error.message.includes('User rejected') || error.message.includes('rejected')) {
            showError('Connection rejected by user');
        } else if (error.message.includes('Plugin Closed')) {
            showError('Wallet connection failed. Please try refreshing the page and ensure Backpack wallet is unlocked.');
        } else if (error.message.includes('wallet not found')) {
            showError('Backpack wallet not found. Please ensure the extension is installed and enabled.');
        } else {
            showError('Failed to connect to Backpack wallet: ' + error.message);
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
        removeWithdrawAuthorityMatch();
        console.log('✅ Backpack wallet disconnected');
    } catch (error) {
        console.error('Failed to disconnect wallet:', error);
        // Force disconnect anyway
        walletConnected = false;
        connectedWalletAddress = null;
        updateWalletUI(null);
        removeWithdrawAuthorityMatch();
    }
}

// Update wallet UI
function updateWalletUI(address) {
    if (address) {
        // Connected state
        connectWalletBtn.classList.add('hidden');
        walletInfo.classList.remove('hidden');
        useWalletAddressBtn.classList.remove('hidden');
        
        // Format address for display (show first 4 and last 4 characters)
        const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
        walletAddress.textContent = shortAddress;
        walletAddress.title = address; // Full address on hover
    } else {
        // Disconnected state
        connectWalletBtn.classList.remove('hidden');
        walletInfo.classList.add('hidden');
        useWalletAddressBtn.classList.add('hidden');
        walletAddress.textContent = '';
    }
}

// Use wallet address in search input
function useWalletAddress() {
    if (walletConnected && connectedWalletAddress) {
        voteAccountInput.value = connectedWalletAddress;
    }
}

// Check if connected wallet address matches withdraw authority
function checkWithdrawAuthorityMatch() {
    if (!walletConnected || !connectedWalletAddress) return;
    
    const withdrawAuthority = withdrawAuthorityEl.textContent;
    if (withdrawAuthority && withdrawAuthority !== 'N/A' && withdrawAuthority !== '-') {
        if (withdrawAuthority === connectedWalletAddress) {
            showWithdrawAuthorityMatch(true);
        } else {
            showWithdrawAuthorityMatch(false);
        }
    }
}

// Show withdraw authority match status
function showWithdrawAuthorityMatch(isMatch) {
    const withdrawCard = withdrawAuthorityEl.closest('.info-card');
    const existingIndicator = withdrawCard.querySelector('.authority-match-indicator');
    
    // Remove existing indicator
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Add new indicator
    const indicator = document.createElement('div');
    indicator.className = 'authority-match-indicator';
    
    if (isMatch) {
        indicator.innerHTML = `
            <div class="match-status match-success">
                <i class="fas fa-check-circle"></i>
                <span>You have withdraw authority</span>
            </div>
        `;
        withdrawCard.classList.add('authority-match');
    } else {
        indicator.innerHTML = `
            <div class="match-status match-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <span>You don't have withdraw authority</span>
            </div>
        `;
        withdrawCard.classList.add('authority-no-match');
    }
    
    const infoContent = withdrawCard.querySelector('.info-content');
    infoContent.appendChild(indicator);
}

// Remove withdraw authority match indicators
function removeWithdrawAuthorityMatch() {
    const withdrawCard = withdrawAuthorityEl.closest('.info-card');
    const indicator = withdrawCard.querySelector('.authority-match-indicator');
    
    if (indicator) {
        indicator.remove();
    }
    
    withdrawCard.classList.remove('authority-match', 'authority-no-match');
}

// Handle search button click
async function handleSearch() {
    const voteAccountStr = voteAccountInput.value.trim();
    
    if (!voteAccountStr) {
        showError('Please enter a vote account public key');
        return;
    }

    showLoading();
    hideError();
    hideResults();
    removeWithdrawAuthorityMatch();

    try {
        // Validate and create PublicKey
        const voteAccountPubkey = new solanaWeb3.PublicKey(voteAccountStr);
        
        const voteAccountInfo = await getVoteAccountInfoWithWeb3(voteAccountPubkey);
        displayResults(voteAccountInfo);
        
        // Check withdraw authority match after displaying results
        if (walletConnected) {
            setTimeout(() => checkWithdrawAuthorityMatch(), 100);
        }
        
        hideLoading();
    } catch (error) {
        hideLoading();
        if (error.message.includes('Invalid public key input')) {
            showError('Invalid public key format');
        } else {
            showError(`Error fetching vote account info: ${error.message}`);
        }
        console.error('Error:', error);
    }
}

// Get vote account information using Solana Web3.js
async function getVoteAccountInfoWithWeb3(voteAccountPubkey) {
    try {
        // Get parsed account info
        const accountInfo = await connection.getParsedAccountInfo(voteAccountPubkey);
        
        if (!accountInfo.value) {
            throw new Error('Vote account not found');
        }

        // Check if this is a vote account
        if (accountInfo.value.data.program !== 'vote') {
            throw new Error('This account is not a vote account');
        }

        const voteData = accountInfo.value.data.parsed.info;
        
        // Get vote accounts list for additional info
        const voteAccounts = await connection.getVoteAccounts();
        
        // Find this account in current or delinquent validators
        let foundAccount = null;
        foundAccount = voteAccounts.current.find(acc => acc.votePubkey === voteAccountPubkey.toString());
        
        if (!foundAccount) {
            foundAccount = voteAccounts.delinquent.find(acc => acc.votePubkey === voteAccountPubkey.toString());
        }

        // Extract vote account information
        const result = {
            validatorIdentity: voteData.node || foundAccount?.nodePubkey || 'N/A',
            withdrawAuthority: voteData.authorizedWithdrawer || 'N/A',
            credits: 'N/A',
            commission: 'N/A'
        };

        // Get credits from vote accounts list if available
        if (foundAccount) {
            if (foundAccount.epochCredits && foundAccount.epochCredits.length > 0) {
                const latestEpoch = foundAccount.epochCredits[foundAccount.epochCredits.length - 1];
                result.credits = latestEpoch[1]; // [epoch, credits, prevCredits]
            }
            result.commission = foundAccount.commission;
        }

        return result;

    } catch (error) {
        console.error('Web3.js Error:', error);
        throw error;
    }
}

// Display results
function displayResults(voteAccountInfo) {
    validatorIdentityEl.textContent = voteAccountInfo.validatorIdentity;
    withdrawAuthorityEl.textContent = voteAccountInfo.withdrawAuthority;
    creditsEl.textContent = formatNumber(voteAccountInfo.credits);
    commissionEl.textContent = formatCommission(voteAccountInfo.commission);
    
    showResults();
}

// Format number with commas
function formatNumber(num) {
    if (num === 'N/A' || num === 'Unknown' || num === null || num === undefined) return 'N/A';
    return parseInt(num).toLocaleString();
}

// Format commission percentage
function formatCommission(commission) {
    if (commission === 'N/A' || commission === 'Unknown' || commission === null || commission === undefined) return 'N/A';
    return `${commission}%`;
}

// Copy to clipboard functionality
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent;
    
    navigator.clipboard.writeText(text).then(function() {
        // Show a temporary success message
        const originalText = element.textContent;
        element.textContent = 'Copied!';
        element.style.color = '#4caf50';
        
        setTimeout(() => {
            element.textContent = originalText;
            element.style.color = '';
        }, 1000);
    }).catch(function(err) {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    });
}

// UI helper functions
function showLoading() {
    loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function showResults() {
    resultsSection.classList.remove('hidden');
}

function hideResults() {
    resultsSection.classList.add('hidden');
}

console.log('X1 Vote Account Explorer with optimized Backpack detection loaded');
