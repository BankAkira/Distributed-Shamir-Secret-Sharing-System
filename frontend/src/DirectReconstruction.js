import React, { useState } from 'react';
import { ethers } from 'ethers';
import './DirectReconstruction.css';

/**
 * DirectReconstruction - A component for directly reconstructing secrets by
 * bypassing the problematic fromHex function in WalletIntegratedEncryption.js
 */
const DirectReconstruction = ({ 
  provider, 
  signer, 
  registryContract, 
  addLog
}) => {
  const [secretId, setSecretId] = useState('');
  const [shareIndices, setShareIndices] = useState('');
  const [rawHex, setRawHex] = useState('');
  const [reconstructedSecret, setReconstructedSecret] = useState('');
  const [fixMethod, setFixMethod] = useState('direct-json');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get the raw reconstruction data from the blockchain
  const getRawReconstruction = async () => {
    if (!registryContract) {
      setError("Registry contract not connected");
      return;
    }
    
    if (!secretId) {
      setError("Please enter a secret ID");
      return;
    }
    
    if (!shareIndices) {
      setError("Please enter share indices");
      return;
    }
    
    try {
      // Parse share indices
      const indices = shareIndices.split(',').map(idx => parseInt(idx.trim()));
      if (indices.some(isNaN)) {
        setError("Invalid share indices. Please use comma-separated numbers.");
        return;
      }
      
      setIsLoading(true);
      setError('');
      setSuccess('');
      addLog('info', 'Getting raw reconstruction data', { secretId, indices });
      
      // Call the contract to get the raw reconstruction
      const result = await registryContract.reconstructSecret(secretId, indices);
      
      // Convert to hex string for display and processing
      const resultHex = ethers.utils.hexlify(result);
      setRawHex(resultHex);
      
      addLog('success', 'Raw reconstruction data retrieved', { 
        resultLength: result.length,
        hexLength: resultHex.length
      });
      
      setSuccess('Raw data retrieved successfully. Use one of the fix methods to decode it.');
      setIsLoading(false);
    } catch (err) {
      setError(`Error getting raw data: ${err.message}`);
      addLog('error', 'Error getting raw reconstruction data', { error: err.message });
      setIsLoading(false);
    }
  };

  // Fix and decode using direct JSON parsing
  const fixWithDirectJson = () => {
    try {
      if (!rawHex) {
        setError("No raw data to fix. Please retrieve it first.");
        return;
      }
      
      setIsLoading(true);
      addLog('info', 'Attempting direct JSON decoding', { hexLength: rawHex.length });
      
      // Convert hex to bytes
      const bytes = ethers.utils.arrayify(rawHex);
      
      // Try to decode as UTF-8 string
      const text = new TextDecoder().decode(bytes);
      addLog('debug', 'Decoded to text', { textLength: text.length });
      
      // Try to parse as JSON
      let jsonData;
      try {
        jsonData = JSON.parse(text);
        addLog('success', 'Successfully parsed as JSON', { keys: Object.keys(jsonData) });
      } catch (jsonErr) {
        addLog('error', 'Failed to parse as JSON', { error: jsonErr.message });
        
        // If we can't parse as JSON, try to fix the JSON string
        // Find the first { and the last } to handle potential garbage data
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          const jsonText = text.substring(firstBrace, lastBrace + 1);
          addLog('debug', 'Extracted JSON portion', { 
            extractedLength: jsonText.length,
            preview: jsonText.substring(0, 100) + '...'
          });
          
          try {
            jsonData = JSON.parse(jsonText);
            addLog('success', 'Successfully parsed extracted JSON', { keys: Object.keys(jsonData) });
          } catch (extractErr) {
            throw new Error(`Failed to parse extracted JSON: ${extractErr.message}`);
          }
        } else {
          throw new Error("Could not locate JSON structure in the data");
        }
      }
      
      // Check for required fields
      if (!jsonData.encryptedSecret || !jsonData.aesKey || !jsonData.iv) {
        throw new Error("Missing required fields in the JSON data");
      }
      
      // Decrypt the secret
      decryptSecret(jsonData);
    } catch (err) {
      setError(`Error fixing with direct JSON: ${err.message}`);
      addLog('error', 'Error in direct JSON fix', { error: err.message });
      setIsLoading(false);
    }
  };

  // Fix by manually processing hex
  const fixWithHexProcessing = () => {
    try {
      if (!rawHex) {
        setError("No raw data to fix. Please retrieve it first.");
        return;
      }
      
      setIsLoading(true);
      addLog('info', 'Attempting hex processing fix', { hexLength: rawHex.length });
      
      // Strip 0x prefix if present
      const cleanHex = rawHex.startsWith('0x') ? rawHex.slice(2) : rawHex;
      
      // Check for valid hex
      if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
        throw new Error("Contains invalid hex characters");
      }
      
      // Convert hex to bytes more carefully
      const bytes = new Uint8Array(cleanHex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
      }
      
      // Convert to string and try to find JSON
      const text = new TextDecoder().decode(bytes);
      
      // Try to find JSON structure
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const jsonText = text.substring(firstBrace, lastBrace + 1);
        addLog('debug', 'Found potential JSON', { 
          jsonStart: firstBrace,
          jsonEnd: lastBrace,
          extractedLength: jsonText.length
        });
        
        try {
          const jsonData = JSON.parse(jsonText);
          addLog('success', 'Successfully parsed JSON', { keys: Object.keys(jsonData) });
          
          // Check for required fields
          if (!jsonData.encryptedSecret || !jsonData.aesKey || !jsonData.iv) {
            throw new Error("Missing required fields in the JSON data");
          }
          
          // Decrypt the secret
          decryptSecret(jsonData);
        } catch (jsonErr) {
          throw new Error(`Failed to parse JSON: ${jsonErr.message}`);
        }
      } else {
        throw new Error("Could not locate JSON structure in the data");
      }
    } catch (err) {
      setError(`Error fixing with hex processing: ${err.message}`);
      addLog('error', 'Error in hex processing fix', { error: err.message });
      setIsLoading(false);
    }
  };

  // Fix by removing invalid characters
  const fixWithCharacterCleaning = () => {
    try {
      if (!rawHex) {
        setError("No raw data to fix. Please retrieve it first.");
        return;
      }
      
      setIsLoading(true);
      addLog('info', 'Attempting character cleaning fix', { hexLength: rawHex.length });
      
      // Convert hex to bytes
      const bytes = ethers.utils.arrayify(rawHex);
      
      // Convert to string
      const text = new TextDecoder().decode(bytes);
      
      // Clean up non-printable characters
      const cleanedText = text.replace(/[^\x20-\x7E]/g, '');
      addLog('debug', 'Cleaned text', { 
        originalLength: text.length,
        cleanedLength: cleanedText.length,
        removed: text.length - cleanedText.length
      });
      
      // Try to find valid JSON
      let jsonStart = -1;
      let jsonEnd = -1;
      let braceCount = 0;
      
      // Find the start of JSON
      for (let i = 0; i < cleanedText.length; i++) {
        if (cleanedText[i] === '{') {
          jsonStart = i;
          break;
        }
      }
      
      // Find the matching end brace
      if (jsonStart >= 0) {
        for (let i = jsonStart; i < cleanedText.length; i++) {
          if (cleanedText[i] === '{') braceCount++;
          if (cleanedText[i] === '}') braceCount--;
          
          if (braceCount === 0) {
            jsonEnd = i;
            break;
          }
        }
      }
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonText = cleanedText.substring(jsonStart, jsonEnd + 1);
        addLog('debug', 'Extracted JSON portion', { 
          extractedLength: jsonText.length,
          preview: jsonText.substring(0, 100) + '...'
        });
        
        try {
          const jsonData = JSON.parse(jsonText);
          addLog('success', 'Successfully parsed JSON', { keys: Object.keys(jsonData) });
          
          // Check for required fields
          if (!jsonData.encryptedSecret || !jsonData.aesKey || !jsonData.iv) {
            throw new Error("Missing required fields in the JSON data");
          }
          
          // Decrypt the secret
          decryptSecret(jsonData);
        } catch (jsonErr) {
          throw new Error(`Failed to parse JSON: ${jsonErr.message}`);
        }
      } else {
        throw new Error("Could not locate valid JSON structure");
      }
    } catch (err) {
      setError(`Error fixing with character cleaning: ${err.message}`);
      addLog('error', 'Error in character cleaning fix', { error: err.message });
      setIsLoading(false);
    }
  };

  // Manual structure recreation
  const fixWithStructureRecreation = () => {
    try {
      if (!rawHex) {
        setError("No raw data to fix. Please retrieve it first.");
        return;
      }
      
      setIsLoading(true);
      addLog('info', 'Attempting structure recreation', { hexLength: rawHex.length });
      
      // Convert hex to bytes
      const bytes = ethers.utils.arrayify(rawHex);
      
      // Analyze bytes to find patterns
      // Look for sequences that might be part of a JSON structure
      let foundIV = false;
      let foundEncryptedSecret = false;
      let foundAESKey = false;
      
      // This is a more sophisticated approach that would require careful
      // pattern analysis of the damaged data. In a real implementation,
      // we would need to search for specific patterns or byte sequences
      // that indicate the structure of our data.
      
      // For this example, we'll create a simple mock package
      const mockPackage = {
        iv: Array.from(bytes.slice(0, 12)), // First 12 bytes as IV
        encryptedSecret: Array.from(bytes.slice(12, 100)), // Next chunk as encrypted data
        aesKey: Array.from(bytes.slice(bytes.length - 32)) // Last 32 bytes as AES key
      };
      
      addLog('warn', 'Created mock package from byte patterns', { 
        ivLength: mockPackage.iv.length,
        encryptedSecretLength: mockPackage.encryptedSecret.length,
        aesKeyLength: mockPackage.aesKey.length
      });
      
      // This is unlikely to work with real data, but it demonstrates the approach
      setSuccess('Created mock structure. Attempting to decrypt...');
      
      // Try to decrypt with the mock package
      decryptSecret(mockPackage);
    } catch (err) {
      setError(`Error with structure recreation: ${err.message}`);
      addLog('error', 'Error in structure recreation', { error: err.message });
      setIsLoading(false);
    }
  };

  // Common decryption function
  const decryptSecret = async (jsonData) => {
    try {
      addLog('info', 'Decrypting secret', {
        hasIv: !!jsonData.iv,
        hasEncryptedSecret: !!jsonData.encryptedSecret,
        hasAesKey: !!jsonData.aesKey
      });
      
      // Import the AES key
      const importedKey = await window.crypto.subtle.importKey(
        "raw",
        new Uint8Array(jsonData.aesKey),
        {
          name: "AES-GCM",
          length: 256
        },
        false,
        ["decrypt"]
      );
      
      addLog('debug', 'AES key imported', {});
      
      // Decrypt the secret
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: new Uint8Array(jsonData.iv)
        },
        importedKey,
        new Uint8Array(jsonData.encryptedSecret)
      );
      
      addLog('debug', 'Data decrypted', { decryptedSize: decryptedData.byteLength });
      
      // Convert to string
      const decryptedText = new TextDecoder().decode(decryptedData);
      setReconstructedSecret(decryptedText);
      
      setSuccess('Secret successfully decrypted!');
      addLog('success', 'Secret decrypted successfully', { secretLength: decryptedText.length });
      setIsLoading(false);
    } catch (err) {
      setError(`Error decrypting secret: ${err.message}`);
      addLog('error', 'Error decrypting secret', { error: err.message });
      setIsLoading(false);
    }
  };

  // Run the selected fix method
  const runSelectedFix = () => {
    switch (fixMethod) {
      case 'direct-json':
        fixWithDirectJson();
        break;
      case 'hex-processing':
        fixWithHexProcessing();
        break;
      case 'character-cleaning':
        fixWithCharacterCleaning();
        break;
      case 'structure-recreation':
        fixWithStructureRecreation();
        break;
      default:
        setError('Invalid fix method selected');
    }
  };

  return (
    <div className="direct-reconstruction">
      <h2>Direct Secret Reconstruction</h2>
      <p className="section-description">
        This tool helps reconstruct secrets directly by bypassing problematic encoding/decoding.
      </p>
      
      <div className="reconstruction-input">
        <div className="input-group">
          <label>Secret ID:</label>
          <input
            type="text"
            value={secretId}
            onChange={(e) => setSecretId(e.target.value)}
            placeholder="Enter secret ID"
          />
        </div>
        
        <div className="input-group">
          <label>Share Indices (comma-separated):</label>
          <input
            type="text"
            value={shareIndices}
            onChange={(e) => setShareIndices(e.target.value)}
            placeholder="e.g. 1,2,3"
          />
        </div>
        
        <button onClick={getRawReconstruction} disabled={isLoading || !registryContract}>
          {isLoading ? 'Retrieving...' : 'Get Raw Data'}
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {rawHex && (
        <div className="raw-data-section">
          <h3>Raw Hex Data:</h3>
          <div className="raw-data">
            {rawHex.length > 100 ? 
              <>{rawHex.substring(0, 100)}... ({rawHex.length} bytes total)</> : 
              rawHex}
          </div>
          
          <div className="fix-methods">
            <h3>Fix Methods:</h3>
            <div className="method-selector">
              <label>
                <input
                  type="radio"
                  value="direct-json"
                  checked={fixMethod === 'direct-json'}
                  onChange={() => setFixMethod('direct-json')}
                />
                Direct JSON Parsing
              </label>
              
              <label>
                <input
                  type="radio"
                  value="hex-processing"
                  checked={fixMethod === 'hex-processing'}
                  onChange={() => setFixMethod('hex-processing')}
                />
                Hex Processing
              </label>
              
              <label>
                <input
                  type="radio"
                  value="character-cleaning"
                  checked={fixMethod === 'character-cleaning'}
                  onChange={() => setFixMethod('character-cleaning')}
                />
                Character Cleaning
              </label>
              
              <label>
                <input
                  type="radio"
                  value="structure-recreation"
                  checked={fixMethod === 'structure-recreation'}
                  onChange={() => setFixMethod('structure-recreation')}
                />
                Structure Recreation
              </label>
            </div>
            
            <button onClick={runSelectedFix} disabled={isLoading} className="fix-btn">
              {isLoading ? 'Processing...' : 'Apply Fix'}
            </button>
          </div>
        </div>
      )}
      
      {reconstructedSecret && (
        <div className="result-section">
          <h3>Reconstructed Secret:</h3>
          <div className="secret-result">{reconstructedSecret}</div>
          
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
  );
};

export default DirectReconstruction;