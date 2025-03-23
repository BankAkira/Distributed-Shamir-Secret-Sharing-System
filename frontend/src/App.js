import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import "./App.css";
import RegistryABI from "./abis/OptimizedShamirRegistry.json";
import ShareContractABI from "./abis/ShareContract.json";
import ShamirClient from "./ShamirClient";

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

  //ethereum remaining
  const [walletBalance, setWalletBalance] = useState("");

  const [chainInfo, setChainInfo] = useState({
    ticker: 'tKUB',
    name: 'BitKub Testnet'
  });

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

        // Add the provider as a plugin
        // await web3auth.addPlugin(privateKeyProvider);

        // Setup OpenLogin adapter
        // const openloginAdapter = new OpenloginAdapter({
        //   adapterSettings: {
        //     loginConfig: {
        //       google: {
        //         name: "Google Login",
        //         verifier: "ecc-sss-test",
        //       },
        //     },
        //   },
        // });
        // web3auth.configureAdapter(openloginAdapter);

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
  };

  // Remove owner address field
  const removeOwnerAddress = (index) => {
    const newAddresses = [...ownerAddresses];
    newAddresses.splice(index, 1);
    setOwnerAddresses(newAddresses);
  };

  // Update owner address
  const updateOwnerAddress = (index, value) => {
    const newAddresses = [...ownerAddresses];
    newAddresses[index] = value;
    setOwnerAddresses(newAddresses);
  };

  // Split and deploy a secret
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
    if (
      filteredOwners.length > 0 &&
      filteredOwners.length !== parseInt(parts)
    ) {
      setError(
        `You must specify exactly ${parts} owners or none (default to caller)`
      );
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      // Encode the secret as bytes
      const secretBytes = ethers.utils.toUtf8Bytes(secret);

      // Call the contract
      let tx;
      if (filteredOwners.length === parseInt(parts)) {
        tx = await registryContract.splitAndDeploy(
          secretBytes,
          parts,
          threshold,
          description,
          filteredOwners
        );
      } else {
        tx = await registryContract.splitAndDeploy(
          secretBytes,
          parts,
          threshold,
          description,
          []
        );
      }

      await tx.wait();

      setSuccess("Secret split successfully!");

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

  // Modified function to better handle share data from the contract
  const handleReconstructSecret = async (e) => {
    e.preventDefault();

    if (!secretToReconstruct) {
      setError("Please select a secret to reconstruct");
      return;
    }

    // Filter shares for the selected secret
    const relevantShareIds = sharesToUse
      .filter((s) => s.secretId === secretToReconstruct)
      .map((s) => parseInt(s.shareId));

    // Verify we have enough shares
    const threshold = secretDetails[secretToReconstruct]?.threshold;
    if (relevantShareIds.length < threshold) {
      setError(
        `You need at least ${threshold} shares to reconstruct this secret (selected: ${relevantShareIds.length})`
      );
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setReconstructedSecret("");

      // First, log data to help with debugging
      console.log("Secret ID:", secretToReconstruct);
      console.log("Share IDs to use:", relevantShareIds);

      // We need to get the share data from the blockchain
      setSuccess("Fetching share data from contracts...");

      const shareData = [];
      for (const shareId of relevantShareIds) {
        try {
          // Get the share contract address
          const shareContractAddress =
            await registryContract.getShareContractAddress(
              secretToReconstruct,
              shareId
            );

          console.log(`Share ${shareId} contract:`, shareContractAddress);

          // Create a contract instance for this share
          const shareContract = new ethers.Contract(
            shareContractAddress,
            ShareContractABI.abi,
            signer
          );

          // Get the share data
          const data = await shareContract.getShareData(account);
          console.log(`Share ${shareId} data:`, data);

          // Format data correctly for our ShamirClient
          // First convert any ethers BigNumber to a hex string
          let formattedData;
          if (data._hex) {
            // For ethers v5
            formattedData = ethers.utils.arrayify(data);
          } else if (typeof data === "string" && data.startsWith("0x")) {
            // For hex string
            formattedData = ethers.utils.arrayify(data);
          } else {
            // Try our best
            formattedData = data;
          }

          console.log(`Share ${shareId} formatted:`, formattedData);
          shareData.push(formattedData);
        } catch (error) {
          console.error(`Error fetching share ${shareId}:`, error);
          setError(`Failed to fetch share ${shareId}: ${error.message}`);
          setLoading(false);
          return;
        }
      }

      setSuccess("Reconstructing secret locally...");
      console.log("All shares data:", shareData);

      // Perform the reconstruction
      try {
        // Use our client-side implementation to reconstruct the secret
        const secretBytes = ShamirClient.reconstructSecret(shareData);
        console.log("Reconstructed bytes:", secretBytes);

        // Try to decode as UTF-8 text
        const decodedSecret = ShamirClient.bytesToString(secretBytes);
        setReconstructedSecret(decodedSecret);
        setSuccess("Secret reconstructed successfully!");

        // Optionally call the blockchain to update access stats
        try {
          // First check if we can use a dedicated function
          let hasRecordFunction = false;
          try {
            hasRecordFunction =
              typeof registryContract.recordSecretAccess === "function";
          } catch (e) {
            hasRecordFunction = false;
          }

          if (hasRecordFunction) {
            setSuccess("Recording access on blockchain...");
            const tx = await registryContract.recordSecretAccess(
              secretToReconstruct
            );
            await tx.wait();
            setSuccess(
              "Secret reconstructed successfully! Access recorded on blockchain."
            );
          } else {
            // Skip recording stats for now
            setSuccess("Secret reconstructed successfully!");
          }
        } catch (recordError) {
          console.warn("Could not record access:", recordError);
          setSuccess("Secret reconstructed successfully!");
        }
      } catch (reconstructError) {
        console.error("Error in reconstruction:", reconstructError);
        setError(
          `Failed to reconstruct the secret: ${reconstructError.message}`
        );

        // If client-side reconstruction fails, fall back to using the contract
        try {
          setSuccess("Falling back to contract reconstruction...");

          // Call the contract method to reconstruct the secret
          const tx = await registryContract.reconstructSecret(
            secretToReconstruct,
            relevantShareIds
          );
          console.log("Transaction sent:", tx.hash);

          // Wait for the transaction to be mined
          setSuccess("Transaction submitted. Waiting for confirmation...");
          const receipt = await tx.wait();

          if (receipt.status === 1) {
            // Now we need to call the function again to get the actual value
            const result = await registryContract.callStatic.reconstructSecret(
              secretToReconstruct,
              relevantShareIds
            );

            // Decode the result
            try {
              const decodedSecret = ethers.utils.toUtf8String(result);
              setReconstructedSecret(decodedSecret);
              setSuccess("Secret reconstructed successfully using contract!");
            } catch (decodeError) {
              console.error("Error decoding contract result:", decodeError);
              setError(
                "Error decoding the contract result. The secret might contain binary data."
              );

              // Show hex representation
              setReconstructedSecret(
                `[Binary data: 0x${Array.from(new Uint8Array(result))
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("")}]`
              );
            }
          } else {
            setError(
              "Contract transaction failed. Please check the blockchain explorer for details."
            );
          }
        } catch (contractError) {
          console.error("Error falling back to contract:", contractError);
          setError(
            `Both client-side and contract reconstruction failed. Error: ${contractError.message}`
          );
        }
      }

      // Reload user secrets to update UI
      try {
        await loadUserSecrets();
      } catch (error) {
        console.warn(
          "Failed to reload user secrets after reconstruction:",
          error
        );
      }

      setLoading(false);
    } catch (err) {
      console.error("Error reconstructing secret:", err);
      setError(
        `Error reconstructing secret: ${err.message || "Unknown error"}`
      );
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
                    Initial Owners (leave empty to use your address for all
                    shares):
                  </label>
                  {ownerAddresses.map((address, index) => (
                    <div key={index} className="owner-input">
                      <input
                        type="text"
                        value={address}
                        onChange={(e) =>
                          updateOwnerAddress(index, e.target.value)
                        }
                        placeholder="0x..."
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeOwnerAddress(index)}
                          className="remove-btn"
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
                    >
                      Add Owner
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!registryContract || loading}
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

                <button
                  type="submit"
                  disabled={
                    !registryContract ||
                    loading ||
                    !secretToReconstruct ||
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
