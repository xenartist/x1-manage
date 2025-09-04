// Global variables
let connection = null;
let currentRpcEndpoint = 'https://rpc.testnet.x1.xyz';
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

// fix: get Backpack wallet accounts - use correct data structure
async function getBackpackAccounts() {
    if (!window.backpack?.solana || typeof window.backpack.solana._backpackGetAccounts !== 'function') {
        throw new Error('Backpack wallet not available or method not supported');
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
        throw error;
    }
}

// add: show account selector modal
function showAccountSelector() {
    if (!walletConnected) {
        showError('Please connect your wallet first');
        return;
    }
    
    getBackpackAccounts().then(accounts => {
        createAccountSelectorModal(accounts);
    }).catch(error => {
        showError('Failed to retrieve wallet accounts: ' + error.message);
    });
}

// modify: create account selector modal - current account does not show select button
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
                <div style="margin-top: 10px; padding: 8px; background: #f0f0f0; border-radius: 4px; font-family: monospace; font-size: 12px;">
                    Debug: Found ${accounts.length} accounts
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

// add: execute withdraw authority update transaction
async function executeWithdrawAuthorityUpdate(newAuthority) {
    if (!walletConnected || !wallet) {
        throw new Error('Wallet not connected');
    }
    
    const currentAuthority = withdrawAuthorityEl.textContent;
    if (currentAuthority !== connectedWalletAddress) {
        throw new Error('You must be the current withdraw authority to update it');
    }
    
    showError('Creating withdraw authority update transaction...');
    
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
        
        // Vote program ID
        const VOTE_PROGRAM_ID = new solanaWeb3.PublicKey('Vote111111111111111111111111111111111111111');
        
        // create update withdraw authority instruction
        // instruction type 4 = UpdateWithdrawAuthority
        const instructionData = new Uint8Array(4);
        const instructionType = 4; // UpdateWithdrawAuthority
        instructionData[0] = instructionType & 0xff;
        instructionData[1] = (instructionType >> 8) & 0xff;
        instructionData[2] = (instructionType >> 16) & 0xff;
        instructionData[3] = (instructionType >> 24) & 0xff;
        
        const updateInstruction = new solanaWeb3.TransactionInstruction({
            keys: [
                { pubkey: voteAccountPubkey, isSigner: false, isWritable: true },
                { pubkey: newAuthorityPubkey, isSigner: false, isWritable: false },
                { pubkey: currentAuthorityPubkey, isSigner: true, isWritable: false },
            ],
            programId: VOTE_PROGRAM_ID,
            data: instructionData,
        });
        
        transaction.add(updateInstruction);
        
        console.log('Update withdraw authority transaction created:', {
            voteAccount: voteAccountPubkey.toString(),
            currentAuthority: currentAuthorityPubkey.toString(),
            newAuthority: newAuthorityPubkey.toString()
        });
        
        // sign and send transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });
        
        console.log('Transaction sent:', signature);
        showError('Transaction sent! Waiting for confirmation...');
        
        // wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        
        // update UI after successful withdrawal
        withdrawAuthorityEl.textContent = newAuthority;
        checkWithdrawAuthorityMatch();
        
        const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
        showSuccess(`✅ Withdraw authority updated successfully! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
        
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

console.log('X1 Vote Account Explorer with optimized Backpack detection loaded');