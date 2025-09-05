// Global variables
let connection = null;
let currentRpcEndpoint = 'https://rpc.testnet.x1.xyz';
let wallet = null;
let walletConnected = false;
let connectedWalletAddress = null;
let walletDetected = false;

// add: global variables for stake management
let currentStakeAccounts = [];
let activeTab = 'vote-info';

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
const accountBalanceEl = document.getElementById('accountBalance');

// Withdraw modal elements
const withdrawModal = document.getElementById('withdrawModal');
const withdrawAmountInput = document.getElementById('withdrawAmount');
const withdrawToInput = document.getElementById('withdrawTo');
const availableBalanceEl = document.getElementById('availableBalance');
const withdrawBtn = document.getElementById('withdrawBtn');

// Success message elements
const successMessage = document.getElementById('successMessage');
const successText = document.getElementById('successText');

// add: DOM elements for new message types
const infoMessage = document.getElementById('infoMessage');
const infoText = document.getElementById('infoText');
const warningMessage = document.getElementById('warningMessage');
const warningText = document.getElementById('warningText');

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
    
    // Initialize withdraw button to disabled state
    updateWithdrawButtonState(false);
    
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

// Improve wallet detection with longer timeout
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
                
                // Re-check current results if any
                if (!resultsSection.classList.contains('hidden')) {
                    checkWithdrawAuthorityMatch();
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
            
            // Re-check current results if any
            if (!resultsSection.classList.contains('hidden')) {
                checkWithdrawAuthorityMatch();
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
        
        // Check withdraw authority if results are visible
        if (!resultsSection.classList.contains('hidden')) {
            checkWithdrawAuthorityMatch();
        }
    } else {
        // Disconnected state
        connectWalletBtn.classList.remove('hidden');
        walletInfo.classList.add('hidden');
        useWalletAddressBtn.classList.add('hidden');
        walletAddress.textContent = '';
        
        // Disable withdraw button when wallet disconnected
        updateWithdrawButtonState(false);
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
    if (!walletConnected || !connectedWalletAddress) {
        updateWithdrawButtonState(false);
        return;
    }
    
    const withdrawAuthority = withdrawAuthorityEl.textContent;
    if (withdrawAuthority && withdrawAuthority !== 'N/A' && withdrawAuthority !== '-') {
        if (withdrawAuthority === connectedWalletAddress) {
            showWithdrawAuthorityMatch(true);
            updateWithdrawButtonState(true);
        } else {
            showWithdrawAuthorityMatch(false);
            updateWithdrawButtonState(false);
        }
    } else {
        updateWithdrawButtonState(false);
    }
}

// Update withdraw button state based on authority
function updateWithdrawButtonState(hasAuthority) {
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (hasAuthority) {
        withdrawBtn.disabled = false;
        withdrawBtn.classList.remove('disabled');
    } else {
        withdrawBtn.disabled = true;
        withdrawBtn.classList.add('disabled');
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
    
    // Disable withdraw button when removing authority match
    updateWithdrawButtonState(false);
}

// Handle search button click
async function handleSearch() {
    const voteAccountStr = voteAccountInput.value.trim();
    
    if (!voteAccountStr) {
        showError('Please enter a vote account public key');
        return;
    }

    hideError();
    hideInfo();
    hideWarning();
    hideSuccess();
    hideResults();
    removeWithdrawAuthorityMatch();

    try {
        // validate and create PublicKey
        const voteAccountPubkey = new solanaWeb3.PublicKey(voteAccountStr);
        
        // show info message for vote account loading
        showInfo('Loading vote account information...', true);
        
        const voteAccountInfo = await getVoteAccountInfoWithWeb3(voteAccountPubkey);
        displayResults(voteAccountInfo);
        
        // show info message for stake accounts loading
        showInfo('Loading delegated stake accounts...', true);
        const stakeAccounts = await getStakeAccountsForVoteAccount(voteAccountPubkey);
        
        console.log('=== Before createStakeTabs ===');
        console.log('Wallet connected:', walletConnected);
        console.log('Connected address:', connectedWalletAddress);
        console.log('Raw stake accounts:', stakeAccounts.length);
        
        // IMPORTANT: Store the unsorted accounts first
        currentStakeAccounts = stakeAccounts;
        
        // create stake tabs with proper wallet state
        createStakeTabs(stakeAccounts);
        
        // check withdraw authority match after displaying results
        if (walletConnected) {
            setTimeout(() => checkWithdrawAuthorityMatch(), 100);
        }
        
        hideInfo();
        
        // show completion message
        if (stakeAccounts.length > 0) {
            showInfo(`✅ Found ${stakeAccounts.length} delegated stake account(s)`);
            setTimeout(() => hideInfo(), 3000); // auto hide after 3 seconds
        }
        
    } catch (error) {
        hideInfo();
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

        // Get account balance
        const balance = await connection.getBalance(voteAccountPubkey);
        const balanceInSol = balance / solanaWeb3.LAMPORTS_PER_SOL;

        // Extract vote account information
        const result = {
            validatorIdentity: voteData.node || foundAccount?.nodePubkey || 'N/A',
            withdrawAuthority: voteData.authorizedWithdrawer || 'N/A',
            credits: 'N/A',
            commission: 'N/A',
            accountBalance: balanceInSol
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
    accountBalanceEl.textContent = formatBalance(voteAccountInfo.accountBalance);
    
    showResults();
    
    // Check withdraw authority after displaying results
    if (walletConnected) {
        setTimeout(() => checkWithdrawAuthorityMatch(), 50);
    } else {
        updateWithdrawButtonState(false);
    }
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

// Format balance with SOL units
function formatBalance(balance) {
    if (balance === 'N/A' || balance === 'Unknown' || balance === null || balance === undefined) return 'N/A';
    return `${balance.toFixed(4)} SOL`;
}

// UI helper functions
function showLoading() {
    loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

// show success message
function showSuccess(message) {
    successText.innerHTML = message;
    successMessage.classList.remove('hidden');
    // hide error message (if any)
    hideError();
}

function hideSuccess() {
    successMessage.classList.add('hidden');
}

function showError(message) {
    errorText.innerHTML = message;
    errorMessage.classList.remove('hidden');
    // hide success message (if any)
    hideSuccess();
}

function hideError() {
    errorMessage.classList.add('hidden');
}

// show error message with link
function showErrorWithLink(message, linkUrl, linkText) {
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    
    if (linkUrl && linkText) {
        const linkEl = document.createElement('a');
        linkEl.href = linkUrl;
        linkEl.target = '_blank';
        linkEl.style.color = '#4CAF50';
        linkEl.style.textDecoration = 'underline';
        linkEl.textContent = linkText;
        
        messageEl.appendChild(document.createTextNode(' '));
        messageEl.appendChild(linkEl);
    }
    
    errorText.innerHTML = '';
    errorText.appendChild(messageEl);
    errorMessage.classList.remove('hidden');
}

function showResults() {
    resultsSection.classList.remove('hidden');
}

function hideResults() {
    resultsSection.classList.add('hidden');
    // Disable withdraw button when hiding results
    updateWithdrawButtonState(false);
}

// Show withdraw modal
function showWithdrawModal() {
    // Check if user has withdraw authority
    if (!walletConnected || !connectedWalletAddress) {
        showError('Please connect your wallet first');
        return;
    }
    
    const withdrawAuthority = withdrawAuthorityEl.textContent;
    if (withdrawAuthority !== connectedWalletAddress) {
        showError('You do not have withdraw authority for this vote account');
        return;
    }
    
    // Get current balance
    const balanceText = accountBalanceEl.textContent;
    const currentBalance = parseFloat(balanceText.replace(' SOL', ''));
    
    if (isNaN(currentBalance) || currentBalance <= 0) {
        showError('No balance available for withdrawal');
        return;
    }

    // Populate modal with connected wallet address as recipient
    availableBalanceEl.textContent = currentBalance.toFixed(4);
    withdrawToInput.value = connectedWalletAddress; // Use connected wallet address
    withdrawAmountInput.value = '';
    
    // Add max button
    addMaxAmountButton();
    
    // Show modal
    withdrawModal.classList.remove('hidden');
    
    // Focus on amount input
    setTimeout(() => {
        withdrawAmountInput.focus();
    }, 100);
}

// Add helper function to add max amount button
function addMaxAmountButton() {
    const withdrawAmountInput = document.getElementById('withdrawAmount');
    const formGroup = withdrawAmountInput.parentElement;
    
    // Check if max button already exists
    if (formGroup.querySelector('.max-btn')) return;
    
    const maxBtn = document.createElement('button');
    maxBtn.type = 'button';
    maxBtn.className = 'max-btn';
    maxBtn.textContent = 'Max';
    maxBtn.onclick = () => {
        const availableBalance = parseFloat(availableBalanceEl.textContent);
        // Leave a small amount for transaction fees (0.001 SOL)
        const maxWithdrawAmount = Math.max(0, availableBalance - 0.001);
        withdrawAmountInput.value = maxWithdrawAmount.toFixed(6);
    };
    
    formGroup.style.position = 'relative';
    formGroup.appendChild(maxBtn);
}

// Hide withdraw modal
function hideWithdrawModal() {
    withdrawModal.classList.add('hidden');
    withdrawAmountInput.value = '';
}

// Execute withdraw
async function executeWithdraw() {
    const amount = parseFloat(withdrawAmountInput.value);
    const recipient = withdrawToInput.value.trim();

    if (!amount || amount <= 0) {
        showError('Please enter a valid amount');
        return;
    }

    const availableBalance = parseFloat(availableBalanceEl.textContent);
    if (amount > availableBalance) {
        showError('Withdrawal amount exceeds available balance');
        return;
    }

    if (!recipient) {
        showError('Please enter recipient address');
        return;
    }

    if (!walletConnected || !wallet) {
        showError('Wallet not connected');
        return;
    }

    // Get button reference and store original text outside try block
    const confirmBtn = document.querySelector('.btn-confirm');
    const originalText = confirmBtn.textContent;

    try {
        // Disable withdraw button during transaction
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        // Convert SOL to lamports
        const lamports = Math.floor(amount * solanaWeb3.LAMPORTS_PER_SOL);
        
        // Get current vote account public key
        const voteAccountStr = document.getElementById('voteAccount').value.trim();
        
        // Validate and create PublicKeys with error handling
        let voteAccountPubkey, recipientPubkey, withdrawAuthorityPubkey;
        
        try {
            voteAccountPubkey = new solanaWeb3.PublicKey(voteAccountStr);
            recipientPubkey = new solanaWeb3.PublicKey(recipient);
            withdrawAuthorityPubkey = new solanaWeb3.PublicKey(connectedWalletAddress);
        } catch (keyError) {
            throw new Error('Invalid public key format: ' + keyError.message);
        }

        console.log('Creating withdraw transaction:', {
            voteAccount: voteAccountPubkey.toString(),
            withdrawAuthority: withdrawAuthorityPubkey.toString(),
            recipient: recipientPubkey.toString(),
            amount: amount,
            lamports: lamports
        });

        // Get latest blockhash with retry mechanism
        let blockhash, lastValidBlockHeight;
        let retries = 3;
        
        while (retries > 0) {
            try {
                const result = await connection.getLatestBlockhash('finalized');
                blockhash = result.blockhash;
                lastValidBlockHeight = result.lastValidBlockHeight;
                break;
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                console.log(`Retrying to get blockhash... ${retries} attempts left`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log('Got fresh blockhash:', blockhash);
        
        // Create transaction with fresh blockhash
        const transaction = new solanaWeb3.Transaction({
            recentBlockhash: blockhash,
            feePayer: withdrawAuthorityPubkey,
        });

        // Create withdraw instruction manually using the correct format
        // Vote program ID on Solana
        const VOTE_PROGRAM_ID = new solanaWeb3.PublicKey('Vote111111111111111111111111111111111111111');
        
        // Withdraw instruction data - using Uint8Array instead of Buffer
        const instructionData = new Uint8Array(12);
        
        // Write instruction type (3 = withdraw) as 4-byte little endian
        const instructionType = 3;
        instructionData[0] = instructionType & 0xff;
        instructionData[1] = (instructionType >> 8) & 0xff;
        instructionData[2] = (instructionType >> 16) & 0xff;
        instructionData[3] = (instructionType >> 24) & 0xff;
        
        // Write lamports as 8-byte little endian
        const lamportsBigInt = BigInt(lamports);
        for (let i = 0; i < 8; i++) {
            instructionData[4 + i] = Number((lamportsBigInt >> BigInt(i * 8)) & BigInt(0xff));
        }

        const withdrawInstruction = new solanaWeb3.TransactionInstruction({
            keys: [
                { pubkey: voteAccountPubkey, isSigner: false, isWritable: true },
                { pubkey: recipientPubkey, isSigner: false, isWritable: true },
                { pubkey: withdrawAuthorityPubkey, isSigner: true, isWritable: false },
            ],
            programId: VOTE_PROGRAM_ID,
            data: instructionData,
        });

        // Add instruction to transaction
        transaction.add(withdrawInstruction);

        console.log('Transaction created with fresh blockhash:', {
            blockhash: blockhash,
            feePayer: withdrawAuthorityPubkey.toString(),
            instructions: transaction.instructions.length,
            instructionProgramId: withdrawInstruction.programId.toString(),
            instructionKeys: withdrawInstruction.keys.map(k => ({
                pubkey: k.pubkey.toString(),
                isSigner: k.isSigner,
                isWritable: k.isWritable
            })),
            instructionDataLength: instructionData.length,
            instructionDataArray: Array.from(instructionData)
        });

        let signature;
        try {
            // separate signature and send steps, instead of using signAndSendTransaction
            console.log('Requesting wallet signature...');
            
            // step 1: only sign transaction
            const signedTransaction = await wallet.signTransaction(transaction);
            console.log('Transaction signed successfully');
            
            // step 2: manually send signed transaction
            signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3,
            });
            
            console.log('Transaction sent with signature:', signature);
            
        } catch (walletError) {
            // Handle "Plugin Closed" error specifically
            if (walletError.message && walletError.message.includes('Plugin Closed')) {
                console.log('Plugin closed error detected, checking if transaction was sent...');
                
                // Wait a bit for potential transaction to be processed
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Try to check if balance changed instead of checking signatures
                try {
                    const currentBalance = await connection.getBalance(voteAccountPubkey);
                    const currentBalanceInSol = currentBalance / solanaWeb3.LAMPORTS_PER_SOL;
                    const originalBalance = parseFloat(availableBalanceEl.textContent);
                    
                    console.log('Balance check:', {
                        original: originalBalance,
                        current: currentBalanceInSol,
                        difference: originalBalance - currentBalanceInSol
                    });
                    
                    // If balance decreased by approximately the withdrawal amount, assume success
                    const expectedDecrease = amount;
                    const actualDecrease = originalBalance - currentBalanceInSol;
                    
                    if (Math.abs(actualDecrease - expectedDecrease) < 0.01) { // Allow 0.01 SOL tolerance for fees
                        console.log('Balance decreased as expected, transaction likely successful');
                        
                        // Update the displayed balance
                        accountBalanceEl.textContent = formatBalance(currentBalanceInSol);
                        
                        // Show success message without transaction link
                        showSuccess('✅ Withdrawal appears successful! Your balance has been updated. Please check your wallet for confirmation.');
                        
                        // Hide modal
                        hideWithdrawModal();
                        return; // Exit successfully
                    } else {
                        console.log('Balance did not change as expected, transaction may have failed');
                        throw new Error('Transaction may have failed - balance unchanged after wallet plugin closed');
                    }
                } catch (balanceCheckError) {
                    console.error('Failed to check balance:', balanceCheckError);
                    throw new Error('Wallet plugin closed during signing. Please check your wallet history and account balance manually.');
                }
            } else {
                throw walletError; // Re-throw other wallet errors
            }
        }

        if (signature) {
            // Show processing message
            hideError();
            showError('Transaction sent! Waiting for confirmation...');
            
            try {
                // Wait for confirmation with timeout
                const confirmationPromise = connection.confirmTransaction(signature, 'confirmed');

                // Add timeout to avoid waiting forever
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Transaction confirmation timeout')), 45000)
                );

                const confirmation = await Promise.race([confirmationPromise, timeoutPromise]);

                if (confirmation.value && confirmation.value.err) {
                    throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
                }

                console.log('Transaction confirmed:', confirmation);

                // Show success message with full X1 explorer URL
                const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                showSuccess(`✅ Withdrawal successful! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
        
        // Hide modal
        hideWithdrawModal();

                // Refresh account balance after successful withdrawal
                setTimeout(async () => {
                    try {
                        const newBalance = await connection.getBalance(voteAccountPubkey);
                        const newBalanceInSol = newBalance / solanaWeb3.LAMPORTS_PER_SOL;
                        accountBalanceEl.textContent = formatBalance(newBalanceInSol);
                        console.log('Balance refreshed:', newBalanceInSol);
                    } catch (error) {
                        console.error('Failed to refresh balance:', error);
                    }
                }, 3000);
            } catch (confirmationError) {
                if (confirmationError.message.includes('timeout')) {
                    // Even if confirmation times out, the transaction might have succeeded
                    // Refresh balance to check
                    setTimeout(async () => {
                        try {
                            const newBalance = await connection.getBalance(voteAccountPubkey);
                            const newBalanceInSol = newBalance / solanaWeb3.LAMPORTS_PER_SOL;
                            accountBalanceEl.textContent = formatBalance(newBalanceInSol);
                            console.log('Balance refreshed after timeout:', newBalanceInSol);
                        } catch (error) {
                            console.error('Failed to refresh balance after timeout:', error);
                        }
                    }, 5000);
                    
                    const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                    showWarning(`⚠️ Transaction confirmation timeout. Please check the transaction status: <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
                    hideWithdrawModal();
                } else {
                    throw confirmationError;
                }
            }
        }

    } catch (error) {
        console.error('Withdrawal failed:', error);
        
        // Handle specific error types
        let errorMessage = 'Withdrawal failed: ';
        
        if (error.message && error.message.includes('Plugin Closed')) {
            errorMessage = 'Wallet plugin was closed during signing. Please check your wallet history and account balance to verify if the transaction was successful.';
        } else if (error.message && error.message.includes('balance unchanged')) {
            errorMessage = 'Transaction may have failed - your account balance appears unchanged. Please check your wallet for any error messages.';
        } else if (error.message && error.message.includes('User rejected') || error.message && error.message.includes('rejected')) {
            errorMessage = 'Transaction was rejected by user';
        } else if (error.message && error.message.includes('insufficient funds') || error.message && error.message.includes('Insufficient')) {
            errorMessage = 'Insufficient funds for transaction';
        } else if (error.message && error.message.includes('blockhash not found')) {
            errorMessage = 'Network error, please try again';
        } else if (error.message && error.message.includes('Invalid public key')) {
            errorMessage = 'Invalid address format';
        } else if (error.message && error.message.includes('0x1')) {
            errorMessage = 'Insufficient account balance for transaction fees';
        } else if (error.message && error.message.includes('0x6')) {
            errorMessage = 'Invalid withdraw authority';
        } else {
            errorMessage += error.message || 'Unknown error occurred';
        }
        
        showError(errorMessage);
    } finally {
        // Re-enable withdraw button
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
    }
}

// show error message with link
function showWarning(message) {
    // can reuse error style but use different color, or create new warning style
    errorText.innerHTML = message;
    errorMessage.classList.remove('hidden');
    errorMessage.style.background = '#fff3e0';
    errorMessage.style.color = '#ef6c00';
    errorMessage.style.borderLeftColor = '#ff9800';
    const icon = errorMessage.querySelector('i');
    icon.className = 'fas fa-exclamation-circle';
    icon.style.color = '#ff9800';
}

// add: function to show info messages (for process states)
function showInfo(message, loading = false) {
    // hide other messages
    hideError();
    hideSuccess();
    hideWarning();
    
    infoText.innerHTML = message;
    infoMessage.classList.remove('hidden');
    
    // add loading animation if specified
    if (loading) {
        infoMessage.classList.add('loading');
        const icon = infoMessage.querySelector('i');
        icon.className = 'fas fa-spinner';
    } else {
        infoMessage.classList.remove('loading');
        const icon = infoMessage.querySelector('i');
        icon.className = 'fas fa-info-circle';
    }
}

// add: function to hide info message
function hideInfo() {
    infoMessage.classList.add('hidden');
    infoMessage.classList.remove('loading');
}

// modify: showWarning function to use new warning message style
function showWarning(message) {
    // hide other messages
    hideError();
    hideSuccess();
    hideInfo();
    
    warningText.innerHTML = message;
    warningMessage.classList.remove('hidden');
}

// add: function to hide warning message
function hideWarning() {
    warningMessage.classList.add('hidden');
}

// modify: showSuccess function to hide other messages
function showSuccess(message) {
    successText.innerHTML = message;
    successMessage.classList.remove('hidden');
    // hide other messages
    hideError();
    hideInfo();
    hideWarning();
}

// modify: showError function to hide other messages
function showError(message) {
    errorText.innerHTML = message;
    errorMessage.classList.remove('hidden');
    // hide other messages
    hideSuccess();
    hideInfo();
    hideWarning();
}

// modify: handleSearch function to use appropriate message types
async function handleSearch() {
    const voteAccountStr = voteAccountInput.value.trim();
    
    if (!voteAccountStr) {
        showError('Please enter a vote account public key');
        return;
    }

    hideError();
    hideInfo();
    hideWarning();
    hideSuccess();
    hideResults();
    removeWithdrawAuthorityMatch();

    try {
        // validate and create PublicKey
        const voteAccountPubkey = new solanaWeb3.PublicKey(voteAccountStr);
        
        // show info message for vote account loading
        showInfo('Loading vote account information...', true);
        
        const voteAccountInfo = await getVoteAccountInfoWithWeb3(voteAccountPubkey);
        displayResults(voteAccountInfo);
        
        // show info message for stake accounts loading
        showInfo('Loading delegated stake accounts...', true);
        const stakeAccounts = await getStakeAccountsForVoteAccount(voteAccountPubkey);
        
        console.log('=== Before createStakeTabs ===');
        console.log('Wallet connected:', walletConnected);
        console.log('Connected address:', connectedWalletAddress);
        console.log('Raw stake accounts:', stakeAccounts.length);
        
        // IMPORTANT: Store the unsorted accounts first
        currentStakeAccounts = stakeAccounts;
        
        // create stake tabs with proper wallet state
        createStakeTabs(stakeAccounts);
        
        // check withdraw authority match after displaying results
        if (walletConnected) {
            setTimeout(() => checkWithdrawAuthorityMatch(), 100);
        }
        
        hideInfo();
        
        // show completion message
        if (stakeAccounts.length > 0) {
            showInfo(`✅ Found ${stakeAccounts.length} delegated stake account(s)`);
            setTimeout(() => hideInfo(), 3000); // auto hide after 3 seconds
        }
        
    } catch (error) {
        hideInfo();
        if (error.message.includes('Invalid public key input')) {
            showError('Invalid public key format');
        } else {
            showError(`Error fetching vote account info: ${error.message}`);
        }
        console.error('Error:', error);
    }
}

// modify: get Backpack wallet accounts - add fallback for manual input
async function getBackpackAccounts() {
    if (!window.backpack?.solana || typeof window.backpack.solana._backpackGetAccounts !== 'function') {
        throw new Error('MANUAL_INPUT_REQUIRED');
    }
    
    try {
        const accountsData = await window.backpack.solana._backpackGetAccounts();
        console.log('Retrieved Backpack accounts:', accountsData);
        
        const accounts = [];
        
        if (accountsData.users && Array.isArray(accountsData.users)) {
            for (const user of accountsData.users) {
                // use correct data structure path
                if (user.publicKeys && 
                    user.publicKeys.platforms && 
                    user.publicKeys.platforms.solana && 
                    user.publicKeys.platforms.solana.activePublicKey) {
                    
                    const publicKey = user.publicKeys.platforms.solana.activePublicKey;
                    
                    accounts.push({
                        username: user.username || `Account ${accounts.length + 1}`,
                        uuid: user.uuid,
                        publicKey: publicKey,
                        isActive: user.uuid === accountsData.activeUser
                    });
                    
                    console.log('Added account:', {
                        username: user.username,
                        publicKey: publicKey,
                        isActive: user.uuid === accountsData.activeUser
                    });
                }
            }
        }
        
        console.log('Final processed accounts:', accounts);
        return accounts;
    } catch (error) {
        console.error('Failed to get Backpack accounts:', error);
        // Throw manual input required for access denied errors
        if (error.message && error.message.includes('Access Denied')) {
            throw new Error('MANUAL_INPUT_REQUIRED');
        }
        throw error;
    }
}

// modify: show account selector modal - add manual input fallback
function showAccountSelector() {
    if (!walletConnected) {
        showError('Please connect your wallet first');
        return;
    }
    
    getBackpackAccounts().then(accounts => {
        createAccountSelectorModal(accounts);
    }).catch(error => {
        if (error.message === 'MANUAL_INPUT_REQUIRED') {
            showManualAddressInputModal();
        } else {
            showError('Failed to retrieve wallet accounts: ' + error.message);
        }
    });
}

// add: create account selector modal - current account does not show select button
function createAccountSelectorModal(accounts) {
    console.log('Creating modal with accounts:', accounts);
    
    // check account data
    if (!accounts || accounts.length === 0) {
        showError('No accounts found in Backpack wallet');
        return;
    }
    
    // check if modal exists, if exists, remove it
    const existingModal = document.getElementById('accountSelectorModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'accountSelectorModal';
    modal.className = 'modal';
    
    // generate accounts list HTML - current account does not show select button
    const accountsHTML = accounts.map(account => {
        console.log('Generating HTML for account:', account);
        
        // check if show select button
        const showSelectButton = !account.isActive;
        
        return `
            <div class="account-item" data-public-key="${account.publicKey}">
                <div class="account-info">
                    <div class="account-name">
                        ${account.username}
                        ${account.isActive ? '<span class="active-badge">Current</span>' : ''}
                    </div>
                    <div class="account-address">${account.publicKey}</div>
                </div>
                ${showSelectButton ? 
                    `<button class="select-account-btn" onclick="selectNewWithdrawAuthority('${account.publicKey}', '${account.username}')">
                        Select
                    </button>` : 
                    `<span class="current-indicator">
                        <i class="fas fa-check"></i>
                        Current
                    </span>`
                }
            </div>
        `;
    }).join('');
    
    console.log('Generated accounts HTML:', accountsHTML);
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-users"></i> Select New Withdraw Authority</h3>
                <button class="modal-close" onclick="hideAccountSelectorModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 16px; color: #666; font-size: 14px;">
                    Choose which wallet address should become the new withdraw authority for this vote account:
                </p>
                <div class="account-list">
                    ${accountsHTML}
                </div>
                <div class="modal-note">
                    <i class="fas fa-info-circle"></i>
                    <small>This will create a transaction to update the withdraw authority. You'll need to sign the transaction with the current withdraw authority.</small>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="hideAccountSelectorModal()">Cancel</button>
            </div>
        </div>
    `;
    
    console.log('Modal HTML:', modal.innerHTML);
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    
    console.log('Modal added to DOM and shown');
}

// add: hide account selector modal
function hideAccountSelectorModal() {
    const modal = document.getElementById('accountSelectorModal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

// add: select new withdraw authority
async function selectNewWithdrawAuthority(newAuthority, accountName) {
    hideAccountSelectorModal();
    
    // confirm operation
    if (!confirm(`Are you sure you want to update the withdraw authority to "${accountName}" (${newAuthority})?`)) {
        return;
    }
    
    try {
        await executeWithdrawAuthorityUpdate(newAuthority);
    } catch (error) {
        showError('Failed to update withdraw authority: ' + error.message);
    }
}

// add: manual address input modal
function showManualAddressInputModal() {
    const existingModal = document.getElementById('manualAddressModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'manualAddressModal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Update Withdraw Authority</h3>
                <button class="modal-close" onclick="hideManualAddressModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-note" style="margin-bottom: 16px; background: #e3f2fd; color: #1565c0; border-left: 4px solid #2196f3;">
                    <i class="fas fa-info-circle"></i>
                    <p><strong>Multiple account selection not available</strong><br>
                    Please enter the new withdraw authority address manually.</p>
                </div>
                
                <div class="form-group">
                    <label for="manualAddress">New Withdraw Authority Address:</label>
                    <input 
                        type="text" 
                        id="manualAddress" 
                        placeholder="Enter wallet address..." 
                        autocomplete="off"
                        style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 14px;"
                    >
                </div>
                
                <div class="current-wallet-info" style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 12px 0;">
                    <strong>Current Connected Wallet:</strong><br>
                    <span style="font-family: monospace; color: #666; word-break: break-all;">${connectedWalletAddress}</span>
                </div>
                
                <div class="modal-note">
                    <i class="fas fa-lightbulb"></i>
                    <small>
                        <strong>Alternative method:</strong> Ask the target wallet owner to:
                        <ol style="margin: 8px 0; padding-left: 20px;">
                            <li>Connect their Backpack wallet to this page</li>
                            <li>Refresh the page and try the Update button again</li>
                        </ol>
                        This may allow automatic account detection.
                    </small>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="hideManualAddressModal()">Cancel</button>
                <button class="btn-confirm" onclick="processManualAddressInput()">Update Authority</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        document.getElementById('manualAddress').focus();
    }, 100);
}

// add: hide manual address input modal
function hideManualAddressModal() {
    const modal = document.getElementById('manualAddressModal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

// add: process manual address input
function processManualAddressInput() {
    const addressInput = document.getElementById('manualAddress');
    const newAddress = addressInput.value.trim();
    
    if (!newAddress) {
        showError('Please enter a valid wallet address');
        return;
    }
    
    // Validate address format
    try {
        new solanaWeb3.PublicKey(newAddress);
    } catch (error) {
        showError('Invalid wallet address format');
        return;
    }
    
    // Check if it's the same as current address
    if (newAddress === connectedWalletAddress) {
        showError('New address cannot be the same as current address');
        return;
    }
    
    hideManualAddressModal();
    
    // Confirm the update
    if (confirm(`Are you sure you want to update the withdraw authority to:\n\n${newAddress}\n\nPlease verify this address is correct.`)) {
        selectNewWithdrawAuthority(newAddress, 'Manual Input');
    }
}

// add: function to switch active account in Backpack wallet
async function switchToAccount(targetAddress) {
    if (!window.backpack?.solana) {
        throw new Error('Backpack wallet not available');
    }
    
    try {
        console.log('Attempting to switch to account:', targetAddress);
        
        // get all accounts to find the target UUID
        const accountsData = await window.backpack.solana._backpackGetAccounts();
        let targetAccountUuid = null;
        
        // find the UUID for the target address
        for (const user of accountsData.users) {
            if (user.publicKeys && 
                user.publicKeys.platforms && 
                user.publicKeys.platforms.solana && 
                user.publicKeys.platforms.solana.activePublicKey === targetAddress) {
                targetAccountUuid = user.uuid;
                break;
            }
        }
        
        if (!targetAccountUuid) {
            throw new Error('Target account not found in wallet');
        }
        
        console.log('Found target account UUID:', targetAccountUuid);
        
        // attempt to switch account using internal API
        if (typeof window.backpack.solana._setActiveUser === 'function') {
            await window.backpack.solana._setActiveUser(targetAccountUuid);
            console.log('Account switched successfully via _setActiveUser');
            return true;
        } else if (typeof window.backpack.solana.switchAccount === 'function') {
            await window.backpack.solana.switchAccount(targetAccountUuid);
            console.log('Account switched successfully via switchAccount');
            return true;
        } else {
            console.log('No account switching API found, trying disconnect/reconnect approach');
            
            // fallback: force reconnection which might prompt user to select account
            await wallet.disconnect();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // this might open account selection in Backpack
            await wallet.connect();
            return false; // manual selection required
        }
        
    } catch (error) {
        console.error('Failed to switch account:', error);
        return false;
    }
}

// add: function to update wallet connection after account switch
async function updateWalletConnectionAfterSwitch(newAddress) {
    try {
        // wait a moment for wallet to update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // check if wallet connection reflects the new address
        if (wallet && wallet.publicKey) {
            const currentAddress = wallet.publicKey.toString();
            if (currentAddress === newAddress) {
                // update our internal state
                walletConnected = true;
                connectedWalletAddress = newAddress;
                updateWalletUI(newAddress);
                
                // recheck withdraw authority match
                checkWithdrawAuthorityMatch();
                
                console.log('Wallet connection updated to new address:', newAddress);
                return true;
            }
        }
        
        // if automatic detection failed, try to trigger wallet connection events
        try {
            await wallet.connect();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (wallet.publicKey && wallet.publicKey.toString() === newAddress) {
                walletConnected = true;
                connectedWalletAddress = newAddress;
                updateWalletUI(newAddress);
                checkWithdrawAuthorityMatch();
                return true;
            }
        } catch (reconnectError) {
            console.log('Reconnect attempt failed:', reconnectError);
        }
        
        return false;
    } catch (error) {
        console.error('Failed to update wallet connection:', error);
        return false;
    }
}

// modify: execute withdraw authority update transaction - add auto account switch
async function executeWithdrawAuthorityUpdate(newAuthority) {
    if (!walletConnected || !wallet) {
        throw new Error('Wallet not connected');
    }
    
    const currentAuthority = withdrawAuthorityEl.textContent;
    if (currentAuthority !== connectedWalletAddress) {
        throw new Error('You must be the current withdraw authority to update it');
    }
    
    showInfo('Creating withdraw authority update transaction...', true);
    
    try {
        // get current vote account
        const voteAccountStr = document.getElementById('voteAccount').value.trim();
        const voteAccountPubkey = new solanaWeb3.PublicKey(voteAccountStr);
        const currentAuthorityPubkey = new solanaWeb3.PublicKey(currentAuthority);
        const newAuthorityPubkey = new solanaWeb3.PublicKey(newAuthority);
        
        // get latest blockhash
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        
        // create transaction
        const transaction = new solanaWeb3.Transaction({
            recentBlockhash: blockhash,
            feePayer: currentAuthorityPubkey,
        });
        
        // use the correct VoteAuthorizationLayout.Withdrawer
        const authorizeInstruction = solanaWeb3.VoteProgram.authorize({
            votePubkey: voteAccountPubkey,
            authorizedPubkey: currentAuthorityPubkey,
            newAuthorizedPubkey: newAuthorityPubkey,
            voteAuthorizationType: solanaWeb3.VoteAuthorizationLayout.Withdrawer
        });
        
        transaction.add(authorizeInstruction);
        
        console.log('VoteProgram.authorize transaction created:', {
            voteAccount: voteAccountPubkey.toString(),
            currentAuthority: currentAuthorityPubkey.toString(),
            newAuthority: newAuthorityPubkey.toString(),
            authorizationType: 'VoteAuthorizationLayout.Withdrawer'
        });
        
        // sign and send transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });
        
        console.log('Transaction sent:', signature);
        showInfo('Transaction sent! Waiting for confirmation...', true);
        
        // wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        
        // update UI withdraw authority display
        withdrawAuthorityEl.textContent = newAuthority;
        
        // immediately recheck withdraw authority match with current connected wallet
        checkWithdrawAuthorityMatch();
        
        const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
        
        // attempt to automatically switch to the new authority account
        showInfo('Attempting to switch wallet to new authority address...', true);
        
        const switchSuccessful = await switchToAccount(newAuthority);
        
        if (switchSuccessful) {
            // wait for wallet to update and then update our connection
            const connectionUpdated = await updateWalletConnectionAfterSwitch(newAuthority);
            
            if (connectionUpdated) {
                showSuccess(`✅ Withdraw authority updated and wallet switched to new address! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
            } else {
                showWarning(`✅ Withdraw authority updated but wallet switch needs verification. Please check if you're now connected to ${newAuthority.slice(0,8)}... <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
                // manually trigger authority check after delay
                setTimeout(() => {
                    checkWithdrawAuthorityMatch();
                }, 3000);
            }
        } else {
            // fallback: show manual instruction
            showWarning(`✅ Withdraw authority updated successfully! Please manually switch to the new address (${newAuthority.slice(0,8)}...) in your Backpack wallet to continue managing this vote account. <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
            // still check authority match periodically in case user manually switches
            const checkInterval = setInterval(() => {
                if (connectedWalletAddress === newAuthority) {
                    clearInterval(checkInterval);
                    checkWithdrawAuthorityMatch();
                    showSuccess(`✅ Wallet switched successfully! You now have withdraw authority. <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
                }
            }, 2000);
            
            // stop checking after 30 seconds
            setTimeout(() => clearInterval(checkInterval), 30000);
        }
        
    } catch (error) {
        console.error('Update withdraw authority failed:', error);
        throw error;
    }
}

// improve: showWithdrawAuthorityMatch function - ensure correct container structure
function showWithdrawAuthorityMatch(isMatch) {
    const withdrawCard = withdrawAuthorityEl.closest('.info-card');
    const existingIndicator = withdrawCard.querySelector('.authority-match-indicator');
    const existingButton = withdrawCard.querySelector('.update-authority-btn');
    
    // Remove existing indicator and button
    if (existingIndicator) {
        existingIndicator.remove();
    }
    if (existingButton) {
        existingButton.remove();
    }
    
    // Remove existing classes
    withdrawCard.classList.remove('authority-match', 'authority-no-match');
    
    if (isMatch) {
        // ensure address is wrapped in the appropriate container
        let addressParent = withdrawAuthorityEl.parentElement;
        
        // if address is not in address-container, create one
        if (!addressParent.classList.contains('address-container')) {
            const addressContainer = document.createElement('div');
            addressContainer.className = 'address-container';
            
            // move address element to new container
            addressParent.insertBefore(addressContainer, withdrawAuthorityEl);
            addressContainer.appendChild(withdrawAuthorityEl);
            
            addressParent = addressContainer;
        }
        
        // create Update button
        const updateButton = document.createElement('button');
        updateButton.className = 'update-authority-btn';
        updateButton.onclick = showAccountSelector;
        updateButton.innerHTML = `
            <i class="fas fa-edit"></i>
            Update
        `;
        
        // add button to address container
        addressParent.appendChild(updateButton);
        
        // add style class
        withdrawCard.classList.add('authority-match');
        
        console.log('Update button added to address container');
    } else {
        withdrawCard.classList.add('authority-no-match');
    }
    
    // Add status indicator (show status below)
    const indicator = document.createElement('div');
    indicator.className = 'authority-match-indicator';
    
    if (isMatch) {
        indicator.innerHTML = `
            <div class="match-status match-success">
                <i class="fas fa-check-circle"></i>
                <span>You have withdraw authority</span>
            </div>
        `;
    } else {
        indicator.innerHTML = `
            <div class="match-status match-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <span>You don't have withdraw authority</span>
            </div>
        `;
    }
    
    const infoContent = withdrawCard.querySelector('.info-content');
    infoContent.appendChild(indicator);
}

// simplify: removeWithdrawAuthorityMatch function
function removeWithdrawAuthorityMatch() {
    const withdrawCard = withdrawAuthorityEl.closest('.info-card');
    const indicator = withdrawCard.querySelector('.authority-match-indicator');
    const updateButton = withdrawCard.querySelector('.update-authority-btn');
    
    if (indicator) {
        indicator.remove();
    }
    
    if (updateButton) {
        updateButton.remove();
    }
    
    // remove container's special style
    const addressParent = withdrawAuthorityEl.parentElement;
    if (addressParent) {
        addressParent.classList.remove('address-container');
    }
    
    withdrawCard.classList.remove('authority-match', 'authority-no-match');
    
    // Disable withdraw button when removing authority match
    updateWithdrawButtonState(false);
}

// add: function to get all stake accounts delegated to a vote account
async function getStakeAccountsForVoteAccount(voteAccountPubkey) {
    try {
        console.log('Searching for stake accounts delegated to:', voteAccountPubkey.toString());
        
        // get all stake program accounts
        const stakeProgram = new solanaWeb3.PublicKey('Stake11111111111111111111111111111111111111');
        
        // filter for accounts delegated to our vote account
        const accounts = await connection.getProgramAccounts(stakeProgram, {
            filters: [
                {
                    memcmp: {
                        offset: 124, // offset for vote account pubkey in stake account
                        bytes: voteAccountPubkey.toBase58(),
                    },
                },
            ],
        });
        
        console.log('Found', accounts.length, 'stake accounts');
        
        const stakeAccounts = [];
        for (const account of accounts) {
            try {
                // parse stake account data
                const stakeAccount = await connection.getParsedAccountInfo(account.pubkey);
                if (stakeAccount.value && stakeAccount.value.data.program === 'stake') {
                    const stakeData = stakeAccount.value.data.parsed.info;
                    
                    // verify it's delegated to our vote account
                    if (stakeData.stake && 
                        stakeData.stake.delegation && 
                        stakeData.stake.delegation.voter === voteAccountPubkey.toString()) {
                        
                        stakeAccounts.push({
                            pubkey: account.pubkey.toString(),
                            lamports: account.account.lamports,
                            data: stakeData,
                            accountInfo: stakeAccount.value
                        });
                    }
                }
            } catch (error) {
                console.warn('Failed to parse stake account:', account.pubkey.toString(), error);
            }
        }
        
        console.log('Processed stake accounts:', stakeAccounts);
        return stakeAccounts;
        
    } catch (error) {
        console.error('Failed to get stake accounts:', error);
        return [];
    }
}

// fix: function to switch tabs - use data attributes instead of onclick
function switchTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    // update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // find the correct button using data attribute or by checking which button corresponds to this tab
    const targetButton = document.querySelector(`[data-tab-id="${tabId}"]`) || 
                        document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    
    if (targetButton) {
        targetButton.classList.add('active');
    } else {
        console.warn('Could not find tab button for:', tabId);
    }
    
    // update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.classList.add('active');
    } else {
        console.warn('Could not find tab content for:', tabId);
    }
    
    activeTab = tabId;
    console.log('Switched to tab:', tabId);
}

// modify: createStakeTab function - add authority indicators to tab title
function createStakeTab(stakeAccount, index) {
    const stakePubkey = stakeAccount.pubkey;
    const stakeData = stakeAccount.data;
    const lamports = stakeAccount.lamports;
    
    // get actual stake amount (delegated amount) if available, otherwise use total balance
    const delegatedStake = stakeData.stake?.delegation?.stake || 0;
    const solAmount = delegatedStake / solanaWeb3.LAMPORTS_PER_SOL;
    const totalBalance = lamports / solanaWeb3.LAMPORTS_PER_SOL;
    
    // check if user has authority
    const stakeAuthority = stakeData.meta?.authorized?.staker || '';
    const withdrawAuthority = stakeData.meta?.authorized?.withdrawer || '';
    const hasStakeAuthority = walletConnected && connectedWalletAddress && stakeAuthority === connectedWalletAddress;
    const hasWithdrawAuthority = walletConnected && connectedWalletAddress && withdrawAuthority === connectedWalletAddress;
    const hasAnyAuthority = hasStakeAuthority || hasWithdrawAuthority;
    
    // format amount for display
    const formatAmount = (amount) => {
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(1) + 'M';
        } else if (amount >= 1000) {
            return (amount / 1000).toFixed(1) + 'K';
        } else {
            return amount.toFixed(2);
        }
    };
    
    const tabId = `stake-${index}`;
    
    // create tab button with authority indicator
    const tabBtn = document.createElement('button');
    tabBtn.className = 'tab-btn';
    tabBtn.setAttribute('data-tab-id', tabId);
    tabBtn.onclick = () => switchTab(tabId);
    
    // add authority indicator to tab title
    const authorityIndicator = hasAnyAuthority ? 
        `<span class="authority-indicator">
            ${hasStakeAuthority ? '<i class="fas fa-key" title="Stake Authority"></i>' : ''}
            ${hasWithdrawAuthority ? '<i class="fas fa-hand-holding-usd" title="Withdraw Authority"></i>' : ''}
        </span>` : '';
    
    tabBtn.innerHTML = `
        <i class="fas fa-layer-group"></i>
        <span class="stake-rank">#${index + 1}</span>
        <span class="stake-amount">${formatAmount(solAmount)} SOL</span>
        ${authorityIndicator}
    `;
    
    // create tab content using vote account layout style
    const tabContent = document.createElement('div');
    tabContent.id = tabId;
    tabContent.className = 'tab-content';
    
    // extract authorities
    const delegatedVoteAccount = stakeData.stake?.delegation?.voter || 'N/A';
    
    // determine active stake (same as delegated stake for active stakes)
    const activeStake = stakeData.stake ? delegatedStake : 0;
    
    tabContent.innerHTML = `
        <div class="stake-summary-card">
            <div class="stake-summary-title">
                <i class="fas fa-layer-group"></i>
                Stake Account #${index + 1}
                <span class="stake-rank-badge">Rank ${index + 1}</span>
                ${hasAnyAuthority ? '<span class="user-authority-badge">Your Account</span>' : ''}
            </div>
        </div>
        
        <div class="info-grid">
            <!-- Account Balance -->
            <div class="info-card">
                <div class="info-header">
                    <i class="fas fa-wallet"></i>
                    <h3>Account Balance</h3>
                </div>
                <div class="info-content">
                    <span class="balance">${totalBalance.toFixed(6)} SOL</span>
                </div>
            </div>

            <!-- Delegated Stake -->
            <div class="info-card">
                <div class="info-header">
                    <i class="fas fa-coins"></i>
                    <h3>Delegated Stake</h3>
                </div>
                <div class="info-content">
                    <span class="number">${solAmount.toFixed(6)} SOL</span>
                </div>
            </div>

            <!-- Active Stake -->
            <div class="info-card">
                <div class="info-header">
                    <i class="fas fa-check-circle"></i>
                    <h3>Active Stake</h3>
                </div>
                <div class="info-content">
                    <span class="number">${(activeStake / solanaWeb3.LAMPORTS_PER_SOL).toFixed(6)} SOL</span>
                </div>
            </div>

            <!-- Delegated Vote Account -->
            <div class="info-card">
                <div class="info-header">
                    <i class="fas fa-vote-yea"></i>
                    <h3>Delegated Vote Account</h3>
                </div>
                <div class="info-content">
                    <span class="address">${delegatedVoteAccount}</span>
                </div>
            </div>

            <!-- Stake Authority -->
            <div class="info-card stake-authority-card">
                <div class="info-header">
                    <i class="fas fa-user-cog"></i>
                    <h3>Stake Authority</h3>
                </div>
                <div class="info-content">
                    <span class="address stake-authority-address">${stakeAuthority || 'N/A'}</span>
                </div>
            </div>

            <!-- Withdraw Authority -->
            <div class="info-card stake-withdraw-authority-card">
                <div class="info-header">
                    <i class="fas fa-hand-holding-usd"></i>
                    <h3>Withdraw Authority</h3>
                </div>
                <div class="info-content">
                    <span class="address stake-withdraw-authority-address">${withdrawAuthority || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
    
    return { tabBtn, tabContent };
}

// modify: createStakeTabs function - add more debugging
function createStakeTabs(stakeAccounts) {
    console.log('=== createStakeTabs called ===');
    console.log('Accounts to sort:', stakeAccounts.length);
    console.log('Wallet state:', {
        connected: walletConnected,
        address: connectedWalletAddress
    });
    
    const stakeTabsContainer = document.getElementById('stakeTabs');
    const stakeTabsContent = document.getElementById('stakeTabsContent');
    
    // clear existing stake tabs
    stakeTabsContainer.innerHTML = '';
    stakeTabsContent.innerHTML = '';
    
    if (stakeAccounts.length === 0) {
        console.log('No stake accounts found for this vote account');
        return;
    }
    
    // enhanced sorting with debugging
    const sortedStakeAccounts = [...stakeAccounts].sort((a, b) => {
        const stakeAuthorityA = a.data.meta?.authorized?.staker || '';
        const withdrawAuthorityA = a.data.meta?.authorized?.withdrawer || '';
        const stakeAuthorityB = b.data.meta?.authorized?.staker || '';
        const withdrawAuthorityB = b.data.meta?.authorized?.withdrawer || '';
        
        const hasAuthorityA = walletConnected && connectedWalletAddress && (
            stakeAuthorityA === connectedWalletAddress || 
            withdrawAuthorityA === connectedWalletAddress
        );
        const hasAuthorityB = walletConnected && connectedWalletAddress && (
            stakeAuthorityB === connectedWalletAddress || 
            withdrawAuthorityB === connectedWalletAddress
        );
        
        // PRIORITY 1: Authority accounts ALWAYS come first
        if (hasAuthorityA && !hasAuthorityB) return -1;
        if (!hasAuthorityA && hasAuthorityB) return 1;
        
        // PRIORITY 2: sort by stake amount
        const stakeAmountA = a.data.stake?.delegation?.stake || a.lamports;
        const stakeAmountB = b.data.stake?.delegation?.stake || b.lamports;
        return stakeAmountB - stakeAmountA;
    });
    
    // log the actual order that will be displayed
    console.log('=== UI Display Order ===');
    sortedStakeAccounts.forEach((stake, index) => {
        const stakeAuthority = stake.data.meta?.authorized?.staker || '';
        const withdrawAuthority = stake.data.meta?.authorized?.withdrawer || '';
        const hasAuthority = walletConnected && connectedWalletAddress && (
            stakeAuthority === connectedWalletAddress || 
            withdrawAuthority === connectedWalletAddress
        );
        const amount = (stake.data.stake?.delegation?.stake || stake.lamports) / solanaWeb3.LAMPORTS_PER_SOL;
        
        console.log(`UI Tab ${index + 1}: ${stake.pubkey.slice(0,8)}... Authority: ${hasAuthority} Amount: ${amount.toFixed(2)} SOL`);
    });
    
    // create tabs for each stake account in the sorted order
    sortedStakeAccounts.forEach((stakeAccount, index) => {
        const { tabBtn, tabContent } = createStakeTab(stakeAccount, index);
        stakeTabsContainer.appendChild(tabBtn);
        stakeTabsContent.appendChild(tabContent);
    });
    
    // update global reference to sorted accounts
    currentStakeAccounts = sortedStakeAccounts;
    
    console.log('=== createStakeTabs completed ===');
}

// add: function to check stake authorities after displaying stake tab
function checkStakeAuthorities(tabId) {
    if (!walletConnected || !connectedWalletAddress) {
        return;
    }
    
    const tabContent = document.getElementById(tabId);
    if (!tabContent) return;
    
    // check stake authority
    const stakeAuthorityCard = tabContent.querySelector('.stake-authority-card');
    const stakeAuthorityEl = tabContent.querySelector('.stake-authority-address');
    
    if (stakeAuthorityEl && stakeAuthorityCard) {
        const stakeAuthority = stakeAuthorityEl.textContent;
        checkAndShowStakeAuthorityMatch(stakeAuthorityCard, stakeAuthorityEl, stakeAuthority, 'stake');
    }
    
    // check withdraw authority  
    const withdrawAuthorityCard = tabContent.querySelector('.stake-withdraw-authority-card');
    const withdrawAuthorityEl = tabContent.querySelector('.stake-withdraw-authority-address');
    
    if (withdrawAuthorityEl && withdrawAuthorityCard) {
        const withdrawAuthority = withdrawAuthorityEl.textContent;
        checkAndShowStakeAuthorityMatch(withdrawAuthorityCard, withdrawAuthorityEl, withdrawAuthority, 'withdraw');
    }
}

// add: function to check and show authority match for stake accounts
function checkAndShowStakeAuthorityMatch(card, addressEl, authority, type) {
    // remove existing indicator
    const existingIndicator = card.querySelector('.authority-match-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // remove existing classes
    card.classList.remove('authority-match', 'authority-no-match');
    
    if (authority && authority !== 'N/A' && authority !== '-') {
        const indicator = document.createElement('div');
        indicator.className = 'authority-match-indicator';
        
        if (authority === connectedWalletAddress) {
            // user has authority
            indicator.innerHTML = `
                <div class="match-status match-success">
                    <i class="fas fa-check-circle"></i>
                    <span>You have ${type} authority</span>
                </div>
            `;
            card.classList.add('authority-match');
        } else {
            // user doesn't have authority
            indicator.innerHTML = `
                <div class="match-status match-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>You don't have ${type} authority</span>
                </div>
            `;
            card.classList.add('authority-no-match');
        }
        
        const infoContent = card.querySelector('.info-content');
        infoContent.appendChild(indicator);
    }
}

// modify: switchTab function to check authorities when switching to stake tabs
function switchTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    // update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // find the correct button using data attribute or by checking which button corresponds to this tab
    const targetButton = document.querySelector(`[data-tab-id="${tabId}"]`) || 
                        document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    
    if (targetButton) {
        targetButton.classList.add('active');
    } else {
        console.warn('Could not find tab button for:', tabId);
    }
    
    // update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.classList.add('active');
        
        // check authorities if this is a stake tab
        if (tabId.startsWith('stake-')) {
            setTimeout(() => checkStakeAuthorities(tabId), 100);
        }
    } else {
        console.warn('Could not find tab content for:', tabId);
    }
    
    activeTab = tabId;
    console.log('Switched to tab:', tabId);
}

// modify: combine all dynamic CSS styles
const allDynamicCSS = `
.stake-detail-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
}

.stake-detail-item:last-child {
    border-bottom: none;
}

.stake-detail-item label {
    font-weight: 600;
    color: #555;
    margin-right: 16px;
    flex-shrink: 0;
}

.stake-detail-item span {
    text-align: right;
    word-break: break-all;
    color: #333;
}
`;

// add combined CSS to head (keep only one styleElement)
const styleElement = document.createElement('style');
styleElement.textContent = allDynamicCSS;
document.head.appendChild(styleElement);

// Add info message styles
const infoMessageCSS = `
/* Add info message for process states */
.info-message {
    background: #e3f2fd;
    color: #1565c0;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    margin-bottom: 20px;
    border-left: 4px solid #2196f3;
    border: 1px solid #2196f3;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.info-message i {
    color: #2196f3;
    font-size: 16px;
}

.info-message.loading i {
    animation: spin 1s linear infinite;
}

.info-message a {
    color: #1565c0 !important;
    text-decoration: underline;
    font-weight: 500;
}

.info-message a:hover {
    color: #0d47a1 !important;
}

/* Warning message (for non-critical warnings) */
.warning-message {
    background: #fff8e1;
    color: #ef6c00;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    margin-bottom: 20px;
    border-left: 4px solid #ff9800;
    border: 1px solid #ff9800;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.warning-message i {
    color: #ff9800;
}

.warning-message a {
    color: #ef6c00 !important;
    text-decoration: underline;
    font-weight: 500;
}

.warning-message a:hover {
    color: #e65100 !important;
}
`;

// Add warning message styles
const warningMessageCSS = `
/* Warning message (for non-critical warnings) */
.warning-message {
    background: #fff8e1;
    color: #ef6c00;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    margin-bottom: 20px;
    border-left: 4px solid #ff9800;
    border: 1px solid #ff9800;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.warning-message i {
    color: #ff9800;
}

.warning-message a {
    color: #ef6c00 !important;
    text-decoration: underline;
    font-weight: 500;
}

.warning-message a:hover {
    color: #e65100 !important;
}
`;

// Add info message styles to head
const infoStyleElement = document.createElement('style');
infoStyleElement.textContent = infoMessageCSS;
document.head.appendChild(infoStyleElement);

// Add warning message styles to head
const warningStyleElement = document.createElement('style');
warningStyleElement.textContent = warningMessageCSS;
document.head.appendChild(warningStyleElement);

// Add CSS for stake tab enhancements
const stakeTabCSS = `
/* Stake tab enhancements */
.tab-btn .stake-rank {
    background: rgba(102, 126, 234, 0.2);
    color: #667eea;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
    margin-right: 4px;
}

.tab-btn .stake-amount {
    font-weight: 600;
    color: #2e7d32;
}

.tab-btn.active .stake-rank {
    background: rgba(102, 126, 234, 0.3);
    color: #5a67d8;
}

.tab-btn.active .stake-amount {
    color: #1b5e20;
}

/* Stake rank badge in content */
.stake-rank-badge {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 12px;
    margin-left: auto;
}

/* Enhanced stake summary for ranking */
.stake-summary-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
}

.stake-summary-item:has(.stake-summary-label:contains("Share of Total")) {
    background: rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Responsive improvements for mobile */
@media (max-width: 768px) {
    .tab-btn {
        flex-direction: column;
        padding: 8px 12px;
        min-width: 80px;
    }
    
    .tab-btn .stake-rank {
        margin-right: 0;
        margin-bottom: 2px;
    }
    
    .stake-summary-content {
        grid-template-columns: 1fr;
    }
}
`;

console.log('X1 Vote Account Explorer with optimized Backpack detection loaded');