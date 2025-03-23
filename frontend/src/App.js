import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import "./App.css";
import RegistryABI from "./abis/OptimizedShamirRegistry.json";
import ShareContractABI from "./abis/ShareContract.json";
import ShamirCilent from "./ShamirClient";
import WalletIntegratedEncryption from "./WalletIntegratedEncryption";
import WalletKeyManagement from "./WalletKeyManagement";

import ShamirVisualization from './ShamirVisualization';

// Import debugging components
import DebugPanel from "./DebugPanel";
import ShamirBlockchainTester from "./ShamirBlockchainTester";
import DirectReconstruction from "./DirectReconstruction";

// Polyfill imports
import "buffer";
import process from "process";

// Web3Auth imports
import { Web3Auth } from "@web3auth/modal";
import { WEB3AUTH_NETWORK, CHAIN_NAMESPACES } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

window.Buffer = window.Buffer || require("buffer").Buffer;
window.process = process;

// Debug logger utility
const Logger = {
  info: (component, action, data) => {
    console.log(`[INFO][${component}][${action}]`, data || '');
  },
  error: (component, action, error) => {
    console.error(`[ERROR][${component}][${action}]`, error);
  },
  warn: (component, action, data) => {
    console.warn(`[WARN][${component}][${action}]`, data || '');
  },
  success: (component, action, data) => {
    console.log(`[SUCCESS][${component}][${action}]`, data || '');
  },
  debug: (component, functionName, data) => {
    console.debug(`[DEBUG][${component}][${functionName}]`, data || '');
  },
  trace: (component, functionName, args) => {
    console.log(`[TRACE][${component}][${functionName}] Called with:`, args || '');
  }
};

function App() {
  // State variables
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [registryContract, setRegistryContract] = useState(null);
  const [registryAddress, setRegistryAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [web3auth, setWeb3auth] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  // Form states
  const [secret, setSecret] = useState("");
  const [parts, setParts] = useState(3);
  const [threshold, setThreshold] = useState(2);
  const [description, setDescription] = useState("");
  const [ownerAddresses, setOwnerAddresses] = useState([""]);
  const [recipientPublicKeys, setRecipientPublicKeys] = useState([""]);

  // My secrets state
  const [mySecrets, setMySecrets] = useState([]);
  const [secretDetails, setSecretDetails] = useState({});
  const [myShares, setMyShares] = useState({});

  // Reconstruction state
  const [secretToReconstruct, setSecretToReconstruct] = useState("");
  const [sharesToUse, setSharesToUse] = useState([]);
  const [reconstructedSecret, setReconstructedSecret] = useState("");

  // Share management state
  const [selectedSecret, setSelectedSecret] = useState("");
  const [selectedShare, setSelectedShare] = useState("");
  const [shareContractAddress, setShareContractAddress] = useState("");
  const [shareContract, setShareContract] = useState(null);
  const [userToGrant, setUserToGrant] = useState("");
  const [userToRevoke, setUserToRevoke] = useState("");
  const [userToTransfer, setUserToTransfer] = useState("");

  // Login methods
  const [loginMethod, setLoginMethod] = useState("web3auth"); // 'web3auth' or 'metamask'

  // Encryption related state
  const [userKeys, setUserKeys] = useState({ publicKey: '', privateKey: '' });

  // Ethereum remaining
  const [walletBalance, setWalletBalance] = useState("");
  const [chainInfo, setChainInfo] = useState({
    ticker: 'ETH',
    name: 'OP Testnet'
  });

  const [encryptionKeys, setEncryptionKeys] = useState({
    publicKey: '',
    privateKey: '',
    walletProvider: null,
    isMetaMask: false,
    manualKey: false
  });

  // Debug state
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showDebugTools, setShowDebugTools] = useState(true); // Show by default
  const [debugLogs, setDebugLogs] = useState([]);
  const [lastRawData, setLastRawData] = useState(null);

  // Add debug log
  const addDebugLog = (level, message, data) => {
    const timestamp = new Date().toISOString();
    const newLog = { timestamp, level, message, data };
    setDebugLogs(prev => [newLog, ...prev.slice(0, 99)]); // Keep last 100 logs
    
    // Also log to console
    switch(level) {
      case 'error': console.error(message, data); break;
      case 'warn': console.warn(message, data); break;
      case 'success': console.log('%c' + message, 'color: green', data); break;
      default: console.log(message, data);
    }
  };

  // this function to handle key retrieval
  const handleKeyRetrieved = (keys) => {
    Logger.trace('App', 'handleKeyRetrieved', keys);
    
    // Set encryption keys
    setEncryptionKeys(keys);
    
    // Also update userKeys state to fix the button disabled state
    setUserKeys({
      publicKey: keys.publicKey,
      privateKey: keys.privateKey || 'wallet-managed-key' // Provide a fallback value for wallet-based encryption
    });
    
    Logger.success('App', 'keyRetrieved', {
      hasPublicKey: !!keys.publicKey,
      hasPrivateKey: !!keys.privateKey,
      isWalletProvider: !!keys.walletProvider,
      isManualKey: !!keys.manualKey
    });
    
    addDebugLog('success', 'Encryption keys retrieved', {
      publicKeyLength: keys.publicKey ? keys.publicKey.length : 0,
      hasPrivateKey: !!keys.privateKey,
      isManualKey: !!keys.manualKey
    });
  };

  const fetchWalletBalance = async () => {
    Logger.trace('App', 'fetchWalletBalance', { provider: !!provider, account });
    
    if (!provider || !account) {
      Logger.warn('App', 'fetchWalletBalance', 'Provider or account not available');
      return;
    }

    try {
      // Get the balance in wei
      const balance = await provider.getBalance(account);
      Logger.debug('App', 'fetchWalletBalance', { rawBalance: balance.toString() });

      // Convert to ether units (or the appropriate denomination for your chain)
      const formattedBalance = ethers.utils.formatEther(balance);

      // Round to a reasonable number of decimal places (e.g., 4)
      const roundedBalance = parseFloat(formattedBalance).toFixed(4);
      Logger.debug('App', 'fetchWalletBalance', { formattedBalance, roundedBalance });

      setWalletBalance(roundedBalance);
      Logger.success('App', 'fetchWalletBalance', `Balance: ${roundedBalance} ${chainInfo.ticker}`);
    } catch (error) {
      Logger.error('App', 'fetchWalletBalance', error);
      setWalletBalance("Error");
    }
  };

  useEffect(() => {
    Logger.info('App', 'useEffect', 'Setting up balance polling');
    
    fetchWalletBalance();

    // Set up polling to update balance periodically (every 30 seconds)
    const intervalId = setInterval(() => {
      Logger.debug('App', 'balancePolling', 'Checking balance');
      fetchWalletBalance();
    }, 30000);

    // Clean up interval on unmount
    return () => {
      Logger.debug('App', 'useEffect cleanup', 'Clearing balance polling interval');
      clearInterval(intervalId);
    }
  }, [account, provider]);

  // Initialize Web3Auth
  useEffect(() => {
    Logger.info('App', 'useEffect', 'Initializing Web3Auth');
    
    const initWeb3Auth = async () => {
      try {
        Logger.debug('App', 'initWeb3Auth', 'Starting Web3Auth initialization');
        
        // Configure the chain configs that you want to support
        const chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: "0xAA37DC", // hex of 11155420
          rpcTarget: "https://sepolia.optimism.io",
          // Avoid using public rpcTarget in production.
          // Use services like Infura
          displayName: "OP Sepolia",
          blockExplorerUrl: "`https://sepolia-optimistic.etherscan.io`",
          ticker: "ETH",
          tickerName: "ETH",
          logo: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png",
        };
        
        Logger.debug('App', 'initWeb3Auth', { chainConfig });
        
        setChainInfo({
          ticker: chainConfig.ticker || 'ETH',
          name: chainConfig.displayName || 'Ethereum'
        });

        // Create and configure the Ethereum Provider with the SAME chainConfig
        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig: chainConfig },
        });
        Logger.debug('App', 'initWeb3Auth', 'Created EthereumPrivateKeyProvider');

        // Create Web3Auth instance first
        const web3auth = new Web3Auth({
          clientId:
            "BJyzYMhrixp0WEMr2rQjpk_4tOejiKq2pO6yAn5lqhHJ0ZLHAT8paV4kcPjii5g8G2BL49KRVC2fhASGQSESt5I",
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          chainConfig: chainConfig, // This sets the default chain config
          privateKeyProvider,
        });
        Logger.debug('App', 'initWeb3Auth', 'Created Web3Auth instance');

        // Initialize Web3Auth
        await web3auth.initModal();
        Logger.success('App', 'initWeb3Auth', 'Web3Auth initialized successfully');
        setWeb3auth(web3auth);

        // Check if already logged in
        if (web3auth.connected) {
          Logger.info('App', 'initWeb3Auth', 'User already connected with Web3Auth');
          setIsLoggedIn(true);
          const userInfo = await web3auth.getUserInfo();
          setUserInfo(userInfo);
          await setupWeb3Provider(web3auth);
        }
      } catch (error) {
        Logger.error('App', 'initWeb3Auth', error);
        setError(
          "Failed to initialize Web3Auth. Please try again or use MetaMask instead."
        );
      }
    };

    initWeb3Auth();
  }, []);

  // Set up Web3 provider using Web3Auth
  const setupWeb3Provider = async (web3authInstance) => {
    Logger.trace('App', 'setupWeb3Provider', { web3authInstance: !!web3authInstance });
    
    try {
      const web3Provider = new ethers.providers.Web3Provider(
        web3authInstance.provider
      );
      Logger.debug('App', 'setupWeb3Provider', 'Created Web3Provider');
      setProvider(web3Provider);

      const accounts = await web3Provider.listAccounts();
      Logger.debug('App', 'setupWeb3Provider', { accounts });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const web3Signer = web3Provider.getSigner();
        setSigner(web3Signer);
        Logger.success('App', 'setupWeb3Provider', `Connected with account: ${accounts[0]}`);
      } else {
        Logger.warn('App', 'setupWeb3Provider', 'No accounts found with Web3Auth provider');
        setError("No accounts found with Web3Auth provider");
      }
    } catch (error) {
      Logger.error('App', 'setupWeb3Provider', error);
      setError("Error setting up blockchain connection with Web3Auth");
    }
  };

  // Initialize blockchain connection with MetaMask
  const initMetaMask = async () => {
    Logger.trace('App', 'initMetaMask', {});
    
    try {
      if (window.ethereum) {
        Logger.info('App', 'initMetaMask', 'MetaMask detected');
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(web3Provider);

        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        Logger.debug('App', 'initMetaMask', { accounts });
        
        setAccount(accounts[0]);

        const web3Signer = web3Provider.getSigner();
        setSigner(web3Signer);

        // Listen for account changes
        window.ethereum.on("accountsChanged", (accounts) => {
          Logger.info('App', 'accountsChanged', { newAccount: accounts[0] });
          setAccount(accounts[0]);
          loadUserSecrets();
        });

        setLoginMethod("metamask");
        setIsLoggedIn(true);
        Logger.success('App', 'initMetaMask', `Connected with account: ${accounts[0]}`);
      } else {
        Logger.warn('App', 'initMetaMask', 'MetaMask not installed');
        setError("Please install MetaMask to use this option");
      }
    } catch (err) {
      Logger.error('App', 'initMetaMask', err);
      setError(
        "Error connecting to MetaMask. Please make sure you have MetaMask installed and connected."
      );
    }
  };

  // Login with Web3Auth
  const loginWithWeb3Auth = async () => {
    Logger.trace('App', 'loginWithWeb3Auth', {});
    
    if (!web3auth) {
      Logger.error('App', 'loginWithWeb3Auth', 'Web3Auth is not initialized');
      setError("Web3Auth is not initialized yet");
      return;
    }

    try {
      setLoading(true);
      Logger.info('App', 'loginWithWeb3Auth', 'Connecting to Web3Auth');
      
      const web3authProvider = await web3auth.connect();
      setIsLoggedIn(true);
      Logger.debug('App', 'loginWithWeb3Auth', { web3authProvider: !!web3authProvider });

      // Get user info
      const userInfo = await web3auth.getUserInfo();
      Logger.debug('App', 'loginWithWeb3Auth', { userInfo });
      setUserInfo(userInfo);

      // Set up provider and signer
      await setupWeb3Provider(web3auth);
      fetchWalletBalance();
      setLoginMethod("web3auth");
      setLoading(false);
      Logger.success('App', 'loginWithWeb3Auth', 'Successfully logged in with Web3Auth');
      setSuccess("Successfully logged in with Web3Auth!");
    } catch (error) {
      Logger.error('App', 'loginWithWeb3Auth', error);
      setError("Login failed. Please try again.");
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    Logger.trace('App', 'logout', { loginMethod });
    
    try {
      setLoading(true);
      Logger.info('App', 'logout', 'Starting logout process');

      if (loginMethod === "web3auth" && web3auth) {
        await web3auth.logout();
        Logger.debug('App', 'logout', 'Web3Auth logout successful');
      }

      // Reset state
      setProvider(null);
      setSigner(null);
      setAccount("");
      setIsLoggedIn(false);
      setUserInfo(null);
      setMySecrets([]);
      setSecretDetails({});
      setMyShares({});
      setRegistryContract(null);
      setUserKeys({ publicKey: '', privateKey: '' });
      setEncryptionKeys({
        publicKey: '',
        privateKey: '',
        walletProvider: null,
        isMetaMask: false,
        manualKey: false
      });

      setWalletBalance("");
      setLoading(false);
      Logger.success('App', 'logout', 'Successfully logged out');
      setSuccess("Successfully logged out");
    } catch (error) {
      Logger.error('App', 'logout', error);
      setError("Logout failed. Please try again.");
      setLoading(false);
    }
  };

  // Connect to registry contract when address changes
  useEffect(() => {
    Logger.info('App', 'useEffect', 'Registry contract connection setup');
    
    const connectToRegistry = async () => {
      Logger.trace('App', 'connectToRegistry', { 
        hasSigner: !!signer, 
        registryAddress, 
        isValidAddress: registryAddress && ethers.utils.isAddress(registryAddress)
      });
      
      if (
        signer &&
        registryAddress &&
        ethers.utils.isAddress(registryAddress)
      ) {
        try {
          Logger.info('App', 'connectToRegistry', `Connecting to registry at ${registryAddress}`);
          const contract = new ethers.Contract(
            registryAddress,
            RegistryABI.abi,
            signer
          );
          setRegistryContract(contract);
          setError("");
          Logger.success('App', 'connectToRegistry', 'Registry contract connected');
          
          await loadUserSecrets();
        } catch (err) {
          Logger.error('App', 'connectToRegistry', err);
          setError(
            "Error connecting to registry contract. Please check the address."
          );
          setRegistryContract(null);
        }
      } else {
        if (signer && registryAddress) {
          Logger.warn('App', 'connectToRegistry', 'Invalid registry address format');
        }
      }
    };

    connectToRegistry();
  }, [signer, registryAddress]);

  // Load user secrets when registry contract changes
  const loadUserSecrets = async () => {
    Logger.trace('App', 'loadUserSecrets', { hasRegistryContract: !!registryContract });
    
    if (!registryContract) {
      Logger.warn('App', 'loadUserSecrets', 'Registry contract not available');
      return;
    }

    try {
      setLoading(true);
      Logger.info('App', 'loadUserSecrets', 'Loading user secrets');
      
      const secrets = await registryContract.getMySecrets();
      Logger.debug('App', 'loadUserSecrets', { secretsCount: secrets.length });
      setMySecrets(secrets.map((s) => s.toString()));

      // Clear previous details
      setSecretDetails({});
      setMyShares({});

      // Load details for each secret
      Logger.info('App', 'loadUserSecrets', 'Loading details for each secret');
      const detailsPromises = secrets.map(async (secretId) => {
        Logger.debug('App', 'loadUserSecrets', `Fetching details for secret ${secretId}`);
        const details = await registryContract.getSecretInfo(secretId);
        return {
          secretId: secretId.toString(),
          parts: details[0],
          threshold: details[1],
          timestamp: new Date(details[2].toNumber() * 1000).toLocaleString(),
          description: details[3],
          lastAccess:
            details[4].toNumber() > 0
              ? new Date(details[4].toNumber() * 1000).toLocaleString()
              : "Never",
          accessCount: details[5].toString(),
          dataSize: details[6].toString(),
        };
      });

      Logger.info('App', 'loadUserSecrets', 'Loading shares for each secret');
      const sharesPromises = secrets.map(async (secretId) => {
        Logger.debug('App', 'loadUserSecrets', `Fetching shares for secret ${secretId}`);
        const shares = await registryContract.getMySharesForSecret(secretId);
        return {
          secretId: secretId.toString(),
          shares: shares.map((s) => s.toString()),
        };
      });

      const detailsResults = await Promise.all(detailsPromises);
      const sharesResults = await Promise.all(sharesPromises);
      Logger.debug('App', 'loadUserSecrets', { 
        detailsResultsCount: detailsResults.length,
        sharesResultsCount: sharesResults.length 
      });

      const detailsObj = {};
      const sharesObj = {};

      detailsResults.forEach((detail) => {
        detailsObj[detail.secretId] = detail;
      });

      sharesResults.forEach((result) => {
        sharesObj[result.secretId] = result.shares;
      });

      setSecretDetails(detailsObj);
      setMyShares(sharesObj);
      setLoading(false);
      Logger.success('App', 'loadUserSecrets', `Loaded ${secrets.length} secrets successfully`);
    } catch (err) {
      Logger.error('App', 'loadUserSecrets', err);
      setError("Error loading your secrets. Please try again.");
      setLoading(false);
    }
  };

  // Add owner address field
  const addOwnerAddress = () => {
    Logger.trace('App', 'addOwnerAddress', { currentCount: ownerAddresses.length });
    setOwnerAddresses([...ownerAddresses, ""]);
    setRecipientPublicKeys([...recipientPublicKeys, ""]);
    Logger.debug('App', 'addOwnerAddress', 'Added new owner address field');
  };

  // Remove owner address field
  const removeOwnerAddress = (index) => {
    Logger.trace('App', 'removeOwnerAddress', { index });
    
    const newAddresses = [...ownerAddresses];
    newAddresses.splice(index, 1);
    setOwnerAddresses(newAddresses);
    
    const newKeys = [...recipientPublicKeys];
    newKeys.splice(index, 1);
    setRecipientPublicKeys(newKeys);
    
    Logger.debug('App', 'removeOwnerAddress', `Removed owner at index ${index}`);
  };

  // Update owner address
  const updateOwnerAddress = (index, value) => {
    Logger.trace('App', 'updateOwnerAddress', { index, value });
    const newAddresses = [...ownerAddresses];
    newAddresses[index] = value;
    setOwnerAddresses(newAddresses);
  };

  // Update recipient public key
  const updateRecipientPublicKey = (index, value) => {
    Logger.trace('App', 'updateRecipientPublicKey', { index, valueLength: value.length });
    const newKeys = [...recipientPublicKeys];
    newKeys[index] = value;
    setRecipientPublicKeys(newKeys);
  };

  // Split and deploy a secret with encryption
  const handleSplitSecret = async (e) => {
    e.preventDefault();
    Logger.trace('App', 'handleSplitSecret', { 
      hasSecret: !!secret, 
      parts, 
      threshold,
      hasPublicKey: !!encryptionKeys.publicKey
    });
  
    if (!registryContract) {
      Logger.error('App', 'handleSplitSecret', 'Registry contract not connected');
      setError("Registry contract not connected");
      return;
    }
  
    if (!secret) {
      Logger.warn('App', 'handleSplitSecret', 'No secret provided');
      setError("Please enter a secret");
      return;
    }
  
    if (!encryptionKeys.publicKey) {
      Logger.warn('App', 'handleSplitSecret', 'No encryption keys available');
      setError("Please retrieve or generate encryption keys first");
      return;
    }
  
    // Validate parts and threshold
    if (parts < 2) {
      Logger.warn('App', 'handleSplitSecret', 'Parts must be at least 2');
      setError("Parts must be at least 2");
      return;
    }
  
    if (threshold < 2 || threshold > parts) {
      Logger.warn('App', 'handleSplitSecret', 'Invalid threshold value');
      setError("Threshold must be at least 2 and not greater than parts");
      return;
    }
  
    // Filter out empty owner addresses
    const filteredOwners = ownerAddresses.filter(
      (addr) => addr && ethers.utils.isAddress(addr)
    );
    
    Logger.debug('App', 'handleSplitSecret', { 
      filteredOwnersCount: filteredOwners.length,
      partsNeeded: parseInt(parts)
    });
  
    // If we have some owners but not enough, validate
    if (filteredOwners.length > 0 && filteredOwners.length !== parseInt(parts)) {
      Logger.warn('App', 'handleSplitSecret', 'Incomplete owner addresses');
      setError(`You must specify exactly ${parts} owners or none (default to caller)`);
      return;
    }
  
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      
      addDebugLog('info', 'Starting secret splitting process', {
        secretLength: secret.length,
        parts,
        threshold
      });
  
      // Encrypt the secret first - this is the critical security step!
      Logger.info('App', 'handleSplitSecret', 'Encrypting secret before sending to blockchain');
      setSuccess("Encrypting your secret before sending to blockchain...");
      
      // For simplicity, we'll use the same key for all parts
      // In a more sophisticated implementation, you'd encrypt differently for each recipient
      const recipientKeys = [encryptionKeys.publicKey];
      Logger.debug('App', 'handleSplitSecret', { recipientKeysCount: recipientKeys.length });
      
      addDebugLog('info', 'Encrypting with recipient keys', {
        keyCount: recipientKeys.length,
        firstKeyPreview: recipientKeys[0] ? recipientKeys[0].substring(0, 20) + '...' : 'none'
      });
      
      const encryptedPackage = await WalletIntegratedEncryption.encryptForRecipients(
        secret,
        recipientKeys
      );
      Logger.debug('App', 'handleSplitSecret', { encryptedPackageSize: encryptedPackage.length });
      addDebugLog('success', 'Secret encrypted', { packageSize: encryptedPackage.length });
      
      // Convert to hex format for blockchain
      const encryptedHex = WalletIntegratedEncryption.toHex(encryptedPackage);
      Logger.debug('App', 'handleSplitSecret', { encryptedHexSize: encryptedHex.length });
      addDebugLog('info', 'Converted to hex for blockchain', { hexSize: encryptedHex.length });
      
      // Convert the hex string to bytes for the contract
      const encryptedBytes = ethers.utils.arrayify(encryptedHex);
      Logger.debug('App', 'handleSplitSecret', { encryptedBytesSize: encryptedBytes.length });
      addDebugLog('info', 'Converted to bytes for contract', { bytesSize: encryptedBytes.length });
  
      // Call the contract with the encrypted data
      Logger.info('App', 'handleSplitSecret', 'Sending encrypted secret to blockchain');
      setSuccess("Sending encrypted secret to blockchain...");
      
      let tx;
      if (filteredOwners.length === parseInt(parts)) {
        Logger.debug('App', 'handleSplitSecret', 'Using specified owners for shares');
        addDebugLog('info', 'Using specified owners for shares', { 
          ownersCount: filteredOwners.length
        });
        
        tx = await registryContract.splitAndDeploy(
          encryptedBytes,
          parts,
          threshold,
          description,
          filteredOwners
        );
      } else {
        Logger.debug('App', 'handleSplitSecret', 'Using default owner (caller) for shares');
        addDebugLog('info', 'Using caller as default owner for all shares');
        
        tx = await registryContract.splitAndDeploy(
          encryptedBytes,
          parts,
          threshold,
          description,
          []
        );
      }
  
      Logger.info('App', 'handleSplitSecret', 'Transaction submitted, waiting for confirmation');
      setSuccess("Transaction submitted, waiting for confirmation...");
      addDebugLog('info', 'Transaction submitted', { txHash: tx.hash });
      
      const receipt = await tx.wait();
      Logger.debug('App', 'handleSplitSecret', { 
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });
      addDebugLog('success', 'Transaction confirmed', { 
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });
  
      Logger.success('App', 'handleSplitSecret', 'Secret successfully split and stored');
      setSuccess("Success! Your secret is now encrypted and stored on the blockchain.");
      addDebugLog('success', 'Secret successfully split and stored');
  
      // Reset form
      setSecret("");
      setParts(3);
      setThreshold(2);
      setDescription("");
      setOwnerAddresses([""]);
  
      // Reload user secrets
      await loadUserSecrets();
      setLoading(false);
    } catch (err) {
      Logger.error('App', 'handleSplitSecret', err);
      setError("Error splitting secret: " + (err.message || "Unknown error"));
      addDebugLog('error', 'Error splitting secret', { 
        message: err.message || "Unknown error" 
      });
      setLoading(false);
    }
  };

  // Toggle share selection for reconstruction
  const toggleShareSelection = (secretId, shareId) => {
    Logger.trace('App', 'toggleShareSelection', { secretId, shareId });
    
    const newSharesToUse = [...sharesToUse];
    const index = newSharesToUse.findIndex(
      (s) => s.secretId === secretId && s.shareId === shareId
    );

    if (index >= 0) {
      Logger.debug('App', 'toggleShareSelection', 'Removing share from selection');
      newSharesToUse.splice(index, 1);
    } else {
      Logger.debug('App', 'toggleShareSelection', 'Adding share to selection');
      newSharesToUse.push({ secretId, shareId });
    }

    setSharesToUse(newSharesToUse);
    Logger.debug('App', 'toggleShareSelection', { selectedSharesCount: newSharesToUse.length });
  };

  // Check if share is selected
  const isShareSelected = (secretId, shareId) => {
    return sharesToUse.some(
      (s) => s.secretId === secretId && s.shareId === shareId
    );
  };

  // Examine reconstructed data (Debug function)
  const examineReconstructedData = async (secretId, shareIndices) => {
    try {
      Logger.info('App', 'examineReconstructedData', `Examining data for secret ${secretId}`);
      addDebugLog('info', 'Examining reconstructed data', { 
        secretId, 
        shareIndices 
      });
      
      const encryptedResult = await registryContract.reconstructSecret(
        secretId,
        shareIndices
      );
      
      // Store the raw data for inspection
      setLastRawData(encryptedResult);
      
      Logger.debug('App', 'examineReconstructedData', { 
        resultType: typeof encryptedResult,
        resultLength: encryptedResult.length || 0
      });
      
      addDebugLog('info', 'Raw result details', {
        type: typeof encryptedResult,
        length: encryptedResult.length || 0,
        isArray: Array.isArray(encryptedResult),
        isBuffer: encryptedResult instanceof Uint8Array
      });
      
      // Try different ways of converting the result
      const asString = String(encryptedResult);
      addDebugLog('debug', 'As string', asString.substring(0, 100) + '...');
      
      // Convert to hex for inspection
      let hexString = "";
      try {
        hexString = "0x" + Array.from(new Uint8Array(encryptedResult))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
          
        addDebugLog('debug', 'As hex', hexString.substring(0, 100) + '...');
      } catch (err) {
        addDebugLog('error', 'Error converting to hex', err.message);
      }
      
      // Try to inspect the raw bytes
      try {
        const bytes = new Uint8Array(encryptedResult);
        const byteInfo = {
          length: bytes.length,
          first20Bytes: Array.from(bytes.slice(0, 20)),
          contains0: bytes.includes(0),
          containsNonAscii: Array.from(bytes).some(b => b > 127)
        };
        addDebugLog('debug', 'Byte analysis', byteInfo);
      } catch (err) {
        addDebugLog('error', 'Error analyzing bytes', err.message);
      }
      
      // Try to parse it as JSON if possible
      try {
        // First try direct parsing
        const jsonAttempt = JSON.parse(String(encryptedResult));
        addDebugLog('success', 'Successfully parsed as JSON directly', 
          typeof jsonAttempt === 'object' ? 'Valid JSON object' : typeof jsonAttempt
        );
      } catch (err) {
        addDebugLog('info', 'Not directly parseable as JSON', err.message);
        
        // Try fromHex conversion
        try {
          const fromHexResult = WalletIntegratedEncryption.fromHex(hexString);
          addDebugLog('info', 'fromHex result', {
            length: fromHexResult.length,
            preview: fromHexResult.substring(0, 100) + '...'
          });
          
          try {
            // Try to parse the fromHex result as JSON
            const jsonFromHex = JSON.parse(fromHexResult);
            addDebugLog('success', 'Successfully parsed fromHex result as JSON', 
              typeof jsonFromHex === 'object' ? 'Valid JSON object' : typeof jsonFromHex
            );
          } catch (err) {
            addDebugLog('warn', 'fromHex result is not valid JSON', err.message);
          }
        } catch (err) {
          addDebugLog('error', 'Error in fromHex conversion', err.message);
        }
      }
      
      Logger.success('App', 'examineReconstructedData', 'Data examination complete');
      return "Data examination complete - check debug panel";
    } catch (err) {
      Logger.error('App', 'examineReconstructedData', err);
      addDebugLog('error', 'Error examining data', err.message);
      return "Error: " + err.message;
    }
  };

  // Reconstruct secret with decryption
  const handleReconstructSecret = async (e) => {
    e.preventDefault();
    Logger.trace('App', 'handleReconstructSecret', { 
      secretToReconstruct,
      sharesToUseCount: sharesToUse.length,
      hasEncryptionKeys: !!encryptionKeys.publicKey
    });
    
    if (!secretToReconstruct) {
      Logger.warn('App', 'handleReconstructSecret', 'No secret selected for reconstruction');
      setError("Please select a secret to reconstruct");
      return;
    }
    
    // Check for decryption capability
    if (!encryptionKeys.publicKey) {
      Logger.warn('App', 'handleReconstructSecret', 'Encryption keys not available');
      setError("Encryption keys not available. Please retrieve your wallet keys or generate browser keys.");
      return;
    }
    
    // Filter shares for the selected secret
    const relevantShareIds = sharesToUse
      .filter((s) => s.secretId === secretToReconstruct)
      .map((s) => parseInt(s.shareId));
    
    Logger.debug('App', 'handleReconstructSecret', { 
      relevantShareIdsCount: relevantShareIds.length,
      secretDetails: secretDetails[secretToReconstruct]
    });
    
    addDebugLog('info', 'Starting secret reconstruction', {
      secretId: secretToReconstruct,
      shareCount: relevantShareIds.length,
      threshold: secretDetails[secretToReconstruct]?.threshold
    });
    
    // Verify we have enough shares
    const threshold = secretDetails[secretToReconstruct]?.threshold;
    if (relevantShareIds.length < threshold) {
      Logger.warn('App', 'handleReconstructSecret', 'Not enough shares to reconstruct');
      setError(`You need at least ${threshold} shares to reconstruct this secret (selected: ${relevantShareIds.length})`);
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setReconstructedSecret("");
      
      // 1. Call the contract method to retrieve each share
      Logger.info('App', 'handleReconstructSecret', 'Retrieving shares from blockchain');
      setSuccess("Retrieving shares from blockchain...");
      
      // Collect the share data for each selected share
      const shares = [];
      for (const shareId of relevantShareIds) {
        addDebugLog('info', `Retrieving share ${shareId}`, { secretId: secretToReconstruct });
        
        // Get the share contract address
        const shareContractAddress = await registryContract.getShareContractAddress(
          secretToReconstruct, 
          shareId
        );
        
        // Create a contract instance for this share
        const shareContract = new ethers.Contract(
          shareContractAddress,
          ShareContractABI.abi,
          signer
        );
        
        // Get the share data
        const shareData = await shareContract.getShareData(account);
        
        // Add to our shares collection with the index
        shares.push({
          data: shareData,
          index: shareId
        });
        
        addDebugLog('debug', `Retrieved share ${shareId}`, { 
          dataLength: shareData.length,
          contractAddress: shareContractAddress
        });
      }
      
      addDebugLog('info', 'All shares retrieved', { count: shares.length });
      setSuccess("Reconstructing secret using Shamir's Secret Sharing...");
      
      // 2. Use ShamirClient to reconstruct the secret
      // Format the shares for the ShamirClient
      const formattedShares = shares.map(share => ({
        shareData: share.data,
        x: share.index
      }));
      
      // Import the ShamirClient module
      const ShamirClient = await import('./ShamirClient').then(module => module.default);
      
      // Reconstruct the encrypted package bytes
      Logger.info('App', 'handleReconstructSecret', 'Applying Shamir reconstruction');
      const reconstructedBytes = ShamirClient.reconstructSecret(formattedShares.map(s => s.shareData));
      
      // 3. Convert reconstructed bytes to the encrypted package
      setSuccess("Reconstructed data, preparing for decryption...");
      
      // The reconstructed bytes should represent the encrypted package in JSON format
      const encryptedPackage = new TextDecoder().decode(reconstructedBytes);
      Logger.debug('App', 'handleReconstructSecret', { 
        encryptedPackageSize: encryptedPackage.length,
        preview: encryptedPackage.substring(0, 100) + '...'
      });
      
      addDebugLog('success', 'Secret reconstructed using Shamir', { 
        packageSize: encryptedPackage.length 
      });
      
      // Store the raw data for debugging
      setLastRawData(encryptedPackage);
      
      // 4. Decrypt using the appropriate method
      Logger.info('App', 'handleReconstructSecret', 'Decrypting data');
      setSuccess("Decrypting reconstructed data...");
      
      let decryptedSecret;
      
      if (encryptionKeys.manualKey && encryptionKeys.privateKey) {
        // Use manual decryption with private key
        Logger.debug('App', 'handleReconstructSecret', 'Using manual key decryption');
        addDebugLog('info', 'Using manual private key for decryption');
        decryptedSecret = await WalletIntegratedEncryption.decryptWithPrivateKey(
          encryptedPackage,
          encryptionKeys.privateKey
        );
      } else {
        // Use wallet for decryption
        Logger.debug('App', 'handleReconstructSecret', 'Using wallet decryption');
        addDebugLog('info', 'Using wallet for decryption');
        decryptedSecret = await WalletIntegratedEncryption.decryptWithWallet(
          encryptedPackage,
          encryptionKeys.walletProvider || provider,
          account
        );
      }
      
      Logger.success('App', 'handleReconstructSecret', 'Secret decrypted successfully');
      addDebugLog('success', 'Secret decrypted successfully', { 
        secretLength: decryptedSecret.length 
      });
      
      setReconstructedSecret(decryptedSecret);
      setSuccess("Secret decrypted successfully!");
      
      // Record access on the blockchain
      try {
        Logger.info('App', 'handleReconstructSecret', 'Recording access on blockchain');
        await registryContract.recordSecretAccess(secretToReconstruct);
        Logger.success('App', 'handleReconstructSecret', 'Access recorded on blockchain');
        addDebugLog('info', 'Access recorded on blockchain');
      } catch (recordError) {
        Logger.warn('App', 'handleReconstructSecret', 'Could not record access on blockchain');
        addDebugLog('warn', 'Could not record access on blockchain', recordError.message);
        console.warn("Could not record access:", recordError);
      }
      
      // Reload user secrets to update UI
      await loadUserSecrets();
      setLoading(false);
    } catch (err) {
      Logger.error('App', 'handleReconstructSecret', err);
      addDebugLog('error', 'Error reconstructing secret', err.message);
      setError(`Error: ${err.message || "Unknown error"}`);
      setLoading(false);
    }
  };
  

  // Load share contract
  const loadShareContract = async () => {
    Logger.trace('App', 'loadShareContract', { 
      hasRegistryContract: !!registryContract,
      selectedSecret,
      selectedShare
    });
    
    if (!registryContract || !selectedSecret || !selectedShare) {
      Logger.debug('App', 'loadShareContract', 'Missing required data, resetting share contract');
      setShareContract(null);
      setShareContractAddress("");
      return;
    }

    try {
      Logger.info('App', 'loadShareContract', `Loading share contract for secret ${selectedSecret}, share ${selectedShare}`);
      const address = await registryContract.getShareContractAddress(
        selectedSecret,
        selectedShare
      );
      Logger.debug('App', 'loadShareContract', { shareContractAddress: address });
      setShareContractAddress(address);

      if (address && ethers.utils.isAddress(address)) {
        Logger.debug('App', 'loadShareContract', 'Creating contract instance');
        const contract = new ethers.Contract(
          address,
          ShareContractABI.abi,
          signer
        );
        setShareContract(contract);
        Logger.success('App', 'loadShareContract', 'Share contract loaded successfully');
      } else {
        Logger.warn('App', 'loadShareContract', 'Invalid or empty share contract address');
        setShareContract(null);
      }
    } catch (err) {
      Logger.error('App', 'loadShareContract', err);
      setError(
        "Error loading share contract: " + (err.message || "Unknown error")
      );
      setShareContract(null);
    }
  };

  // Effect to load share contract when selection changes
  useEffect(() => {
    Logger.info('App', 'useEffect', 'Share contract loader setup');
    loadShareContract();
  }, [selectedSecret, selectedShare, registryContract, signer]);

  // Grant access to a user
  const handleGrantAccess = async (e) => {
    e.preventDefault();
    Logger.trace('App', 'handleGrantAccess', { 
      hasShareContract: !!shareContract,
      userToGrant,
      isValidAddress: userToGrant && ethers.utils.isAddress(userToGrant)
    });

    if (!shareContract) {
      Logger.error('App', 'handleGrantAccess', 'Share contract not loaded');
      setError("Share contract not loaded");
      return;
    }

    if (!userToGrant || !ethers.utils.isAddress(userToGrant)) {
      Logger.warn('App', 'handleGrantAccess', 'Invalid address provided');
      setError("Please enter a valid address");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      Logger.info('App', 'handleGrantAccess', `Granting access to ${userToGrant}`);
      const tx = await shareContract.grantAccess(userToGrant);
      Logger.debug('App', 'handleGrantAccess', { transactionHash: tx.hash });
      
      await tx.wait();
      Logger.success('App', 'handleGrantAccess', 'Access granted successfully');

      setSuccess(`Access granted to ${userToGrant}`);
      setUserToGrant("");
      setLoading(false);
    } catch (err) {
      Logger.error('App', 'handleGrantAccess', err);
      setError("Error granting access: " + (err.message || "Unknown error"));
      setLoading(false);
    }
  };

  // Revoke access from a user
  const handleRevokeAccess = async (e) => {
    e.preventDefault();
    Logger.trace('App', 'handleRevokeAccess', { 
      hasShareContract: !!shareContract,
      userToRevoke,
      isValidAddress: userToRevoke && ethers.utils.isAddress(userToRevoke)
    });

    if (!shareContract) {
      Logger.error('App', 'handleRevokeAccess', 'Share contract not loaded');
      setError("Share contract not loaded");
      return;
    }

    if (!userToRevoke || !ethers.utils.isAddress(userToRevoke)) {
      Logger.warn('App', 'handleRevokeAccess', 'Invalid address provided');
      setError("Please enter a valid address");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      Logger.info('App', 'handleRevokeAccess', `Revoking access from ${userToRevoke}`);
      const tx = await shareContract.revokeAccess(userToRevoke);
      Logger.debug('App', 'handleRevokeAccess', { transactionHash: tx.hash });
      
      await tx.wait();
      Logger.success('App', 'handleRevokeAccess', 'Access revoked successfully');

      setSuccess(`Access revoked from ${userToRevoke}`);
      setUserToRevoke("");
      setLoading(false);
    } catch (err) {
      Logger.error('App', 'handleRevokeAccess', err);
      setError("Error revoking access: " + (err.message || "Unknown error"));
      setLoading(false);
    }
  };

  // Transfer ownership to a user
  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    Logger.trace('App', 'handleTransferOwnership', { 
      hasShareContract: !!shareContract,
      userToTransfer,
      isValidAddress: userToTransfer && ethers.utils.isAddress(userToTransfer)
    });

    if (!shareContract) {
      Logger.error('App', 'handleTransferOwnership', 'Share contract not loaded');
      setError("Share contract not loaded");
      return;
    }

    if (!userToTransfer || !ethers.utils.isAddress(userToTransfer)) {
      Logger.warn('App', 'handleTransferOwnership', 'Invalid address provided');
      setError("Please enter a valid address");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      Logger.info('App', 'handleTransferOwnership', `Transferring ownership to ${userToTransfer}`);
      const tx = await shareContract.transferOwnership(userToTransfer);
      Logger.debug('App', 'handleTransferOwnership', { transactionHash: tx.hash });
      
      await tx.wait();
      Logger.success('App', 'handleTransferOwnership', 'Ownership transferred successfully');

      setSuccess(`Ownership transferred to ${userToTransfer}`);
      setUserToTransfer("");

      // Reload user secrets after transfer
      await loadUserSecrets();
      setLoading(false);
    } catch (err) {
      Logger.error('App', 'handleTransferOwnership', err);
      setError(
        "Error transferring ownership: " + (err.message || "Unknown error")
      );
      setLoading(false);
    }
  };

  // Debug handler for secret reconstruction
  const handleDebugReconstruction = async () => {
    if (!secretToReconstruct) {
      addDebugLog('error', 'No secret selected for debugging');
      return;
    }
    
    const relevantShareIds = sharesToUse
      .filter((s) => s.secretId === secretToReconstruct)
      .map((s) => parseInt(s.shareId));
    
    if (relevantShareIds.length === 0) {
      addDebugLog('error', 'No shares selected for debugging');
      return;
    }
    
    addDebugLog('info', 'Starting debug reconstruction', {
      secretId: secretToReconstruct,
      shares: relevantShareIds
    });
    
    try {
      const result = await examineReconstructedData(secretToReconstruct, relevantShareIds);
      addDebugLog('success', 'Debug reconstruction complete', result);
    } catch (err) {
      addDebugLog('error', 'Debug reconstruction failed', err.message);
    }
  };

  // Debug logState
  const logState = () => {
    const state = {
      account,
      isLoggedIn,
      loginMethod,
      registryAddress,
      hasRegistryContract: !!registryContract,
      secretsCount: mySecrets.length,
      userKeys,
      encryptionKeys: {
        hasPublicKey: !!encryptionKeys.publicKey,
        hasPrivateKey: !!encryptionKeys.privateKey,
        isManualKey: encryptionKeys.manualKey,
        hasWalletProvider: !!encryptionKeys.walletProvider
      }
    };
    
    Logger.debug('App', 'state', state);
    addDebugLog('debug', 'Application State', state);
    return state;
  };

  return (
    <div className="app-container">
      <h1>Shamir Secret Sharing System</h1>

      {/* Debug and Tool Toggle Buttons */}
      <div className="debug-toggles" style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 9999 }}>
        <button
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          style={{
            backgroundColor: showDebugPanel ? '#d32f2f' : '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            marginRight: '10px',
            cursor: 'pointer'
          }}
        >
          {showDebugPanel ? 'Hide Debug Panel' : 'Show Debug Panel'}
        </button>
        
        <button
          onClick={() => setShowDebugTools(!showDebugTools)}
          style={{
            backgroundColor: showDebugTools ? '#d32f2f' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer'
          }}
        >
          {showDebugTools ? 'Hide Debug Tools' : 'Show Debug Tools'}
        </button>
      </div>

      {/* Debug Panel */}
      {showDebugPanel && (
        <DebugPanel 
          logs={debugLogs}
          addLog={addDebugLog}
          logState={logState}
          rawData={lastRawData}
          secretId={secretToReconstruct}
          selectedShares={sharesToUse.filter(s => s.secretId === secretToReconstruct)}
          onDebugReconstruction={handleDebugReconstruction}
          provider={provider}
          signer={signer}
          registryContract={registryContract}
          account={account}
          encryptionKeys={encryptionKeys}
        />
      )}

      {!isLoggedIn ? (
        <div className="login-container">
          <h2>Connect to Blockchain</h2>
          <p>Choose how you want to connect to the blockchain.</p>

          <div className="login-options">
            <button
              onClick={loginWithWeb3Auth}
              disabled={loading || !web3auth}
              className="login-btn web3auth-btn"
            >
              Login with Social Account
            </button>

            <div className="login-divider">OR</div>

            <button
              onClick={initMetaMask}
              disabled={loading}
              className="login-btn metamask-btn"
            >
              Connect with MetaMask
            </button>
          </div>

          {loading && (
            <div className="loading-message">Connecting to blockchain...</div>
          )}
          {error && <div className="error-message">{error}</div>}
        </div>
      ) : (
        <>
          <div className="connection-info">
            <div className="user-info">
              {userInfo && loginMethod === "web3auth" ? (
                <div className="user-profile">
                  {userInfo.profileImage && (
                    <img
                      src={userInfo.profileImage}
                      alt="Profile"
                      className="profile-image"
                    />
                  )}
                  <div className="user-details">
                    <p className="user-name">
                      Welcome, {userInfo.name || "User"}
                    </p>
                    <p className="wallet-address">
                      Wallet:{" "}
                      {account
                        ? `${account.substring(0, 6)}...${account.substring(
                            account.length - 4
                          )}`
                        : "Loading wallet..."}
                      <button
                        className="copy-address-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(account);
                          setSuccess("Address copied to clipboard!");
                          Logger.debug('App', 'copyAddress', 'Address copied to clipboard');
                        }}
                        title="Copy full address"
                      >
                        Copy
                      </button>
                    </p>
                    {walletBalance && (
                      <p className="wallet-balance">
                        Balance:{" "}
                        <span className="balance-amount">{walletBalance}</span>
                        <span className="ticker-symbol">{chainInfo.ticker}</span>
                        <button
                          className="refresh-balance-btn"
                          onClick={fetchWalletBalance}
                          title="Refresh balance"
                        >
                          ↻
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="wallet-info">
                  <div className="wallet-details">
                    <p>
                      Connected Account:
                      <span className="wallet-address">
                        {account
                          ? `${account.substring(0, 6)}...${account.substring(
                              account.length - 4
                            )}`
                          : "Not connected"}
                      </span>
                      {account && (
                        <button
                          className="copy-address-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(account);
                            setSuccess("Address copied to clipboard!");
                            Logger.debug('App', 'copyAddress', 'Address copied to clipboard');
                          }}
                          title="Copy full address"
                        >
                          Copy
                        </button>
                      )}
                    </p>
                    {walletBalance && (
                      <p className="wallet-balance">
                        Balance:{" "}
                        <span className="balance-amount">{walletBalance}</span>
                        <span className="ticker-symbol">{chainInfo}</span>
                        <button
                          className="refresh-balance-btn"
                          onClick={fetchWalletBalance}
                          title="Refresh balance"
                        >
                          ↻
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              )}
              <button onClick={logout} className="logout-btn">
                Logout
              </button>
            </div>

            <div className="registry-connect">
              <input
                type="text"
                placeholder="Registry Contract Address"
                value={registryAddress}
                onChange={(e) => {
                  setRegistryAddress(e.target.value);
                  Logger.debug('App', 'registryAddressChange', e.target.value);
                }}
              />
              <button
                onClick={loadUserSecrets}
                disabled={
                  !signer ||
                  !registryAddress ||
                  !ethers.utils.isAddress(registryAddress)
                }
              >
                Connect & Load Secrets
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          {loading && <div className="loading-message">Loading...</div>}

          {/* Debug Tools Section */}
          {showDebugTools && (
            <div className="debug-tools-container" style={{ marginBottom: '30px' }}>
              <h2>Debugging Tools</h2>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <button onClick={logState}>Log App State to Console</button>
                <button onClick={handleDebugReconstruction} disabled={!secretToReconstruct}>
                  Debug Selected Secret
                </button>
              </div>
              
              <ShamirBlockchainTester 
                provider={provider}
                signer={signer}
                registryContract={registryContract}
                addLog={addDebugLog}
              />
              
              <DirectReconstruction
                provider={provider}
                signer={signer}
                registryContract={registryContract}
                addLog={addDebugLog}
              />
              
              {/* Add the ShamirVisualization component here */}
              <details>
                <summary style={{
                  cursor: 'pointer',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}>
                  Educational: Shamir's Secret Sharing Visualization
                </summary>
                <ShamirVisualization />
              </details>
            </div>
          )}

          {/* Key Management Section */}
          <div className="app-section">
            <h2>Encryption Keys</h2>
            <p>Encryption keys are needed to secure your secrets before storing them on the blockchain.</p>
            <WalletKeyManagement 
              provider={provider} 
              web3auth={web3auth} 
              account={account}
              loginMethod={loginMethod}
              onKeyRetrieved={handleKeyRetrieved}
            />
          </div>

          <div className="app-sections">
            {/* Create Secret Section */}
            <div className="app-section">
              <h2>Split a New Secret</h2>
              <form onSubmit={handleSplitSecret}>
                <div className="form-group">
                  <label>Secret:</label>
                  <textarea
                    value={secret}
                    onChange={(e) => {
                      setSecret(e.target.value);
                      Logger.debug('App', 'secretChange', { length: e.target.value.length });
                    }}
                    placeholder="Enter your secret text here"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Number of Parts:</label>
                  <input
                    type="number"
                    min="2"
                    value={parts}
                    onChange={(e) => {
                      setParts(e.target.value);
                      Logger.debug('App', 'partsChange', { value: e.target.value });
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Threshold:</label>
                  <input
                    type="number"
                    min="2"
                    max={parts}
                    value={threshold}
                    onChange={(e) => {
                      setThreshold(e.target.value);
                      Logger.debug('App', 'thresholdChange', { value: e.target.value });
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description:</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      Logger.debug('App', 'descriptionChange', { length: e.target.value.length });
                    }}
                    placeholder="Optional description"
                  />
                </div>

                <div className="form-group">
                  <label>
                    Share Recipients (Each address will receive an encrypted share):
                  </label>
                  {ownerAddresses.map((address, index) => (
                    <div key={index} className="owner-input">
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => updateOwnerAddress(index, e.target.value)}
                        placeholder="0x... (recipient address)"
                        disabled={loading}
                      />
                      <input
                        type="text"
                        value={recipientPublicKeys[index] || ''}
                        onChange={(e) => updateRecipientPublicKey(index, e.target.value)}
                        placeholder="Recipient's public key"
                        disabled={loading}
                        className="public-key-input"
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeOwnerAddress(index)}
                          className="remove-btn"
                          disabled={loading}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}

                  {ownerAddresses.length < parts && (
                    <button
                      type="button"
                      onClick={addOwnerAddress}
                      className="add-btn"
                      disabled={loading}
                    >
                      Add Recipient
                    </button>
                  )}
                </div>

                <div className="security-info">
                  <h4>How Your Data Is Protected:</h4>
                  <ul>
                    <li>Your secret is encrypted with recipient public keys</li>
                    <li>Only encrypted data is stored on the blockchain</li>
                    <li>A unique ephemeral key is generated for each encryption</li>
                    <li>Only intended recipients can decrypt the secret</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={
                    !registryContract || 
                    loading || 
                    !userKeys.publicKey ||
                    !userKeys.privateKey
                  }
                  className="submit-btn"
                >
                  {loading ? "Processing..." : "Split Secret"}
                </button>
                
                {/* Debug info for disabled button state */}
                {(!registryContract || !userKeys.publicKey || !userKeys.privateKey) && (
                  <div style={{color: '#888', fontSize: '12px', marginTop: '5px'}}>
                    Button disabled because: 
                    {!registryContract && " No registry contract connected."}
                    {!userKeys.publicKey && " No public key available."}
                    {!userKeys.privateKey && " No private key available."}
                  </div>
                )}
              </form>
            </div>

            {/* My Secrets Section */}
            <div className="app-section">
              <h2>My Secrets</h2>

              {mySecrets.length === 0 ? (
                <p>You don't have any secrets yet.</p>
              ) : (
                <div className="secrets-list">
                  {mySecrets.map((secretId) => (
                    <div key={secretId} className="secret-item">
                      <h3>Secret ID: {secretId}</h3>

                      {secretDetails[secretId] ? (
                        <div className="secret-details">
                          <p>
                            <strong>Description:</strong>{" "}
                            {secretDetails[secretId].description ||
                              "No description"}
                          </p>
                          <p>
                            <strong>Parts:</strong>{" "}
                            {secretDetails[secretId].parts} /{" "}
                            <strong>Threshold:</strong>{" "}
                            {secretDetails[secretId].threshold}
                          </p>
                          <p>
                            <strong>Created:</strong>{" "}
                            {secretDetails[secretId].timestamp}
                          </p>
                          <p>
                            <strong>Last Access:</strong>{" "}
                            {secretDetails[secretId].lastAccess}
                          </p>
                          <p>
                            <strong>Access Count:</strong>{" "}
                            {secretDetails[secretId].accessCount}
                          </p>
                          <p>
                            <strong>Size:</strong>{" "}
                            {secretDetails[secretId].dataSize} bytes
                          </p>

                          <div className="my-shares">
                            <p>
                              <strong>My Shares:</strong>
                            </p>
                            {myShares[secretId] &&
                            myShares[secretId].length > 0 ? (
                              <ul>
                                {myShares[secretId].map((shareId) => (
                                  <li key={shareId}>
                                    Share {shareId}
                                    <input
                                      type="checkbox"
                                      checked={isShareSelected(
                                        secretId,
                                        shareId
                                      )}
                                      onChange={() => {
                                        toggleShareSelection(secretId, shareId);
                                        Logger.debug('App', 'shareSelectionToggle', {
                                          secretId,
                                          shareId,
                                          selected: !isShareSelected(secretId, shareId)
                                        });
                                      }}
                                    />
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>You don't own any shares for this secret.</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p>Loading details...</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reconstruct Secret Section with Improved UI */}
            <div className="app-section">
              <h2>Reconstruct a Secret</h2>

              <form onSubmit={handleReconstructSecret}>
                <div className="form-group">
                  <label>Select Secret to Reconstruct:</label>
                  <select
                    value={secretToReconstruct}
                    onChange={(e) => {
                      setSecretToReconstruct(e.target.value);
                      Logger.debug('App', 'secretToReconstructChange', { value: e.target.value });
                      // Clear previous reconstruction results when changing secrets
                      setReconstructedSecret("");
                    }}
                    required
                  >
                    <option value="">-- Select a Secret --</option>
                    {mySecrets.map((secretId) => (
                      <option key={secretId} value={secretId}>
                        Secret {secretId}{" "}
                        {secretDetails[secretId]?.description
                          ? `(${secretDetails[secretId].description})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {secretToReconstruct && (
                  <div className="form-group">
                    <label>Selected Shares:</label>
                    <div className="selected-shares-info">
                      <div className="share-count-indicator">
                        <div
                          className={`share-progress ${
                            sharesToUse.filter(
                              (s) => s.secretId === secretToReconstruct
                            ).length >=
                            (secretDetails[secretToReconstruct]?.threshold ||
                              Infinity)
                              ? "sufficient"
                              : "insufficient"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (sharesToUse.filter(
                                (s) => s.secretId === secretToReconstruct
                              ).length /
                                (secretDetails[secretToReconstruct]
                                  ?.threshold || 1)) *
                                100
                            )}%`,
                          }}
                        ></div>
                        <p>
                          <strong>
                            {
                              sharesToUse.filter(
                                (s) => s.secretId === secretToReconstruct
                              ).length
                            }
                          </strong>{" "}
                          of{" "}
                          <strong>
                            {secretDetails[secretToReconstruct]?.threshold ||
                              "?"}
                          </strong>{" "}
                          required shares selected
                        </p>
                      </div>

                      {/* Show list of selected shares */}
                      {sharesToUse.filter(
                        (s) => s.secretId === secretToReconstruct
                      ).length > 0 ? (
                        <div className="selected-shares-list">
                          <p>
                            Using shares:{" "}
                            {sharesToUse
                              .filter((s) => s.secretId === secretToReconstruct)
                              .map((s) => s.shareId)
                              .join(", ")}
                          </p>
                          
                          {/* Debug button */}
                          {showDebugTools && (
                            <button 
                              type="button" 
                              onClick={handleDebugReconstruction}
                              className="debug-btn"
                              style={{
                                marginTop: '10px',
                                backgroundColor: '#ff5722',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '5px 10px',
                                fontSize: '12px'
                              }}
                            >
                              Debug Reconstruct
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="share-selection-hint">
                          Please select shares from the My Secrets section by
                          checking the boxes next to each share
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="reconstruction-progress">
                    <div className="progress-spinner"></div>
                    <p>{success || "Processing..."}</p>
                  </div>
                )}

                <div className="security-info">
                  <h4>Decryption Security:</h4>
                  <ul>
                    <li>Reconstruction requires your private key for decryption</li>
                    <li>The original secret will only be visible to you</li>
                    <li>All decryption happens locally in your browser</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={
                    !registryContract ||
                    loading ||
                    !secretToReconstruct ||
                    !userKeys.privateKey ||
                    sharesToUse.filter(
                      (s) => s.secretId === secretToReconstruct
                    ).length <
                      (secretDetails[secretToReconstruct]?.threshold ||
                        Infinity)
                  }
                  className="submit-btn"
                >
                  {loading ? "Processing..." : "Reconstruct Secret"}
                </button>
                
                {/* Debug info for disabled reconstruction button */}
                {(!registryContract || !secretToReconstruct || !userKeys.privateKey || 
                  sharesToUse.filter(s => s.secretId === secretToReconstruct).length <
                  (secretDetails[secretToReconstruct]?.threshold || Infinity)) && (
                  <div style={{color: '#888', fontSize: '12px', marginTop: '5px'}}>
                    Button disabled because: 
                    {!registryContract && " No registry contract connected."}
                    {!secretToReconstruct && " No secret selected."}
                    {!userKeys.privateKey && " No private key available."}
                    {secretToReconstruct && 
                      sharesToUse.filter(s => s.secretId === secretToReconstruct).length <
                      (secretDetails[secretToReconstruct]?.threshold || Infinity) && 
                      " Not enough shares selected."}
                  </div>
                )}
              </form>

              {reconstructedSecret && (
                <div className="reconstructed-result">
                  <h3>Reconstructed Secret:</h3>
                  <div className="secret-value">{reconstructedSecret}</div>
                  <button
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(reconstructedSecret);
                      setSuccess("Secret copied to clipboard!");
                      Logger.debug('App', 'copySecret', 'Secret copied to clipboard');
                    }}
                  >
                    Copy to Clipboard
                  </button>
                </div>
              )}
            </div>

            {/* Share Management Section */}
            <div className="app-section">
              <h2>Manage Share Access</h2>

              <div className="share-selector">
                <div className="form-group">
                  <label>Select Secret:</label>
                  <select
                    value={selectedSecret}
                    onChange={(e) => {
                      setSelectedSecret(e.target.value);
                      Logger.debug('App', 'selectedSecretChange', { value: e.target.value });
                    }}
                  >
                    <option value="">-- Select a Secret --</option>
                    {mySecrets.map((secretId) => (
                      <option key={secretId} value={secretId}>
                        Secret {secretId}{" "}
                        {secretDetails[secretId]?.description
                          ? `(${secretDetails[secretId].description})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSecret &&
                  myShares[selectedSecret] &&
                  myShares[selectedSecret].length > 0 && (
                    <div className="form-group">
                      <label>Select Share:</label>
                      <select
                        value={selectedShare}
                        onChange={(e) => {
                          setSelectedShare(e.target.value);
                          Logger.debug('App', 'selectedShareChange', { value: e.target.value });
                        }}
                      >
                        <option value="">-- Select a Share --</option>
                        {myShares[selectedSecret].map((shareId) => (
                          <option key={shareId} value={shareId}>
                            Share {shareId}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
              </div>

              {shareContractAddress && (
                <div className="share-contract-info">
                  <p>
                    <strong>Share Contract Address:</strong>{" "}
                    {shareContractAddress}
                  </p>
                </div>
              )}

              {shareContract && (
                <div className="share-management">
                  <div className="share-action">
                    <h3>Grant Access</h3>
                    <form onSubmit={handleGrantAccess}>
                      <div className="form-group">
                        <input
                          type="text"
                          value={userToGrant}
                          onChange={(e) => {
                            setUserToGrant(e.target.value);
                            Logger.debug('App', 'userToGrantChange', { value: e.target.value });
                          }}
                          placeholder="Address to grant access"
                          required
                        />
                      </div>
                      <p className="note">Note: The user will need the corresponding private key to decrypt.</p>
                      <button
                        type="submit"
                        disabled={loading}
                        className="action-btn"
                      >
                        Grant Access
                      </button>
                    </form>
                  </div>

                  <div className="share-action">
                    <h3>Revoke Access</h3>
                    <form onSubmit={handleRevokeAccess}>
                      <div className="form-group">
                        <input
                          type="text"
                          value={userToRevoke}
                          onChange={(e) => {
                            setUserToRevoke(e.target.value);
                            Logger.debug('App', 'userToRevokeChange', { value: e.target.value });
                          }}
                          placeholder="Address to revoke access"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="action-btn"
                      >
                        Revoke Access
                      </button>
                    </form>
                  </div>

                  <div className="share-action">
                    <h3>Transfer Ownership</h3>
                    <form onSubmit={handleTransferOwnership}>
                      <div className="form-group">
                        <input
                          type="text"
                          value={userToTransfer}
                          onChange={(e) => {
                            setUserToTransfer(e.target.value);
                            Logger.debug('App', 'userToTransferChange', { value: e.target.value });
                          }}
                          placeholder="Address to transfer to"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="action-btn"
                      >
                        Transfer Ownership
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;