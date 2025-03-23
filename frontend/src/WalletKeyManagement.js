// WalletKeyManagement.js - FIXED VERSION
// Handle key retrieval from wallets and key management

import React, { useState, useEffect } from 'react';
import WalletIntegratedEncryption from './WalletIntegratedEncryption';

const WalletKeyManagement = ({ provider, web3auth, account, loginMethod, onKeyRetrieved }) => {
  const [publicKey, setPublicKey] = useState('');
  const [keyRetrieved, setKeyRetrieved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualKeyMode, setManualKeyMode] = useState(false);
  const [manualPublicKey, setManualPublicKey] = useState('');
  const [manualPrivateKey, setManualPrivateKey] = useState('');

  // Attempt to get the public key from the wallet
  const retrieveWalletKey = async () => {
    try {
      setLoading(true);
      setError('');
      
      let walletPublicKey = '';
      
      if (loginMethod === 'metamask' && provider && account) {
        // Get public key from MetaMask
        walletPublicKey = await WalletIntegratedEncryption.getMetaMaskPublicKey(provider, account);
      } else if (loginMethod === 'web3auth' && web3auth) {
        // Get public key from Web3Auth
        walletPublicKey = await WalletIntegratedEncryption.getWeb3AuthPublicKey(web3auth);
      } else {
        throw new Error("No wallet provider available");
      }
      
      setPublicKey(walletPublicKey);
      setKeyRetrieved(true);
      setLoading(false);
      
      // Notify parent component
      if (onKeyRetrieved) {
        onKeyRetrieved({
          publicKey: walletPublicKey,
          // Note: We don't have direct access to the private key
          // The wallet will handle decryption when needed
          walletProvider: provider,
          isMetaMask: loginMethod === 'metamask'
        });
      }
      
      return walletPublicKey;
    } catch (err) {
      console.error('Error retrieving wallet key:', err);
      setError(`Unable to get encryption key from wallet. Falling back to browser-generated keys. Error: ${err.message}`);
      
      // Automatically switch to manual mode if wallet fails
      setManualKeyMode(true);
      generateManualKeys();
      
      setLoading(false);
      return null;
    }
  };

  // Attempt to get the key when component mounts or wallet changes
  useEffect(() => {
    if (!manualKeyMode && (provider || web3auth) && account) {
      retrieveWalletKey();
    }
  }, [provider, web3auth, account, loginMethod]);

  // Handle manual key generation
  const generateManualKeys = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Generate a symmetric key (for simplicity)
      const aesKey = await window.crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256
        },
        true,
        ["encrypt", "decrypt"]
      );
      
      // Export the key
      const keyBuffer = await window.crypto.subtle.exportKey("raw", aesKey);
      const keyHex = Array.from(new Uint8Array(keyBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      setManualPublicKey(keyHex);
      // In our simplified model, the private and public keys are the same
      setManualPrivateKey(keyHex);
      setLoading(false);
      
      // Notify parent component
      if (onKeyRetrieved) {
        onKeyRetrieved({
          publicKey: keyHex,
          privateKey: keyHex,
          manualKey: true
        });
      }
    } catch (err) {
      console.error('Error generating manual keys:', err);
      setError(`Failed to generate keys: ${err.message}`);
      setLoading(false);
    }
  };

  // Switch between wallet keys and manual keys
  const toggleKeyMode = () => {
    setManualKeyMode(!manualKeyMode);
    setError('');
    
    if (!manualKeyMode) {
      // Switching to manual mode
      generateManualKeys();
    } else {
      // Switching back to wallet mode
      if ((provider || web3auth) && account) {
        retrieveWalletKey();
      }
    }
  };

  // Download keys as a JSON file
  const downloadManualKeys = () => {
    if (!manualPublicKey || !manualPrivateKey) return;
    
    const keyData = {
      publicKey: manualPublicKey,
      privateKey: manualPrivateKey,
      createdAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'encryption-keys.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Upload keys from a JSON file
  const handleKeyUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const keyData = JSON.parse(event.target.result);
        
        if (keyData.publicKey && keyData.privateKey) {
          setManualPublicKey(keyData.publicKey);
          setManualPrivateKey(keyData.privateKey);
          setManualKeyMode(true);
          
          // Notify parent component
          if (onKeyRetrieved) {
            onKeyRetrieved({
              publicKey: keyData.publicKey,
              privateKey: keyData.privateKey,
              manualKey: true
            });
          }
        } else {
          setError('Invalid key file format');
        }
      } catch (err) {
        console.error('Error parsing key file:', err);
        setError('Error reading key file. Please ensure it is a valid JSON file.');
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="wallet-key-management">
      <div className="key-mode-toggle">
        <button 
          className={`mode-btn ${!manualKeyMode ? 'active' : ''}`}
          onClick={() => !manualKeyMode ? null : toggleKeyMode()}
          disabled={loading || (!provider && !web3auth)}
        >
          Use Wallet Keys
        </button>
        <button 
          className={`mode-btn ${manualKeyMode ? 'active' : ''}`}
          onClick={() => manualKeyMode ? null : toggleKeyMode()}
          disabled={loading}
        >
          Browser Keys
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {!manualKeyMode ? (
        // Wallet Key Mode
        <div className="wallet-key-section">
          <p className="section-description">
            Using your wallet for encryption and decryption.
          </p>
          
          {keyRetrieved ? (
            <div className="key-status success">
              <span className="status-icon">✓</span>
              <span>Encryption key successfully retrieved from your wallet.</span>
            </div>
          ) : (
            <div className="key-actions">
              <button
                onClick={retrieveWalletKey}
                disabled={loading || (!provider && !web3auth)}
                className="key-btn retrieve-btn"
              >
                {loading ? 'Retrieving...' : 'Retrieve Encryption Key'}
              </button>
            </div>
          )}
          
          {keyRetrieved && (
            <div className="key-display">
              <div className="key-field">
                <label>Your Encryption Key ID:</label>
                <div className="key-value">
                  <div className="truncated-key">
                    {publicKey.substring(0, 20)}...{publicKey.length > 40 ? publicKey.substring(publicKey.length - 20) : ''}
                  </div>
                  <button
                    className="copy-key-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(publicKey);
                      alert('Key copied to clipboard!');
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="wallet-info">
                <p>This key is derived from your wallet credentials and will be used for encryption.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Manual Key Mode
        <div className="manual-key-section">
          <p className="section-description">
            Using browser-generated encryption keys.
          </p>
          
          <div className="key-actions">
            <button
              onClick={generateManualKeys}
              disabled={loading}
              className="key-btn generate-btn"
            >
              {loading ? 'Generating...' : 'Generate New Keys'}
            </button>
            
            {manualPublicKey && manualPrivateKey && (
              <button
                onClick={downloadManualKeys}
                disabled={loading}
                className="key-btn download-btn"
              >
                Download Keys
              </button>
            )}
            
            <div className="file-upload">
              <label htmlFor="key-upload" className="upload-label">
                Upload Keys
              </label>
              <input
                id="key-upload"
                type="file"
                accept=".json"
                onChange={handleKeyUpload}
                disabled={loading}
              />
            </div>
          </div>
          
          {(manualPublicKey && manualPrivateKey) && (
            <div className="key-warning">
              <p>⚠️ Important: Save or download your keys now! Without them, you won't be able to decrypt your secrets.</p>
            </div>
          )}
          
          <div className="key-display">
            <div className="key-field">
              <label>Your Encryption Key:</label>
              <div className="key-value">
                {manualPublicKey ? 
                  <div className="truncated-key">{manualPublicKey.substring(0, 20)}...{manualPublicKey.substring(manualPublicKey.length - 20)}</div> :
                  <div className="no-key">No encryption key generated</div>
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletKeyManagement;