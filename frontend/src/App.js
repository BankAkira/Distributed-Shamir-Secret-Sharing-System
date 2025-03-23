import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import "./App.css";
import RegistryABI from "./abis/OptimizedShamirRegistry.json";
import ShareContractABI from "./abis/ShareContract.json";
// import ShamirClient from "./ShamirClient";
import WalletIntegratedEncryption from "./WalletIntegratedEncryption";
import WalletKeyManagement from "./WalletKeyManagement";


// Polyfill imports
import "buffer";
import process from "process";

// Web3Auth imports
import { Web3Auth } from "@web3auth/modal";
import { WEB3AUTH_NETWORK, CHAIN_NAMESPACES } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

window.Buffer = window.Buffer || require("buffer").Buffer;
window.process = process;

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
    ticker: 'tKUB',
    name: 'BitKub Testnet'
  });

  const [encryptionKeys, setEncryptionKeys] = useState({
    publicKey: '',
    privateKey: '',
    walletProvider: null,
    isMetaMask: false,
    manualKey: false
  });

  // this function to handle key retrieval
  const handleKeyRetrieved = (keys) => {
    setEncryptionKeys(keys);
  };

  const fetchWalletBalance = async () => {
    if (!provider || !account) return;

    try {
      // Get the balance in wei
      const balance = await provider.getBalance(account);

      // Convert to ether units (or the appropriate denomination for your chain)
      const formattedBalance = ethers.utils.formatEther(balance);

      // Round to a reasonable number of decimal places (e.g., 4)
      const roundedBalance = parseFloat(formattedBalance).toFixed(4);

      setWalletBalance(roundedBalance);
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      setWalletBalance("Error");
    }
  };

  useEffect(() => {
    fetchWalletBalance();

    // Set up polling to update balance periodically (every 30 seconds)
    const intervalId = setInterval(() => {
      fetchWalletBalance();
    }, 30000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [account, provider]);

  // Initialize Web3Auth
  useEffect(() => {
    const initWeb3Auth = async () => {
      try {
        // Configure the chain configs that you want to support
        const chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: "0x6545", // hex of 25925
          rpcTarget: "https://rpc-testnet.bitkubchain.io",
          // Avoid using public rpcTarget in production.
          // Use services like Infura, Quicknode etc
          displayName: "BitKub Testnet",
          blockExplorer: "https://testnet.bkcscan.com",
          ticker: "tKUB",
          tickerName: "tKUB",
          logo: "https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/151011411910/original/BLLsZXQuCMERrt1iuNKKz3-ebSbLflZ1qQ.png",
        };
        
        setChainInfo({
          ticker: chainConfig.ticker || 'ETH',
          name: chainConfig.displayName || 'Ethereum'
        });

        // Create and configure the Ethereum Provider with the SAME chainConfig
        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig: chainConfig },
        });

        // Create Web3Auth instance first
        const web3auth = new Web3Auth({
          clientId:
            "BJyzYMhrixp0WEMr2rQjpk_4tOejiKq2pO6yAn5lqhHJ0ZLHAT8paV4kcPjii5g8G2BL49KRVC2fhASGQSESt5I",
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          chainConfig: chainConfig, // This sets the default chain config
          privateKeyProvider,
        });

        // Initialize Web3Auth
        await web3auth.initModal();
        setWeb3auth(web3auth);

        // Check if already logged in
        if (web3auth.connected) {
          setIsLoggedIn(true);
          const userInfo = await web3auth.getUserInfo();
          setUserInfo(userInfo);
          setupWeb3Provider(web3auth);
        }
      } catch (error) {
        console.error("Error initializing Web3Auth:", error);
        setError(
          "Failed to initialize Web3Auth. Please try again or use MetaMask instead."
        );
      }
    };

    initWeb3Auth();
  }, []);

  // Set up Web3 provider using Web3Auth
  const setupWeb3Provider = async (web3authInstance) => {
    try {
      const web3Provider = new ethers.providers.Web3Provider(
        web3authInstance.provider
      );
      setProvider(web3Provider);

      const accounts = await web3Provider.listAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const web3Signer = web3Provider.getSigner();
        setSigner(web3Signer);
      } else {
        setError("No accounts found with Web3Auth provider");
      }
    } catch (error) {
      console.error("Error setting up Web3 provider:", error);
      setError("Error setting up blockchain connection with Web3Auth");
    }
  };

  // Initialize blockchain connection with MetaMask
  const initMetaMask = async () => {
    try {
      if (window.ethereum) {
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(web3Provider);

        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts[0]);

        const web3Signer = web3Provider.getSigner();
        setSigner(web3Signer);

        // Listen for account changes
        window.ethereum.on("accountsChanged", (accounts) => {
          setAccount(accounts[0]);
          loadUserSecrets();
        });

        setLoginMethod("metamask");
        setIsLoggedIn(true);
      } else {
        setError("Please install MetaMask to use this option");
      }
    } catch (err) {
      console.error("Error initializing MetaMask connection:", err);
      setError(
        "Error connecting to MetaMask. Please make sure you have MetaMask installed and connected."
      );
    }
  };

  // Login with Web3Auth
  const loginWithWeb3Auth = async () => {
    if (!web3auth) {
      setError("Web3Auth is not initialized yet");
      return;
    }

    try {
      setLoading(true);
      const web3authProvider = await web3auth.connect();
      setIsLoggedIn(true);

      // Get user info
      const userInfo = await web3auth.getUserInfo();
      setUserInfo(userInfo);

      // Set up provider and signer
      await setupWeb3Provider(web3auth);
      fetchWalletBalance();
      setLoginMethod("web3auth");
      setLoading(false);
      setSuccess("Successfully logged in with Web3Auth!");
    } catch (error) {
      console.error("Error during Web3Auth login:", error);
      setError("Login failed. Please try again.");
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setLoading(true);

      if (loginMethod === "web3auth" && web3auth) {
        await web3auth.logout();
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

      setWalletBalance("");
      setLoading(false);
      setSuccess("Successfully logged out");
    } catch (error) {
      console.error("Error during logout:", error);
      setError("Logout failed. Please try again.");
      setLoading(false);
    }
  };

  // Connect to registry contract when address changes
  useEffect(() => {
    const connectToRegistry = async () => {
      if (
        signer &&
        registryAddress &&
        ethers.utils.isAddress(registryAddress)
      ) {
        try {
          const contract = new ethers.Contract(
            registryAddress,
            RegistryABI.abi,
            signer
          );
          setRegistryContract(contract);
          setError("");
          await loadUserSecrets();
        } catch (err) {
          console.error("Error connecting to registry contract:", err);
          setError(
            "Error connecting to registry contract. Please check the address."
          );
          setRegistryContract(null);
        }
      }
    };

    connectToRegistry();
  }, [signer, registryAddress]);

  // Load user secrets when registry contract changes
  const loadUserSecrets = async () => {
    if (!registryContract) return;

    try {
      setLoading(true);
      const secrets = await registryContract.getMySecrets();
      setMySecrets(secrets.map((s) => s.toString()));

      // Clear previous details
      setSecretDetails({});
      setMyShares({});

      // Load details for each secret
      const detailsPromises = secrets.map(async (secretId) => {
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

      const sharesPromises = secrets.map(async (secretId) => {
        const shares = await registryContract.getMySharesForSecret(secretId);
        return {
          secretId: secretId.toString(),
          shares: shares.map((s) => s.toString()),
        };
      });

      const detailsResults = await Promise.all(detailsPromises);
      const sharesResults = await Promise.all(sharesPromises);

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
    } catch (err) {
      console.error("Error loading user secrets:", err);
      setError("Error loading your secrets. Please try again.");
      setLoading(false);
    }
  };

  // Add owner address field
  const addOwnerAddress = () => {
    setOwnerAddresses([...ownerAddresses, ""]);
    setRecipientPublicKeys([...recipientPublicKeys, ""]);
  };

  // Remove owner address field
  const removeOwnerAddress = (index) => {
    const newAddresses = [...ownerAddresses];
    newAddresses.splice(index, 1);
    setOwnerAddresses(newAddresses);
    
    const newKeys = [...recipientPublicKeys];
    newKeys.splice(index, 1);
    setRecipientPublicKeys(newKeys);
  };

  // Update owner address
  const updateOwnerAddress = (index, value) => {
    const newAddresses = [...ownerAddresses];
    newAddresses[index] = value;
    setOwnerAddresses(newAddresses);
  };

  // Update recipient public key
  const updateRecipientPublicKey = (index, value) => {
    const newKeys = [...recipientPublicKeys];
    newKeys[index] = value;
    setRecipientPublicKeys(newKeys);
  };

  // Split and deploy a secret with encryption
  const handleSplitSecret = async (e) => {
    e.preventDefault();
  
    if (!registryContract) {
      setError("Registry contract not connected");
      return;
    }
  
    if (!secret) {
      setError("Please enter a secret");
      return;
    }
  
    if (!encryptionKeys.publicKey) {
      setError("Please retrieve or generate encryption keys first");
      return;
    }
  
    // Validate parts and threshold
    if (parts < 2) {
      setError("Parts must be at least 2");
      return;
    }
  
    if (threshold < 2 || threshold > parts) {
      setError("Threshold must be at least 2 and not greater than parts");
      return;
    }
  
    // Filter out empty owner addresses
    const filteredOwners = ownerAddresses.filter(
      (addr) => addr && ethers.utils.isAddress(addr)
    );
  
    // If we have some owners but not enough, validate
    if (filteredOwners.length > 0 && filteredOwners.length !== parseInt(parts)) {
      setError(`You must specify exactly ${parts} owners or none (default to caller)`);
      return;
    }
  
    try {
      setLoading(true);
      setError("");
      setSuccess("");
  
      // Encrypt the secret first - this is the critical security step!
      setSuccess("Encrypting your secret before sending to blockchain...");
      
      // For simplicity, we'll use the same key for all parts
      // In a more sophisticated implementation, you'd encrypt differently for each recipient
      const recipientKeys = [encryptionKeys.publicKey];
      
      const encryptedPackage = await WalletIntegratedEncryption.encryptForRecipients(
        secret,
        recipientKeys
      );
      
      // Convert to hex format for blockchain
      const encryptedHex = WalletIntegratedEncryption.toHex(encryptedPackage);
      
      // Convert the hex string to bytes for the contract
      const encryptedBytes = ethers.utils.arrayify(encryptedHex);
  
      // Call the contract with the encrypted data
      setSuccess("Sending encrypted secret to blockchain...");
      let tx;
      if (filteredOwners.length === parseInt(parts)) {
        tx = await registryContract.splitAndDeploy(
          encryptedBytes,
          parts,
          threshold,
          description,
          filteredOwners
        );
      } else {
        tx = await registryContract.splitAndDeploy(
          encryptedBytes,
          parts,
          threshold,
          description,
          []
        );
      }
  
      setSuccess("Transaction submitted, waiting for confirmation...");
      await tx.wait();
  
      setSuccess("Success! Your secret is now encrypted and stored on the blockchain.");
  
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
      console.error("Error splitting secret:", err);
      setError("Error splitting secret: " + (err.message || "Unknown error"));
      setLoading(false);
    }
  };

  // Toggle share selection for reconstruction
  const toggleShareSelection = (secretId, shareId) => {
    const newSharesToUse = [...sharesToUse];
    const index = newSharesToUse.findIndex(
      (s) => s.secretId === secretId && s.shareId === shareId
    );

    if (index >= 0) {
      newSharesToUse.splice(index, 1);
    } else {
      newSharesToUse.push({ secretId, shareId });
    }

    setSharesToUse(newSharesToUse);
  };

  // Check if share is selected
  const isShareSelected = (secretId, shareId) => {
    return sharesToUse.some(
      (s) => s.secretId === secretId && s.shareId === shareId
    );
  };

  // Reconstruct secret with decryption
  const handleReconstructSecret = async (e) => {
    e.preventDefault();
  
    if (!secretToReconstruct) {
      setError("Please select a secret to reconstruct");
      return;
    }
  
    // Check for decryption capability
    if (!encryptionKeys.publicKey) {
      setError("Encryption keys not available. Please retrieve your wallet keys or generate browser keys.");
      return;
    }
  
    // Filter shares for the selected secret
    const relevantShareIds = sharesToUse
      .filter((s) => s.secretId === secretToReconstruct)
      .map((s) => parseInt(s.shareId));
  
    // Verify we have enough shares
    const threshold = secretDetails[secretToReconstruct]?.threshold;
    if (relevantShareIds.length < threshold) {
      setError(`You need at least ${threshold} shares to reconstruct this secret (selected: ${relevantShareIds.length})`);
      return;
    }
  
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setReconstructedSecret("");
  
      // Call the contract method to reconstruct the encrypted package
      setSuccess("Retrieving encrypted data from blockchain...");
      const encryptedResult = await registryContract.reconstructSecret(
        secretToReconstruct,
        relevantShareIds
      );
  
      // Convert result to string package
      const encryptedHex = "0x" + Array.from(new Uint8Array(encryptedResult))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
        
      const encryptedPackage = WalletIntegratedEncryption.fromHex(encryptedHex);
  
      // Decrypt using the appropriate method
      setSuccess("Decrypting data...");
      let decryptedSecret;
  
      if (encryptionKeys.manualKey && encryptionKeys.privateKey) {
        // Use manual decryption with private key
        decryptedSecret = await WalletIntegratedEncryption.decryptWithPrivateKey(
          encryptedPackage,
          encryptionKeys.privateKey
        );
      } else {
        // Use wallet for decryption
        decryptedSecret = await WalletIntegratedEncryption.decryptWithWallet(
          encryptedPackage,
          encryptionKeys.walletProvider || provider,
          account
        );
      }
      
      setReconstructedSecret(decryptedSecret);
      setSuccess("Secret decrypted successfully!");
  
      // Record access on the blockchain
      try {
        await registryContract.recordSecretAccess(secretToReconstruct);
      } catch (recordError) {
        console.warn("Could not record access:", recordError);
      }
  
      // Reload user secrets to update UI
      await loadUserSecrets();
      setLoading(false);
    } catch (err) {
      console.error("Error reconstructing secret:", err);
      setError(`Error: ${err.message || "Unknown error"}`);
      setLoading(false);
    }
  };
  

  // Load share contract
  const loadShareContract = async () => {
    if (!registryContract || !selectedSecret || !selectedShare) {
      setShareContract(null);
      setShareContractAddress("");
      return;
    }

    try {
      const address = await registryContract.getShareContractAddress(
        selectedSecret,
        selectedShare
      );
      setShareContractAddress(address);

      if (address && ethers.utils.isAddress(address)) {
        const contract = new ethers.Contract(
          address,
          ShareContractABI.abi,
          signer
        );
        setShareContract(contract);
      } else {
        setShareContract(null);
      }
    } catch (err) {
      console.error("Error loading share contract:", err);
      setError(
        "Error loading share contract: " + (err.message || "Unknown error")
      );
      setShareContract(null);
    }
  };

  // Effect to load share contract when selection changes
  useEffect(() => {
    loadShareContract();
  }, [selectedSecret, selectedShare, registryContract, signer]);

  // Grant access to a user
  const handleGrantAccess = async (e) => {
    e.preventDefault();

    if (!shareContract) {
      setError("Share contract not loaded");
      return;
    }

    if (!userToGrant || !ethers.utils.isAddress(userToGrant)) {
      setError("Please enter a valid address");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const tx = await shareContract.grantAccess(userToGrant);
      await tx.wait();

      setSuccess(`Access granted to ${userToGrant}`);
      setUserToGrant("");
      setLoading(false);
    } catch (err) {
      console.error("Error granting access:", err);
      setError("Error granting access: " + (err.message || "Unknown error"));
      setLoading(false);
    }
  };

  // Revoke access from a user
  const handleRevokeAccess = async (e) => {
    e.preventDefault();

    if (!shareContract) {
      setError("Share contract not loaded");
      return;
    }

    if (!userToRevoke || !ethers.utils.isAddress(userToRevoke)) {
      setError("Please enter a valid address");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const tx = await shareContract.revokeAccess(userToRevoke);
      await tx.wait();

      setSuccess(`Access revoked from ${userToRevoke}`);
      setUserToRevoke("");
      setLoading(false);
    } catch (err) {
      console.error("Error revoking access:", err);
      setError("Error revoking access: " + (err.message || "Unknown error"));
      setLoading(false);
    }
  };

  // Transfer ownership to a user
  const handleTransferOwnership = async (e) => {
    e.preventDefault();

    if (!shareContract) {
      setError("Share contract not loaded");
      return;
    }

    if (!userToTransfer || !ethers.utils.isAddress(userToTransfer)) {
      setError("Please enter a valid address");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const tx = await shareContract.transferOwnership(userToTransfer);
      await tx.wait();

      setSuccess(`Ownership transferred to ${userToTransfer}`);
      setUserToTransfer("");

      // Reload user secrets after transfer
      await loadUserSecrets();
      setLoading(false);
    } catch (err) {
      console.error("Error transferring ownership:", err);
      setError(
        "Error transferring ownership: " + (err.message || "Unknown error")
      );
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1>Shamir Secret Sharing System</h1>

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
                        <span className="ticker-symbol">tKUB</span>
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
                        <span className="ticker-symbol">tKUB</span>
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
                onChange={(e) => setRegistryAddress(e.target.value)}
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
                    onChange={(e) => setSecret(e.target.value)}
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
                    onChange={(e) => setParts(e.target.value)}
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
                    onChange={(e) => setThreshold(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description:</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
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
                  Split Secret
                </button>
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
                                      onChange={() =>
                                        toggleShareSelection(secretId, shareId)
                                      }
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
                    onChange={(e) => setSelectedSecret(e.target.value)}
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
                        onChange={(e) => setSelectedShare(e.target.value)}
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
                          onChange={(e) => setUserToGrant(e.target.value)}
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
                          onChange={(e) => setUserToRevoke(e.target.value)}
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
                          onChange={(e) => setUserToTransfer(e.target.value)}
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