// Manage Account Page Variables
let currentStakeAccounts = [];
let activeTab = 'identity-info';
let currentValidatorInfo = null; // Current selected validator info

// Global cache for current epoch
window.currentEpochCache = null;

// Global cache for all validators
let allValidatorsCache = [];
let validatorsLoaded = false;
let searchInputTimeout = null;

// Global cache for rent-exempt balances
let voteAccountRentExemptCache = null;
let stakeAccountRentExemptCache = null;

// Default rent-exempt values (fallback)
const DEFAULT_VOTE_ACCOUNT_RENT_EXEMPT = 0.02685864; // SOL (~3731 bytes)
const DEFAULT_STAKE_ACCOUNT_RENT_EXEMPT = 0.00228288; // SOL (~200 bytes)

// DOM elements specific to manage account page
const voteAccountInput = document.getElementById('voteAccount');
const searchBtn = document.getElementById('searchBtn');
const resultsSection = document.getElementById('resultsSection');

// Result display elements
const voteAccountAddressEl = document.getElementById('voteAccountAddress');
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
        // Handle Enter key
        voteAccountInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
        
        // Handle input for real-time search suggestions
        voteAccountInput.addEventListener('input', handleSearchInput);
        
        // Handle focus to show suggestions
        voteAccountInput.addEventListener('focus', handleSearchInput);
        
        // Handle blur to hide suggestions
        voteAccountInput.addEventListener('blur', () => {
            setTimeout(() => hideSuggestions(), 200);
        });
    }
    
    // Load and display recent validators
    loadRecentValidators();
    
    // Preload all validators in background
    preloadAllValidators();
    
    // Preload rent-exempt balances in background
    preloadRentExemptBalances();
    
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
    removeCommissionUpdateButton();
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

// Preload rent-exempt balances in background
async function preloadRentExemptBalances() {
    try {
        // Preload vote account rent-exempt
        voteAccountRentExemptCache = await connection.getMinimumBalanceForRentExemption(3731);
        console.log(`✅ Vote account rent-exempt: ${voteAccountRentExemptCache / solanaWeb3.LAMPORTS_PER_SOL} XNT`);
        
        // Preload stake account rent-exempt
        stakeAccountRentExemptCache = await connection.getMinimumBalanceForRentExemption(200);
        console.log(`✅ Stake account rent-exempt: ${stakeAccountRentExemptCache / solanaWeb3.LAMPORTS_PER_SOL} XNT`);
    } catch (error) {
        console.warn('Failed to preload rent-exempt balances, will use defaults:', error);
    }
}

// Get vote account rent-exempt balance (with cache and fallback)
async function getVoteAccountRentExempt() {
    // Return cached value if available
    if (voteAccountRentExemptCache !== null) {
        return voteAccountRentExemptCache / solanaWeb3.LAMPORTS_PER_SOL;
    }
    
    // Try to fetch from chain
    try {
        voteAccountRentExemptCache = await connection.getMinimumBalanceForRentExemption(3731);
        return voteAccountRentExemptCache / solanaWeb3.LAMPORTS_PER_SOL;
    } catch (error) {
        console.warn('Failed to get vote account rent-exempt, using default:', error);
        return DEFAULT_VOTE_ACCOUNT_RENT_EXEMPT;
    }
}

// Get stake account rent-exempt balance (with cache and fallback)
async function getStakeAccountRentExempt() {
    // Return cached value if available
    if (stakeAccountRentExemptCache !== null) {
        return stakeAccountRentExemptCache / solanaWeb3.LAMPORTS_PER_SOL;
    }
    
    // Try to fetch from chain
    try {
        stakeAccountRentExemptCache = await connection.getMinimumBalanceForRentExemption(200);
        return stakeAccountRentExemptCache / solanaWeb3.LAMPORTS_PER_SOL;
    } catch (error) {
        console.warn('Failed to get stake account rent-exempt, using default:', error);
        return DEFAULT_STAKE_ACCOUNT_RENT_EXEMPT;
    }
}

// Preload all validators in background
async function preloadAllValidators() {
    if (validatorsLoaded) return;
    
    const statusEl = document.getElementById('validatorLoadStatus');
    
    try {
        console.log('Preloading all validators...');
        
        const CONFIG_PROGRAM_ID = new solanaWeb3.PublicKey('Config1111111111111111111111111111111111111');
        const VALIDATOR_INFO_KEY = new solanaWeb3.PublicKey('Va1idator1nfo111111111111111111111111111111');
        
        const accounts = await connection.getParsedProgramAccounts(CONFIG_PROGRAM_ID, {
            filters: [
                {
                    memcmp: {
                        offset: 1,
                        bytes: VALIDATOR_INFO_KEY.toBase58(),
                    },
                },
            ],
        });

        console.log(`Fetched ${accounts.length} validator info accounts`);

        allValidatorsCache = accounts
            .map((account) => {
                try {
                    const parsed = account.account.data.parsed;
                    if (!parsed || parsed.type !== 'validatorInfo') return null;

                    const configData = parsed.info.configData || {};
                    const identity = parsed.info.keys.find(k => k.signer)?.pubkey || 
                                   (parsed.info.keys[1] ? parsed.info.keys[1].pubkey : 'Unknown');

                    return {
                        infoPubkey: account.pubkey.toBase58(),
                        identity: identity,
                        name: configData.name || '',
                        website: configData.website || '',
                        iconUrl: configData.iconUrl || '',
                        details: configData.details || '',
                        keybaseUsername: configData.keybaseUsername || '',
                    };
                } catch (err) {
                    console.error('Error parsing validator account:', err);
                    return null;
                }
            })
            .filter(v => v && v.name); // Only keep validators with names

        validatorsLoaded = true;
        console.log(`✅ Preloaded ${allValidatorsCache.length} validators with names`);
        
        if (statusEl) {
            statusEl.innerHTML = `<i class="fas fa-check-circle"></i> ${allValidatorsCache.length} validators loaded`;
            statusEl.style.color = '#10b981';
        }
        
    } catch (error) {
        console.error('Failed to preload validators:', error);
        if (statusEl) {
            statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> Failed to load validators`;
            statusEl.style.color = '#ef4444';
        }
    }
}

// Handle search input for real-time suggestions
function handleSearchInput() {
    clearTimeout(searchInputTimeout);
    
    const input = voteAccountInput.value.trim();
    
    // If empty or looks like an address (long and alphanumeric), hide suggestions
    if (!input || input.length > 40) {
        hideSuggestions();
        return;
    }
    
    // Debounce: wait 200ms after user stops typing
    searchInputTimeout = setTimeout(() => {
        showSearchSuggestions(input);
    }, 200);
}

// Show search suggestions based on input
function showSearchSuggestions(searchTerm) {
    if (!validatorsLoaded || !searchTerm) {
        hideSuggestions();
        return;
    }
    
    const suggestionsEl = document.getElementById('searchSuggestions');
    if (!suggestionsEl) {
        return;
    }
    
    // Filter validators by name (case-insensitive)
    const lowerSearch = searchTerm.toLowerCase();
    const matches = allValidatorsCache
        .filter(v => v.name.toLowerCase().includes(lowerSearch))
        .slice(0, 10); // Limit to 10 results
    
    if (matches.length === 0) {
        hideSuggestions();
        return;
    }
    
    // Sort by relevance: exact matches first, then by name length
    matches.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        const aExact = aName === lowerSearch;
        const bExact = bName === lowerSearch;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        const aStarts = aName.startsWith(lowerSearch);
        const bStarts = bName.startsWith(lowerSearch);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        return a.name.length - b.name.length;
    });
    
    // Build suggestions HTML
    suggestionsEl.innerHTML = matches.map(v => {
        const iconHtml = v.iconUrl 
            ? `<img src="${v.iconUrl}" class="suggestion-icon" onerror="this.outerHTML='<div class=\\'suggestion-icon-fallback\\'><i class=\\'fas fa-server\\'></i></div>'">`
            : `<div class="suggestion-icon-fallback"><i class="fas fa-server"></i></div>`;
        
        const websiteHtml = v.website 
            ? `<span class="suggestion-website" title="${v.website}"><i class="fas fa-globe"></i></span>`
            : '';
        
        return `
            <div class="suggestion-item" onmousedown="selectValidatorFromSuggestion('${v.identity}')">
                ${iconHtml}
                <div class="suggestion-info">
                    <div class="suggestion-name">${escapeHtml(v.name)}</div>
                    <div class="suggestion-identity">${v.identity.substring(0, 8)}...${v.identity.substring(v.identity.length - 8)}</div>
                </div>
                ${websiteHtml}
            </div>
        `;
    }).join('');
    
    suggestionsEl.classList.add('visible');
}

// Hide suggestions
function hideSuggestions() {
    const suggestionsEl = document.getElementById('searchSuggestions');
    if (suggestionsEl) {
        suggestionsEl.classList.remove('visible');
    }
}

// Select validator from suggestion
function selectValidatorFromSuggestion(identity) {
    hideSuggestions();
    loadValidatorByIdentity(identity);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load validator by identity (called when clicking recent validator or after detecting identity)
async function loadValidatorByIdentity(identity) {
    try {
        hideAllMessages();
        hideResults();
        removeWithdrawAuthorityMatch();

        // Fill the search input with the identity address
        voteAccountInput.value = identity;
        hideSuggestions();

        showInfo('Loading validator information...', true);
        
        // Find vote account for this identity
        const voteAccounts = await connection.getVoteAccounts();
        const allVoteAccounts = [...voteAccounts.current, ...voteAccounts.delinquent];
        const voteAcc = allVoteAccounts.find(acc => acc.nodePubkey === identity);
        
        if (!voteAcc) {
            throw new Error('Vote account not found for this validator identity');
        }
        
        // Try to get validator info from cache
        const cachedValidator = allValidatorsCache.find(v => v.identity === identity);
        
        // Create validator info with basic data + cached info
        currentValidatorInfo = {
            identity: identity,
            votePubkey: voteAcc.votePubkey,
            name: cachedValidator?.name || `${identity.substring(0, 4)}...${identity.substring(identity.length - 4)}`,
            commission: voteAcc.commission,
            activatedStake: voteAcc.activatedStake,
            lastVote: voteAcc.lastVote,
            iconUrl: cachedValidator?.iconUrl || '',
            website: cachedValidator?.website || '',
            details: cachedValidator?.details || ''
        };

        // Save to recent validators
        saveRecentValidator(currentValidatorInfo);
        
        // Get current epoch
        const currentEpoch = await getCurrentEpoch();
        window.currentEpochCache = currentEpoch;
        
        // Get vote account info
        const voteAccountPubkey = new solanaWeb3.PublicKey(voteAcc.votePubkey);
        await handleVoteAccountSearch(voteAccountPubkey, currentEpoch);
        
        // Update the search input to show the identity
        voteAccountInput.value = identity;
        
        // Update recent validators display
        loadRecentValidators();
        
    } catch (error) {
        hideInfo();
        showError(`Error loading validator: ${error.message}`);
        console.error('Error:', error);
    }
}

// Save validator to recent list (localStorage)
function saveRecentValidator(validator) {
    try {
        const MAX_RECENT = 10;
        let recent = JSON.parse(localStorage.getItem('recentValidators') || '[]');
        
        // Remove if already exists
        recent = recent.filter(v => v.identity !== validator.identity);
        
        // Add to beginning
        recent.unshift({
            identity: validator.identity,
            votePubkey: validator.votePubkey,
            name: validator.name,
            iconUrl: validator.iconUrl,
            website: validator.website,
            details: validator.details,
            commission: validator.commission,
            timestamp: Date.now()
        });
        
        // Keep only MAX_RECENT
        recent = recent.slice(0, MAX_RECENT);
        
        localStorage.setItem('recentValidators', JSON.stringify(recent));
    } catch (error) {
        console.error('Failed to save recent validator:', error);
    }
}

// Load and display recent validators
function loadRecentValidators() {
    try {
        const recent = JSON.parse(localStorage.getItem('recentValidators') || '[]');
        const container = document.getElementById('recentValidators');
        
        if (!container) return;
        
        if (recent.length === 0) {
            container.innerHTML = '<div class="no-recent">No recent validators. Search for a validator to get started.</div>';
            return;
        }
        
        container.innerHTML = recent.map(v => `
            <div class="recent-validator-wrapper">
                <button class="recent-validator-btn" onclick="loadValidatorByIdentity('${v.identity}')" title="${v.name}">
                    ${v.iconUrl ? 
                        `<img src="${v.iconUrl}" alt="${v.name}" class="recent-icon" onerror="this.outerHTML='<span class=\\'recent-icon-text\\'>${v.name.charAt(0).toUpperCase()}</span>'">` : 
                        `<span class="recent-icon-text">${v.name.charAt(0).toUpperCase()}</span>`
                    }
                    <span class="recent-name">${v.name.length > 12 ? v.name.substring(0, 12) + '...' : v.name}</span>
                </button>
                <button class="recent-validator-delete" onclick="clearRecentValidator('${v.identity}', event)" title="Remove from recent">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load recent validators:', error);
    }
}

// Clear a recent validator
function clearRecentValidator(identity, event) {
    if (event) {
        event.stopPropagation();
    }
    
    try {
        let recent = JSON.parse(localStorage.getItem('recentValidators') || '[]');
        recent = recent.filter(v => v.identity !== identity);
        localStorage.setItem('recentValidators', JSON.stringify(recent));
        loadRecentValidators();
    } catch (error) {
        console.error('Failed to clear recent validator:', error);
    }
}

// Clear all recent validators
function clearAllRecentValidators() {
    try {
        localStorage.removeItem('recentValidators');
        loadRecentValidators();
        showInfo('Recent validators cleared');
        setTimeout(() => hideInfo(), 2000);
    } catch (error) {
        console.error('Failed to clear recent validators:', error);
    }
}

// Handle search button click
async function handleSearch() {
    const accountStr = voteAccountInput.value.trim();
    
    if (!accountStr) {
        showError('Please enter an account address (identity, vote, or stake)');
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
        console.log('📅 Current epoch:', currentEpoch);
        
        if (currentEpoch === null) {
            console.warn('⚠️ Failed to get current epoch, stake status may be inaccurate');
        }
        
        // Store for global access
        window.currentEpochCache = currentEpoch;
        
        // Detect account type by checking the owner/program
        showInfo('Detecting account type...', true);
        const accountType = await detectAccountType(accountPubkey);
        
        console.log('🔍 Detected account type:', accountType);
        
        if (accountType === 'vote') {
            // Handle as vote account
            await handleVoteAccountSearch(accountPubkey, currentEpoch);
        } else if (accountType === 'stake') {
            // Handle as stake account
            await handleStakeAccountSearch(accountPubkey, currentEpoch);
        } else if (accountType === 'identity') {
            // Handle as validator identity
            const identity = accountPubkey.toString();
            await loadValidatorByIdentity(identity);
        } else {
            throw new Error(`Invalid account type. This account is not a vote account, stake account, or validator identity (Owner: ${accountType})`);
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

// Detect whether the account is a vote account, stake account, or validator identity
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
            // Check if this is a validator identity by looking in vote accounts
            const identity = accountPubkey.toString();
            
            try {
                const voteAccounts = await connection.getVoteAccounts();
                const found = [...voteAccounts.current, ...voteAccounts.delinquent]
                    .find(acc => acc.nodePubkey === identity);
                
                if (found) {
                    return 'identity';
                }
            } catch (e) {
                console.error('Failed to check vote accounts:', e);
            }
            
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
    const voteAccountAddress = voteAccountPubkey.toString();
    
    // Create minimal validator info if not already set
    if (!currentValidatorInfo && voteAccountInfo.validatorIdentity && voteAccountInfo.validatorIdentity !== 'N/A') {
        const identity = voteAccountInfo.validatorIdentity;
        
        // Try to get activated stake from getVoteAccounts
        let activatedStake = 0;
        try {
            const allVoteAccounts = await connection.getVoteAccounts();
            const allValidators = [...allVoteAccounts.current, ...allVoteAccounts.delinquent];
            const voteAcc = allValidators.find(v => v.votePubkey === voteAccountAddress);
            if (voteAcc) {
                activatedStake = voteAcc.activatedStake;
            }
        } catch (error) {
            console.warn('Could not fetch activated stake:', error);
        }
        
        // Try to get validator info from cache
        const cachedValidator = allValidatorsCache.find(v => v.identity === identity);
        
        currentValidatorInfo = {
            identity: identity,
            votePubkey: voteAccountAddress,
            name: cachedValidator?.name || `${identity.substring(0, 4)}...${identity.substring(identity.length - 4)}`,
            commission: voteAccountInfo.commission,
            activatedStake: activatedStake,
            iconUrl: cachedValidator?.iconUrl || '',
            website: cachedValidator?.website || '',
            details: cachedValidator?.details || ''
        };
    }
    
    // Display results with vote account address
    displayResults(voteAccountInfo, voteAccountAddress);
    
    // Update Identity tab with validator info
    updateIdentityTab(voteAccountInfo);
    
    // Save to recent validators if we have validator info
    if (currentValidatorInfo) {
        saveRecentValidator(currentValidatorInfo);
        loadRecentValidators();
    }
    
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

// Update Identity tab with validator information
function updateIdentityTab(voteAccountInfo) {
    const validator = currentValidatorInfo;

    // Update validator icon
    const iconEl = document.getElementById('validatorIcon');
    const iconFallbackEl = document.getElementById('validatorIconFallback');
    if (iconEl && iconFallbackEl) {
        if (validator && validator.iconUrl && validator.iconUrl.trim()) {
            iconEl.src = validator.iconUrl;
            iconEl.style.display = 'block';
            iconFallbackEl.style.display = 'none';
        } else {
            iconEl.style.display = 'none';
            iconFallbackEl.style.display = 'flex';
        }
    }

    // Update validator name
    const nameEl = document.getElementById('validatorName');
    if (nameEl) {
        if (validator && validator.name) {
            nameEl.textContent = validator.name;
        } else {
            const identity = voteAccountInfo.validatorIdentity;
            nameEl.textContent = `${identity.substring(0, 8)}...${identity.substring(identity.length - 8)}`;
        }
    }

    // Update validator website
    const websiteEl = document.getElementById('validatorWebsite');
    if (websiteEl) {
        if (validator && validator.website) {
            websiteEl.href = validator.website;
            websiteEl.classList.remove('hidden');
        } else {
            websiteEl.classList.add('hidden');
        }
    }

    // Update identity address
    const addressEl = document.getElementById('identityAddress');
    if (addressEl) {
        addressEl.textContent = voteAccountInfo.validatorIdentity;
    }

    // Update active stake
    const activeStakeEl = document.getElementById('identityActiveStake');
    if (activeStakeEl) {
        if (validator && validator.activatedStake) {
            const stakeInXNT = validator.activatedStake / solanaWeb3.LAMPORTS_PER_SOL;
            activeStakeEl.textContent = formatBalance(stakeInXNT);
        } else {
            activeStakeEl.textContent = '-';
        }
    }

    // Update validator details
    const detailsEl = document.getElementById('validatorDetails');
    const detailsCardEl = document.getElementById('validatorDetailsCard');
    if (detailsEl && detailsCardEl) {
        if (validator && validator.details && validator.details.trim()) {
            detailsEl.textContent = validator.details;
            detailsCardEl.classList.remove('hidden');
        } else {
            detailsEl.textContent = '-';
            detailsCardEl.classList.add('hidden');
        }
    }
}

// Handle stake account search (new logic)
async function handleStakeAccountSearch(stakeAccountPubkey, currentEpoch) {
    showInfo('Loading stake account information...', true);

    // Get stake account information
    const stakeAccountInfo = await getStakeAccountInfo(stakeAccountPubkey);

    // Extract vote account address from stake delegation
    let voteAccountAddress = null;
    if (stakeAccountInfo.data.stake && stakeAccountInfo.data.stake.delegation) {
        voteAccountAddress = stakeAccountInfo.data.stake.delegation.voter;
    }

    if (voteAccountAddress) {
        // Load vote account and identity information
        showInfo('Loading vote account and identity information...', true);
        
        const voteAccountPubkey = new solanaWeb3.PublicKey(voteAccountAddress);
        const voteAccountInfo = await getVoteAccountInfoWithWeb3(voteAccountPubkey);
        
        // Create minimal validator info if not already set
        if (voteAccountInfo.validatorIdentity && voteAccountInfo.validatorIdentity !== 'N/A') {
            const identity = voteAccountInfo.validatorIdentity;
            
            // Try to get activated stake from getVoteAccounts
            let activatedStake = 0;
            try {
                const allVoteAccounts = await connection.getVoteAccounts();
                const allValidators = [...allVoteAccounts.current, ...allVoteAccounts.delinquent];
                const voteAcc = allValidators.find(v => v.votePubkey === voteAccountAddress);
                if (voteAcc) {
                    activatedStake = voteAcc.activatedStake;
                }
            } catch (error) {
                console.warn('Could not fetch activated stake:', error);
            }
            
            // Try to get validator info from cache
            const cachedValidator = allValidatorsCache.find(v => v.identity === identity);
            
            currentValidatorInfo = {
                identity: identity,
                votePubkey: voteAccountAddress,
                name: cachedValidator?.name || `${identity.substring(0, 4)}...${identity.substring(identity.length - 4)}`,
                commission: voteAccountInfo.commission,
                activatedStake: activatedStake,
                iconUrl: cachedValidator?.iconUrl || '',
                website: cachedValidator?.website || '',
                details: cachedValidator?.details || ''
            };
        }
        
        // Display vote account results
        displayResults(voteAccountInfo, voteAccountAddress);
        
        // Update Identity tab
        updateIdentityTab(voteAccountInfo);
        
        // Save to recent validators
        if (currentValidatorInfo) {
            saveRecentValidator(currentValidatorInfo);
            loadRecentValidators();
        }
        
        // Load all stake accounts for this vote account (just like when searching by vote/identity)
        showInfo('Loading all stake accounts for this validator...', true);
        const stakeAccounts = await getStakeAccountsForVoteAccount(voteAccountPubkey);
        
        console.log('=== Before createStakeTabs ===');
        console.log('Wallet connected:', walletConnected);
        console.log('Connected address:', connectedWalletAddress);
        console.log('Authorized stake accounts:', stakeAccounts.length);
        console.log('Current epoch (early):', currentEpoch);
        
        // Store the stake accounts
        currentStakeAccounts = stakeAccounts;
        
        // Create stake tabs with current epoch info
        await createStakeTabs(stakeAccounts, currentEpoch);
        
        // Check withdraw authority match after displaying results
        if (walletConnected) {
            setTimeout(() => checkWithdrawAuthorityMatch(), 100);
        }
        
        hideInfo();
        
        // Show completion message
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
    } else {
        // No vote account found, hide vote info and only show the single stake account
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
function displayResults(voteAccountInfo, voteAccountAddress = null) {
    // Display vote account address
    if (voteAccountAddressEl) {
        // Use provided address, or fall back to validator info, or search input
        const voteAccount = voteAccountAddress || 
                           currentValidatorInfo?.votePubkey || 
                           voteAccountInput.value.trim();
        voteAccountAddressEl.textContent = voteAccount;
    }
    
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
    // Switch to identity tab by default when showing results
    switchTab('identity-info');
}

function hideResults() {
    resultsSection.classList.add('hidden');
    // Disable withdraw button when hiding results
    updateWithdrawButtonState(false);
    // Remove commission update button when hiding results
    removeCommissionUpdateButton();
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
        removeCommissionUpdateButton();
        return;
    }
    
    const withdrawAuthority = withdrawAuthorityEl.textContent;
    if (withdrawAuthority && withdrawAuthority !== 'N/A' && withdrawAuthority !== '-') {
        if (withdrawAuthority === connectedWalletAddress) {
            showWithdrawAuthorityMatch(true);
            updateWithdrawButtonState(true);
            showCommissionUpdateButton(true);
        } else {
            showWithdrawAuthorityMatch(false);
            updateWithdrawButtonState(false);
            showCommissionUpdateButton(false);
        }
    } else {
        updateWithdrawButtonState(false);
        removeCommissionUpdateButton();
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

// Show commission update button based on authority
function showCommissionUpdateButton(hasAuthority) {
    const commissionCard = commissionEl.closest('.info-card');
    if (!commissionCard) return;
    
    // Remove existing button and indicator
    const existingButton = commissionCard.querySelector('.update-commission-btn');
    const existingIndicator = commissionCard.querySelector('.commission-authority-indicator');
    const existingContainer = commissionCard.querySelector('.commission-value-container');
    
    if (existingButton) {
        existingButton.remove();
    }
    if (existingIndicator) {
        existingIndicator.remove();
    }
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Remove existing classes
    commissionCard.classList.remove('authority-match', 'authority-no-match');
    
    const infoContent = commissionCard.querySelector('.info-content');
    
    if (hasAuthority) {
        // Create a container for commission value and button
        const valueContainer = document.createElement('div');
        valueContainer.className = 'commission-value-container';
        
        // Move commission element into container (not clone, just move)
        valueContainer.appendChild(commissionEl);
        
        // Create Update button
        const updateButton = document.createElement('button');
        updateButton.className = 'update-commission-btn';
        updateButton.onclick = showUpdateCommissionModal;
        updateButton.innerHTML = `
            <i class="fas fa-edit"></i>
            Update
        `;
        valueContainer.appendChild(updateButton);
        
        // Add container to info-content
        infoContent.appendChild(valueContainer);
        
        // Add style class
        commissionCard.classList.add('authority-match');
        
        // Add status indicator below
        const indicator = document.createElement('div');
        indicator.className = 'commission-authority-indicator';
        indicator.innerHTML = `
            <div class="match-status match-success">
                <i class="fas fa-check-circle"></i>
                <span>You have withdraw authority</span>
            </div>
        `;
        infoContent.appendChild(indicator);
        
        console.log('Update commission button added');
    } else {
        commissionCard.classList.add('authority-no-match');
        
        // Add status indicator showing no authority
        const indicator = document.createElement('div');
        indicator.className = 'commission-authority-indicator';
        indicator.innerHTML = `
            <div class="match-status match-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <span>You don't have withdraw authority</span>
            </div>
        `;
        
        infoContent.appendChild(indicator);
    }
}

// Remove commission update button
function removeCommissionUpdateButton() {
    const commissionCard = document.querySelector('.commission-card');
    if (!commissionCard) return;
    
    const button = commissionCard.querySelector('.update-commission-btn');
    const indicator = commissionCard.querySelector('.commission-authority-indicator');
    const container = commissionCard.querySelector('.commission-value-container');
    
    if (container) {
        // Move commission element back to info-content
        const commissionInContainer = container.querySelector('#commission');
        const infoContent = commissionCard.querySelector('.info-content');
        if (commissionInContainer && infoContent) {
            infoContent.appendChild(commissionInContainer);
        }
        container.remove();
    }
    
    if (button) {
        button.remove();
    }
    if (indicator) {
        indicator.remove();
    }
    
    commissionCard.classList.remove('authority-match', 'authority-no-match');
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
        
        // Initialize merge stake UI when switching to merge-stake tab
        if (tabId === 'merge-stake') {
            setTimeout(() => {
                initializeMergeStakeUI();
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
            <div class="info-card${hasWithdrawAuthority ? ' balance-card' : ''}">
                <div class="info-header">
                    <i class="fas fa-wallet"></i>
                    <h3>Account Balance</h3>
                </div>
                <div class="info-content">
                    <span class="balance">${totalBalance.toFixed(6)} XNT</span>
                    ${hasWithdrawAuthority && totalBalance > 0 ? 
                        (stakeStatus.text === 'Inactive' || stakeStatus.text === 'Not Delegated' ?
                            `<button class="withdraw-stake-btn" onclick="showStakeWithdrawModal('${stakePubkey}', ${totalBalance.toFixed(6)})">
                                <i class="fas fa-arrow-right"></i>
                                Withdraw
                            </button>` :
                            `<button class="withdraw-stake-btn" disabled title="Only inactive or undelegated stake can be withdrawn. Deactivate the stake first.">
                                <i class="fas fa-arrow-right"></i>
                                Withdraw
                            </button>`
                        ) : 
                        ''
                    }
                </div>
                ${hasWithdrawAuthority && totalBalance > 0 && stakeStatus.text !== 'Inactive' && stakeStatus.text !== 'Not Delegated' ?
                    `<div class="withdraw-hint" style="margin-top: 8px; padding: 8px; background: rgba(255, 152, 0, 0.1); border-radius: 6px; font-size: 0.85rem; color: #ef6c00; border-left: 3px solid #ff9800;">
                        <i class="fas fa-info-circle"></i>
                        <span>Withdraw available after stake is deactivated and inactive</span>
                    </div>` : 
                    ''
                }
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
async function showWithdrawModal() {
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

    // Get vote account rent-exempt minimum balance (from cache or chain)
    const VOTE_ACCOUNT_RENT_EXEMPT = await getVoteAccountRentExempt();
    const maxSafeWithdraw = currentBalance - VOTE_ACCOUNT_RENT_EXEMPT;
    
    if (maxSafeWithdraw <= 0) {
        showError(
            `Cannot withdraw from this vote account. ` +
            `Account balance (${currentBalance.toFixed(6)} XNT) is at or below the rent-exempt minimum (${VOTE_ACCOUNT_RENT_EXEMPT.toFixed(8)} XNT).\n\n` +
            `Vote accounts must maintain this minimum balance to remain active.`
        );
        return;
    }

    // Populate modal with connected wallet address as recipient
    availableBalanceEl.textContent = currentBalance.toFixed(4);
    withdrawToInput.value = connectedWalletAddress; // Use connected wallet address
    withdrawAmountInput.value = '';
    
    // Add max button with rent-exempt consideration
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
    maxBtn.onclick = async () => {
        const availableBalance = parseFloat(availableBalanceEl.textContent);
        // Get vote account rent-exempt minimum balance (from cache or chain)
        const VOTE_ACCOUNT_RENT_EXEMPT = await getVoteAccountRentExempt();
        const maxSafeWithdraw = availableBalance - VOTE_ACCOUNT_RENT_EXEMPT;
        const maxWithdrawAmount = Math.floor(maxSafeWithdraw); // only allow integer part, and keep rent-exempt
        withdrawAmountInput.value = Math.max(0, maxWithdrawAmount);
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
async function showStakeWithdrawModal(stakeAccountAddress, availableBalance) {
    const existingModal = document.getElementById('stakeWithdrawModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Get stake account rent-exempt minimum balance (from cache or chain)
    const STAKE_ACCOUNT_RENT_EXEMPT = await getStakeAccountRentExempt();
    const maxWithdrawable = availableBalance - STAKE_ACCOUNT_RENT_EXEMPT;
    
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
                    For partial withdrawal, the account must keep at least ${STAKE_ACCOUNT_RENT_EXEMPT} XNT for rent-exempt.<br>
                    To withdraw all funds, enter the full balance to close the account.</p>
                </div>
                
                <div class="stake-account-info" style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 12px 0;">
                    <strong>Stake Account:</strong><br>
                    <span style="font-family: monospace; color: #666; word-break: break-all;">${stakeAccountAddress}</span><br><br>
                    <strong>Total Balance:</strong> ${availableBalance.toFixed(6)} XNT<br>
                    <strong>Max Withdrawable (Partial):</strong> ${maxWithdrawable > 0 ? maxWithdrawable.toFixed(6) : '0.000000'} XNT<br>
                    <small style="color: #666;">Or withdraw all ${availableBalance.toFixed(6)} XNT to close account</small>
                </div>
                
                <div class="form-group">
                    <label for="stakeWithdrawAmount">Amount (XNT):</label>
                    <div style="position: relative;">
                        <input type="number" id="stakeWithdrawAmount" step="0.000000001" placeholder="Enter amount in XNT" value="${availableBalance}" autocomplete="off">
                        <button type="button" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); padding: 4px 8px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;" onclick="document.getElementById('stakeWithdrawAmount').value = ${maxWithdrawable.toFixed(6)}">Max Partial</button>
                    </div>
                    <small style="color: #666; display: block; margin-top: 4px;">
                        <i class="fas fa-lightbulb"></i> 
                        Enter full balance to close account, or less to keep account open
                    </small>
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
    
    // fill current vote account - but only when vote account information is visible
    // if searching stake account directly, vote-info tab will be hidden, so do not fill automatically
    const voteTab = document.querySelector('[onclick="switchTab(\'vote-info\')"]');
    const isVoteAccountVisible = voteTab && voteTab.style.display !== 'none';
    
    if (isVoteAccountVisible) {
        // only fill when vote account list is visible after searching vote account
        const currentVoteAccount = voteAccountInput.value.trim();
        if (currentVoteAccount) {
            document.getElementById('delegateVoteAccount').value = currentVoteAccount;
        }
    }
    // if searching stake account directly, keep input box empty
    
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

    // Get vote account rent-exempt minimum balance (from cache or chain)
    const VOTE_ACCOUNT_RENT_EXEMPT = await getVoteAccountRentExempt();

    // Calculate maximum safe withdrawal amount
    const maxSafeWithdraw = availableBalance - VOTE_ACCOUNT_RENT_EXEMPT;
    const maxAllowedWithdraw = Math.floor(maxSafeWithdraw); // only allow integer part
    
    if (maxAllowedWithdraw <= 0) {
        showError(
            `Cannot withdraw from this vote account. ` +
            `Account balance (${availableBalance.toFixed(6)} XNT) is at or below the rent-exempt minimum (${VOTE_ACCOUNT_RENT_EXEMPT.toFixed(8)} XNT).\n\n` +
            `Vote accounts must maintain this minimum balance to remain active.`
        );
        return;
    }
    
    if (amount > maxAllowedWithdraw) {
        showError(
            `Withdrawal amount exceeds maximum allowed: ${maxAllowedWithdraw} XNT\n\n` +
            `Vote accounts must keep at least ${VOTE_ACCOUNT_RENT_EXEMPT.toFixed(8)} XNT for rent-exempt. ` +
            `Available balance: ${availableBalance.toFixed(6)} XNT`
        );
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
                const explorerUrl = getExplorerUrl(signature);
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
                    
                    const explorerUrl = getExplorerUrl(signature);
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
    
    try {
        // Get stake account info to check total balance
        const stakeAccountPubkey = new solanaWeb3.PublicKey(stakeAccountAddress);
        const stakeAccountInfo = await connection.getAccountInfo(stakeAccountPubkey);
        
        if (!stakeAccountInfo) {
            showError('Stake account not found');
            return;
        }
        
        const totalLamports = stakeAccountInfo.lamports;
        const totalBalance = totalLamports / solanaWeb3.LAMPORTS_PER_SOL;
        const requestedLamports = Math.floor(amount * solanaWeb3.LAMPORTS_PER_SOL);
        
        // Get stake account rent-exempt minimum balance (from cache or chain)
        const STAKE_ACCOUNT_RENT_EXEMPT = await getStakeAccountRentExempt();
        
        // Check if user is trying to withdraw all (within a small tolerance)
        const isWithdrawAll = Math.abs(amount - totalBalance) < 0.000001;
        
        // For partial withdrawal, check if remaining balance would be below rent-exempt
        if (!isWithdrawAll) {
            const remainingBalance = totalBalance - amount;
            
            if (remainingBalance < STAKE_ACCOUNT_RENT_EXEMPT && remainingBalance > 0.000001) {
                // User is trying to withdraw too much but not all
                const maxWithdrawable = totalBalance - STAKE_ACCOUNT_RENT_EXEMPT;
                showError(
                    `Cannot withdraw ${amount.toFixed(6)} XNT. ` +
                    `Account must keep at least ${STAKE_ACCOUNT_RENT_EXEMPT.toFixed(8)} XNT for rent-exempt.\n\n` +
                    `Maximum withdrawable: ${maxWithdrawable.toFixed(6)} XNT\n` +
                    `Or withdraw ALL (${totalBalance.toFixed(6)} XNT) to close the account.`
                );
                return;
            }
        }
        
        // Confirm the operation
        let confirmMessage = `Are you sure you want to withdraw ${amount} XNT from stake account:\n\n${stakeAccountAddress}\n\nTo: ${recipient}`;
        if (isWithdrawAll) {
            confirmMessage += '\n\n⚠️ This will withdraw ALL funds and CLOSE the stake account permanently.';
        }
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        showInfo('Creating stake withdraw transaction...', true);
        
        // Create public keys
        const withdrawAuthorityPubkey = new solanaWeb3.PublicKey(connectedWalletAddress);
        const recipientPubkey = new solanaWeb3.PublicKey(recipient);
        
        // Get latest blockhash
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        
        // Create transaction
        const transaction = new solanaWeb3.Transaction({
            recentBlockhash: blockhash,
            feePayer: withdrawAuthorityPubkey,
        });
        
        if (isWithdrawAll) {
            // Withdraw ALL lamports (including rent-exempt balance) - this will close the account
            console.log('Withdrawing ALL and closing account:', {
                stakeAccount: stakeAccountPubkey.toString(),
                totalLamports: totalLamports,
                withdrawingAll: true
            });
            
            const withdrawInstruction = solanaWeb3.StakeProgram.withdraw({
                stakePubkey: stakeAccountPubkey,
                authorizedPubkey: withdrawAuthorityPubkey,
                toPubkey: recipientPubkey,
                lamports: totalLamports, // Withdraw ALL lamports to close account
            });
            
            transaction.add(withdrawInstruction);
        } else {
            // Partial withdrawal - keep account open
            console.log('Partial withdrawal:', {
                stakeAccount: stakeAccountPubkey.toString(),
                requestedLamports: requestedLamports,
                totalLamports: totalLamports,
                remaining: totalLamports - requestedLamports
            });
            
            const withdrawInstruction = solanaWeb3.StakeProgram.withdraw({
                stakePubkey: stakeAccountPubkey,
                authorizedPubkey: withdrawAuthorityPubkey,
                toPubkey: recipientPubkey,
                lamports: requestedLamports,
            });
            
            transaction.add(withdrawInstruction);
        }
        
        console.log('Stake withdraw transaction created');
        
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
        
        const explorerUrl = getExplorerUrl(signature);
        if (isWithdrawAll) {
            showSuccess(`✅ Stake withdrawal successful! Account closed. <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
        } else {
            showSuccess(`✅ Stake withdrawal successful! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
        }
        
        // Refresh the stake accounts display after a short delay
        setTimeout(async () => {
            const currentVoteAccount = document.getElementById('voteAccount').value.trim();
            if (currentVoteAccount) {
                showInfo('Refreshing stake accounts...', true);
                await handleSearch();
            }
        }, 2000);
        
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
        
        const explorerUrl = getExplorerUrl(signature);
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
        
        const explorerUrl = getExplorerUrl(signature);
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
        
        const explorerUrl = getExplorerUrl(signature);
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

// Stake Authority Selector functions
function showStakeAuthoritySelector() {
    if (!walletConnected) {
        showError('Please connect your wallet first');
        return;
    }
    
    // Get current active stake tab
    const activeStakeTab = document.querySelector('.tab-content.active[id^="stake-"]');
    if (!activeStakeTab) {
        showError('No active stake account selected');
        return;
    }
    
    getBackpackAccounts().then(accounts => {
        createStakeAuthoritySelectorModal(accounts, 'stake');
    }).catch(error => {
        if (error.message === 'MANUAL_INPUT_REQUIRED') {
            showManualStakeAuthorityInputModal('stake');
        } else {
            showError('Failed to retrieve wallet accounts: ' + error.message);
        }
    });
}

function showStakeWithdrawAuthoritySelector() {
    if (!walletConnected) {
        showError('Please connect your wallet first');
        return;
    }
    
    // Get current active stake tab
    const activeStakeTab = document.querySelector('.tab-content.active[id^="stake-"]');
    if (!activeStakeTab) {
        showError('No active stake account selected');
        return;
    }
    
    getBackpackAccounts().then(accounts => {
        createStakeAuthoritySelectorModal(accounts, 'withdraw');
    }).catch(error => {
        if (error.message === 'MANUAL_INPUT_REQUIRED') {
            showManualStakeAuthorityInputModal('withdraw');
        } else {
            showError('Failed to retrieve wallet accounts: ' + error.message);
        }
    });
}

// Create stake authority selector modal
function createStakeAuthoritySelectorModal(accounts, authorityType) {
    console.log('Creating stake authority modal with accounts:', accounts, 'type:', authorityType);
    
    if (!accounts || accounts.length === 0) {
        showError('No accounts found in Backpack wallet');
        return;
    }
    
    const existingModal = document.getElementById('stakeAuthoritySelectorModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'stakeAuthoritySelectorModal';
    modal.className = 'modal';
    
    const authorityTitle = authorityType === 'stake' ? 'Stake Authority' : 'Withdraw Authority';
    
    const accountsHTML = accounts.map(account => {
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
                    `<button class="select-account-btn" onclick="selectNewStakeAuthority('${account.publicKey}', '${account.username}', '${authorityType}')">
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
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-users"></i> Select New ${authorityTitle}</h3>
                <button class="modal-close" onclick="hideStakeAuthoritySelectorModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 16px; color: #666; font-size: 14px;">
                    Choose which wallet address should become the new ${authorityTitle.toLowerCase()} for this stake account:
                </p>
                <div class="account-list">
                    ${accountsHTML}
                </div>
                <div class="modal-note">
                    <i class="fas fa-info-circle"></i>
                    <small>This will create a transaction to update the ${authorityTitle.toLowerCase()}. You'll need to sign the transaction with the current ${authorityTitle.toLowerCase()}.</small>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="hideStakeAuthoritySelectorModal()">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
}

// Hide stake authority selector modal
function hideStakeAuthoritySelectorModal() {
    const modal = document.getElementById('stakeAuthoritySelectorModal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

// Manual stake authority input modal
function showManualStakeAuthorityInputModal(authorityType) {
    const existingModal = document.getElementById('manualStakeAuthorityModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'manualStakeAuthorityModal';
    modal.className = 'modal';
    
    const authorityTitle = authorityType === 'stake' ? 'Stake Authority' : 'Withdraw Authority';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Update ${authorityTitle}</h3>
                <button class="modal-close" onclick="hideManualStakeAuthorityModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-note" style="margin-bottom: 16px; background: #e3f2fd; color: #1565c0; border-left: 4px solid #2196f3;">
                    <i class="fas fa-info-circle"></i>
                    <p><strong>Multiple account selection not available</strong><br>
                    Please enter the new ${authorityTitle.toLowerCase()} address manually.</p>
                </div>
                
                <div class="form-group">
                    <label for="manualStakeAuthorityAddress">New ${authorityTitle} Address:</label>
                    <input 
                        type="text" 
                        id="manualStakeAuthorityAddress" 
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
                <button class="btn-cancel" onclick="hideManualStakeAuthorityModal()">Cancel</button>
                <button class="btn-confirm" onclick="processManualStakeAuthorityInput('${authorityType}')">Update Authority</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        document.getElementById('manualStakeAuthorityAddress').focus();
    }, 100);
}

// Hide manual stake authority input modal
function hideManualStakeAuthorityModal() {
    const modal = document.getElementById('manualStakeAuthorityModal');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    }
}

// Process manual stake authority input
function processManualStakeAuthorityInput(authorityType) {
    const addressInput = document.getElementById('manualStakeAuthorityAddress');
    const newAddress = addressInput.value.trim();
    
    if (!newAddress) {
        showError('Please enter a valid wallet address');
        return;
    }
    
    try {
        new solanaWeb3.PublicKey(newAddress);
    } catch (error) {
        showError('Invalid wallet address format');
        return;
    }
    
    if (newAddress === connectedWalletAddress) {
        showError('New address cannot be the same as current address');
        return;
    }
    
    hideManualStakeAuthorityModal();
    
    const authorityTitle = authorityType === 'stake' ? 'stake authority' : 'withdraw authority';
    if (confirm(`Are you sure you want to update the ${authorityTitle} to:\n\n${newAddress}\n\nPlease verify this address is correct.`)) {
        selectNewStakeAuthority(newAddress, 'Manual Input', authorityType);
    }
}

// Select new stake authority
async function selectNewStakeAuthority(newAuthority, accountName, authorityType) {
    hideStakeAuthoritySelectorModal();
    hideManualStakeAuthorityModal();
    
    try {
        // Get current active stake tab
        const activeStakeTab = document.querySelector('.tab-content.active[id^="stake-"]');
        if (!activeStakeTab) {
            throw new Error('No active stake account selected');
        }
        
        // Extract stake account address from the tab
        const stakeAccountEl = activeStakeTab.querySelector('.info-card .address');
        if (!stakeAccountEl) {
            throw new Error('Cannot find stake account address');
        }
        
        const stakeAccountAddress = stakeAccountEl.textContent.trim();
        
        await executeStakeAuthorityUpdate(stakeAccountAddress, newAuthority, authorityType);
    } catch (error) {
        showError('Failed to update stake authority: ' + error.message);
    }
}

// Execute stake authority update transaction
async function executeStakeAuthorityUpdate(stakeAccountAddress, newAuthority, authorityType) {
    if (!walletConnected || !wallet) {
        throw new Error('Wallet not connected');
    }
    
    const authorityTitle = authorityType === 'stake' ? 'stake authority' : 'withdraw authority';
    
    // Get current authority from the active tab
    const activeStakeTab = document.querySelector('.tab-content.active[id^="stake-"]');
    let currentAuthorityEl;
    
    if (authorityType === 'stake') {
        currentAuthorityEl = activeStakeTab.querySelector('.stake-authority-address');
    } else {
        currentAuthorityEl = activeStakeTab.querySelector('.stake-withdraw-authority-address');
    }
    
    if (!currentAuthorityEl) {
        throw new Error(`Cannot find current ${authorityTitle} element`);
    }
    
    const currentAuthority = currentAuthorityEl.textContent.trim();
    
    if (currentAuthority !== connectedWalletAddress) {
        throw new Error(`You must be the current ${authorityTitle} to update it`);
    }
    
    showInfo(`Creating ${authorityTitle} update transaction...`, true);
    
    try {
        const stakeAccountPubkey = new solanaWeb3.PublicKey(stakeAccountAddress);
        const currentAuthorityPubkey = new solanaWeb3.PublicKey(currentAuthority);
        const newAuthorityPubkey = new solanaWeb3.PublicKey(newAuthority);
        
        // Get latest blockhash
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        
        // Create transaction
        const transaction = new solanaWeb3.Transaction({
            recentBlockhash: blockhash,
            feePayer: currentAuthorityPubkey,
        });
        
        // Create authorize instruction
        // StakeAuthorizationLayout: 0 = Staker, 1 = Withdrawer
        const stakeAuthorizationType = authorityType === 'stake' ? 
            solanaWeb3.StakeAuthorizationLayout.Staker : 
            solanaWeb3.StakeAuthorizationLayout.Withdrawer;
        
        const authorizeInstruction = solanaWeb3.StakeProgram.authorize({
            stakePubkey: stakeAccountPubkey,
            authorizedPubkey: currentAuthorityPubkey,
            newAuthorizedPubkey: newAuthorityPubkey,
            stakeAuthorizationType: stakeAuthorizationType
        });
        
        transaction.add(authorizeInstruction);
        
        console.log('StakeProgram.authorize transaction created:', {
            stakeAccount: stakeAccountPubkey.toString(),
            currentAuthority: currentAuthorityPubkey.toString(),
            newAuthority: newAuthorityPubkey.toString(),
            authorizationType: authorityType
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
        
        // Update UI authority display
        currentAuthorityEl.textContent = newAuthority;
        
        // Recheck authority match with current connected wallet
        const activeTab = document.querySelector('.tab-btn.active[data-tab-id]');
        if (activeTab) {
            const tabId = activeTab.getAttribute('data-tab-id');
            setTimeout(() => {
                checkStakeAuthorities(tabId);
            }, 100);
        }
        
        const explorerUrl = getExplorerUrl(signature);
        showSuccess(`✅ ${authorityTitle.charAt(0).toUpperCase() + authorityTitle.slice(1)} updated successfully! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
        
    } catch (error) {
        console.error(`Update ${authorityTitle} failed:`, error);
        throw error;
    }
}

// ===== Update Commission Functions =====

// Show update commission modal
function showUpdateCommissionModal() {
    if (!walletConnected || !connectedWalletAddress) {
        showError('Please connect your wallet first');
        return;
    }
    
    const withdrawAuthority = withdrawAuthorityEl.textContent;
    if (withdrawAuthority !== connectedWalletAddress) {
        showError('You do not have withdraw authority for this vote account');
        return;
    }
    
    // Get current commission value
    const currentCommissionText = commissionEl.textContent;
    const currentCommissionValue = currentCommissionText.replace('%', '').trim();
    
    // Populate modal
    const currentCommissionInput = document.getElementById('currentCommission');
    const newCommissionInput = document.getElementById('newCommission');
    
    if (currentCommissionInput) {
        currentCommissionInput.value = currentCommissionText;
    }
    if (newCommissionInput) {
        newCommissionInput.value = '';
    }
    
    // Show modal
    const modal = document.getElementById('updateCommissionModal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // Focus on new commission input
        setTimeout(() => {
            if (newCommissionInput) {
                newCommissionInput.focus();
            }
        }, 100);
    }
}

// Hide update commission modal
function hideUpdateCommissionModal() {
    const modal = document.getElementById('updateCommissionModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    const newCommissionInput = document.getElementById('newCommission');
    if (newCommissionInput) {
        newCommissionInput.value = '';
    }
}

// Execute update commission transaction
async function executeUpdateCommission() {
    if (!walletConnected || !wallet) {
        showError('Wallet not connected');
        return;
    }
    
    const newCommissionInput = document.getElementById('newCommission');
    const newCommission = parseFloat(newCommissionInput.value);
    
    // Validate commission value
    if (isNaN(newCommission) || newCommission < 0 || newCommission > 100) {
        showError('Commission must be between 0 and 100');
        return;
    }
    
    const withdrawAuthority = withdrawAuthorityEl.textContent;
    if (withdrawAuthority !== connectedWalletAddress) {
        showError('You do not have withdraw authority for this vote account');
        return;
    }
    
    hideUpdateCommissionModal();
    
    // Confirm the operation
    if (!confirm(`Are you sure you want to update the commission to ${newCommission}%?\n\nThis will affect future rewards distribution.`)) {
        return;
    }
    
    showInfo('Creating update commission transaction...', true);
    
    try {
        // Get current vote account
        const voteAccountStr = voteAccountInput.value.trim();
        const voteAccountPubkey = new solanaWeb3.PublicKey(voteAccountStr);
        const withdrawAuthorityPubkey = new solanaWeb3.PublicKey(withdrawAuthority);
        
        // Get latest blockhash
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        
        // Create transaction
        const transaction = new solanaWeb3.Transaction({
            recentBlockhash: blockhash,
            feePayer: withdrawAuthorityPubkey,
        });
        
        // Vote program ID
        const VOTE_PROGRAM_ID = new solanaWeb3.PublicKey('Vote111111111111111111111111111111111111111');
        
        // UpdateCommission instruction data
        // Instruction type for UpdateCommission is 5 (per Solana vote program enum)
        const instructionData = new Uint8Array(5);
        
        // Write instruction type (5 = UpdateCommission) as 4-byte little endian
        const instructionType = 5;
        instructionData[0] = instructionType & 0xff;
        instructionData[1] = (instructionType >> 8) & 0xff;
        instructionData[2] = (instructionType >> 16) & 0xff;
        instructionData[3] = (instructionType >> 24) & 0xff;
        
        // Write commission as u8 (1 byte) - integer 0-100
        instructionData[4] = Math.round(newCommission);
        
        const updateCommissionInstruction = new solanaWeb3.TransactionInstruction({
            keys: [
                { pubkey: voteAccountPubkey, isSigner: false, isWritable: true },
                { pubkey: withdrawAuthorityPubkey, isSigner: true, isWritable: false },
            ],
            programId: VOTE_PROGRAM_ID,
            data: instructionData,
        });
        
        transaction.add(updateCommissionInstruction);
        
        console.log('UpdateCommission transaction created:', {
            voteAccount: voteAccountPubkey.toString(),
            withdrawAuthority: withdrawAuthorityPubkey.toString(),
            newCommission: newCommission,
            instructionType: instructionType
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
        
        // Update UI display
        commissionEl.textContent = `${newCommission}%`;
        
        const explorerUrl = getExplorerUrl(signature);
        showSuccess(`✅ Commission updated to ${newCommission}% successfully! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
        
    } catch (error) {
        console.error('Update commission failed:', error);
        
        let errorMessage = 'Failed to update commission: ';
        
        if (error.message && error.message.includes('rejected')) {
            errorMessage = 'Transaction was rejected by user';
        } else if (error.message && error.message.includes('insufficient funds')) {
            errorMessage = 'Insufficient funds for transaction';
        } else {
            errorMessage += error.message || 'Unknown error occurred';
        }
        
        showError(errorMessage);
    }
}

// ========================================
// Merge Stake Functions
// ========================================

// Store mergeable accounts data
let mergeableAccountsData = [];

// Initialize merge stake UI when switching to the tab
function initializeMergeStakeUI() {
    console.log('Initializing Merge Stake UI');
    
    const walletNotice = document.getElementById('mergeStakeWalletNotice');
    const mergeContent = document.getElementById('mergeStakeContent');
    const noAccountsNotice = document.getElementById('mergeNoAccountsNotice');
    const selectionArea = document.getElementById('mergeSelectionArea');
    
    if (!walletConnected || !connectedWalletAddress) {
        // Show wallet notice, hide content
        walletNotice.classList.remove('hidden');
        mergeContent.classList.add('hidden');
        return;
    }
    
    // Hide wallet notice, show content
    walletNotice.classList.add('hidden');
    mergeContent.classList.remove('hidden');
    
    // Populate the dropdowns with stake accounts
    populateMergeDropdowns();
}

// Populate merge stake dropdowns with available stake accounts
function populateMergeDropdowns() {
    const sourceInput = document.getElementById('mergeSourceSelect');
    const destInput = document.getElementById('mergeDestinationSelect');
    const sourceOptions = document.getElementById('mergeSourceOptions');
    const destOptions = document.getElementById('mergeDestOptions');
    const sourceDisplay = document.getElementById('mergeSourceDisplay');
    const destDisplay = document.getElementById('mergeDestDisplay');
    const noAccountsNotice = document.getElementById('mergeNoAccountsNotice');
    const selectionArea = document.getElementById('mergeSelectionArea');
    
    // Reset values
    sourceInput.value = '';
    destInput.value = '';
    sourceOptions.innerHTML = '';
    destOptions.innerHTML = '';
    
    // Reset display text
    sourceDisplay.querySelector('.select-text').textContent = 'Select source stake account...';
    sourceDisplay.querySelector('.select-text').classList.add('placeholder');
    destDisplay.querySelector('.select-text').textContent = 'Select destination stake account...';
    destDisplay.querySelector('.select-text').classList.add('placeholder');
    
    // Reset preview
    document.getElementById('mergePreview').classList.add('hidden');
    document.getElementById('executeMergeBtn').disabled = true;
    
    // Check if we have enough stake accounts to merge
    if (!currentStakeAccounts || currentStakeAccounts.length < 2) {
        noAccountsNotice.classList.remove('hidden');
        selectionArea.classList.add('hidden');
        console.log('Not enough stake accounts to merge:', currentStakeAccounts?.length || 0);
        return;
    }
    
    // Filter stake accounts that can be merged (user must have authority)
    mergeableAccountsData = currentStakeAccounts.filter(account => {
        const stakeAuthority = account.data.meta?.authorized?.staker || '';
        const withdrawAuthority = account.data.meta?.authorized?.withdrawer || '';
        return stakeAuthority === connectedWalletAddress || withdrawAuthority === connectedWalletAddress;
    });
    
    if (mergeableAccountsData.length < 2) {
        noAccountsNotice.classList.remove('hidden');
        selectionArea.classList.add('hidden');
        console.log('Not enough mergeable stake accounts:', mergeableAccountsData.length);
        return;
    }
    
    noAccountsNotice.classList.add('hidden');
    selectionArea.classList.remove('hidden');
    
    // Create options for both dropdowns
    mergeableAccountsData.forEach((account) => {
        const balance = (account.lamports / 1e9).toFixed(4);
        const shortAddress = account.pubkey.slice(0, 6) + '...' + account.pubkey.slice(-6);
        const status = getStakeStatusForMerge(account);
        
        // Create source option
        const sourceOption = createMergeOption(account.pubkey, shortAddress, balance, status, 'source');
        sourceOptions.appendChild(sourceOption);
        
        // Create destination option
        const destOption = createMergeOption(account.pubkey, shortAddress, balance, status, 'dest');
        destOptions.appendChild(destOption);
    });
    
    console.log('Populated merge dropdowns with', mergeableAccountsData.length, 'accounts');
}

// Create a merge option element
function createMergeOption(pubkey, shortAddress, balance, status, type) {
    const option = document.createElement('div');
    option.className = 'merge-select-option';
    option.dataset.value = pubkey;
    option.dataset.balance = balance;
    option.dataset.status = status.text;
    option.dataset.statusClass = status.class;
    
    option.innerHTML = `
        <i class="fas fa-coins option-icon"></i>
        <div class="option-content">
            <div class="option-address">${shortAddress}</div>
            <div class="option-details">
                <span class="option-balance">${balance} XNT</span>
                <span class="option-status ${status.class}">${status.text}</span>
            </div>
        </div>
    `;
    
    option.onclick = () => selectMergeOption(type, pubkey, shortAddress, balance, status);
    
    return option;
}

// Get stake status for merge display
function getStakeStatusForMerge(account) {
    const delegation = account.data.stake?.delegation;
    if (!delegation) {
        return { text: 'Inactive', class: 'inactive' };
    }
    
    const activationEpoch = parseInt(delegation.activationEpoch);
    const deactivationEpoch = parseInt(delegation.deactivationEpoch);
    const currentEpoch = window.currentEpochCache || 0;
    
    if (deactivationEpoch !== 18446744073709551615 && deactivationEpoch <= currentEpoch) {
        return { text: 'Inactive', class: 'inactive' };
    }
    
    if (deactivationEpoch !== 18446744073709551615) {
        return { text: 'Deactivating', class: 'deactivating' };
    }
    
    if (activationEpoch <= currentEpoch) {
        return { text: 'Active', class: 'active' };
    }
    
    return { text: 'Activating', class: 'activating' };
}

// Toggle merge dropdown
function toggleMergeDropdown(type) {
    const display = document.getElementById(type === 'source' ? 'mergeSourceDisplay' : 'mergeDestDisplay');
    const options = document.getElementById(type === 'source' ? 'mergeSourceOptions' : 'mergeDestOptions');
    const otherOptions = document.getElementById(type === 'source' ? 'mergeDestOptions' : 'mergeSourceOptions');
    const otherDisplay = document.getElementById(type === 'source' ? 'mergeDestDisplay' : 'mergeSourceDisplay');
    
    // Close other dropdown
    otherOptions.classList.remove('open');
    otherDisplay.classList.remove('open');
    
    // Toggle current dropdown
    const isOpen = options.classList.contains('open');
    if (isOpen) {
        options.classList.remove('open');
        display.classList.remove('open');
    } else {
        options.classList.add('open');
        display.classList.add('open');
        updateDisabledOptions();
    }
}

// Update disabled state of options
function updateDisabledOptions() {
    const sourceValue = document.getElementById('mergeSourceSelect').value;
    const destValue = document.getElementById('mergeDestinationSelect').value;
    
    // Update source options - disable the one selected in dest
    document.querySelectorAll('#mergeSourceOptions .merge-select-option').forEach(option => {
        if (option.dataset.value === destValue) {
            option.classList.add('disabled');
        } else {
            option.classList.remove('disabled');
        }
    });
    
    // Update dest options - disable the one selected in source
    document.querySelectorAll('#mergeDestOptions .merge-select-option').forEach(option => {
        if (option.dataset.value === sourceValue) {
            option.classList.add('disabled');
        } else {
            option.classList.remove('disabled');
        }
    });
}

// Select a merge option
function selectMergeOption(type, pubkey, shortAddress, balance, status) {
    const otherType = type === 'source' ? 'dest' : 'source';
    const otherInput = document.getElementById(type === 'source' ? 'mergeDestinationSelect' : 'mergeSourceSelect');
    
    // Check if this option is disabled (already selected in the other dropdown)
    if (otherInput.value === pubkey) {
        return; // Don't allow selecting the same account
    }
    
    const input = document.getElementById(type === 'source' ? 'mergeSourceSelect' : 'mergeDestinationSelect');
    const display = document.getElementById(type === 'source' ? 'mergeSourceDisplay' : 'mergeDestDisplay');
    const options = document.getElementById(type === 'source' ? 'mergeSourceOptions' : 'mergeDestOptions');
    
    // Update value
    input.value = pubkey;
    input.dataset.balance = balance;
    input.dataset.status = status.text;
    input.dataset.statusClass = status.class;
    
    // Update display
    const selectText = display.querySelector('.select-text');
    selectText.textContent = `${shortAddress} (${balance} XNT)`;
    selectText.classList.remove('placeholder');
    
    // Mark selected option
    options.querySelectorAll('.merge-select-option').forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.value === pubkey) {
            opt.classList.add('selected');
        }
    });
    
    // Close dropdown
    options.classList.remove('open');
    display.classList.remove('open');
    
    // Update preview
    updateMergePreview();
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.merge-dropdown-wrapper')) {
        document.querySelectorAll('.merge-select-options').forEach(opt => opt.classList.remove('open'));
        document.querySelectorAll('.merge-select-display').forEach(disp => disp.classList.remove('open'));
    }
});

// Update merge preview
function updateMergePreview() {
    const sourceInput = document.getElementById('mergeSourceSelect');
    const destInput = document.getElementById('mergeDestinationSelect');
    const previewSection = document.getElementById('mergePreview');
    const mergeBtn = document.getElementById('executeMergeBtn');
    
    const sourceValue = sourceInput.value;
    const destValue = destInput.value;
    
    if (!sourceValue || !destValue) {
        previewSection.classList.add('hidden');
        mergeBtn.disabled = true;
        return;
    }
    
    // Get account data
    const sourceAccount = mergeableAccountsData.find(a => a.pubkey === sourceValue);
    const destAccount = mergeableAccountsData.find(a => a.pubkey === destValue);
    
    if (!sourceAccount || !destAccount) {
        previewSection.classList.add('hidden');
        mergeBtn.disabled = true;
        return;
    }
    
    const sourceBalance = sourceAccount.lamports / 1e9;
    const destBalance = destAccount.lamports / 1e9;
    const totalBalance = sourceBalance + destBalance;
    
    // Check if statuses match
    const sourceStatus = sourceInput.dataset.status;
    const destStatus = destInput.dataset.status;
    
    if (sourceStatus !== destStatus) {
        previewSection.classList.add('hidden');
        mergeBtn.disabled = true;
        showWarning(`Cannot merge: Status mismatch. Source is "${sourceStatus}" but destination is "${destStatus}". Both must have the same status.`);
        return;
    }
    
    hideWarning();
    
    // Update preview values
    const shortSourceAddr = sourceValue.slice(0, 6) + '...' + sourceValue.slice(-6);
    const shortDestAddr = destValue.slice(0, 6) + '...' + destValue.slice(-6);
    
    document.getElementById('previewSourceAddress').textContent = shortSourceAddr;
    document.getElementById('previewSourceBalance').textContent = sourceBalance.toFixed(4) + ' XNT';
    document.getElementById('previewDestAddress').textContent = shortDestAddr;
    document.getElementById('previewDestBalance').textContent = destBalance.toFixed(4) + ' XNT';
    document.getElementById('previewTotalBalance').textContent = totalBalance.toFixed(4) + ' XNT';
    
    previewSection.classList.remove('hidden');
    mergeBtn.disabled = false;
}

// Make dropdown toggle globally available
window.toggleMergeDropdown = toggleMergeDropdown;

// Refresh stake information
async function refreshStakeInfo() {
    const refreshBtn = document.getElementById('refreshStakeInfoBtn');
    const voteAccountAddress = document.getElementById('voteAccount').value.trim();
    
    if (!voteAccountAddress) {
        showError('No account address to refresh');
        return;
    }
    
    try {
        // Add spinning animation
        refreshBtn.classList.add('refreshing');
        refreshBtn.disabled = true;
        
        showInfo('Refreshing stake information...', true);
        
        // Re-run the search
        await handleSearch();
        
        // If currently on merge-stake tab, refresh the dropdowns
        if (activeTab === 'merge-stake') {
            initializeMergeStakeUI();
        }
        
        showSuccess('✅ Stake information refreshed successfully!');
        setTimeout(() => hideSuccess(), 3000);
        
    } catch (error) {
        console.error('Refresh failed:', error);
        showError('Failed to refresh: ' + (error.message || 'Unknown error'));
    } finally {
        // Remove spinning animation
        refreshBtn.classList.remove('refreshing');
        refreshBtn.disabled = false;
    }
}

// Make refresh function globally available
window.refreshStakeInfo = refreshStakeInfo;

// Execute merge stake
async function executeMergeStake() {
    const sourceSelect = document.getElementById('mergeSourceSelect');
    const destSelect = document.getElementById('mergeDestinationSelect');
    const mergeBtn = document.getElementById('executeMergeBtn');
    
    const sourceAddress = sourceSelect.value;
    const destAddress = destSelect.value;
    
    if (!sourceAddress || !destAddress) {
        showError('Please select both source and destination accounts');
        return;
    }
    
    if (!walletConnected || !window.backpack) {
        showError('Please connect your wallet first');
        return;
    }
    
    try {
        mergeBtn.disabled = true;
        mergeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Merging...';
        showInfo('Preparing merge transaction...', true);
        
        const wallet = window.backpack;
        const conn = window.connection || connection;
        
        const sourcePubkey = new solanaWeb3.PublicKey(sourceAddress);
        const destPubkey = new solanaWeb3.PublicKey(destAddress);
        const authorityPubkey = new solanaWeb3.PublicKey(connectedWalletAddress);
        
        // Get stake account info to find stake authority
        const sourceAccountInfo = currentStakeAccounts.find(a => a.pubkey === sourceAddress);
        const stakeAuthority = sourceAccountInfo?.data.meta?.authorized?.staker;
        
        if (stakeAuthority !== connectedWalletAddress) {
            throw new Error('Connected wallet is not the stake authority');
        }
        
        // Create merge instruction
        // Merge instruction type is 7 for Stake program
        const STAKE_PROGRAM_ID = new solanaWeb3.PublicKey('Stake11111111111111111111111111111111111111');
        const SYSVAR_CLOCK_PUBKEY = new solanaWeb3.PublicKey('SysvarC1ock11111111111111111111111111111111');
        const SYSVAR_STAKE_HISTORY_PUBKEY = new solanaWeb3.PublicKey('SysvarStakeHistory1111111111111111111111111');
        
        // Merge instruction data: just the instruction type (7)
        const instructionData = new Uint8Array(4);
        instructionData[0] = 7;  // Merge = 7 (little endian)
        instructionData[1] = 0;
        instructionData[2] = 0;
        instructionData[3] = 0;
        
        const mergeInstruction = new solanaWeb3.TransactionInstruction({
            keys: [
                { pubkey: destPubkey, isSigner: false, isWritable: true },      // Destination stake account
                { pubkey: sourcePubkey, isSigner: false, isWritable: true },    // Source stake account
                { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: authorityPubkey, isSigner: true, isWritable: false }, // Stake authority
            ],
            programId: STAKE_PROGRAM_ID,
            data: instructionData,
        });
        
        // Create transaction
        const transaction = new solanaWeb3.Transaction();
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = authorityPubkey;
        transaction.add(mergeInstruction);
        
        console.log('Merge transaction created:', {
            source: sourceAddress,
            destination: destAddress,
            authority: connectedWalletAddress
        });
        
        showInfo('Please approve the transaction in your wallet...', true);
        
        // Sign and send transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = await conn.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });
        
        console.log('Transaction sent:', signature);
        showInfo('Transaction sent! Waiting for confirmation...', true);
        
        // Wait for confirmation
        await conn.confirmTransaction(signature, 'confirmed');
        
        const explorerUrl = getExplorerUrl(signature);
        showSuccess(`✅ Stake accounts merged successfully! <a href="${explorerUrl}" target="_blank">View transaction</a>`);
        
        // Auto refresh after a short delay to allow network to update
        showInfo('Refreshing stake accounts...', true);
        setTimeout(async () => {
            try {
                const voteAccountAddress = document.getElementById('voteAccount').value.trim();
                if (voteAccountAddress) {
                    await handleSearch();
                    // Refresh the merge stake dropdowns
                    if (activeTab === 'merge-stake') {
                        initializeMergeStakeUI();
                    }
                    showSuccess('✅ Stake accounts updated!');
                    setTimeout(() => hideSuccess(), 3000);
                }
            } catch (err) {
                console.error('Auto refresh failed:', err);
                hideInfo();
            }
        }, 3000); // Wait 3 seconds for network to update
        
    } catch (error) {
        console.error('Merge stake failed:', error);
        
        let errorMessage = 'Failed to merge stake accounts: ';
        
        if (error.message && error.message.includes('rejected')) {
            errorMessage = 'Transaction was rejected by user';
        } else if (error.message && error.message.includes('insufficient funds')) {
            errorMessage = 'Insufficient funds for transaction';
        } else if (error.message && error.message.includes('stake authority')) {
            errorMessage = 'You are not authorized to merge these stake accounts';
        } else if (error.message && error.message.includes('MergeTransientStake')) {
            errorMessage = 'Cannot merge: One or both stake accounts are in a transient state (activating/deactivating)';
        } else if (error.message && error.message.includes('MergeMismatch')) {
            errorMessage = 'Cannot merge: Stake accounts have different lockup, withdraw authority, or are not delegated to the same vote account';
        } else {
            errorMessage += error.message || 'Unknown error occurred';
        }
        
        showError(errorMessage);
    } finally {
        mergeBtn.disabled = false;
        mergeBtn.innerHTML = '<i class="fas fa-compress-arrows-alt"></i> Merge Stake Accounts';
    }
}

// Make functions globally available
window.executeMergeStake = executeMergeStake;

console.log('Manage Account.js loaded successfully with all features');

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeManageAccount);
} else {
    initializeManageAccount();
}
