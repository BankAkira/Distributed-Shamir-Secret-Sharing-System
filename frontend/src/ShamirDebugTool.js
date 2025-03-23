// ShamirDebugTool.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import ShareContractABI from './abis/ShareContract.json';

/**
 * ShamirDebugTool component for testing Shamir reconstruction
 * directly with more detailed logging and visualization
 */
const ShamirDebugTool = ({ 
  provider, 
  signer, 
  registryContract, 
  account,
  encryptionKeys,
  addLog,
  secretId,
  shareIndices 
}) => {
  const [shares, setShares] = useState([]);
  const [reconstructedData, setReconstructedData] = useState(null);
  const [decryptedSecret, setDecryptedSecret] = useState('');
  const [visualData, setVisualData] = useState({ bytes: [], patterns: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);

  // Clear all data
  const clearData = () => {
    setShares([]);
    setReconstructedData(null);
    setDecryptedSecret('');
    setVisualData({ bytes: [], patterns: [] });
    setError('');
    setStep(0);
  };

  // Fetch individual shares directly from the blockchain
  const fetchShares = async () => {
    if (!registryContract || !secretId || !shareIndices || shareIndices.length === 0) {
      setError('Missing required data: registry contract, secret ID, or share indices');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setStep(1);
      
      addLog('info', 'Beginning share retrieval process', { 
        secretId, 
        shareIndices: shareIndices.map(s => s.toString())
      });
      
      const shareList = [];
      
      // Fetch each share
      for (const shareIndex of shareIndices) {
        // Get share contract address
        const shareContractAddress = await registryContract.getShareContractAddress(
          secretId, 
          shareIndex
        );
        
        addLog('debug', `Retrieved share contract address for share ${shareIndex}`, {
          address: shareContractAddress
        });
        
        // Create contract instance
        const shareContract = new ethers.Contract(
          shareContractAddress,
          ShareContractABI.abi,
          signer
        );
        
        // Get share data
        const shareData = await shareContract.getShareData(account);
        
        addLog('debug', `Retrieved share data for share ${shareIndex}`, {
          dataLength: shareData.length
        });
        
        // Analyze the bytes for debugging
        const bytes = Array.from(shareData).slice(0, 20); // First 20 bytes
        
        // Add to list
        shareList.push({
          index: shareIndex,
          data: shareData,
          address: shareContractAddress,
          bytes: bytes
        });
      }
      
      setShares(shareList);
      addLog('success', 'All shares retrieved successfully', { count: shareList.length });
      setStep(2);
      setIsLoading(false);
    } catch (err) {
      setError(`Error fetching shares: ${err.message}`);
      addLog('error', 'Error fetching shares', { error: err.message });
      setIsLoading(false);
    }
  };

  // Reconstruct the secret using Shamir's Secret Sharing
  const reconstructWithShamir = async () => {
    if (shares.length === 0) {
      setError('No shares available for reconstruction');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      setStep(3);
      addLog('info', 'Beginning Shamir reconstruction', { sharesCount: shares.length });
      
      // Import ShamirClient
      const ShamirClient = await import('./ShamirClient').then(module => module.default);
      
      // Format shares for reconstruction
      const formattedShares = shares.map(share => share.data);
      
      // Apply Shamir reconstruction
      addLog('debug', 'Applying Shamir reconstruction algorithm', {
        shareIndices: shares.map(s => s.index)
      });
      
      const reconstructedBytes = ShamirClient.reconstructSecret(formattedShares);
      
      // Analyze reconstructed data
      const byteArray = Array.from(reconstructedBytes).slice(0, 100); // First 100 bytes
      
      // Try to decode as text
      let textRepresentation = 'Not decodable as text';
      try {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(reconstructedBytes);
        textRepresentation = text.length > 100 ? text.substring(0, 100) + '...' : text;
      } catch (decodeErr) {
        addLog('warn', 'Could not decode reconstructed bytes as text', { error: decodeErr.message });
      }
      
      // Create visualization data
      const patterns = findBytePatterns(reconstructedBytes);
      
      setReconstructedData({
        bytes: reconstructedBytes,
        byteArray: byteArray,
        length: reconstructedBytes.length,
        textRepresentation: textRepresentation,
        possibleJson: textRepresentation.startsWith('{') || textRepresentation.startsWith('[')
      });
      
      setVisualData({
        bytes: byteArray,
        patterns: patterns
      });
      
      addLog('success', 'Shamir reconstruction completed', {
        resultSize: reconstructedBytes.length,
        looksLikeJson: textRepresentation.startsWith('{') || textRepresentation.startsWith('[')
      });
      
      setStep(4);
      setIsLoading(false);
    } catch (err) {
      setError(`Error in Shamir reconstruction: ${err.message}`);
      addLog('error', 'Error in Shamir reconstruction', { error: err.message });
      setIsLoading(false);
    }
  };

  // Attempt to decrypt the reconstructed data
  const decryptReconstructedData = async () => {
    if (!reconstructedData || !reconstructedData.bytes) {
      setError('No reconstructed data available for decryption');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      setStep(5);
      addLog('info', 'Beginning decryption of reconstructed data', {
        dataSize: reconstructedData.bytes.length
      });
      
      // Import WalletIntegratedEncryption
      const WalletIntegratedEncryption = await import('./WalletIntegratedEncryption')
        .then(module => module.default);
      
      // Convert bytes to JSON string (assuming it's JSON encoded)
      const encryptedPackage = new TextDecoder().decode(reconstructedData.bytes);
      
      addLog('debug', 'Encrypted package decoded as text', {
        length: encryptedPackage.length,
        preview: encryptedPackage.substring(0, 100) + '...'
      });
      
      // Choose decryption method based on available keys
      let decryptedData = '';
      
      if (encryptionKeys && encryptionKeys.manualKey && encryptionKeys.privateKey) {
        // Use manual key decryption
        addLog('info', 'Using manual key for decryption', {
          hasPrivateKey: !!encryptionKeys.privateKey
        });
        
        decryptedData = await WalletIntegratedEncryption.decryptWithPrivateKey(
          encryptedPackage,
          encryptionKeys.privateKey
        );
      } else if (encryptionKeys && encryptionKeys.walletProvider) {
        // Use wallet for decryption
        addLog('info', 'Using wallet for decryption', {
          provider: !!encryptionKeys.walletProvider,
          account: account
        });
        
        decryptedData = await WalletIntegratedEncryption.decryptWithWallet(
          encryptedPackage,
          encryptionKeys.walletProvider || provider,
          account
        );
      } else {
        throw new Error('No decryption keys available');
      }
      
      setDecryptedSecret(decryptedData);
      addLog('success', 'Decryption successful', { 
        resultSize: decryptedData.length,
        preview: decryptedData.substring(0, 100) + '...'
      });
      
      setStep(6); // Complete
      setIsLoading(false);
    } catch (err) {
      setError(`Error decrypting data: ${err.message}`);
      addLog('error', 'Error decrypting data', { error: err.message });
      setIsLoading(false);
    }
  };

  // Find patterns in byte array for visualization
  const findBytePatterns = (bytes) => {
    const patterns = [];
    const byteArray = Array.from(bytes);
    
    // Find potential JSON markers
    const findMarker = (marker, name) => {
      const markerBytes = new TextEncoder().encode(marker);
      for (let i = 0; i < byteArray.length - markerBytes.length; i++) {
        let found = true;
        for (let j = 0; j < markerBytes.length; j++) {
          if (byteArray[i + j] !== markerBytes[j]) {
            found = false;
            break;
          }
        }
        if (found) {
          patterns.push({
            position: i,
            length: markerBytes.length,
            type: name
          });
        }
      }
    };
    
    // Look for common patterns
    findMarker('{', 'JSON Object Start');
    findMarker('}', 'JSON Object End');
    findMarker('[', 'JSON Array Start');
    findMarker(']', 'JSON Array End');
    findMarker('"encryptedSecret"', 'Encrypted Secret Field');
    findMarker('"iv"', 'IV Field');
    findMarker('"aesKey"', 'AES Key Field');
    
    return patterns;
  };

  // Step labels for the progress indicator
  const stepLabels = [
    'Start',
    'Fetching Shares',
    'Shares Retrieved',
    'Reconstructing',
    'Data Reconstructed',
    'Decrypting',
    'Complete'
  ];

  return (
    <div className="shamir-debug-tool" style={{
      backgroundColor: '#f8f9fa',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      marginBottom: '20px'
    }}>
      <h2 style={{ marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
        Shamir Reconstruction Debug Tool
      </h2>
      
      <div className="progress-steps" style={{
        display: 'flex',
        margin: '15px 0 25px',
        position: 'relative'
      }}>
        {stepLabels.map((label, idx) => (
          <div key={idx} className={`progress-step ${idx <= step ? 'active' : ''}`} style={{
            flex: 1,
            textAlign: 'center',
            position: 'relative',
            zIndex: 1
          }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: idx <= step ? '#4caf50' : '#e0e0e0',
              color: idx <= step ? 'white' : '#555',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 5px',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              {idx}
            </div>
            <div style={{
              fontSize: '12px',
              color: idx <= step ? '#333' : '#888'
            }}>
              {label}
            </div>
          </div>
        ))}
        
        <div style={{
          position: 'absolute',
          height: '2px',
          backgroundColor: '#e0e0e0',
          top: '15px',
          left: '15px', 
          right: '15px',
          zIndex: 0
        }}></div>
        
        <div style={{
          position: 'absolute',
          height: '2px',
          backgroundColor: '#4caf50',
          top: '15px',
          left: '15px',
          width: `${Math.min(100, (step / (stepLabels.length - 1)) * 100)}%`,
          zIndex: 0,
          transition: 'width 0.3s ease'
        }}></div>
      </div>
      
      <div className="debug-actions" style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={fetchShares}
          disabled={isLoading || !secretId || shareIndices.length === 0}
          style={{
            padding: '10px 15px',
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: isLoading || !secretId || shareIndices.length === 0 ? 0.7 : 1
          }}
        >
          1. Fetch Shares
        </button>
        
        <button
          onClick={reconstructWithShamir}
          disabled={isLoading || shares.length === 0}
          style={{
            padding: '10px 15px',
            backgroundColor: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: isLoading || shares.length === 0 ? 0.7 : 1
          }}
        >
          2. Reconstruct with Shamir
        </button>
        
        <button
          onClick={decryptReconstructedData}
          disabled={isLoading || !reconstructedData}
          style={{
            padding: '10px 15px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: isLoading || !reconstructedData ? 0.7 : 1
          }}
        >
          3. Decrypt Data
        </button>
        
        <button
          onClick={clearData}
          style={{
            padding: '10px 15px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Data
        </button>
      </div>
      
      {error && (
        <div style={{
          backgroundColor: '#ffebee',
          color: '#c62828',
          padding: '10px 15px',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}
      
      <div className="debug-sections" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {/* Shares Section */}
        <div className="debug-section" style={{
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Shares</h3>
          
          {shares.length > 0 ? (
            <div>
              <p>Retrieved {shares.length} shares:</p>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {shares.map((share, idx) => (
                  <div key={idx} style={{
                    padding: '10px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ fontWeight: 'bold' }}>Share {share.index}</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', marginTop: '5px' }}>
                      Bytes (preview): {share.bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}...
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                      Contract: {share.address.substring(0, 8)}...{share.address.substring(36)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: '#888', fontStyle: 'italic' }}>
              No shares retrieved yet
            </div>
          )}
        </div>
        
        {/* Reconstructed Data Section */}
        <div className="debug-section" style={{
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Reconstructed Data</h3>
          
          {reconstructedData ? (
            <div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Size:</strong> {reconstructedData.length} bytes
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <strong>Preview as text:</strong>
                <div style={{
                  backgroundColor: '#f5f5f5',
                  padding: '10px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  maxHeight: '100px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {reconstructedData.textRepresentation}
                </div>
              </div>
              
              <div>
                <strong>Byte pattern preview:</strong>
                <div style={{
                  backgroundColor: '#f5f5f5',
                  padding: '10px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap'
                }}>
                  {visualData.bytes.map((byte, idx) => {
                    // Find if this byte is part of a pattern
                    const patternMatch = visualData.patterns.find(p => 
                      idx >= p.position && idx < p.position + p.length
                    );
                    
                    return (
                      <span key={idx} style={{
                        backgroundColor: patternMatch ? '#4caf5066' : 'transparent',
                        padding: '2px 0',
                        borderBottom: patternMatch ? '2px solid #4caf50' : 'none',
                        title: patternMatch ? patternMatch.type : ''
                      }}>
                        {byte.toString(16).padStart(2, '0')}{' '}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#888', fontStyle: 'italic' }}>
              No reconstructed data yet
            </div>
          )}
        </div>
        
        {/* Decrypted Secret Section */}
        <div className="debug-section" style={{
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          gridColumn: '1 / -1' // Make this section full width
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Decrypted Secret</h3>
          
          {decryptedSecret ? (
            <div>
              <div style={{
                backgroundColor: '#e8f5e9',
                padding: '15px',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'monospace',
                maxHeight: '200px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {decryptedSecret}
              </div>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(decryptedSecret);
                  addLog('info', 'Secret copied to clipboard', null);
                }}
                style={{
                  marginTop: '10px',
                  padding: '8px 15px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Copy to Clipboard
              </button>
            </div>
          ) : (
            <div style={{ color: '#888', fontStyle: 'italic' }}>
              No decrypted secret yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShamirDebugTool;