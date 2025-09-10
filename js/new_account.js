// New Account Page Management
let currentValidator = {
    identityAccount: null,
    voteAccount: null,  // 改为单个对象
    stakeAccounts: []   // stake account 保持数组，可以多个
};

// Account generation constants
const DEFAULT_DERIVATION_PATH = "m/44'/501'/0'/0'";
const ACCOUNT_TYPES = {
    IDENTITY: 'identity',
    VOTE: 'vote', 
    STAKE: 'stake'
};

// seed verification data
let seedVerificationData = {
    originalSeed: [],
    shuffledSeed: [],
    userSelectedSeed: [],
    isVerified: false
};

// Initialize new account page
function initializeNewAccount() {
    console.log('Initializing new account page...');
    
    // Initialize event listeners
    initializeGenerationButtons();
    updateAccountTypesDisplay();
    
    // Update UI based on wallet connection status
    updateAuthorityDisplay();
    
    // Ensure import buttons have event listeners
    ensureImportButtonListeners();
}

// Initialize generation buttons
function initializeGenerationButtons() {
    const identityBtn = document.getElementById('generateIdentityBtn');
    const importIdentityBtn = document.getElementById('importIdentityBtn');
    const voteBtn = document.getElementById('generateVoteBtn');
    const importVoteBtn = document.getElementById('importVoteBtn');
    const stakeBtn = document.getElementById('generateStakeBtn');
    
    if (identityBtn) {
        identityBtn.addEventListener('click', () => showGenerationModal(ACCOUNT_TYPES.IDENTITY));
    }
    
    if (importIdentityBtn) {
        importIdentityBtn.addEventListener('click', () => showImportIdentityModal());
    }
    
    if (voteBtn) {
        voteBtn.addEventListener('click', () => showGenerationModal(ACCOUNT_TYPES.VOTE));
    }
    
    if (importVoteBtn) {
        importVoteBtn.addEventListener('click', () => showImportVoteModal());
    }
    
    if (stakeBtn) {
        stakeBtn.addEventListener('click', () => showGenerationModal(ACCOUNT_TYPES.STAKE));
    }
}

// Update account types display
function updateAccountTypesDisplay() {
    updateIdentityAccountDisplay();
    updateVoteAccountsDisplay();
    updateStakeAccountsDisplay();
}

// Update identity account display
function updateIdentityAccountDisplay() {
    const identityCard = document.querySelector('.account-type-card[data-type="identity"]');
    const identityBtn = document.getElementById('generateIdentityBtn');
    const importIdentityBtn = document.getElementById('importIdentityBtn');
    const existingCount = document.querySelector('[data-type="identity"] .existing-accounts');
    const identityAccountsList = document.getElementById('identityAccountsList');
    const generatedSection = document.querySelector('[data-type="identity"] .generated-accounts');
    const generatedSectionTitle = document.querySelector('[data-type="identity"] .generated-accounts h4');
    
    if (currentValidator.identityAccount) {
        if (identityBtn) identityBtn.disabled = true;
        if (importIdentityBtn) importIdentityBtn.disabled = true;
        if (existingCount) {
            const accountType = currentValidator.identityAccount.imported ? 'imported' : 'created';
            existingCount.textContent = `1 account ${accountType}`;
            existingCount.classList.remove('none');
        }
        if (identityCard) {
            identityCard.classList.add('disabled');
            identityCard.classList.add('has-account');
        }
        if (generatedSection) generatedSection.style.display = 'block';
        
        // Update section title based on whether account was imported or generated
        if (generatedSectionTitle) {
            const titleText = currentValidator.identityAccount.imported ? 'Imported Account:' : 'Generated Account:';
            generatedSectionTitle.textContent = titleText;
        }
        
        // Update accounts list
        if (identityAccountsList) {
            identityAccountsList.innerHTML = '';
            const accountElement = createAccountElement(currentValidator.identityAccount, ACCOUNT_TYPES.IDENTITY, 0);
            identityAccountsList.appendChild(accountElement);
        }
    } else {
        if (identityBtn) identityBtn.disabled = false;
        if (importIdentityBtn) importIdentityBtn.disabled = false;
        if (existingCount) {
            existingCount.textContent = 'No accounts';
            existingCount.classList.add('none');
        }
        if (identityCard) {
            identityCard.classList.remove('disabled');
            identityCard.classList.remove('has-account');
        }
        if (generatedSection) generatedSection.style.display = 'none';
        
        // Reset section title to default
        if (generatedSectionTitle) {
            generatedSectionTitle.textContent = 'Generated Account:';
        }
        
        // Clear accounts list
        if (identityAccountsList) {
            identityAccountsList.innerHTML = '';
        }
    }
}

// Update vote account display
function updateVoteAccountsDisplay() {
    const voteCard = document.querySelector('.account-type-card[data-type="vote"]');
    const voteBtn = document.getElementById('generateVoteBtn');
    const importVoteBtn = document.getElementById('importVoteBtn');
    const existingCount = document.querySelector('[data-type="vote"] .existing-accounts');
    const voteAccountsList = document.getElementById('voteAccountsList');
    const generatedSection = document.querySelector('[data-type="vote"] .generated-accounts');
    
    // Check if identity account exists - required ONLY for generate/create vote account operations
    const hasIdentityAccount = currentValidator.identityAccount && currentValidator.identityAccount.publicKey;
    
    if (currentValidator.voteAccount) {
        // Vote account exists - disable both buttons
        if (voteBtn) voteBtn.disabled = true;
        if (importVoteBtn) importVoteBtn.disabled = true;
        if (existingCount) {
            const accountType = currentValidator.voteAccount.imported ? 'imported' : 'created';
            existingCount.textContent = `1 account ${accountType}`;
            existingCount.classList.remove('none');
        }
        if (voteCard) {
            voteCard.classList.add('disabled');
            voteCard.classList.add('has-account');
        }
        if (generatedSection) generatedSection.style.display = 'block';
        
        // Update section title based on whether account was imported or generated
        const generatedSectionTitle = document.querySelector('[data-type="vote"] .generated-accounts h4');
        if (generatedSectionTitle) {
            const titleText = currentValidator.voteAccount.imported ? 'Imported Account:' : 'Generated Account:';
            generatedSectionTitle.textContent = titleText;
        }
        
        // Update accounts list
        if (voteAccountsList) {
            voteAccountsList.innerHTML = '';
            const accountElement = createAccountElement(currentValidator.voteAccount, ACCOUNT_TYPES.VOTE, 0);
            voteAccountsList.appendChild(accountElement);
        }
        
        // Change button to Create Vote Account - but only enable if identity exists
        if (voteBtn) {
            voteBtn.textContent = 'Create (Initialize) Vote Account';
            voteBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create (Initialize) Vote Account';
            voteBtn.classList.remove('generate-btn');
            voteBtn.classList.add('create-vote-btn');
            
            if (hasIdentityAccount) {
                // Enable create functionality
                voteBtn.disabled = false;
                // Remove old event listener and add new one
                voteBtn.replaceWith(voteBtn.cloneNode(true));
                const newVoteBtn = document.getElementById('generateVoteBtn');
                newVoteBtn.classList.add('create-vote-btn');
                newVoteBtn.addEventListener('click', () => showCreateVoteAccountModal());
            } else {
                // Disable because no identity account
                voteBtn.disabled = true;
                voteBtn.title = 'Please generate an Identity Account first';
                // Remove click handler
                voteBtn.replaceWith(voteBtn.cloneNode(true));
                const newVoteBtn = document.getElementById('generateVoteBtn');
                newVoteBtn.classList.add('create-vote-btn');
                newVoteBtn.disabled = true;
                newVoteBtn.title = 'Please generate an Identity Account first';
            }
        }
    } else {
        // No vote account exists
        if (existingCount) {
            existingCount.textContent = 'No accounts';
            existingCount.classList.add('none');
        }
        if (voteCard) {
            voteCard.classList.remove('has-account');
        }
        if (generatedSection) generatedSection.style.display = 'none';
        
        // Clear accounts list
        if (voteAccountsList) {
            voteAccountsList.innerHTML = '';
        }
        
        // Generate Vote Account button - depends on identity account
        if (voteBtn) {
            voteBtn.textContent = 'Generate Vote Account';
            voteBtn.innerHTML = '<i class="fas fa-plus"></i> Generate Vote Account';
            voteBtn.classList.remove('create-vote-btn');
            voteBtn.classList.add('generate-btn');
            
            if (hasIdentityAccount) {
                // Enable generation
                voteBtn.disabled = false;
                voteCard.classList.remove('disabled');
                // Remove old event listener and add new one  
                voteBtn.replaceWith(voteBtn.cloneNode(true));
                const newVoteBtn = document.getElementById('generateVoteBtn');
                newVoteBtn.classList.add('generate-btn');
                newVoteBtn.addEventListener('click', () => showGenerationModal(ACCOUNT_TYPES.VOTE));
            } else {
                // Disable generation because no identity account
                voteBtn.disabled = true;
                voteCard.classList.add('disabled');
                voteBtn.title = 'Please generate an Identity Account first';
                // Remove click handler
                voteBtn.replaceWith(voteBtn.cloneNode(true));
                const newVoteBtn = document.getElementById('generateVoteBtn');
                newVoteBtn.classList.add('generate-btn');
                newVoteBtn.disabled = true;
                newVoteBtn.title = 'Please generate an Identity Account first';
            }
        }
        
        // Import Vote Account button - does NOT depend on identity account
        if (importVoteBtn) {
            importVoteBtn.disabled = false;
            importVoteBtn.title = '';
            // Ensure event listener is attached (in case it was lost)
            if (!importVoteBtn.hasAttribute('data-listener-attached')) {
                importVoteBtn.addEventListener('click', () => showImportVoteModal());
                importVoteBtn.setAttribute('data-listener-attached', 'true');
            }
        }
    }
}

// Update stake accounts display
function updateStakeAccountsDisplay() {
    const existingCount = document.querySelector('[data-type="stake"] .existing-accounts');
    const stakeAccountsList = document.getElementById('stakeAccountsList');
    
    if (existingCount) {
        if (currentValidator.stakeAccounts.length > 0) {
            existingCount.textContent = `${currentValidator.stakeAccounts.length} account(s) created`;
            existingCount.classList.remove('none');
        } else {
            existingCount.textContent = 'No accounts';
            existingCount.classList.add('none');
        }
    }
    
    // Update accounts list
    if (stakeAccountsList) {
        stakeAccountsList.innerHTML = '';
        currentValidator.stakeAccounts.forEach((account, index) => {
            const accountElement = createAccountElement(account, ACCOUNT_TYPES.STAKE, index);
            stakeAccountsList.appendChild(accountElement);
        });
    }
}

// Create account element for display
function createAccountElement(account, type, index) {
    const div = document.createElement('div');
    div.className = 'account-item new';
    
    const typeIcons = {
        [ACCOUNT_TYPES.IDENTITY]: 'fas fa-user-shield',
        [ACCOUNT_TYPES.VOTE]: 'fas fa-vote-yea',
        [ACCOUNT_TYPES.STAKE]: 'fas fa-coins'
    };
    
    const typeLabels = {
        [ACCOUNT_TYPES.IDENTITY]: 'Identity',
        [ACCOUNT_TYPES.VOTE]: 'Vote',
        [ACCOUNT_TYPES.STAKE]: 'Stake'
    };
    
    // account type
    let sourceText = 'Created';
    if (account.imported) {
        sourceText = account.importMethod === 'seed' ? 'Imported from Seed' : 'Imported from Keypair';
    }
    
    // Create action buttons based on account type
    let actionButtons = `
        <button class="action-btn copy-btn" onclick="copyToClipboard('${account.publicKey}')">
            <i class="fas fa-copy"></i>
            Copy
        </button>
        <button class="action-btn download-btn" onclick="downloadKeypair('${account.publicKey}', '${type}', ${index})">
            <i class="fas fa-download"></i>
            Download
        </button>
    `;
    
    // Add specialized buttons for stake accounts
    if (type === ACCOUNT_TYPES.STAKE) {
        if (account.delegated) {
            // Stake account is delegated - show status
            actionButtons += `
                <div class="action-status delegated-status">
                    <i class="fas fa-check-circle"></i>
                    Delegated
                </div>
            `;
        } else if (account.initialized) {
            // Stake account is initialized but not delegated - show delegate button
            actionButtons += `
                <button class="action-btn delegate-btn" onclick="showDelegateModal('${account.publicKey}', ${index})">
                    <i class="fas fa-arrow-up"></i>
                    Delegate Stake
                </button>
            `;
        } else {
            // Stake account not initialized - show create button
            actionButtons += `
                <button class="action-btn create-stake-btn" onclick="showCreateStakeAccountModal('${account.publicKey}', ${index})">
                    <i class="fas fa-plus-circle"></i>
                    Create (Initialize) Stake Account
                </button>
            `;
        }
    }
    
    div.innerHTML = `
        <div class="account-info">
            <div class="account-type-icon ${type}-icon">
                <i class="${typeIcons[type]}"></i>
            </div>
            <div class="account-details">
                <div class="account-address">${account.publicKey}</div>
                <div class="account-meta">${typeLabels[type]} Account • ${sourceText} ${new Date(account.createdAt).toLocaleString()}</div>
            </div>
        </div>
        <div class="account-actions">
            ${actionButtons}
        </div>
    `;
    
    return div;
}

// Show generation modal
function showGenerationModal(accountType) {
    if (!walletConnected) {
        showError('Please connect your wallet first');
        return;
    }
    
    const modal = document.getElementById('generationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const accountTypeInput = document.getElementById('accountType');
    const derivationInput = document.getElementById('derivationPath');
    
    const typeLabels = {
        [ACCOUNT_TYPES.IDENTITY]: 'Identity Account',
        [ACCOUNT_TYPES.VOTE]: 'Vote Account', 
        [ACCOUNT_TYPES.STAKE]: 'Stake Account'
    };
    
    const typeDescriptions = {
        [ACCOUNT_TYPES.IDENTITY]: 'The identity account represents your validator and signs blocks.',
        [ACCOUNT_TYPES.VOTE]: 'Vote accounts are used to participate in consensus and earn rewards.',
        [ACCOUNT_TYPES.STAKE]: 'Stake accounts hold delegated stake and earn rewards.'
    };
    
    if (modalTitle) modalTitle.textContent = `Generate ${typeLabels[accountType]}`;
    if (modalDescription) modalDescription.textContent = typeDescriptions[accountType];
    if (accountTypeInput) accountTypeInput.value = accountType;
    if (derivationInput) derivationInput.value = DEFAULT_DERIVATION_PATH;
    
    // Update authority display
    updateModalAuthorityDisplay();
    
    // Reset modal state
    resetModalState();
    
    if (modal) modal.classList.remove('hidden');
}

// Hide generation modal
function hideGenerationModal() {
    // 如果有生成的账户但未验证种子，阻止关闭
    if (window.currentGeneratedAccount && !seedVerificationData.isVerified) {
        showWarning('Please verify your seed phrase before closing this dialog.');
        return;
    }
    
    const modal = document.getElementById('generationModal');
    if (modal) modal.classList.add('hidden');
    resetModalState();
    
    // 重置验证状态
    seedVerificationData = {
        originalSeed: [],
        shuffledSeed: [],
        userSelectedSeed: [],
        isVerified: false
    };
}

// Reset modal state
// Reset modal state
function resetModalState() {
    const generateBtn = document.getElementById('generateAccountBtn');
    const progressSection = document.getElementById('generationProgress');
    const formSection = document.getElementById('generationForm');
    const recoverySection = document.getElementById('recoverySection');
    
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.classList.remove('loading', 'success');
        generateBtn.innerHTML = '<i class="fas fa-plus"></i> Generate Account';
        generateBtn.onclick = generateAccount;
    }
    
    // Reset progress steps to initial state
    const progressSteps = document.querySelectorAll('.progress-step');
    progressSteps.forEach(step => {
        const stepId = step.getAttribute('data-step');
        step.className = 'progress-step'; // Remove active/completed classes
        
        // Reset icons to original state
        const icon = step.querySelector('i');
        if (stepId === 'generating') {
            icon.className = 'fas fa-key';
        } else if (stepId === 'seed') {
            icon.className = 'fas fa-seedling';
        } else if (stepId === 'creating') {
            icon.className = 'fas fa-plus-circle';
        }
    });
    
    if (progressSection) progressSection.style.display = 'none';
    if (formSection) formSection.style.display = 'block';
    if (recoverySection) recoverySection.style.display = 'none';
}

// Update authority display in modal
function updateModalAuthorityDisplay() {
    const authorityAddress = document.getElementById('authorityAddress');
    if (authorityAddress && connectedWalletAddress) {
        authorityAddress.textContent = connectedWalletAddress;
    }
}

// Use default derivation path
function useDefaultPath() {
    const derivationInput = document.getElementById('derivationPath');
    if (derivationInput) {
        derivationInput.value = DEFAULT_DERIVATION_PATH;
    }
}

// Generate new account - BIP39 standard process
async function generateAccount() {
    const accountType = document.getElementById('accountType').value;
    const derivationPath = document.getElementById('derivationPath').value;
    const generateBtn = document.getElementById('generateAccountBtn');
    const progressSection = document.getElementById('generationProgress');
    const formSection = document.getElementById('generationForm');
    
    try {
        // Validate inputs
        if (!derivationPath.trim()) {
            showError('Please enter a derivation path');
            return;
        }
        
        // Update UI to show progress
        generateBtn.disabled = true;
        generateBtn.classList.add('loading');
        formSection.style.display = 'none';
        progressSection.style.display = 'block';
        
        // Step 1: Generate BIP39 seed first
        updateProgressStep('seed', 'active');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
        
        const seed = generateRecoverySeed();
        console.log('✅ BIP39 seed generated successfully');
        updateProgressStep('seed', 'completed');
        
        // Step 2: Generate keypair from seed + derivation path
        updateProgressStep('generating', 'active');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const keypairData = await generateKeypairFromSeed(seed, derivationPath);
        const publicKey = keypairData.publicKey;
        const secretKey = keypairData.secretKey; // Already in Solana CLI format [num, num, ...]
        
        console.log('✅ Generated keypair from seed. Public key:', publicKey);
        updateProgressStep('generating', 'completed');
        
        // Step 3: Create account object
        updateProgressStep('creating', 'active');
        await new Promise(resolve => setTimeout(resolve, 600));
        
        const accountData = {
            publicKey: publicKey,
            secretKey: secretKey,
            seed: seed,
            derivationPath: derivationPath,
            createdAt: new Date().toISOString(),
            accountType: accountType
        };
        
        // Store account based on type
        switch (accountType) {
            case ACCOUNT_TYPES.IDENTITY:
                currentValidator.identityAccount = accountData;
                break;
            case ACCOUNT_TYPES.VOTE:
                currentValidator.voteAccount = accountData;
                break;
            case ACCOUNT_TYPES.STAKE:
                currentValidator.stakeAccounts.push(accountData);
                break;
        }
        
        updateProgressStep('creating', 'completed');
        
        // Show recovery information
        showRecoverySection(accountData);
        
        // Update main page display
        updateAccountTypesDisplay();
        
        // Success state
        generateBtn.disabled = false;
        generateBtn.classList.remove('loading');
        generateBtn.classList.add('success');
        generateBtn.innerHTML = '<i class="fas fa-shield-check"></i> Verify Seed';
        generateBtn.onclick = showSeedVerification;

        showSuccess(`${accountType.charAt(0).toUpperCase() + accountType.slice(1)} account generated successfully!`);
        
    } catch (error) {
        console.error('Failed to generate account:', error);
        showError('Failed to generate account: ' + error.message);
        
        // Reset UI
        generateBtn.disabled = false;
        generateBtn.classList.remove('loading');
        formSection.style.display = 'block';
        progressSection.style.display = 'none';
    }
}

// Update progress step
function updateProgressStep(stepId, status) {
    const step = document.querySelector(`[data-step="${stepId}"]`);
    if (step) {
        step.className = `progress-step ${status}`;
        if (status === 'active') {
            step.querySelector('i').className = 'fas fa-spinner fa-spin';
        } else if (status === 'completed') {
            step.querySelector('i').className = 'fas fa-check';
        }
    }
}

// Generate recovery seed using @scure/bip39
function generateRecoverySeed() {
    console.log('Checking @scure/bip39 availability...');
    console.log('typeof bip39:', typeof bip39);
    console.log('typeof bip39Wordlist:', typeof bip39Wordlist);
    
    if (typeof bip39 !== 'undefined' && bip39.generateMnemonic && typeof bip39Wordlist !== 'undefined') {
        try {
            console.log('✅ Using @scure/bip39 to generate mnemonic');
            const mnemonic = bip39.generateMnemonic(bip39Wordlist, 128); // 128 bits = 12 words
            console.log('✅ Generated BIP39 mnemonic successfully');
            return mnemonic.split(' ');
        } catch (error) {
            console.error('❌ @scure/bip39 generation failed:', error);
        }
    } else {
        console.warn('⚠️ @scure/bip39 not available, using fallback');
    }
    
    // fallback to simplified version
    console.log('📝 Using simplified seed generation as fallback');
    return generateSimplifiedSeed();
}

// simplified version as fallback (only for development test)
function generateSimplifiedSeed() {
    const words = [
        'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
        'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
        'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
        'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
        'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
        'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
        'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
        'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
        'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
        'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
        'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april',
        'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor',
        'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact',
        'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume',
        'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
        'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado',
        'avoid', 'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis'
    ];
    
    const seed = [];
    const usedWords = new Set();
    
    // ensure no duplicate words
    while (seed.length < 12) {
        const randomIndex = Math.floor(Math.random() * words.length);
        const word = words[randomIndex];
        if (!usedWords.has(word)) {
            usedWords.add(word);
            seed.push(word);
        }
    }
    
    return seed;
}

// Show recovery section
// Show recovery section
function showRecoverySection(accountData) {
    const recoverySection = document.getElementById('recoverySection');
    const seedWordsContainer = document.getElementById('seedWords');
    const publicKeyElement = document.getElementById('generatedPublicKey');
    
    if (recoverySection && seedWordsContainer) {
        // Display seed words
        seedWordsContainer.innerHTML = '';
        accountData.seed.forEach((word, index) => {
            const wordElement = document.createElement('div');
            wordElement.className = 'seed-word';
            wordElement.textContent = `${index + 1}. ${word}`;
            seedWordsContainer.appendChild(wordElement);
        });
        
        // Display public key
        if (publicKeyElement) {
            publicKeyElement.textContent = accountData.publicKey;
        }
        
        recoverySection.style.display = 'block';
        
        // Store current account data for download
        window.currentGeneratedAccount = accountData;
    }
}

// Copy seed to clipboard
async function copySeed() {
    if (window.currentGeneratedAccount && window.currentGeneratedAccount.seed) {
        const seedPhrase = window.currentGeneratedAccount.seed.join(' ');
        
        try {
            await navigator.clipboard.writeText(seedPhrase);
            showSuccess('Recovery seed copied to clipboard');
        } catch (error) {
            console.error('Failed to copy seed:', error);
            showError('Failed to copy seed to clipboard');
        }
    }
}

// Copy public key to clipboard
async function copyPublicKey() {
    if (window.currentGeneratedAccount && window.currentGeneratedAccount.publicKey) {
        try {
            await navigator.clipboard.writeText(window.currentGeneratedAccount.publicKey);
            showSuccess('Public key copied to clipboard');
        } catch (error) {
            console.error('Failed to copy public key:', error);
            showError('Failed to copy public key to clipboard');
        }
    }
}

// Download keypair file
function downloadKeypair(publicKey, accountType, index) {
    let accountData;
    
    // Find account data
    switch (accountType) {
        case ACCOUNT_TYPES.IDENTITY:
            accountData = currentValidator.identityAccount;
            break;
        case ACCOUNT_TYPES.VOTE:
            accountData = currentValidator.voteAccount; 
            break;
        case ACCOUNT_TYPES.STAKE:
            accountData = currentValidator.stakeAccounts[index]; 
            break;
    }
    
    if (!accountData) {
        showError('Account data not found');
        return;
    }
    
    downloadCurrentKeypair(accountData);
}

// Download current generated keypair
function downloadCurrentKeypair(accountData = window.currentGeneratedAccount) {
    if (!accountData) {
        showError('No account data available for download');
        return;
    }
    
    // Generate standard Solana keypair format (secretKey array only, single line)
    const solanaKeypair = JSON.stringify(accountData.secretKey);
    
    const dataBlob = new Blob([solanaKeypair], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${accountData.accountType}-${accountData.publicKey.slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess('Keypair file downloaded successfully');
}

// Copy to clipboard utility
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showSuccess('Address copied to clipboard');
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        showError('Failed to copy to clipboard');
    }
}

// Wallet connection handlers for new account page
function onWalletConnectedNewAccount() {
    updateAuthorityDisplay();
    updateModalAuthorityDisplay();
}

function onWalletDisconnectedNewAccount() {
    updateAuthorityDisplay();
}

function onWalletUIUpdatedNewAccount(address) {
    console.log('New Account: Wallet UI updated, address:', address);
    updateAuthorityDisplay();
    updateModalAuthorityDisplay();
}

// Update authority display
function updateAuthorityDisplay() {
    const walletStatus = document.getElementById('walletStatus');
    const authorityDisplay = document.getElementById('authorityDisplay');
    
    if (walletConnected && connectedWalletAddress) {
        if (walletStatus) {
            walletStatus.innerHTML = `
                <div class="status-dot"></div>
                <span>Wallet Connected</span>
            `;
        }
        
        if (authorityDisplay) {
            authorityDisplay.innerHTML = `
                <div class="authority-info">
                    <h5><i class="fas fa-user-shield"></i> Default Authority Account</h5>
                    <div class="authority-address">${connectedWalletAddress}</div>
                </div>
            `;
        }
    } else {
        if (walletStatus) {
            walletStatus.innerHTML = `
                <div class="status-dot" style="background: #f59e0b;"></div>
                <span>Wallet Not Connected</span>
            `;
        }
        
        if (authorityDisplay) {
            authorityDisplay.innerHTML = `
                <div class="authority-info">
                    <h5><i class="fas fa-exclamation-triangle"></i> No Authority Set</h5>
                    <div style="color: #f59e0b; font-size: 14px;">Please connect your wallet to set default authorities</div>
                </div>
            `;
        }
    }
}

// show seed verification modal
function showSeedVerification() {
    if (!window.currentGeneratedAccount || !window.currentGeneratedAccount.seed) {
        showError('No seed data available for verification');
        return;
    }
    
    // prepare verification data
    seedVerificationData.originalSeed = [...window.currentGeneratedAccount.seed];
    seedVerificationData.shuffledSeed = shuffleSeed([...window.currentGeneratedAccount.seed]);
    seedVerificationData.userSelectedSeed = [];
    seedVerificationData.isVerified = false;
    
    // show verification modal
    const verificationModal = document.getElementById('seedVerificationModal');
    if (verificationModal) {
        setupSeedVerificationUI();
        verificationModal.classList.remove('hidden');
        
        // disable main modal close button
        disableMainModalClose();
    }
}

// hide seed verification modal
function hideSeedVerification() {
    const verificationModal = document.getElementById('seedVerificationModal');
    if (verificationModal) {
        verificationModal.classList.add('hidden');
    }
    
    // if verification successful, close main modal
    if (seedVerificationData.isVerified) {
        // close main generate account modal
        setTimeout(() => {
            hideGenerationModal();
        }, 300); // slightly delay to let verification modal close first
    }
}

// disable main modal close function
function disableMainModalClose() {
    const mainModal = document.getElementById('generationModal');
    const closeBtn = mainModal.querySelector('.modal-close');
    const cancelBtn = document.querySelector('#generationModal .btn-cancel');
    
    if (closeBtn) {
        closeBtn.style.display = 'none';
    }
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
    
    // disable click background close
    mainModal.onclick = function(e) {
        e.stopPropagation();
    };
}

// enable main modal close function
function enableMainModalClose() {
    const mainModal = document.getElementById('generationModal');
    const closeBtn = mainModal.querySelector('.modal-close');
    const cancelBtn = document.querySelector('#generationModal .btn-cancel');
    
    if (closeBtn) {
        closeBtn.style.display = 'block';
        closeBtn.onclick = hideGenerationModal;
    }
    if (cancelBtn) {
        cancelBtn.style.display = 'block';
        cancelBtn.onclick = hideGenerationModal;
    }
    
    // restore click background close
    mainModal.onclick = function(e) {
        if (e.target === mainModal) {
            hideGenerationModal();
        }
    };
}

// shuffle seed
function shuffleSeed(seed) {
    const shuffled = [...seed];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// setup seed verification UI
function setupSeedVerificationUI() {
    const shuffledWordsContainer = document.getElementById('shuffledWords');
    const selectedWordsContainer = document.getElementById('selectedWords');
    const verificationStatus = document.getElementById('verificationStatus');
    const verificationProgress = document.getElementById('verificationProgress');
    const downloadKeypairBtn = document.getElementById('downloadKeypairBtn');
    
    // clear containers
    if (shuffledWordsContainer) shuffledWordsContainer.innerHTML = '';
    if (selectedWordsContainer) selectedWordsContainer.innerHTML = '';
    
    // show shuffled seed words
    seedVerificationData.shuffledSeed.forEach((word, index) => {
        const wordBtn = document.createElement('button');
        wordBtn.className = 'seed-word-btn';
        wordBtn.textContent = word;
        wordBtn.onclick = () => selectSeedWord(word, wordBtn);
        shuffledWordsContainer.appendChild(wordBtn);
    });
    
    // create selected words placeholder
    for (let i = 0; i < seedVerificationData.originalSeed.length; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'selected-word-placeholder';
        placeholder.textContent = `${i + 1}.`;
        selectedWordsContainer.appendChild(placeholder);
    }
    
    // reset status
    if (verificationStatus) {
        verificationStatus.textContent = 'Please select the words in the correct order';
        verificationStatus.className = 'verification-status';
    }
    
    if (verificationProgress) {
        verificationProgress.textContent = `0 / ${seedVerificationData.originalSeed.length}`;
    }
    
    // initial disable download button
    if (downloadKeypairBtn) {
        downloadKeypairBtn.disabled = true;
        downloadKeypairBtn.classList.add('disabled');
    }
}

// select seed word
function selectSeedWord(word, buttonElement) {
    const expectedWord = seedVerificationData.originalSeed[seedVerificationData.userSelectedSeed.length];
    
    if (word === expectedWord) {
        // correct selection
        seedVerificationData.userSelectedSeed.push(word);
        buttonElement.classList.add('correct');
        buttonElement.disabled = true;
        
        // update selected words display
        updateSelectedWordsDisplay();
        
        // update progress
        updateVerificationProgress();
        
        // check if completed
        if (seedVerificationData.userSelectedSeed.length === seedVerificationData.originalSeed.length) {
            completeVerification();
        }
        
        // add success animation
        buttonElement.style.animation = 'correctSelection 0.3s ease';
        setTimeout(() => {
            buttonElement.style.opacity = '0.3';
        }, 300);
        
    } else {
        // incorrect selection
        buttonElement.classList.add('incorrect');
        
        // show error hint
        const verificationStatus = document.getElementById('verificationStatus');
        if (verificationStatus) {
            verificationStatus.textContent = 'Incorrect word. Please try again.';
            verificationStatus.className = 'verification-status error';
        }
        
        // add error animation
        buttonElement.style.animation = 'incorrectSelection 0.5s ease';
        
        // reset button state after 1 second
        setTimeout(() => {
            buttonElement.classList.remove('incorrect');
            buttonElement.style.animation = '';
            
            // reset status hint
            if (verificationStatus) {
                verificationStatus.textContent = 'Please select the words in the correct order';
                verificationStatus.className = 'verification-status';
            }
        }, 1000);
    }
}

// update selected words display
function updateSelectedWordsDisplay() {
    const selectedWordsContainer = document.getElementById('selectedWords');
    if (!selectedWordsContainer) return;
    
    const placeholders = selectedWordsContainer.children;
    
    seedVerificationData.userSelectedSeed.forEach((word, index) => {
        if (placeholders[index]) {
            placeholders[index].textContent = `${index + 1}. ${word}`;
            placeholders[index].classList.add('filled');
        }
    });
}

// update verification progress
function updateVerificationProgress() {
    const verificationProgress = document.getElementById('verificationProgress');
    if (verificationProgress) {
        verificationProgress.textContent = 
            `${seedVerificationData.userSelectedSeed.length} / ${seedVerificationData.originalSeed.length}`;
    }
}

// complete verification
function completeVerification() {
    seedVerificationData.isVerified = true;
    
    const verificationStatus = document.getElementById('verificationStatus');
    const completeVerificationBtn = document.getElementById('completeVerificationBtn');
    const downloadKeypairBtn = document.getElementById('downloadKeypairBtn');
    
    if (verificationStatus) {
        verificationStatus.textContent = '✅ Seed verification completed successfully!';
        verificationStatus.className = 'verification-status success';
    }
    
    if (completeVerificationBtn) {
        completeVerificationBtn.disabled = false;
        completeVerificationBtn.classList.add('success');
        completeVerificationBtn.innerHTML = '<i class="fas fa-check"></i> Complete & Close';
    }
    
    // enable download button
    if (downloadKeypairBtn) {
        downloadKeypairBtn.disabled = false;
        downloadKeypairBtn.classList.remove('disabled');
    }
    
    // show success message
    showSuccess('Seed phrase verified successfully! Don\'t forget to download your keypair file.');
}

// reset seed verification
function resetSeedVerification() {
    seedVerificationData.userSelectedSeed = [];
    setupSeedVerificationUI();
    
    // reset download button state
    const downloadKeypairBtn = document.getElementById('downloadKeypairBtn');
    if (downloadKeypairBtn) {
        downloadKeypairBtn.disabled = true;
        downloadKeypairBtn.classList.add('disabled');
    }
}

function downloadKeypairFromVerification() {
    if (window.currentGeneratedAccount) {
        downloadCurrentKeypair(window.currentGeneratedAccount);
        
        // add download success visual feedback
        const downloadBtn = document.getElementById('downloadKeypairBtn');
        if (downloadBtn) {
            downloadBtn.classList.add('downloaded');
            downloadBtn.innerHTML = '<i class="fas fa-check"></i> Keypair Downloaded';
            
            // reset to original state after 3 seconds
            setTimeout(() => {
                downloadBtn.classList.remove('downloaded');
                downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download Keypair File';
            }, 3000);
        }
    } else {
        showError('No account data available for download');
    }
}

// Generate keypair from BIP39 seed and derivation path
async function generateKeypairFromSeed(seedWords, derivationPath) {
    const seedPhrase = seedWords.join(' ');
    
    try {
        // Check if required libraries are available
        if (typeof bip39 !== 'undefined' && bip39.mnemonicToSeed && typeof derivePath !== 'undefined') {
            console.log('✅ Using ed25519-hd-key for standard Solana BIP44 derivation');
            
            // Step 1: Convert mnemonic to seed bytes (BIP39)
            const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
            console.log('✅ Generated seed buffer from mnemonic, length:', seedBuffer.length);
            
            // Step 2: Use ed25519-hd-key for proper Solana derivation
            console.log('✅ Using derivation path:', derivationPath);
            
            // Step 3: Derive using ed25519-hd-key with correct parameters
            const seedHex = Array.from(new Uint8Array(seedBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            
            console.log('✅ Converted seed to hex format, length:', seedHex.length);
            
            const derived = derivePath(derivationPath, seedHex);
            console.log('✅ Key derivation completed successfully');
            
            // Step 4: Create Solana keypair from derived key
            let privateKeyBytes;
            
            if (typeof derived.key === 'string') {
                // If key is hex string, convert to bytes
                privateKeyBytes = new Uint8Array(
                    derived.key.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
                );
            } else if (derived.key instanceof Uint8Array) {
                // If key is already Uint8Array, use directly
                privateKeyBytes = derived.key;
            } else if (Array.isArray(derived.key)) {
                // If key is regular array, convert to Uint8Array
                privateKeyBytes = new Uint8Array(derived.key);
            } else {
                // Try to convert to Uint8Array as fallback
                privateKeyBytes = new Uint8Array(Object.values(derived.key));
            }
            
            console.log('✅ Private key processing completed');
            
            // Use first 32 bytes as seed for Solana keypair
            const keypair = solanaWeb3.Keypair.fromSeed(privateKeyBytes.slice(0, 32));
            
            console.log('✅ Ed25519 BIP44 derivation successful. Path:', derivationPath);
            console.log('✅ Public key generated:', keypair.publicKey.toString());
            
            return {
                publicKey: keypair.publicKey.toString(),
                secretKey: Array.from(keypair.secretKey)
            };
        } else {
            console.warn('⚠️ ed25519-hd-key not available, using fallback');
            return generateKeypairFallback(seedPhrase, derivationPath);
        }
        
    } catch (error) {
        console.error('❌ Failed to generate keypair from seed:', error);
        // If ed25519-hd-key fails, try alternative method
        console.log('⚠️ Trying alternative derivation method...');
        try {
            return await generateKeypairFromSeedAlternative(seedWords, derivationPath);
        } catch (altError) {
            console.error('❌ Alternative derivation also failed:', altError);
            throw new Error('Failed to generate keypair from seed: ' + error.message);
        }
    }
}

// Fallback keypair generation (for development when full BIP39 not available)
function generateKeypairFallback(seedPhrase, derivationPath) {
    console.log('📝 Using fallback keypair generation');
    
    // Simple hash-based approach (not cryptographically secure, for development only)
    const combined = seedPhrase + derivationPath;
    const hash = simpleHash(combined);
    
    // Create a deterministic but simplified seed
    const seedArray = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        seedArray[i] = hash[i % hash.length];
    }
    
    // Generate keypair using Solana Web3.js
    const keypair = solanaWeb3.Keypair.fromSeed(seedArray);
    
    return {
        publicKey: keypair.publicKey.toString(),
        secretKey: Array.from(keypair.secretKey) // Solana CLI format [num, num, ...]
    };
}

// Simple hash function for fallback (development only)
function simpleHash(str) {
    const hash = [];
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash.push((char * 7 + i * 13) % 256);
    }
    // Ensure we have enough bytes
    while (hash.length < 64) {
        hash.push(...hash);
    }
    return hash.slice(0, 64);
}

// Alternative implementation using native crypto if ed25519-hd-key fails
async function generateKeypairFromSeedAlternative(seedWords, derivationPath) {
    console.log('📝 Using alternative Solana-compatible derivation');
    const seedPhrase = seedWords.join(' ');
    
    try {
        if (typeof bip39 !== 'undefined' && bip39.mnemonicToSeed) {
            // Step 1: Generate seed
            const seed = await bip39.mnemonicToSeed(seedPhrase);
            
            // Step 2: Simple deterministic derivation (Solana-compatible)
            // This mimics how most Solana wallets derive keys
            const pathSeed = new TextEncoder().encode(derivationPath);
            const combined = new Uint8Array(seed.length + pathSeed.length);
            combined.set(new Uint8Array(seed), 0);
            combined.set(pathSeed, seed.length);
            
            // Hash to get final seed
            const finalSeed = await crypto.subtle.digest('SHA-256', combined);
            const keypair = solanaWeb3.Keypair.fromSeed(new Uint8Array(finalSeed));
            
            return {
                publicKey: keypair.publicKey.toString(),
                secretKey: Array.from(keypair.secretKey)
            };
        }
    } catch (error) {
        console.error('❌ Alternative derivation failed:', error);
    }
    
    // Final fallback
    return generateKeypairFallback(seedPhrase, derivationPath);
}

// Show create vote account modal
function showCreateVoteAccountModal() {
    if (!walletConnected) {
        showError('Please connect your wallet first');
        return;
    }
    
    if (!currentValidator.voteAccount) {
        showError('Please generate a vote account keypair first');
        return;
    }
    
    // Check if identity account is required but not available
    if (!currentValidator.identityAccount) {
        showWarning('Please generate an Identity Account first. The Identity Account is required to authorize voting for your validator.');
        return;
    }
    
    const modal = document.getElementById('createVoteAccountModal');
    const voteAccountKeyInput = document.getElementById('voteAccountKey');
    const identityAccountKeyInput = document.getElementById('identityAccountKey');
    const withdrawAuthorityKeyInput = document.getElementById('withdrawAuthorityKey');
    
    // Fill in vote account public key
    if (voteAccountKeyInput) {
        voteAccountKeyInput.value = currentValidator.voteAccount.publicKey;
    }
    
    // Use generated identity account
    if (identityAccountKeyInput && currentValidator.identityAccount) {
        identityAccountKeyInput.value = currentValidator.identityAccount.publicKey;
        identityAccountKeyInput.readOnly = true;
        identityAccountKeyInput.classList.add('readonly-input');
    }
    
    // Set withdraw authority to connected wallet
    if (withdrawAuthorityKeyInput && connectedWalletAddress) {
        withdrawAuthorityKeyInput.value = connectedWalletAddress;
    }
    
    if (modal) modal.classList.remove('hidden');
}

// Hide create vote account modal
function hideCreateVoteAccountModal() {
    const modal = document.getElementById('createVoteAccountModal');
    if (modal) modal.classList.add('hidden');
}

// Create vote account on-chain
async function createVoteAccount() {
    const voteAccountKey = document.getElementById('voteAccountKey').value;
    const identityAccountKey = document.getElementById('identityAccountKey').value;
    const withdrawAuthorityKey = document.getElementById('withdrawAuthorityKey').value;
    const commission = document.getElementById('voteCommission').value;
    
    // Validation
    if (!voteAccountKey) {
        showError('Vote account public key is required');
        return;
    }
    
    if (!identityAccountKey) {
        showError('Identity account public key is required');
        return;
    }
    
    // Check if we have the identity account keypair
    if (!currentValidator.identityAccount || 
        !currentValidator.identityAccount.secretKey || 
        currentValidator.identityAccount.publicKey !== identityAccountKey) {
        showError('Identity account keypair not found. Please generate an Identity Account first.');
        return;
    }
    
    if (!withdrawAuthorityKey) {
        showError('Withdraw authority is required');
        return;
    }
    
    if (!walletConnected || !connectedWalletAddress) {
        showError('Please connect your wallet first');
        return;
    }
    
    try {
        showInfo('Creating vote account transaction...', true);
        
        // Validate commission (0-100%)
        const commissionValue = parseFloat(commission);
        if (isNaN(commissionValue) || commissionValue < 0 || commissionValue > 100) {
            showError('Commission must be between 0 and 100');
            return;
        }
        
        // Create public keys
        const voteAccountPubkey = new solanaWeb3.PublicKey(voteAccountKey);
        const identityPubkey = new solanaWeb3.PublicKey(identityAccountKey);
        const withdrawAuthorityPubkey = new solanaWeb3.PublicKey(withdrawAuthorityKey);
        const payerPubkey = new solanaWeb3.PublicKey(connectedWalletAddress);
        
        // Get vote account keypair from stored data
        if (!currentValidator.voteAccount || !currentValidator.voteAccount.secretKey) {
            showError('Vote account secret key not found. Please regenerate vote account.');
            return;
        }
        
        // Create vote account keypair from stored secret key
        const voteAccountKeypair = solanaWeb3.Keypair.fromSecretKey(
            new Uint8Array(currentValidator.voteAccount.secretKey)
        );
        
        // Verify the public keys match
        if (voteAccountKeypair.publicKey.toString() !== voteAccountKey) {
            showError('Vote account keypair mismatch. Please regenerate vote account.');
            return;
        }
        
        // Calculate rent exemption amount
        const rentExemptAmount = await connection.getMinimumBalanceForRentExemption(3762); // Vote account space
        
        console.log('Creating vote account with:', {
            voteAccount: voteAccountKey,
            identity: identityAccountKey,
            withdrawAuthority: withdrawAuthorityKey,
            commission: commissionValue,
            rentAmount: rentExemptAmount
        });
        
        // Create vote account instruction
        const createVoteAccountInstruction = solanaWeb3.VoteProgram.createAccount({
            fromPubkey: payerPubkey,
            votePubkey: voteAccountPubkey,
            voteInit: {
                nodePubkey: identityPubkey,
                authorizedVoter: identityPubkey,
                authorizedWithdrawer: withdrawAuthorityPubkey,
                commission: Math.round(commissionValue), // Commission as percentage (0-100)
            },
            lamports: rentExemptAmount
        });
        
        // Create transaction
        const transaction = new solanaWeb3.Transaction();
        transaction.add(createVoteAccountInstruction);
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = payerPubkey;
        
        console.log('Vote account transaction prepared');
        
        // Request wallet to sign and send transaction with additional signers
        showInfo('Please approve the transaction in your wallet...', true);
        
        let signature;
        try {
            // Similar to manage_account.js - separate signing and sending
            console.log('Requesting wallet signature for vote account creation...');
            
            // Step 1: First sign with the vote account keypair (offline)
            transaction.partialSign(voteAccountKeypair);
            console.log('Vote account keypair signed transaction');
            
            // Step 2: Sign with identity account keypair (offline) - required for authorizedVoter
            const identityKeypair = solanaWeb3.Keypair.fromSecretKey(
                new Uint8Array(currentValidator.identityAccount.secretKey)
            );
            transaction.partialSign(identityKeypair);
            console.log('Identity account keypair signed transaction');
            
            // Step 3: Then sign with wallet (this will add the payer signature)
            const signedTransaction = await wallet.signTransaction(transaction);
            console.log('Wallet signed transaction successfully');
            
            // Step 4: Send signed transaction
            signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3,
            });
            
            console.log('Vote account creation transaction sent with signature:', signature);
            
        } catch (walletError) {
            // Handle "Plugin Closed" error specifically (similar to manage_account.js)
            if (walletError.message && walletError.message.includes('Plugin Closed')) {
                console.log('Plugin closed error detected, checking if vote account was created...');
                
                // Wait a bit for potential transaction to be processed
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Try to check if vote account was created by checking its existence
                try {
                    const voteAccountInfo = await connection.getAccountInfo(voteAccountPubkey);
                    
                    if (voteAccountInfo && voteAccountInfo.data && voteAccountInfo.data.length > 0) {
                        console.log('Vote account exists, transaction likely successful');
                        
                        // Show success message without transaction link
                        showSuccess('✅ Vote account creation appears successful! The account has been created. Please check your wallet for confirmation.');
                        
                        // Hide modal
                        hideCreateVoteAccountModal();
                        
                        // Update vote account card status to disabled
                        updateVoteAccountCardStatus();
                        return; // Exit successfully
                    } else {
                        console.log('Vote account does not exist, transaction may have failed');
                        throw new Error('Transaction may have failed - vote account was not created after wallet plugin closed');
                    }
                } catch (accountCheckError) {
                    console.error('Failed to check vote account existence:', accountCheckError);
                    throw new Error('Wallet plugin closed during signing. Please check your wallet history to verify if the vote account was created.');
                }
            } else {
                throw walletError; // Re-throw other wallet errors
            }
        }

        if (signature) {
            console.log('Vote account created successfully! Signature:', signature);
            
            // Wait for confirmation
            showInfo('Confirming transaction...', true);
            
            try {
                // Wait for confirmation with timeout
                const confirmationPromise = connection.confirmTransaction(signature, 'confirmed');

                // Add timeout to avoid waiting forever
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Transaction confirmation timeout')), 45000)
                );

                const confirmation = await Promise.race([confirmationPromise, timeoutPromise]);
                
                if (confirmation.value && confirmation.value.err) {
                    throw new Error('Transaction failed: ' + confirmation.value.err);
                }

                console.log('Transaction confirmed:', confirmation);

                // Success
                const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                showSuccess(`✅ Vote account created successfully! ${explorerUrl}`);
        
                // Hide modal
                hideCreateVoteAccountModal();
                
                // Update vote account card status to disabled (like identity account after creation)
                updateVoteAccountCardStatus();
                
            } catch (confirmationError) {
                if (confirmationError.message.includes('timeout')) {
                    // Even if confirmation times out, check if the account was created
                    try {
                        const voteAccountInfo = await connection.getAccountInfo(voteAccountPubkey);
                        if (voteAccountInfo && voteAccountInfo.data && voteAccountInfo.data.length > 0) {
                            const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                            showWarning(`⚠️ Transaction confirmation timeout, but vote account appears to have been created. Please verify: ${explorerUrl}`);
                            hideCreateVoteAccountModal();
                            updateVoteAccountCardStatus();
                        } else {
                            const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                            showWarning(`⚠️ Transaction confirmation timeout. Please check the transaction status: ${explorerUrl}`);
                            hideCreateVoteAccountModal();
                        }
                    } catch (accountCheckError) {
                        const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                        showWarning(`⚠️ Transaction confirmation timeout. Please check the transaction status: ${explorerUrl}`);
                        hideCreateVoteAccountModal();
                    }
                } else {
                    throw confirmationError;
                }
            }
        }
        
    } catch (error) {
        console.error('Failed to create vote account:', error);
        
        // Handle specific error types
        let errorMessage = 'Failed to create vote account: ';
        
        if (error.message && error.message.includes('Plugin Closed')) {
            errorMessage = 'Wallet plugin was closed during signing. Please check your wallet history to verify if the vote account was created successfully.';
        } else if (error.message && error.message.includes('vote account was not created')) {
            errorMessage = 'Transaction may have failed - the vote account was not created. Please check your wallet for any error messages.';
        } else if (error.message && error.message.includes('User rejected') || error.message && error.message.includes('rejected')) {
            errorMessage = 'Transaction was rejected by user';
        } else if (error.message && error.message.includes('insufficient funds') || error.message && error.message.includes('Insufficient')) {
            errorMessage = 'Insufficient funds for transaction fees and rent';
        } else if (error.message && error.message.includes('blockhash not found')) {
            errorMessage = 'Network error, please try again';
        } else if (error.message && error.message.includes('Invalid public key')) {
            errorMessage = 'Invalid account address format';
        } else if (error.message && error.message.includes('0x1')) {
            errorMessage = 'Insufficient account balance for transaction fees and rent';
        } else {
            errorMessage += error.message || 'Unknown error occurred';
        }
        
        showError(errorMessage);
    }
}

// Update vote account card status to disabled after successful creation
function updateVoteAccountCardStatus() {
    const voteCard = document.querySelector('.account-type-card[data-type="vote"]');
    const voteBtn = document.getElementById('generateVoteBtn');
    
    if (voteCard) {
        voteCard.classList.add('disabled');
        voteCard.classList.add('has-account');
        voteCard.classList.add('vote-created'); // Special class for created vote account
    }
    
    if (voteBtn) {
        voteBtn.disabled = true;
        voteBtn.textContent = 'Vote Account Created';
        voteBtn.innerHTML = '<i class="fas fa-check-circle"></i> Vote Account Created';
        voteBtn.classList.remove('create-vote-btn');
        voteBtn.classList.add('account-created-btn');
        
        // Remove click handler
        voteBtn.onclick = null;
    }
    
    // Update existing accounts display
    const existingCount = document.querySelector('[data-type="vote"] .existing-accounts');
    if (existingCount) {
        existingCount.textContent = '1 account created and initialized';
        existingCount.classList.remove('none');
    }
}

// Show import identity account modal
function showImportIdentityModal() {
    if (currentValidator.identityAccount) {
        showWarning('Identity account already exists. Only one identity account is allowed.');
        return;
    }
    
    const modal = document.getElementById('importIdentityModal');
    if (modal) {
        // Reset modal state
        resetImportModalState();
        modal.classList.remove('hidden');
    }
}

// Hide import identity account modal
function hideImportIdentityModal() {
    const modal = document.getElementById('importIdentityModal');
    if (modal) {
        modal.classList.add('hidden');
        resetImportModalState();
    }
}

// Reset import modal state
function resetImportModalState() {
    // Reset method selection
    const seedMethodOption = document.querySelector('.method-option[data-method="seed"]');
    const keypairMethodOption = document.querySelector('.method-option[data-method="keypair"]');
    const seedRadio = document.querySelector('input[name="importMethod"][value="seed"]');
    const keypairRadio = document.querySelector('input[name="importMethod"][value="keypair"]');
    
    if (seedMethodOption) seedMethodOption.classList.add('active');
    if (keypairMethodOption) keypairMethodOption.classList.remove('active');
    if (seedRadio) seedRadio.checked = true;
    if (keypairRadio) keypairRadio.checked = false;
    
    // Show seed section, hide keypair section
    const seedSection = document.getElementById('seedImportSection');
    const keypairSection = document.getElementById('keypairImportSection');
    if (seedSection) seedSection.classList.remove('hidden');
    if (keypairSection) keypairSection.classList.add('hidden');
    
    // Clear inputs
    const seedInput = document.getElementById('seedInput');
    const derivationPath = document.getElementById('importDerivationPath');
    const keypairFile = document.getElementById('keypairFile');
    const keypairText = document.getElementById('keypairText');
    
    if (seedInput) seedInput.value = '';
    if (derivationPath) derivationPath.value = "m/44'/501'/0'/0'";
    if (keypairFile) {
        keypairFile.value = '';
        keypairFile.removeAttribute('data-file-loaded');
    }
    if (keypairText) keypairText.value = '';
    
    // Hide file preview
    const filePreview = document.getElementById('filePreview');
    if (filePreview) filePreview.classList.add('hidden');
    
    // Reset button state
    const importBtn = document.getElementById('importAccountBtn');
    if (importBtn) {
        importBtn.disabled = false;
        importBtn.classList.remove('loading');
        importBtn.innerHTML = '<i class="fas fa-upload"></i> Import Account';
    }
}

// Handle import method selection
document.addEventListener('DOMContentLoaded', function() {
    // Method selection event listeners for both identity and vote import modals
    const methodOptions = document.querySelectorAll('.method-option');
    methodOptions.forEach(option => {
        option.addEventListener('click', function() {
            const method = this.getAttribute('data-method');
            const radio = this.querySelector('input[type="radio"]');
            
            // Update radio button
            radio.checked = true;
            
            // Update active states within the same modal
            const modal = this.closest('.modal');
            const modalMethodOptions = modal.querySelectorAll('.method-option');
            modalMethodOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            // Show/hide sections based on modal
            const isVoteModal = modal.id === 'importVoteModal';
            const seedSectionId = isVoteModal ? 'voteSeedImportSection' : 'seedImportSection';
            const keypairSectionId = isVoteModal ? 'voteKeypairImportSection' : 'keypairImportSection';
            
            const seedSection = document.getElementById(seedSectionId);
            const keypairSection = document.getElementById(keypairSectionId);
            
            if (method === 'seed') {
                if (seedSection) seedSection.classList.remove('hidden');
                if (keypairSection) keypairSection.classList.add('hidden');
            } else if (method === 'keypair') {
                if (seedSection) seedSection.classList.add('hidden');
                if (keypairSection) keypairSection.classList.remove('hidden');
            }
        });
    });
    
    // File input change handlers for both identity and vote
    const keypairFileInput = document.getElementById('keypairFile');
    if (keypairFileInput) {
        keypairFileInput.addEventListener('change', handleKeypairFileSelect);
    }
    
    const voteKeypairFileInput = document.getElementById('voteKeypairFile');
    if (voteKeypairFileInput) {
        voteKeypairFileInput.addEventListener('change', handleVoteKeypairFileSelect);
    }
});

// Handle keypair file selection
function handleKeypairFileSelect(event) {
    const file = event.target.files[0];
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    
    if (file) {
        if (fileName) fileName.textContent = file.name;
        if (filePreview) filePreview.classList.remove('hidden');
        
        // Store file reference for later processing, but don't display content for security
        const keypairFileInput = document.getElementById('keypairFile');
        if (keypairFileInput) {
            keypairFileInput.setAttribute('data-file-loaded', 'true');
        }
    } else {
        if (filePreview) filePreview.classList.add('hidden');
        const keypairFileInput = document.getElementById('keypairFile');
        if (keypairFileInput) {
            keypairFileInput.removeAttribute('data-file-loaded');
        }
    }
}

// Clear keypair file
function clearKeypairFile() {
    const keypairFile = document.getElementById('keypairFile');
    const filePreview = document.getElementById('filePreview');
    const keypairText = document.getElementById('keypairText');
    
    if (keypairFile) {
        keypairFile.value = '';
        keypairFile.removeAttribute('data-file-loaded');
    }
    if (filePreview) filePreview.classList.add('hidden');
    // 不清除keypairText，让用户可以独立使用文本输入
}

// Use default import derivation path
function useDefaultImportPath() {
    const derivationInput = document.getElementById('importDerivationPath');
    if (derivationInput) {
        derivationInput.value = DEFAULT_DERIVATION_PATH;
    }
}

// Import identity account
async function importIdentityAccount() {
    const importBtn = document.getElementById('importAccountBtn');
    const selectedMethod = document.querySelector('input[name="importMethod"]:checked').value;
    
    try {
        // Update UI
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.classList.add('loading');
            importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
        }
        
        let accountData;
        
        if (selectedMethod === 'seed') {
            accountData = await importFromSeed();
        } else if (selectedMethod === 'keypair') {
            accountData = await importFromKeypair();
        }
        
        if (accountData) {
            // Store imported account
            currentValidator.identityAccount = accountData;
            
            // Update display
            updateAccountTypesDisplay();
            
            // Close modal
            hideImportIdentityModal();
            
            showSuccess('Identity account imported successfully!');
        }
        
    } catch (error) {
        console.error('Failed to import account:', error);
        showError('Failed to import account: ' + error.message);
    } finally {
        // Reset button state
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.classList.remove('loading');
            importBtn.innerHTML = '<i class="fas fa-upload"></i> Import Account';
        }
    }
}

// Import from seed
async function importFromSeed() {
    const seedInput = document.getElementById('seedInput');
    const derivationPath = document.getElementById('importDerivationPath');
    
    if (!seedInput || !derivationPath) {
        throw new Error('Required input fields not found');
    }
    
    const seedText = seedInput.value.trim();
    const derivationPathValue = derivationPath.value.trim();
    
    if (!seedText) {
        throw new Error('Please enter your recovery seed phrase');
    }
    
    if (!derivationPathValue) {
        throw new Error('Please enter a derivation path');
    }
    
    // Validate and parse seed
    const seedWords = seedText.split(/\s+/).filter(word => word.length > 0);
    
    if (seedWords.length !== 12) {
        throw new Error('Recovery seed must be exactly 12 words');
    }
    
    // Generate keypair from seed
    const keypairData = await generateKeypairFromSeed(seedWords, derivationPathValue);
    
    return {
        publicKey: keypairData.publicKey,
        secretKey: keypairData.secretKey,
        seed: seedWords,
        derivationPath: derivationPathValue,
        createdAt: new Date().toISOString(),
        accountType: ACCOUNT_TYPES.IDENTITY,
        imported: true,
        importMethod: 'seed'
    };
}

// Import from keypair
async function importFromKeypair() {
    const keypairText = document.getElementById('keypairText');
    const keypairFile = document.getElementById('keypairFile');
    
    if (!keypairText) {
        throw new Error('Keypair text input not found');
    }
    
    let keypairContent = '';
    
    // Check if file was selected
    if (keypairFile && keypairFile.files && keypairFile.files[0] && keypairFile.getAttribute('data-file-loaded')) {
        // Read from file
        const file = keypairFile.files[0];
        try {
            keypairContent = await readFileAsText(file);
        } catch (error) {
            throw new Error('Failed to read keypair file: ' + error.message);
        }
    } else {
        // Read from text input
        keypairContent = keypairText.value.trim();
    }
    
    if (!keypairContent) {
        throw new Error('Please provide keypair data either by selecting a file or pasting the data');
    }
    
    let secretKeyArray;
    
    try {
        // Parse JSON - expecting direct array format [123, 456, ...]
        const keypairJson = JSON.parse(keypairContent);
        
        if (Array.isArray(keypairJson)) {
            // Direct array format [123, 456, ...]
            secretKeyArray = keypairJson;
        } else {
            throw new Error('Expected array format: [123,456,789,...]');
        }
        
    } catch (parseError) {
        throw new Error('Invalid JSON format. Expected array format: [123,456,789,...]');
    }
    
    // Validate secret key array
    if (!Array.isArray(secretKeyArray) || secretKeyArray.length !== 64) {
        throw new Error('Invalid keypair format. Expected array of exactly 64 numbers.');
    }
    
    // Validate all elements are numbers
    if (!secretKeyArray.every(num => typeof num === 'number' && num >= 0 && num <= 255)) {
        throw new Error('Invalid keypair data. All values must be numbers between 0-255.');
    }
    
    try {
        // Create keypair from secret key
        const keypair = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
        
        return {
            publicKey: keypair.publicKey.toString(),
            secretKey: secretKeyArray,
            seed: null, // No seed for direct keypair import
            derivationPath: null, // No derivation path for direct keypair import
            createdAt: new Date().toISOString(),
            accountType: ACCOUNT_TYPES.IDENTITY,
            imported: true,
            importMethod: 'keypair'
        };
        
    } catch (keypairError) {
        throw new Error('Failed to create keypair from provided data: ' + keypairError.message);
    }
}

// Helper function to read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the new account page
    const newAccountPage = document.getElementById('new-account');
    if (newAccountPage && newAccountPage.classList.contains('active')) {
        initializeNewAccount();
    }
});

// Export functions for global access
window.initializeNewAccount = initializeNewAccount;
window.onWalletConnectedNewAccount = onWalletConnectedNewAccount;
window.onWalletDisconnectedNewAccount = onWalletDisconnectedNewAccount;
window.onWalletUIUpdatedNewAccount = onWalletUIUpdatedNewAccount;

// Show delegate modal
function showDelegateModal(stakeAccountAddress, stakeIndex) {
    if (!walletConnected) {
        showError('Please connect your wallet first');
        return;
    }
    
    const modal = document.getElementById('delegateStakeModal');
    const stakeAccountInput = document.getElementById('delegateStakeAccount');
    const voteAccountInput = document.getElementById('delegateVoteAccount');
    const authorityInput = document.getElementById('delegateAuthority');
    const validationDiv = document.getElementById('voteAccountValidation');
    const balanceDiv = document.getElementById('stakeAccountBalance');
    
    if (stakeAccountInput) {
        stakeAccountInput.value = stakeAccountAddress;
    }
    
    if (authorityInput && connectedWalletAddress) {
        authorityInput.value = connectedWalletAddress;
    }
    
    // Reset balance display to loading state
    if (balanceDiv) {
        balanceDiv.className = 'balance-display loading';
        balanceDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading balance...';
    }
    
    // Auto-fill vote account if available
    if (voteAccountInput) {
        if (currentValidator.voteAccount && currentValidator.voteAccount.publicKey) {
            voteAccountInput.value = currentValidator.voteAccount.publicKey;
            // Validate the vote account immediately
            validateVoteAccount(currentValidator.voteAccount.publicKey);
        } else {
            voteAccountInput.value = '';
        }
    }
    
    // Reset validation
    if (validationDiv) {
        validationDiv.classList.add('hidden');
        validationDiv.textContent = '';
    }
    
    // Reset delegate button
    const delegateBtn = document.getElementById('delegateStakeBtn');
    if (delegateBtn) {
        delegateBtn.disabled = !currentValidator.voteAccount;
        delegateBtn.classList.remove('loading');
    }
    
    // Store current stake index for later use
    window.currentDelegateStakeIndex = stakeIndex;
    
    // Add event listener for vote account validation
    if (voteAccountInput) {
        voteAccountInput.removeEventListener('input', handleVoteAccountInput);
        voteAccountInput.addEventListener('input', handleVoteAccountInput);
    }
    
    if (modal) modal.classList.remove('hidden');
    
    // Load stake account balance
    loadStakeAccountBalance(stakeAccountAddress);
}

// Load stake account balance
async function loadStakeAccountBalance(stakeAccountAddress) {
    const balanceDiv = document.getElementById('stakeAccountBalance');
    
    try {
        // Get stake account info
        const stakeAccountPubkey = new solanaWeb3.PublicKey(stakeAccountAddress);
        const accountInfo = await connection.getAccountInfo(stakeAccountPubkey);
        
        if (!accountInfo) {
            throw new Error('Stake account not found on-chain');
        }
        
        // Convert lamports to XNT
        const balanceXNT = accountInfo.lamports / solanaWeb3.LAMPORTS_PER_SOL;
        
        if (balanceDiv) {
            balanceDiv.className = 'balance-display';
            balanceDiv.innerHTML = `${balanceXNT.toFixed(6)} XNT`;
        }
        
        console.log('Stake account balance loaded:', balanceXNT, 'XNT');
        
    } catch (error) {
        console.error('Failed to load stake account balance:', error);
        
        if (balanceDiv) {
            balanceDiv.className = 'balance-display error';
            balanceDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed to load balance';
        }
    }
}

// Hide delegate modal
function hideDelegateModal() {
    const modal = document.getElementById('delegateStakeModal');
    if (modal) modal.classList.add('hidden');
    
    // Clean up
    window.currentDelegateStakeIndex = null;
    const voteAccountInput = document.getElementById('delegateVoteAccount');
    if (voteAccountInput) {
        voteAccountInput.removeEventListener('input', handleVoteAccountInput);
    }
}

// Handle vote account input validation
function handleVoteAccountInput(event) {
    const voteAccount = event.target.value.trim();
    if (voteAccount.length >= 32) {
        validateVoteAccount(voteAccount);
    } else {
        const validationDiv = document.getElementById('voteAccountValidation');
        const delegateBtn = document.getElementById('delegateStakeBtn');
        
        if (validationDiv) {
            validationDiv.classList.add('hidden');
        }
        
        if (delegateBtn) {
            delegateBtn.disabled = true;
        }
    }
}

// Validate vote account
async function validateVoteAccount(voteAccountAddress) {
    const validationDiv = document.getElementById('voteAccountValidation');
    const delegateBtn = document.getElementById('delegateStakeBtn');
    
    if (!voteAccountAddress) {
        if (validationDiv) {
            validationDiv.classList.add('hidden');
        }
        if (delegateBtn) {
            delegateBtn.disabled = true;
        }
        return;
    }
    
    try {
        // Show validating state
        if (validationDiv) {
            validationDiv.className = 'validation-message validating';
            validationDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating vote account...';
        }
        
        const voteAccountPubkey = new solanaWeb3.PublicKey(voteAccountAddress);
        const accountInfo = await connection.getAccountInfo(voteAccountPubkey);
        
        if (!accountInfo) {
            throw new Error('Vote account does not exist');
        }
        
        // Check if account is owned by Vote Program
        const voteProgram = 'Vote111111111111111111111111111111111111111';
        if (accountInfo.owner.toString() !== voteProgram) {
            throw new Error('Invalid vote account - not owned by Vote Program');
        }
        
        // Validation successful
        if (validationDiv) {
            validationDiv.className = 'validation-message valid';
            validationDiv.innerHTML = '<i class="fas fa-check-circle"></i> Valid vote account';
        }
        
        if (delegateBtn) {
            delegateBtn.disabled = false;
        }
        
    } catch (error) {
        console.error('Vote account validation error:', error);
        
        if (validationDiv) {
            validationDiv.className = 'validation-message invalid';
            validationDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error.message}`;
        }
        
        if (delegateBtn) {
            delegateBtn.disabled = true;
        }
    }
}

// Execute delegate stake
async function executeDelegate() {
    if (!walletConnected || !connectedWalletAddress) {
        showError('Please connect your wallet first');
        return;
    }
    
    const stakeAccountAddress = document.getElementById('delegateStakeAccount').value.trim();
    const voteAccountAddress = document.getElementById('delegateVoteAccount').value.trim();
    const delegateBtn = document.getElementById('delegateStakeBtn');
    
    if (!stakeAccountAddress) {
        showError('Stake account address is required');
        return;
    }
    
    if (!voteAccountAddress) {
        showError('Vote account address is required');
        return;
    }
    
    // Validate stake account exists in our list
    const stakeIndex = window.currentDelegateStakeIndex;
    if (stakeIndex === null || !currentValidator.stakeAccounts[stakeIndex]) {
        showError('Stake account not found');
        return;
    }
    
    const stakeAccount = currentValidator.stakeAccounts[stakeIndex];
    
    try {
        // Update UI
        if (delegateBtn) {
            delegateBtn.disabled = true;
            delegateBtn.classList.add('loading');
            delegateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Delegating...';
        }
        
        showInfo('Creating stake delegation transaction...', true);
        
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
        
        // Create delegate instruction using StakeProgram - use wallet as authority
        const delegateTransaction = solanaWeb3.StakeProgram.delegate({
            stakePubkey: stakeAccountPubkey,
            authorizedPubkey: stakeAuthorityPubkey, // Use connected wallet as stake authority
            votePubkey: voteAccountPubkey,
        });
        
        // Add delegate instruction to transaction
        transaction.add(...delegateTransaction.instructions);
        
        console.log('Stake delegate transaction prepared:', {
            stakeAccount: stakeAccountPubkey.toString(),
            voteAccount: voteAccountPubkey.toString(),
            stakeAuthority: stakeAuthorityPubkey.toString()
        });
        
        // Request wallet to sign and send transaction
        showInfo('Please approve the transaction in your wallet...', true);
        
        try {
            // Sign with wallet only
            const signedTransaction = await wallet.signTransaction(transaction);
            console.log('Wallet signed transaction successfully');
            
            // Send transaction
            const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3,
            });
            
            console.log('Stake delegation transaction sent:', signature);
            showInfo('Transaction sent! Waiting for confirmation...', true);
            
            // Wait for confirmation
            try {
                const confirmation = await connection.confirmTransaction(signature, 'confirmed');
                
                if (confirmation.value && confirmation.value.err) {
                    throw new Error('Transaction failed: ' + confirmation.value.err);
                }
                
                console.log('Transaction confirmed:', confirmation);

                // Mark as delegated and update display
                const stakeIndex = window.currentDelegateStakeIndex;
                if (stakeIndex !== null && currentValidator.stakeAccounts[stakeIndex]) {
                    currentValidator.stakeAccounts[stakeIndex].delegated = true;
                    updateStakeAccountsDisplay();
                }

                const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                showSuccess(`✅ Stake delegated successfully! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);

                // Close modal
                hideDelegateModal();
                
            } catch (confirmationError) {
                if (confirmationError.message.includes('timeout')) {
                    const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                    showWarning(`⚠️ Transaction confirmation timeout. Please check transaction status: <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
                    hideDelegateModal();
                } else {
                    throw confirmationError;
                }
            }
            
        } catch (walletError) {
            if (walletError.message && walletError.message.includes('Plugin Closed')) {
                showWarning('Wallet plugin was closed during signing. Please check your wallet history to verify if the delegation was successful.');
                hideDelegateModal();
            } else {
                throw walletError;
            }
        }
        
    } catch (error) {
        console.error('Failed to delegate stake:', error);
        
        let errorMessage = 'Failed to delegate stake: ';
        
        if (error.message && error.message.includes('rejected')) {
            errorMessage = 'Transaction was rejected by user';
        } else if (error.message && error.message.includes('insufficient funds')) {
            errorMessage = 'Insufficient funds for transaction fees';
        } else if (error.message && error.message.includes('Invalid public key')) {
            errorMessage = 'Invalid account address format';
        } else {
            errorMessage += error.message || 'Unknown error occurred';
        }
        
        showError(errorMessage);
        
    } finally {
        // Reset button state
        if (delegateBtn) {
            delegateBtn.disabled = false;
            delegateBtn.classList.remove('loading');
            delegateBtn.innerHTML = '<i class="fas fa-arrow-up"></i> Delegate Stake';
        }
    }
}

console.log('New Account JS loaded successfully');

// Show create stake account modal
function showCreateStakeAccountModal(stakeAccountAddress, stakeIndex) {
    if (!walletConnected) {
        showError('Please connect your wallet first');
        return;
    }
    
    const modal = document.getElementById('createStakeAccountModal');
    const stakeAccountInput = document.getElementById('stakeAccountKey');
    const stakeAuthorityInput = document.getElementById('stakeAuthority');
    const withdrawAuthorityInput = document.getElementById('createStakeWithdrawAuthority');
    
    // Fill in stake account public key
    if (stakeAccountInput) {
        stakeAccountInput.value = stakeAccountAddress;
    }
    
    // Set authorities to connected wallet
    if (stakeAuthorityInput && connectedWalletAddress) {
        stakeAuthorityInput.value = connectedWalletAddress;
    }
    
    if (withdrawAuthorityInput && connectedWalletAddress) {
        withdrawAuthorityInput.value = connectedWalletAddress;
    }
    
    // Store stake index for later use
    window.currentCreateStakeIndex = stakeIndex;
    
    if (modal) modal.classList.remove('hidden');
}

// Hide create stake account modal
function hideCreateStakeAccountModal() {
    const modal = document.getElementById('createStakeAccountModal');
    if (modal) modal.classList.add('hidden');
    
    // Clean up
    window.currentCreateStakeIndex = null;
}

// Create stake account on-chain
async function createStakeAccount() {
    const stakeAccountKey = document.getElementById('stakeAccountKey').value;
    const stakeAuthorityKey = document.getElementById('stakeAuthority').value;
    const withdrawAuthorityKey = document.getElementById('createStakeWithdrawAuthority').value;
    const stakeAmount = document.getElementById('stakeAmount').value;
    
    // Validation
    if (!stakeAccountKey) {
        showError('Stake account public key is required');
        return;
    }
    
    if (!stakeAuthorityKey || !withdrawAuthorityKey) {
        showError('Stake and withdraw authorities are required');
        return;
    }
    
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
        showError('Please enter a valid stake amount');
        return;
    }
    
    const stakeIndex = window.currentCreateStakeIndex;
    if (stakeIndex === null || !currentValidator.stakeAccounts[stakeIndex]) {
        showError('Stake account not found');
        return;
    }
    
    const stakeAccount = currentValidator.stakeAccounts[stakeIndex];
    if (!stakeAccount.secretKey) {
        showError('Stake account secret key not found');
        return;
    }
    
    if (!walletConnected || !connectedWalletAddress) {
        showError('Please connect your wallet first');
        return;
    }
    
    try {
        showInfo('Creating stake account transaction...', true);
        
        // Validate amount
        const amountInLamports = Math.floor(parseFloat(stakeAmount) * solanaWeb3.LAMPORTS_PER_SOL);
        if (amountInLamports < 1000000) { // Minimum ~0.001 SOL
            showError('Minimum stake amount is 0.001 XNT');
            return;
        }
        
        // Create public keys
        const stakeAccountPubkey = new solanaWeb3.PublicKey(stakeAccountKey);
        const stakeAuthorityPubkey = new solanaWeb3.PublicKey(stakeAuthorityKey);
        const withdrawAuthorityPubkey = new solanaWeb3.PublicKey(withdrawAuthorityKey);
        const payerPubkey = new solanaWeb3.PublicKey(connectedWalletAddress);
        
        // Create stake account keypair from stored secret key
        const stakeAccountKeypair = solanaWeb3.Keypair.fromSecretKey(
            new Uint8Array(stakeAccount.secretKey)
        );
        
        // Verify the public keys match
        if (stakeAccountKeypair.publicKey.toString() !== stakeAccountKey) {
            showError('Stake account keypair mismatch. Please regenerate stake account.');
            return;
        }
        
        // Calculate rent exemption amount
        const rentExemptAmount = await connection.getMinimumBalanceForRentExemption(200); // Stake account space
        const totalAmount = amountInLamports + rentExemptAmount;
        
        console.log('Creating stake account with:', {
            stakeAccount: stakeAccountKey,
            stakeAuthority: stakeAuthorityKey,
            withdrawAuthority: withdrawAuthorityKey,
            amount: stakeAmount,
            totalLamports: totalAmount
        });
        
        // Create stake account instruction
        const createStakeAccountInstruction = solanaWeb3.StakeProgram.createAccount({
            fromPubkey: payerPubkey,
            stakePubkey: stakeAccountPubkey,
            authorized: {
                staker: stakeAuthorityPubkey,
                withdrawer: withdrawAuthorityPubkey,
            },
            lamports: totalAmount
        });
        
        // Create transaction
        const transaction = new solanaWeb3.Transaction();
        transaction.add(createStakeAccountInstruction);
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = payerPubkey;
        
        console.log('Stake account transaction prepared');
        
        // Request wallet to sign and send transaction with additional signers
        showInfo('Please approve the transaction in your wallet...', true);
        
        let signature;
        try {
            console.log('Requesting wallet signature for stake account creation...');
            
            // Step 1: First sign with the stake account keypair (offline)
            transaction.partialSign(stakeAccountKeypair);
            console.log('Stake account keypair signed transaction');
            
            // Step 2: Then sign with wallet (this will add the payer signature)
            const signedTransaction = await wallet.signTransaction(transaction);
            console.log('Wallet signed transaction successfully');
            
            // Step 3: Send signed transaction
            signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3,
            });
            
            console.log('Stake account creation transaction sent with signature:', signature);
            
        } catch (walletError) {
            // Handle "Plugin Closed" error specifically
            if (walletError.message && walletError.message.includes('Plugin Closed')) {
                console.log('Plugin closed error detected, checking if stake account was created...');
                
                // Wait a bit for potential transaction to be processed
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Try to check if stake account was created by checking its existence
                try {
                    const stakeAccountInfo = await connection.getAccountInfo(stakeAccountPubkey);
                    
                    if (stakeAccountInfo && stakeAccountInfo.lamports > 0) {
                        console.log('Stake account exists, transaction likely successful');
                        
                        // Mark as initialized and update display
                        currentValidator.stakeAccounts[stakeIndex].initialized = true;
                        updateStakeAccountsDisplay();
                        
                        // Show success message without transaction link
                        showSuccess('✅ Stake account creation appears successful! The account has been created.');
                        
                        // Hide modal
                        hideCreateStakeAccountModal();
                        return; // Exit successfully
                    } else {
                        console.log('Stake account does not exist, transaction may have failed');
                        throw new Error('Transaction may have failed - stake account was not created after wallet plugin closed');
                    }
                } catch (accountCheckError) {
                    console.error('Failed to check stake account existence:', accountCheckError);
                    throw new Error('Wallet plugin closed during signing. Please check your wallet history to verify if the stake account was created.');
                }
            } else {
                throw walletError; // Re-throw other wallet errors
            }
        }

        if (signature) {
            console.log('Stake account created successfully! Signature:', signature);
            
            // Wait for confirmation
            showInfo('Confirming transaction...', true);
            
            try {
                // Wait for confirmation with timeout
                const confirmationPromise = connection.confirmTransaction(signature, 'confirmed');

                // Add timeout to avoid waiting forever
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Transaction confirmation timeout')), 45000)
                );

                const confirmation = await Promise.race([confirmationPromise, timeoutPromise]);
                
                if (confirmation.value && confirmation.value.err) {
                    throw new Error('Transaction failed: ' + confirmation.value.err);
                }

                console.log('Transaction confirmed:', confirmation);

                // Mark as initialized and update display
                currentValidator.stakeAccounts[stakeIndex].initialized = true;
                updateStakeAccountsDisplay();

                // Success
                const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                showSuccess(`✅ Stake account created successfully! <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
        
                // Hide modal
                hideCreateStakeAccountModal();
                
            } catch (confirmationError) {
                if (confirmationError.message.includes('timeout')) {
                    // Even if confirmation times out, check if the account was created
                    try {
                        const stakeAccountInfo = await connection.getAccountInfo(stakeAccountPubkey);
                        if (stakeAccountInfo && stakeAccountInfo.lamports > 0) {
                            // Mark as initialized and update display
                            currentValidator.stakeAccounts[stakeIndex].initialized = true;
                            updateStakeAccountsDisplay();
                            
                            const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                            showWarning(`⚠️ Transaction confirmation timeout, but stake account appears to have been created. <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
                            hideCreateStakeAccountModal();
                        } else {
                            const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                            showWarning(`⚠️ Transaction confirmation timeout. Please check the transaction status: <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
                            hideCreateStakeAccountModal();
                        }
                    } catch (accountCheckError) {
                        const explorerUrl = `https://explorer.x1.xyz/tx/${signature}`;
                        showWarning(`⚠️ Transaction confirmation timeout. Please check the transaction status: <a href="${explorerUrl}" target="_blank">${explorerUrl}</a>`);
                        hideCreateStakeAccountModal();
                    }
                } else {
                    throw confirmationError;
                }
            }
        }
        
    } catch (error) {
        console.error('Failed to create stake account:', error);
        
        // Handle specific error types
        let errorMessage = 'Failed to create stake account: ';
        
        if (error.message && error.message.includes('Plugin Closed')) {
            errorMessage = 'Wallet plugin was closed during signing. Please check your wallet history to verify if the stake account was created successfully.';
        } else if (error.message && error.message.includes('User rejected') || error.message && error.message.includes('rejected')) {
            errorMessage = 'Transaction was rejected by user';
        } else if (error.message && error.message.includes('insufficient funds') || error.message && error.message.includes('Insufficient')) {
            errorMessage = 'Insufficient funds for transaction fees and stake amount';
        } else if (error.message && error.message.includes('Invalid public key')) {
            errorMessage = 'Invalid account address format';
        } else {
            errorMessage += error.message || 'Unknown error occurred';
        }
        
        showError(errorMessage);
    }
}

console.log('New Account JS loaded successfully');

// Show import vote account modal
function showImportVoteModal() {
    if (currentValidator.voteAccount) {
        showWarning('Vote account already exists. Only one vote account is allowed.');
        return;
    }
    
    const modal = document.getElementById('importVoteModal');
    if (modal) {
        // Reset modal state
        resetImportVoteModalState();
        modal.classList.remove('hidden');
    }
}

// Hide import vote account modal
function hideImportVoteModal() {
    const modal = document.getElementById('importVoteModal');
    if (modal) {
        modal.classList.add('hidden');
        resetImportVoteModalState();
    }
}

// Reset import vote modal state
function resetImportVoteModalState() {
    // Reset method selection
    const seedMethodOption = document.querySelector('#importVoteModal .method-option[data-method="seed"]');
    const keypairMethodOption = document.querySelector('#importVoteModal .method-option[data-method="keypair"]');
    const seedRadio = document.querySelector('input[name="importVoteMethod"][value="seed"]');
    const keypairRadio = document.querySelector('input[name="importVoteMethod"][value="keypair"]');
    
    if (seedMethodOption) seedMethodOption.classList.add('active');
    if (keypairMethodOption) keypairMethodOption.classList.remove('active');
    if (seedRadio) seedRadio.checked = true;
    if (keypairRadio) keypairRadio.checked = false;
    
    // Show seed section, hide keypair section
    const seedSection = document.getElementById('voteSeedImportSection');
    const keypairSection = document.getElementById('voteKeypairImportSection');
    if (seedSection) seedSection.classList.remove('hidden');
    if (keypairSection) keypairSection.classList.add('hidden');
    
    // Clear inputs
    const seedInput = document.getElementById('voteSeedInput');
    const derivationPath = document.getElementById('importVoteDerivationPath');
    const keypairFile = document.getElementById('voteKeypairFile');
    const keypairText = document.getElementById('voteKeypairText');
    
    if (seedInput) seedInput.value = '';
    if (derivationPath) derivationPath.value = "m/44'/501'/0'/0'";
    if (keypairFile) {
        keypairFile.value = '';
        keypairFile.removeAttribute('data-file-loaded');
    }
    if (keypairText) keypairText.value = '';
    
    // Hide file preview
    const filePreview = document.getElementById('voteFilePreview');
    if (filePreview) filePreview.classList.add('hidden');
    
    // Reset button state
    const importBtn = document.getElementById('importVoteAccountBtn');
    if (importBtn) {
        importBtn.disabled = false;
        importBtn.classList.remove('loading');
        importBtn.innerHTML = '<i class="fas fa-upload"></i> Import Vote Account';
    }
}

// Use default vote import derivation path
function useDefaultVoteImportPath() {
    const derivationInput = document.getElementById('importVoteDerivationPath');
    if (derivationInput) {
        derivationInput.value = DEFAULT_DERIVATION_PATH;
    }
}

// Clear vote keypair file
function clearVoteKeypairFile() {
    const keypairFile = document.getElementById('voteKeypairFile');
    const filePreview = document.getElementById('voteFilePreview');
    
    if (keypairFile) {
        keypairFile.value = '';
        keypairFile.removeAttribute('data-file-loaded');
    }
    if (filePreview) filePreview.classList.add('hidden');
}

// Import vote account
async function importVoteAccount() {
    const importBtn = document.getElementById('importVoteAccountBtn');
    const selectedMethod = document.querySelector('input[name="importVoteMethod"]:checked').value;
    
    try {
        // Update UI
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.classList.add('loading');
            importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
        }
        
        let accountData;
        
        if (selectedMethod === 'seed') {
            accountData = await importVoteFromSeed();
        } else if (selectedMethod === 'keypair') {
            accountData = await importVoteFromKeypair();
        }
        
        if (accountData) {
            // Verify the vote account is initialized on-chain
            const isInitialized = await verifyVoteAccountInitialized(accountData.publicKey);
            
            if (!isInitialized) {
                throw new Error('This vote account has not been initialized on-chain yet. Only initialized vote accounts can be imported.');
            }
            
            // Store imported account
            currentValidator.voteAccount = accountData;
            
            // Update display
            updateVoteAccountsDisplay();
            
            // Close modal
            hideImportVoteModal();
            
            showSuccess('Vote account imported successfully!');
        }
        
    } catch (error) {
        console.error('Failed to import vote account:', error);
        showError('Failed to import vote account: ' + error.message);
    } finally {
        // Reset button state
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.classList.remove('loading');
            importBtn.innerHTML = '<i class="fas fa-upload"></i> Import Vote Account';
        }
    }
}

// Verify vote account is initialized on-chain
async function verifyVoteAccountInitialized(publicKey) {
    try {
        const voteAccountPubkey = new solanaWeb3.PublicKey(publicKey);
        const accountInfo = await connection.getAccountInfo(voteAccountPubkey);
        
        if (!accountInfo) {
            throw new Error('Vote account does not exist on-chain');
        }
        
        // Check if account is owned by Vote Program
        const voteProgram = 'Vote111111111111111111111111111111111111111';
        if (accountInfo.owner.toString() !== voteProgram) {
            throw new Error('Account is not a valid vote account (not owned by Vote Program)');
        }
        
        // If we reach here, it's a valid initialized vote account
        return true;
        
    } catch (error) {
        console.error('Vote account verification failed:', error);
        throw error;
    }
}

// Import vote from seed
async function importVoteFromSeed() {
    const seedInput = document.getElementById('voteSeedInput');
    const derivationPath = document.getElementById('importVoteDerivationPath');
    
    if (!seedInput || !derivationPath) {
        throw new Error('Required input fields not found');
    }
    
    const seedText = seedInput.value.trim();
    const derivationPathValue = derivationPath.value.trim();
    
    if (!seedText) {
        throw new Error('Please enter your recovery seed phrase');
    }
    
    if (!derivationPathValue) {
        throw new Error('Please enter a derivation path');
    }
    
    // Validate and parse seed
    const seedWords = seedText.split(/\s+/).filter(word => word.length > 0);
    
    if (seedWords.length !== 12) {
        throw new Error('Recovery seed must be exactly 12 words');
    }
    
    // Generate keypair from seed
    const keypairData = await generateKeypairFromSeed(seedWords, derivationPathValue);
    
    return {
        publicKey: keypairData.publicKey,
        secretKey: keypairData.secretKey,
        seed: seedWords,
        derivationPath: derivationPathValue,
        createdAt: new Date().toISOString(),
        accountType: ACCOUNT_TYPES.VOTE,
        imported: true,
        importMethod: 'seed'
    };
}

// Import vote from keypair
async function importVoteFromKeypair() {
    const keypairText = document.getElementById('voteKeypairText');
    const keypairFile = document.getElementById('voteKeypairFile');
    
    if (!keypairText) {
        throw new Error('Keypair text input not found');
    }
    
    let keypairContent = '';
    
    // Check if file was selected
    if (keypairFile && keypairFile.files && keypairFile.files[0] && keypairFile.getAttribute('data-file-loaded')) {
        // Read from file
        const file = keypairFile.files[0];
        try {
            keypairContent = await readFileAsText(file);
        } catch (error) {
            throw new Error('Failed to read keypair file: ' + error.message);
        }
    } else {
        // Read from text input
        keypairContent = keypairText.value.trim();
    }
    
    if (!keypairContent) {
        throw new Error('Please provide keypair data either by selecting a file or pasting the data');
    }
    
    let secretKeyArray;
    
    try {
        // Parse JSON - expecting direct array format [123, 456, ...]
        const keypairJson = JSON.parse(keypairContent);
        
        if (Array.isArray(keypairJson)) {
            // Direct array format [123, 456, ...]
            secretKeyArray = keypairJson;
        } else {
            throw new Error('Expected array format: [123,456,789,...]');
        }
        
    } catch (parseError) {
        throw new Error('Invalid JSON format. Expected array format: [123,456,789,...]');
    }
    
    // Validate secret key array
    if (!Array.isArray(secretKeyArray) || secretKeyArray.length !== 64) {
        throw new Error('Invalid keypair format. Expected array of exactly 64 numbers.');
    }
    
    // Validate all elements are numbers
    if (!secretKeyArray.every(num => typeof num === 'number' && num >= 0 && num <= 255)) {
        throw new Error('Invalid keypair data. All values must be numbers between 0-255.');
    }
    
    try {
        // Create keypair from secret key
        const keypair = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
        
        return {
            publicKey: keypair.publicKey.toString(),
            secretKey: secretKeyArray,
            seed: null, // No seed for direct keypair import
            derivationPath: null, // No derivation path for direct keypair import
            createdAt: new Date().toISOString(),
            accountType: ACCOUNT_TYPES.VOTE,
            imported: true,
            importMethod: 'keypair'
        };
        
    } catch (keypairError) {
        throw new Error('Failed to create keypair from provided data: ' + keypairError.message);
    }
}

// Handle vote keypair file selection
function handleVoteKeypairFileSelect(event) {
    const file = event.target.files[0];
    const filePreview = document.getElementById('voteFilePreview');
    const fileName = document.getElementById('voteFileName');
    
    if (file) {
        if (fileName) fileName.textContent = file.name;
        if (filePreview) filePreview.classList.remove('hidden');
        
        // Store file reference for later processing, but don't display content for security
        const voteKeypairFileInput = document.getElementById('voteKeypairFile');
        if (voteKeypairFileInput) {
            voteKeypairFileInput.setAttribute('data-file-loaded', 'true');
        }
    } else {
        if (filePreview) filePreview.classList.add('hidden');
        const voteKeypairFileInput = document.getElementById('voteKeypairFile');
        if (voteKeypairFileInput) {
            voteKeypairFileInput.removeAttribute('data-file-loaded');
        }
    }
}

// Ensure import button listeners are attached
function ensureImportButtonListeners() {
    const importVoteBtn = document.getElementById('importVoteBtn');
    if (importVoteBtn && !importVoteBtn.hasAttribute('data-listener-attached')) {
        importVoteBtn.addEventListener('click', () => showImportVoteModal());
        importVoteBtn.setAttribute('data-listener-attached', 'true');
        console.log('Import vote button listener attached');
    }
    
    const importIdentityBtn = document.getElementById('importIdentityBtn');
    if (importIdentityBtn && !importIdentityBtn.hasAttribute('data-listener-attached')) {
        importIdentityBtn.addEventListener('click', () => showImportIdentityModal());
        importIdentityBtn.setAttribute('data-listener-attached', 'true');
        console.log('Import identity button listener attached');
    }
}
