// Manage Account Page Variables
let currentStakeAccounts = [];
let activeTab = 'vote-info';

// Global cache for current epoch
window.currentEpochCache = null;

// DOM elements specific to manage account page
const voteAccountInput = document.getElementById('voteAccount');
const searchBtn = document.getElementById('searchBtn');
const resultsSection = document.getElementById('resultsSection');

// Result display elements
const validatorIdentityEl = document.getElementById('validatorIdentity');
const withdrawAuthorityEl = document.getElementById('withdrawAuthority');
const creditsEl = document.getElementById('credits');
const commissionEl = document.getElementById('commission');
const accountBalanceEl = document.getElementById('accountBalance');
const withdrawBtn = document.getElementById('withdrawBtn');

// Withdraw modal elements
const withdrawModal = document.getElementById('withdrawModal');
const withdrawAmountInput = document.getElementById('withdrawAmount');
const withdrawToInput = document.getElementById('withdrawTo');
const availableBalanceEl = document.getElementById('availableBalance');

// Initialize manage account page
function initializeManageAccount() {
    console.log('Initializing Manage Account page...');
    
    // Initialize withdraw button to disabled state
    updateWithdrawButtonState(false);
    
    // Add event listeners
    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearch);
    }
    
    if (voteAccountInput) {
        voteAccountInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }
    
    console.log('Manage Account page initialized');
}

// Wallet event callbacks from app.js
function onWalletConnected() {
    console.log('Manage Account: Wallet connected');
    
    // Re-check current results if any
    if (!resultsSection.classList.contains('hidden')) {
        setTimeout(() => checkWithdrawAuthorityMatch(), 100);
        
        // Refresh stake accounts if we're showing a vote account
        const accountStr = voteAccountInput.value.trim();
        if (accountStr) {
            showInfo('Refreshing stake accounts with your connected wallet...', true);
            setTimeout(async () => {
                try {
                    const accountPubkey = new solanaWeb3.PublicKey(accountStr);
                    const accountType = await detectAccountType(accountPubkey);
                    if (accountType === 'vote') {
                        // Re-run the search to show user's authorized stake accounts
                        handleSearch();
                    }
                } catch (error) {
                    hideInfo();
                    console.error('Failed to refresh stake accounts:', error);
                }
            }, 500);
        }
    }
}

function onWalletDisconnected() {
    console.log('Manage Account: Wallet disconnected');
    removeWithdrawAuthorityMatch();
}

function onWalletUIUpdated(address) {
    if (address) {
        // Check withdraw authority if results are visible
        if (!resultsSection.classList.contains('hidden')) {
            checkWithdrawAuthorityMatch();
            
            // check stake authority match for current active tab
            if (activeTab && activeTab.startsWith('stake-')) {
                setTimeout(() => {
                    checkStakeAuthorities(activeTab);
                }, 100);
            }
        }
    } else {
        updateWithdrawButtonState(false);
    }
}

// Handle search button click
async function handleSearch() {
    const accountStr = voteAccountInput.value.trim();
    
    if (!accountStr) {
        showError('Please enter an account address (vote or stake)');
        return;
    }

    hideAllMessages();
    hideResults();
    removeWithdrawAuthorityMatch();

    try {
        // Validate and create PublicKey
        const accountPubkey = new solanaWeb3.PublicKey(accountStr);
        
        // GET CURRENT EPOCH EARLY - before any other queries
        showInfo('Getting current epoch information...', true);
        const currentEpoch = await getCurrentEpoch();
        console.log('📅 Early epoch query result:', currentEpoch);
        
        if (currentEpoch === null) {
            console.warn('⚠️ Failed to get current epoch, stake status may be inaccurate');
        }
        
        // Store for global access
        window.currentEpochCache = currentEpoch;
        console.log('💾 Cached epoch globally:', window.currentEpochCache);
        
        // Detect account type by checking the owner/program
        showInfo('Detecting account type...', true);
        const accountType = await detectAccountType(accountPubkey);
        
        if (accountType === 'vote') {
            // Handle as vote account (existing logic)
            await handleVoteAccountSearch(accountPubkey, currentEpoch);
        } else if (accountType === 'stake') {
            // Handle as stake account (new logic)
            await handleStakeAccountSearch(accountPubkey, currentEpoch);
        } else {
            throw new Error(`Invalid account type. This account is not a vote account or stake account (Owner: ${accountType})`);
        }
        
    } catch (error) {
        hideInfo();
        if (error.message.includes('Invalid public key input')) {
            showError('Invalid public key format');
        } else {
            showError(`Error fetching account info: ${error.message}`);
        }
        console.error('Error:', error);
    }
}

// Detect whether the account is a vote account or stake account
async function detectAccountType(accountPubkey) {
    try {
        const accountInfo = await connection.getAccountInfo(accountPubkey);
        
        if (!accountInfo) {
            throw new Error('Account not found');
        }

        const voteProgram = 'Vote111111111111111111111111111111111111111';
        const stakeProgram = 'Stake11111111111111111111111111111111111111';
        
        const owner = accountInfo.owner.toString();
        
        if (owner === voteProgram) {
            return 'vote';
        } else if (owner === stakeProgram) {
            return 'stake';
        } else {
            return owner; // Return the actual owner for error message
        }
    } catch (error) {
        console.error('Failed to detect account type:', error);
        throw error;
    }
}

// Handle vote account search (existing logic extracted)
async function handleVoteAccountSearch(voteAccountPubkey, currentEpoch) {
    // Show info message for vote account loading
    showInfo('Loading vote account information...', true);
    
    const voteAccountInfo = await getVoteAccountInfoWithWeb3(voteAccountPubkey);
    displayResults(voteAccountInfo);
    
    // Show info message for stake accounts loading
    showInfo('Loading your authorized stake accounts...', true);
    const stakeAccounts = await getStakeAccountsForVoteAccount(voteAccountPubkey);
    
    console.log('=== Before createStakeTabs ===');
    console.log('Wallet connected:', walletConnected);
    console.log('Connected address:', connectedWalletAddress);
    console.log('Authorized stake accounts:', stakeAccounts.length);
    console.log('Current epoch (early):', currentEpoch);
    
    // IMPORTANT: Store the unsorted accounts first
    currentStakeAccounts = stakeAccounts;
    
    // Create stake tabs with current epoch info - PASS THE EPOCH!
    await createStakeTabs(stakeAccounts, currentEpoch);
    
    // Check withdraw authority match after displaying results
    if (walletConnected) {
        setTimeout(() => checkWithdrawAuthorityMatch(), 100);
    }
    
    hideInfo();
    
    // Show completion message with more descriptive text
    if (walletConnected) {
        if (stakeAccounts.length > 0) {
            showInfo(`✅ Found vote account with ${stakeAccounts.length} stake account(s) you have authority over`);
            setTimeout(() => hideInfo(), 4000);
        } else {
            showInfo(`✅ Found vote account (no stake accounts found that you have authority over)`);
            setTimeout(() => hideInfo(), 4000);
        }
    } else {
        showInfo(`✅ Found vote account. Connect your wallet to see stake accounts you have authority over.`);
        setTimeout(() => hideInfo(), 4000);
    }
}

// Handle stake account search (new logic)
async function handleStakeAccountSearch(stakeAccountPubkey, currentEpoch) {
    showInfo('Loading stake account information...', true);
    
    // Get stake account information
    const stakeAccountInfo = await getStakeAccountInfo(stakeAccountPubkey);
    
    // Hide vote account info and display stake account directly
    hideVoteInfo();
    
    // Create a single stake tab for this specific stake account
    const stakeAccounts = [stakeAccountInfo];
    currentStakeAccounts = stakeAccounts;
    
    // Create stake tabs
    await createStakeTabs(stakeAccounts, currentEpoch);
    
    // Show results section and activate first stake tab
    showResults();
    setTimeout(() => {
        switchTab('stake-0');
    }, 100);
    
    // Check authorities if wallet is connected
    if (walletConnected) {
        setTimeout(() => {
            checkStakeAuthorities('stake-0');
        }, 200);
    }
    
    hideInfo();
    showInfo(`✅ Found stake account information`);
    setTimeout(() => hideInfo(), 3000);
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

function showResults() {
    resultsSection.classList.remove('hidden');
}

function hideResults() {
    resultsSection.classList.add('hidden');
    // Disable withdraw button when hiding results
    updateWithdrawButtonState(false);
    // Show vote info section in case it was hidden for stake-only search
    showVoteInfo();
    
    // Clear stake tabs immediately to prevent showing old results
    clearStakeTabs();
}

// Helper function to clear stake tabs
function clearStakeTabs() {
    const stakeTabsContainer = document.getElementById('stakeTabs');
    const stakeTabsContent = document.getElementById('stakeTabsContent');
    
    if (stakeTabsContainer) {
        stakeTabsContainer.innerHTML = '';
    }
    if (stakeTabsContent) {
        stakeTabsContent.innerHTML = '';
    }
    
    // Also clear the global stake accounts array
    currentStakeAccounts = [];
    
    console.log('Cleared stake tabs and cache');
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

// Remove withdraw authority match indicators
function removeWithdrawAuthorityMatch() {
    const withdrawCard = withdrawAuthorityEl.closest('.info-card');
    if (!withdrawCard) return;
    
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

// Get all stake accounts delegated to a vote account
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
        
        console.log('Found', accounts.length, 'total stake accounts delegated to vote account');
        
        const stakeAccounts = [];
        let filteredOutCount = 0;
        
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
                        
                        // Check if wallet is connected and user has authority
                        let hasAuthority = false;
                        
                        if (walletConnected && connectedWalletAddress) {
                            const stakeAuthority = stakeData.meta?.authorized?.staker || '';
                            const withdrawAuthority = stakeData.meta?.authorized?.withdrawer || '';
                            
                            hasAuthority = (stakeAuthority === connectedWalletAddress || 
                                          withdrawAuthority === connectedWalletAddress);
                            
                            console.log(`Stake account ${account.pubkey.toString()}: stake authority=${stakeAuthority}, withdraw authority=${withdrawAuthority}, user has authority=${hasAuthority}`);
                        } else {
                            console.log('Wallet not connected, excluding all stake accounts');
                        }
                        
                        // Only include stake accounts where user has authority
                        if (hasAuthority) {
                            stakeAccounts.push({
                                pubkey: account.pubkey.toString(),
                                lamports: account.account.lamports,
                                data: stakeData,
                                accountInfo: stakeAccount.value
                            });
                        } else {
                            filteredOutCount++;
                        }
                    }
                }
            } catch (error) {
                console.warn('Failed to parse stake account:', account.pubkey.toString(), error);
            }
        }
        
        console.log(`Filtered results: ${stakeAccounts.length} stake accounts with user authority, ${filteredOutCount} filtered out`);
        
        // Add informative message about filtering
        if (walletConnected && filteredOutCount > 0) {
            console.log(`Note: ${filteredOutCount} stake account(s) were filtered out because you don't have stake or withdraw authority`);
        } else if (!walletConnected && accounts.length > 0) {
            console.log('Note: Connect your wallet to see stake accounts you have authority over');
        }
        
        return stakeAccounts;
        
    } catch (error) {
        console.error('Failed to get stake accounts:', error);
        return [];
    }
}

// Get current epoch
async function getCurrentEpoch() {
    try {
        console.log('🔍 Getting current epoch via getEpochInfo...');
        const epochInfo = await connection.getEpochInfo();
        console.log('📅 Epoch info received:', epochInfo);
        
        if (epochInfo && typeof epochInfo.epoch === 'number') {
            console.log('✅ Current epoch:', epochInfo.epoch);
            return epochInfo.epoch;
        } else {
            console.error('❌ Invalid epoch info structure:', epochInfo);
            return null;
        }
    } catch (error) {
        console.error('❌ Failed to get current epoch:', error);
        return null;
    }
}

// Get stake status information
async function getStakeStatus(delegation, currentEpoch = null) {
    console.log('🔍 getStakeStatus called with delegation:', delegation);
    console.log('🔍 Current epoch provided:', currentEpoch);
    
    if (!delegation) {
        console.log('❌ No delegation found - returning Not Delegated');
        return {
            text: 'Not Delegated',
            class: 'status-inactive',
            description: 'This stake account is not delegated to any validator',
            isDeactivating: false
        };
    }
    
    // Check if stake is in deactivating state
    // deactivationEpoch is set to a very large number (18446744073709551615) when not deactivating
    const deactivationEpoch = delegation.deactivationEpoch;
    
    console.log('⏰ Checking deactivation status:');
    console.log('  - deactivationEpoch raw:', deactivationEpoch);
    console.log('  - deactivationEpoch type:', typeof deactivationEpoch);
    console.log('  - deactivationEpoch string:', String(deactivationEpoch));
    console.log('  - Is large number (strict):', deactivationEpoch === '18446744073709551615');
    console.log('  - Is large number (loose):', deactivationEpoch == '18446744073709551615');
    console.log('  - Is large number (number):', deactivationEpoch === 18446744073709551615);
    
    if (deactivationEpoch && 
        deactivationEpoch !== '18446744073709551615' && 
        deactivationEpoch != 18446744073709551615 &&
        String(deactivationEpoch) !== '18446744073709551615') {
        
        const deactivationEpochNum = parseInt(deactivationEpoch);
        console.log('  - deactivationEpoch as number:', deactivationEpochNum);
        console.log('  - currentEpoch:', currentEpoch);
        
        if (currentEpoch !== null) {
            if (currentEpoch > deactivationEpochNum) {
                console.log('✅ Stake deactivation COMPLETED - now INACTIVE');
                return {
                    text: 'Inactive',
                    class: 'status-inactive',
                    description: `Stake deactivated at epoch ${deactivationEpochNum} and is now withdrawable`,
                    isDeactivating: false
                };
            } else {
                const epochsRemaining = deactivationEpochNum - currentEpoch;
                console.log('⏳ Stake is DEACTIVATING -', epochsRemaining, 'epochs remaining');
                return {
                    text: 'Deactivating',
                    class: 'status-deactivating',
                    description: `Deactivating (${epochsRemaining} epoch(s) remaining until inactive)`,
                    isDeactivating: true
                };
            }
        } else {
            // Fallback when we don't have current epoch info
            console.log('⚠️ No current epoch info - assuming DEACTIVATING');
            return {
                text: 'Deactivating',
                class: 'status-deactivating',
                description: 'Stake is being deactivated (epoch info unavailable)',
                isDeactivating: true
            };
        }
    }
    
    // If delegated and not deactivating, it's active
    console.log('✅ Stake is ACTIVE');
    return {
        text: 'Active',
        class: 'status-active',
        description: 'Stake is active and earning rewards',
        isDeactivating: false
    };
}

// Function to switch tabs - use data attributes instead of onclick
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
        // Clear any inline display styles that might interfere with CSS
        content.style.display = '';
    });
    
    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.classList.add('active');
        
        // check authorities if this is a stake tab
        if (tabId.startsWith('stake-')) {
            setTimeout(() => {
                checkStakeAuthorities(tabId);
            }, 100);
        }
    } else {
        console.warn('Could not find tab content for:', tabId);
    }
    
    activeTab = tabId;
    console.log('Switched to tab:', tabId);
}

// Create stake tabs
async function createStakeTabs(stakeAccounts, currentEpoch = null) {
    console.log('=== createStakeTabs called ===');
    console.log('Accounts to sort:', stakeAccounts.length);
    console.log('Received currentEpoch:', currentEpoch);
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
    
    // Use passed currentEpoch instead of querying again
    if (currentEpoch === null) {
        console.warn('⚠️ No currentEpoch provided, trying to get it now...');
        currentEpoch = await getCurrentEpoch();
        console.log('📅 Fallback epoch query result:', currentEpoch);
    }
    
    console.log('📅 Using current epoch for status calculation:', currentEpoch);
    
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
    
    // create tabs for each stake account in the sorted order
    for (let index = 0; index < sortedStakeAccounts.length; index++) {
        const stakeAccount = sortedStakeAccounts[index];
        console.log(`🏗️ Creating tab ${index + 1} with epoch:`, currentEpoch);
        const { tabBtn, tabContent } = await createStakeTab(stakeAccount, index, currentEpoch);
        stakeTabsContainer.appendChild(tabBtn);
        stakeTabsContent.appendChild(tabContent);
    }
    
    // update global reference to sorted accounts
    currentStakeAccounts = sortedStakeAccounts;
    
    console.log('=== createStakeTabs completed ===');
}

// Create stake tab function
async function createStakeTab(stakeAccount, index, currentEpoch = null) {
    const stakePubkey = stakeAccount.pubkey;
    const stakeData = stakeAccount.data;
    const lamports = stakeAccount.lamports;
    
    // get stake status information with current epoch
    const delegation = stakeData.stake?.delegation;
    const stakeStatus = await getStakeStatus(delegation, currentEpoch);
    
    // get actual stake amount (delegated amount) if available, otherwise use total balance
    const delegatedStake = stakeData.stake?.delegation?.stake || 0;
    const effectiveDelegatedStake = stakeStatus.text === 'Inactive' ? 0 : delegatedStake;
    const solAmount = effectiveDelegatedStake / solanaWeb3.LAMPORTS_PER_SOL;
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
    
    // create tab button with authority indicator and status
    const tabBtn = document.createElement('button');
    tabBtn.className = hasAnyAuthority ? 'tab-btn authority-tab' : 'tab-btn';
    tabBtn.setAttribute('data-tab-id', tabId);
    tabBtn.onclick = () => switchTab(tabId);
    
    // add authority indicator to tab title
    const authorityIndicator = hasAnyAuthority ? 
        `<span class="authority-indicator">
            ${hasStakeAuthority ? '<i class="fas fa-key" title="Stake Authority"></i>' : ''}
            ${hasWithdrawAuthority ? '<i class="fas fa-hand-holding-usd" title="Withdraw Authority"></i>' : ''}
        </span>` : '';
        
    // add status indicator to tab
    const statusIndicator = stakeStatus.isDeactivating ? 
        `<span class="status-indicator deactivating" title="Deactivating">
            <i class="fas fa-hourglass-half"></i>
        </span>` : 
        (stakeStatus.text === 'Inactive' && hasStakeAuthority ? 
        `<span class="status-indicator inactive" title="Inactive">
            <i class="fas fa-stop-circle"></i>
        </span>` : '');
    
    tabBtn.innerHTML = `
        <i class="fas fa-layer-group"></i>
        <span class="stake-rank">#${index + 1}</span>
        <span class="stake-amount">${formatAmount(solAmount)} XNT</span>
        ${authorityIndicator}
        ${statusIndicator}
    `;
    
    // create tab content using vote account layout style
    const tabContent = document.createElement('div');
    tabContent.id = tabId;
    tabContent.className = 'tab-content';
    
    // extract authorities
    const delegatedVoteAccount = stakeData.stake?.delegation?.voter || 'N/A';
    
    // determine active stake based on status
    let activeStake;
    switch (stakeStatus.text) {
        case 'Active':
            activeStake = delegatedStake;
            break;
        case 'Deactivating':
            activeStake = delegatedStake; // still has value while deactivating
            break;
        case 'Inactive':
            activeStake = 0; // already inactive, active stake is 0
            break;
        default:
            activeStake = 0;
    }
    
    // determine stake card title and icon based on status
    let stakeCardTitle, stakeCardIcon, stakeCardClass;
    
    switch (stakeStatus.text) {
        case 'Active':
            stakeCardTitle = 'Active Stake';
            stakeCardIcon = 'fas fa-check-circle';
            stakeCardClass = 'active-stake-card';
            break;
        case 'Deactivating':
            stakeCardTitle = 'Deactivating Stake';
            stakeCardIcon = 'fas fa-hourglass-half';
            stakeCardClass = 'deactivating-stake-card';
            break;
        case 'Inactive':
            stakeCardTitle = 'Inactive Stake';
            stakeCardIcon = 'fas fa-stop-circle';
            stakeCardClass = 'inactive-stake-card';
            break;
        default:
            stakeCardTitle = 'Stake Status';
            stakeCardIcon = 'fas fa-question-circle';
            stakeCardClass = 'unknown-stake-card';
    }
    
    // determine if deactivate button should be enabled
    const showDeactivateButton = hasStakeAuthority && activeStake > 0 && stakeStatus.text === 'Active';
    
    tabContent.innerHTML = `
        <div class="info-grid">
            <!-- Stake Account Address -->
            <div class="info-card">
                <div class="info-header">
                    <i class="fas fa-address-card"></i>
                    <h3>Stake Account Address</h3>
                </div>
                <div class="info-content">
                    <span class="address">${stakePubkey}</span>
                </div>
            </div>

            <!-- Account Balance -->
            <div class="info-card${stakeStatus.text === 'Inactive' && hasWithdrawAuthority ? ' balance-card' : ''}">
                <div class="info-header">
                    <i class="fas fa-wallet"></i>
                    <h3>Account Balance</h3>
                </div>
                <div class="info-content">
                    <span class="balance">${totalBalance.toFixed(6)} XNT</span>
                    ${stakeStatus.text === 'Inactive' && hasWithdrawAuthority && totalBalance > 0 ? 
                        `<button class="withdraw-stake-btn" onclick="showStakeWithdrawModal('${stakePubkey}', ${totalBalance.toFixed(6)})">
                            <i class="fas fa-arrow-right"></i>
                            Withdraw
                        </button>` : 
                        ''
                    }
                </div>
            </div>

            <!-- Delegated Stake -->
            <div class="info-card${(delegatedStake === 0 || stakeStatus.text === 'Inactive') && activeStake === 0 && hasStakeAuthority ? ' balance-card' : ''}">
                <div class="info-header">
                    <i class="fas fa-coins"></i>
                    <h3>Delegated Stake</h3>
                </div>
                <div class="info-content">
                    <span class="balance">${solAmount.toFixed(6)} XNT</span>
                    ${(delegatedStake === 0 || stakeStatus.text === 'Inactive') && activeStake === 0 && hasStakeAuthority ? 
                        `<button class="delegate-stake-btn" onclick="showDelegateStakeModal('${stakePubkey}', ${totalBalance.toFixed(6)})">
                            <i class="fas fa-arrow-up"></i>
                            Delegate
                        </button>` : 
                        ''
                    }
                </div>
            </div>

            <!-- Combined Active/Deactivating/Inactive Stake with Status -->
            <div class="info-card ${stakeCardClass}">
                <div class="info-header">
                    <i class="${stakeCardIcon}"></i>
                    <h3>${stakeCardTitle}</h3>
                </div>
                <div class="info-content">
                    <span class="number">${(activeStake / solanaWeb3.LAMPORTS_PER_SOL).toFixed(6)} XNT</span>
                    ${showDeactivateButton ? 
                        `<button class="deactivate-stake-btn" onclick="showDeactivateStakeModal('${stakePubkey}', ${(activeStake / solanaWeb3.LAMPORTS_PER_SOL).toFixed(6)})">
                            <i class="fas fa-power-off"></i>
                            Deactivate
                        </button>` : 
                        ''
                    }
                </div>
                ${stakeStatus.description ? `<div class="status-description">${stakeStatus.description}</div>` : ''}
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

// ===== 检查权限函数 =====

// function to check stake authorities after displaying stake tab
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

// function to check and show authority match for stake accounts - add update button for both stake and withdraw authority
function checkAndShowStakeAuthorityMatch(card, addressEl, authority, type) {
    // remove existing indicator and buttons
    const existingIndicator = card.querySelector('.authority-match-indicator');
    const existingStakeButton = card.querySelector('.update-stake-authority-btn');
    const existingWithdrawButton = card.querySelector('.update-stake-withdraw-authority-btn');
    
    if (existingIndicator) {
        existingIndicator.remove();
    }
    if (existingStakeButton) {
        existingStakeButton.remove();
    }
    if (existingWithdrawButton) {
        existingWithdrawButton.remove();
    }
    
    // remove existing classes
    card.classList.remove('authority-match', 'authority-no-match');
    
    if (authority && authority !== 'N/A' && authority !== '-') {
        // Add update button when user has authority (for both stake and withdraw)
        if (authority === connectedWalletAddress) {
            // ensure address is wrapped in the appropriate container
            let addressParent = addressEl.parentElement;
            
            // if address is not in address-container, create one
            if (!addressParent.classList.contains('address-container')) {
                const addressContainer = document.createElement('div');
                addressContainer.className = 'address-container';
                
                // move address element to new container
                addressParent.insertBefore(addressContainer, addressEl);
                addressContainer.appendChild(addressEl);
                
                addressParent = addressContainer;
            }
            
            // create Update button based on authority type
            const updateButton = document.createElement('button');
            
            if (type === 'stake') {
                updateButton.className = 'update-stake-authority-btn';
                updateButton.onclick = () => showStakeAuthoritySelector();
                console.log('Update button added to stake authority container');
            } else if (type === 'withdraw') {
                updateButton.className = 'update-stake-withdraw-authority-btn';
                updateButton.onclick = () => showStakeWithdrawAuthoritySelector();
                console.log('Update button added to stake withdraw authority container');
            }
            
            updateButton.innerHTML = `
                <i class="fas fa-edit"></i>
                Update
            `;
            
            // add button to address container
            addressParent.appendChild(updateButton);
        }
        
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

// ===== 模态框函数 =====

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
    const currentBalance = parseFloat(balanceText.replace(' XNT', ''));
    
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
        const maxWithdrawAmount = Math.floor(availableBalance); // only allow integer part of available balance to be withdrawn
        withdrawAmountInput.value = maxWithdrawAmount;
    };
    
    formGroup.style.position = 'relative';
    formGroup.appendChild(maxBtn);
}

// Hide withdraw modal
function hideWithdrawModal() {
    withdrawModal.classList.add('hidden');
    withdrawAmountInput.value = '';
}

// show stake withdraw modal
function showStakeWithdrawModal(stakeAccountAddress, availableBalance) {
    const existingModal = document.getElementById('stakeWithdrawModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'stakeWithdrawModal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-arrow-right"></i> Withdraw from Stake Account</h3>
                <button class="modal-close" onclick="hideStakeWithdrawModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-note" style="margin-bottom: 16px; background: #e3f2fd; color: #1565c0; border-left: 4px solid #2196f3;">
                    <i class="fas fa-info-circle"></i>
                    <p><strong>Stake Account Withdrawal</strong><br>
                    You can withdraw the full balance from this inactive stake account.</p>
                </div>
                
                <div class="stake-account-info" style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 12px 0;">
                    <strong>Stake Account:</strong><br>
                    <span style="font-family: monospace; color: #666; word-break: break-all;">${stakeAccountAddress}</span><br><br>
                    <strong>Available Balance:</strong> ${availableBalance} XNT
                </div>
                
                <div class="form-group">
                    <label for="stakeWithdrawAmount">Amount (XNT):</label>
                    <input type="number" id="stakeWithdrawAmount" step="0.000000001" placeholder="Enter amount in XNT" value="${availableBalance}" autocomplete="off">
                </div>
                
                <div class="form-group">
                    <label for="stakeWithdrawTo">Withdraw to:</label>
                    <input type="text" id="stakeWithdrawTo" placeholder="Recipient address" value="${connectedWalletAddress}" autocomplete="off">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="hideStakeWithdrawModal()">Cancel</button>
                <button class="btn-confirm" onclick="executeStakeWithdraw('${stakeAccountAddress}')">Withdraw</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        document.getElementById('stakeWithdrawAmount').focus();
    }, 100);
}

// hide stake withdraw modal
function hideStakeWithdrawModal() {
    const modal = document.getElementById('stakeWithdrawModal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

// show delegate stake modal
function showDelegateStakeModal(stakeAccountAddress, availableBalance) {
    const existingModal = document.getElementById('delegateStakeModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'delegateStakeModal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-arrow-up"></i> Delegate Stake</h3>
                <button class="modal-close" onclick="hideDelegateStakeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-note" style="margin-bottom: 16px; background: #e8f5e8; color: #2e7d32; border-left: 4px solid #4caf50;">
                    <i class="fas fa-info-circle"></i>
                    <p><strong>Delegate Stake</strong><br>
                    Delegate your stake to a validator to start earning rewards.</p>
                </div>
                
                <div class="stake-account-info" style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 12px 0;">
                    <strong>Stake Account:</strong><br>
                    <span style="font-family: monospace; color: #666; word-break: break-all;">${stakeAccountAddress}</span><br><br>
                    <strong>Available Balance:</strong> ${availableBalance} XNT
                </div>
                
                <div class="form-group">
                    <label for="delegateVoteAccount">Vote Account to Delegate:</label>
                    <input type="text" id="delegateVoteAccount" placeholder="Enter vote account address..." autocomplete="off" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 14px;">
                </div>
                
                <div class="modal-note">
                    <i class="fas fa-exclamation-triangle"></i>
                    <small><strong>Important:</strong> Delegation will use the entire stake account balance. Once delegated, your stake will start earning rewards but will be locked until you deactivate the delegation.</small>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="hideDelegateStakeModal()">Cancel</button>
                <button class="btn-confirm" onclick="executeStakeDelegate('${stakeAccountAddress}')">Delegate</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    
    // 预填当前查询的 vote account
    const currentVoteAccount = voteAccountInput.value.trim();
    if (currentVoteAccount) {
        document.getElementById('delegateVoteAccount').value = currentVoteAccount;
    }
    
    setTimeout(() => {
        document.getElementById('delegateVoteAccount').focus();
    }, 100);
}

// hide delegate stake modal
function hideDelegateStakeModal() {
    const modal = document.getElementById('delegateStakeModal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

// show deactivate stake modal
function showDeactivateStakeModal(stakeAccountAddress, activeStakeAmount) {
    const existingModal = document.getElementById('deactivateStakeModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'deactivateStakeModal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-power-off"></i> Deactivate Stake</h3>
                <button class="modal-close" onclick="hideDeactivateStakeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-note" style="margin-bottom: 16px; background: #fff3e0; color: #ef6c00; border-left: 4px solid #ff9800;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p><strong>Important:</strong> Deactivating stake will begin the process of undelegating your stake. It takes several epochs for the stake to become inactive and withdrawable.</p>
                </div>
                
                <div class="stake-info" style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 12px 0;">
                    <strong>Stake Account:</strong><br>
                    <span style="font-family: monospace; color: #666; word-break: break-all;">${stakeAccountAddress}</span><br><br>
                    <strong>Active Stake Amount:</strong> ${activeStakeAmount} XNT
                </div>
                
                <div class="modal-note">
                    <i class="fas fa-info-circle"></i>
                    <small>This will create a transaction to deactivate the stake account. You'll need to sign the transaction with your stake authority. The stake will become inactive after several epochs.</small>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="hideDeactivateStakeModal()">Cancel</button>
                <button class="btn-confirm" onclick="executeStakeDeactivate('${stakeAccountAddress}')">Deactivate Stake</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
}

// hide deactivate stake modal
function hideDeactivateStakeModal() {
    const modal = document.getElementById('deactivateStakeModal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

// ===== Backpack账户管理函数 =====

// get Backpack wallet accounts - add fallback for manual input
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

// show account selector modal - add manual input fallback
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

// create account selector modal - current account does not show select button
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

// hide account selector modal
function hideAccountSelectorModal() {
    const modal = document.getElementById('accountSelectorModal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

// manual address input modal
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

// hide manual address input modal
function hideManualAddressModal() {
    const modal = document.getElementById('manualAddressModal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

// process manual address input
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

// select new withdraw authority
async function selectNewWithdrawAuthority(newAuthority, accountName) {
    hideAccountSelectorModal();
    
    try {
        await executeWithdrawAuthorityUpdate(newAuthority);
    } catch (error) {
        showError('Failed to update withdraw authority: ' + error.message);
    }
}

// ===== 交易执行函数 =====

// Execute withdraw
async function executeWithdraw() {
    const amount = parseFloat(withdrawAmountInput.value);
    const recipient = withdrawToInput.value.trim();

    if (!amount || amount <= 0) {
        showError('Please enter a valid amount');
        return;
    }

    const availableBalance = parseFloat(availableBalanceEl.textContent);
    const maxAllowedWithdraw = Math.floor(availableBalance); // only allow integer part of available balance to be withdrawn
    
    if (amount > maxAllowedWithdraw) {
        showError(`Withdrawal amount exceeds maximum allowed: ${maxAllowedWithdraw} XNT (only integer part of available balance can be withdrawn)`);
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

        // Convert XNT to lamports
        const lamports = Math.floor(amount * solanaWeb3.LAMPORTS_PER_SOL);
        
        // Get current vote account public key
        const voteAccountStr = voteAccountInput.value.trim();
        
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
            instructions: transaction.instructions.length
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
                    
                    if (Math.abs(actualDecrease - expectedDecrease) < 0.01) { // Allow 0.01 XNT tolerance for fees
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
            hideAllMessages();
            showInfo('Transaction sent! Waiting for confirmation...', true);
            
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

// execute stake withdraw transaction
async function executeStakeWithdraw(stakeAccountAddress) {
    if (!walletConnected || !wallet) {
        showError('Wallet not connected');
        return;
    }
    
    const amount = parseFloat(document.getElementById('stakeWithdrawAmount').value);
    const recipient = document.getElementById('stakeWithdrawTo').value.trim();

    if (!amount || amount <= 0) {
        showError('Please enter a valid amount');
        return;
    }

    if (!recipient) {
        showError('Please enter recipient address');
        return;
    }
    
    hideStakeWithdrawModal();
    
    // Confirm the operation
    if (!confirm(`Are you sure you want to withdraw ${amount} XNT from stake account:\n\n${stakeAccountAddress}\n\nTo: ${recipient}`)) {
        return;
    }
    
    showInfo('Creating stake withdraw transaction...', true);
    
    try {
        // Create public keys
        const stakeAccountPubkey = new solanaWeb3.PublicKey(stakeAccountAddress);
        const withdrawAuthorityPubkey = new solanaWeb3.PublicKey(connectedWalletAddress);
        const recipientPubkey = new solanaWeb3.PublicKey(recipient);
        
        // Convert XNT to lamports
        const lamports = Math.floor(amount * solanaWeb3.LAMPORTS_PER_SOL);
        
        // Get latest blockhash
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        
        // Create transaction
        const transaction = new solanaWeb3.Transaction({
            recentBlockhash: blockhash,
            feePayer: withdrawAuthorityPubkey,
        });
        
        // Create withdraw instruction using StakeProgram
        const withdrawInstruction = solanaWeb3.StakeProgram.withdraw({
            stakePubkey: stakeAccountPubkey,
            authorizedPubkey: withdrawAuthorityPubkey,
            toPubkey: recipientPubkey,
            lamports: lamports,
        });
        
        transaction.add(withdrawInstruction);
        
        console.log('Stake withdraw transaction created:', {
            stakeAccount: stakeAccountPubkey.toString(),
            withdrawAuthority: withdrawAuthorityPubkey.toString(),
            recipient: recipientPubkey.toString(),
            amount: amount,
            lamports: lamports
        });
        
        // Sign and send transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });
        
        console.log('Transaction sent:', signature);
        showInfo('Transaction sent! Waiting for confirmation...', true);
        
        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        
        const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
        showSuccess(`✅ Stake withdrawal successful! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
        
    } catch (error) {
        console.error('Failed to withdraw from stake account:', error);
        showError('Failed to withdraw from stake account: ' + error.message);
    }
}

// execute stake delegate transaction
async function executeStakeDelegate(stakeAccountAddress) {
    if (!walletConnected || !wallet) {
        showError('Wallet not connected');
        return;
    }
    
    const voteAccountAddress = document.getElementById('delegateVoteAccount').value.trim();

    if (!voteAccountAddress) {
        showError('Please enter a vote account address');
        return;
    }
    
    hideDelegateStakeModal();
    
    // Confirm the operation
    if (!confirm(`Are you sure you want to delegate stake account:\n\n${stakeAccountAddress}\n\nTo vote account: ${voteAccountAddress}\n\nThis will delegate the entire stake account balance.`)) {
        return;
    }
    
    showInfo('Creating stake delegate transaction...', true);
    
    try {
        // Create public keys
        const stakeAccountPubkey = new solanaWeb3.PublicKey(stakeAccountAddress);
        const voteAccountPubkey = new solanaWeb3.PublicKey(voteAccountAddress);
        const stakeAuthorityPubkey = new solanaWeb3.PublicKey(connectedWalletAddress);
        
        // Get latest blockhash
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        
        // Create transaction
        const transaction = new solanaWeb3.Transaction({
            recentBlockhash: blockhash,
            feePayer: stakeAuthorityPubkey,
        });
        
        // Create delegate instruction using StakeProgram
        const delegateTransaction = solanaWeb3.StakeProgram.delegate({
            stakePubkey: stakeAccountPubkey,
            authorizedPubkey: stakeAuthorityPubkey,
            votePubkey: voteAccountPubkey,
        });
        
        // Add delegate instruction to transaction
        transaction.add(...delegateTransaction.instructions);
        
        console.log('Stake delegate transaction created:', {
            stakeAccount: stakeAccountPubkey.toString(),
            voteAccount: voteAccountPubkey.toString(),
            stakeAuthority: stakeAuthorityPubkey.toString()
        });
        
        // Sign and send transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });
        
        console.log('Transaction sent:', signature);
        showInfo('Transaction sent! Waiting for confirmation...', true);
        
        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        
        const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
        showSuccess(`✅ Stake delegated successfully! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
        
    } catch (error) {
        console.error('Failed to delegate stake:', error);
        showError('Failed to delegate stake: ' + error.message);
    }
}

// execute stake deactivate transaction
async function executeStakeDeactivate(stakeAccountAddress) {
    if (!walletConnected || !wallet) {
        showError('Wallet not connected');
        return;
    }
    
    hideDeactivateStakeModal();
    
    // Confirm the operation
    if (!confirm(`Are you sure you want to deactivate stake account:\n\n${stakeAccountAddress}\n\nThis action cannot be undone and will begin the undelegation process.`)) {
        return;
    }
    
    showInfo('Creating stake deactivate transaction...', true);
    
    try {
        // Create public keys
        const stakeAccountPubkey = new solanaWeb3.PublicKey(stakeAccountAddress);
        const stakeAuthorityPubkey = new solanaWeb3.PublicKey(connectedWalletAddress);
        
        // Get latest blockhash
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        
        // Create transaction
        const transaction = new solanaWeb3.Transaction({
            recentBlockhash: blockhash,
            feePayer: stakeAuthorityPubkey,
        });
        
        // Create deactivate instruction using StakeProgram
        const deactivateInstruction = solanaWeb3.StakeProgram.deactivate({
            stakePubkey: stakeAccountPubkey,
            authorizedPubkey: stakeAuthorityPubkey,
        });
        
        transaction.add(deactivateInstruction);
        
        console.log('Stake deactivate transaction created:', {
            stakeAccount: stakeAccountPubkey.toString(),
            stakeAuthority: stakeAuthorityPubkey.toString()
        });
        
        // Sign and send transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });
        
        console.log('Transaction sent:', signature);
        showInfo('Transaction sent! Waiting for confirmation...', true);
        
        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        
        const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
        showSuccess(`✅ Stake account deactivated successfully! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
    } catch (error) {
        console.error('Failed to deactivate stake account:', error);
        showError('Failed to deactivate stake account: ' + error.message);
    }
}

// execute withdraw authority update transaction - add auto account switch
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
        const voteAccountStr = voteAccountInput.value.trim();
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
        showSuccess(`✅ Withdraw authority updated successfully! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
        
    } catch (error) {
        console.error('Update withdraw authority failed:', error);
        throw error;
    }
}

// Get information for a specific stake account
async function getStakeAccountInfo(stakeAccountPubkey) {
    try {
        console.log('Getting stake account info for:', stakeAccountPubkey.toString());
        
        // Get parsed account info
        const accountInfo = await connection.getParsedAccountInfo(stakeAccountPubkey);
        
        if (!accountInfo.value) {
            throw new Error('Stake account not found');
        }

        // Verify this is actually a stake account
        if (accountInfo.value.data.program !== 'stake') {
            throw new Error('This account is not a stake account');
        }

        const stakeData = accountInfo.value.data.parsed.info;
        
        // Structure the data similar to getStakeAccountsForVoteAccount format
        const stakeAccountInfo = {
            pubkey: stakeAccountPubkey.toString(),
            lamports: accountInfo.value.lamports,
            data: stakeData,
            accountInfo: accountInfo.value
        };
        
        console.log('Stake account info:', stakeAccountInfo);
        return stakeAccountInfo;
        
    } catch (error) {
        console.error('Failed to get stake account info:', error);
        throw error;
    }
}

// Hide vote account info section
function hideVoteInfo() {
    const voteTab = document.querySelector('[onclick="switchTab(\'vote-info\')"]');
    
    if (voteTab) {
        voteTab.style.display = 'none';
    }
    // Don't manipulate vote-info content display directly - let CSS handle it
}

// Show vote account info section (for when switching back to vote account search)
function showVoteInfo() {
    const voteTab = document.querySelector('[onclick="switchTab(\'vote-info\')"]');
    const voteInfo = document.getElementById('vote-info');
    
    if (voteTab) {
        voteTab.style.display = 'block';
    }
    if (voteInfo) {
        // Clear any inline display style that might interfere with CSS
        voteInfo.style.display = '';
    }
}

// Stake Authority Selector functions (placeholder - you may need to implement these based on your needs)
function showStakeAuthoritySelector() {
    showError('Stake authority update functionality will be implemented in future updates');
}

function showStakeWithdrawAuthoritySelector() {
    showError('Stake withdraw authority update functionality will be implemented in future updates');
}

console.log('Manage Account.js loaded successfully with all features');

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeManageAccount);
} else {
    initializeManageAccount();
}
