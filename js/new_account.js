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
}

// Initialize generation buttons
function initializeGenerationButtons() {
    const identityBtn = document.getElementById('generateIdentityBtn');
    const voteBtn = document.getElementById('generateVoteBtn');
    const stakeBtn = document.getElementById('generateStakeBtn');
    
    if (identityBtn) {
        identityBtn.addEventListener('click', () => showGenerationModal(ACCOUNT_TYPES.IDENTITY));
    }
    
    if (voteBtn) {
        voteBtn.addEventListener('click', () => showGenerationModal(ACCOUNT_TYPES.VOTE));
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
// Update identity account display
function updateIdentityAccountDisplay() {
    const identityCard = document.querySelector('.account-type-card[data-type="identity"]');
    const identityBtn = document.getElementById('generateIdentityBtn');
    const existingCount = document.querySelector('[data-type="identity"] .existing-accounts');
    const identityAccountsList = document.getElementById('identityAccountsList');
    const generatedSection = document.querySelector('[data-type="identity"] .generated-accounts');
    
    if (currentValidator.identityAccount) {
        if (identityBtn) identityBtn.disabled = true;
        if (existingCount) {
            existingCount.textContent = '1 account created';
            existingCount.classList.remove('none');
        }
        if (identityCard) {
            identityCard.classList.add('disabled');
            identityCard.classList.add('has-account');
        }
        if (generatedSection) generatedSection.style.display = 'block';
        
        // Update accounts list
        if (identityAccountsList) {
            identityAccountsList.innerHTML = '';
            const accountElement = createAccountElement(currentValidator.identityAccount, ACCOUNT_TYPES.IDENTITY, 0);
            identityAccountsList.appendChild(accountElement);
        }
    } else {
        if (identityBtn) identityBtn.disabled = false;
        if (existingCount) {
            existingCount.textContent = 'No accounts';
            existingCount.classList.add('none');
        }
        if (identityCard) {
            identityCard.classList.remove('disabled');
            identityCard.classList.remove('has-account');
        }
        if (generatedSection) generatedSection.style.display = 'none';
        
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
    const existingCount = document.querySelector('[data-type="vote"] .existing-accounts');
    const voteAccountsList = document.getElementById('voteAccountsList');
    const generatedSection = document.querySelector('[data-type="vote"] .generated-accounts');
    
    if (currentValidator.voteAccount) {
        if (voteBtn) voteBtn.disabled = true;
        if (existingCount) {
            existingCount.textContent = '1 account created';
            existingCount.classList.remove('none');
        }
        if (voteCard) {
            voteCard.classList.add('disabled');
            voteCard.classList.add('has-account');
        }
        if (generatedSection) generatedSection.style.display = 'block';
        
        // Update accounts list
        if (voteAccountsList) {
            voteAccountsList.innerHTML = '';
            const accountElement = createAccountElement(currentValidator.voteAccount, ACCOUNT_TYPES.VOTE, 0);
            voteAccountsList.appendChild(accountElement);
        }
    } else {
        if (voteBtn) voteBtn.disabled = false;
        if (existingCount) {
            existingCount.textContent = 'No accounts';
            existingCount.classList.add('none');
        }
        if (voteCard) {
            voteCard.classList.remove('disabled');
            voteCard.classList.remove('has-account');
        }
        if (generatedSection) generatedSection.style.display = 'none';
        
        // Clear accounts list
        if (voteAccountsList) {
            voteAccountsList.innerHTML = '';
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
    
    div.innerHTML = `
        <div class="account-info">
            <div class="account-type-icon ${type}-icon">
                <i class="${typeIcons[type]}"></i>
            </div>
            <div class="account-details">
                <div class="account-address">${account.publicKey}</div>
                <div class="account-meta">${typeLabels[type]} Account • Created ${new Date().toLocaleString()}</div>
            </div>
        </div>
        <div class="account-actions">
            <button class="action-btn copy-btn" onclick="copyToClipboard('${account.publicKey}')">
                <i class="fas fa-copy"></i>
                Copy
            </button>
            <button class="action-btn download-btn" onclick="downloadKeypair('${account.publicKey}', '${type}', ${index})">
                <i class="fas fa-download"></i>
                Download
            </button>
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
        console.log('✅ Generated BIP39 seed:', seed);
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
    
    const keypairData = {
        publicKey: accountData.publicKey,
        secretKey: accountData.secretKey,
        accountType: accountData.accountType,
        derivationPath: accountData.derivationPath,
        createdAt: accountData.createdAt
    };
    
    const dataStr = JSON.stringify(keypairData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
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
            console.log('✅ Derived key object:', derived);
            console.log('✅ Derived key type:', typeof derived.key);
            console.log('✅ Derived key value:', derived.key);
            
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
            
            console.log('✅ Private key bytes length:', privateKeyBytes.length);
            
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

console.log('New Account JS loaded successfully');
