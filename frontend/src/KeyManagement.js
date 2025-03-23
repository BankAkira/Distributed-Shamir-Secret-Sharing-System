// KeyManagement.js
// Handle key generation, storage, and retrieval

import React, { useState, useEffect } from 'react';
import AsymmetricEncryption from './AsymmetricEncryption';

const KeyManagement = ({ onKeyGenerated }) => {
  const [keyPair, setKeyPair] = useState(null);
  const [publicKeyString, setPublicKeyString] = useState('');
  const [privateKeyString, setPrivateKeyString] = useState('');
  const [keysSaved, setKeysSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Generate new keys on initial load
  useEffect(() => {
    generateNewKeyPair();
  }, []);

  // Generate a new key pair
  const generateNewKeyPair = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Generate the key pair
      const newKeyPair = await AsymmetricEncryption.generateKeyPair();
      
      // Export keys to strings
      const pubKey = await AsymmetricEncryption.exportPublicKey(newKeyPair.publicKey);
      const privKey = await AsymmetricEncryption.exportPrivateKey(newKeyPair.privateKey);
      
      // Update state
      setKeyPair(newKeyPair);
      setPublicKeyString(pubKey);
      setPrivateKeyString(privKey);
      setKeysSaved(false);
      setLoading(false);
      
      // Notify parent component
      if (onKeyGenerated) {
        onKeyGenerated({ publicKey: pubKey, privateKey: privKey });
      }
    } catch (err) {
      console.error('Error generating key pair:', err);
      setError('Failed to generate keys. Please ensure you are using a modern browser.');
      setLoading(false);
    }
  };

  // Save keys to local storage
  const saveKeysLocally = () => {
    if (publicKeyString && privateKeyString) {
      try {
        localStorage.setItem('shamir_publicKey', publicKeyString);
        localStorage.setItem('shamir_privateKey', privateKeyString);
        setKeysSaved(true);
      } catch (err) {
        setError('Failed to save keys to local storage. Try downloading them instead.');
      }
    }
  };

  // Load keys from local storage
  const loadKeysFromStorage = () => {
    try {
      const storedPublicKey = localStorage.getItem('shamir_publicKey');
      const storedPrivateKey = localStorage.getItem('shamir_privateKey');
      
      if (storedPublicKey && storedPrivateKey) {
        setPublicKeyString(storedPublicKey);
        setPrivateKeyString(storedPrivateKey);
        setKeysSaved(true);
        
        if (onKeyGenerated) {
          onKeyGenerated({ publicKey: storedPublicKey, privateKey: storedPrivateKey });
        }
        
        return true;
      }
    } catch (err) {
      console.error('Error loading keys from storage:', err);
    }
    
    return false;
  };

  // Download keys as a JSON file
  const downloadKeys = () => {
    if (!publicKeyString || !privateKeyString) return;
    
    const keyData = {
      publicKey: publicKeyString,
      privateKey: privateKeyString,
      createdAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shamir-keys.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setKeysSaved(true);
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
          setPublicKeyString(keyData.publicKey);
          setPrivateKeyString(keyData.privateKey);
          setKeysSaved(true);
          
          if (onKeyGenerated) {
            onKeyGenerated({ publicKey: keyData.publicKey, privateKey: keyData.privateKey });
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
    <div className="key-management">
      <h3>Your Encryption Keys</h3>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="key-actions">
        <button
          onClick={generateNewKeyPair}
          disabled={loading}
          className="key-btn generate-btn"
        >
          {loading ? 'Generating...' : 'Generate New Keys'}
        </button>
        
        <button
          onClick={downloadKeys}
          disabled={!publicKeyString || loading}
          className="key-btn download-btn"
        >
          Download Keys
        </button>
        
        <button
          onClick={saveKeysLocally}
          disabled={!publicKeyString || loading}
          className="key-btn save-btn"
        >
          Save to Browser
        </button>
        
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
      
      {(publicKeyString && !keysSaved) && (
        <div className="key-warning">
          <p>⚠️ Important: Save or download your keys now! Without them, you won't be able to decrypt your secrets.</p>
        </div>
      )}
      
      {keysSaved && (
        <div className="key-success">
          <p>✅ Keys saved successfully!</p>
        </div>
      )}
      
      <div className="key-display">
        <div className="key-field">
          <label>Your Public Key:</label>
          <div className="key-value">
            {publicKeyString ? 
              <div className="truncated-key">{publicKeyString.substring(0, 20)}...{publicKeyString.substring(publicKeyString.length - 20)}</div> :
              <div className="no-key">No public key generated</div>
            }
          </div>
        </div>
        
        <div className="key-field">
          <label>Your Private Key:</label>
          <div className="key-value">
            {privateKeyString ? 
              <div className="hidden-key">••••••••••••••••••••••••••••••••••••••••••</div> :
              <div className="no-key">No private key generated</div>
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyManagement;