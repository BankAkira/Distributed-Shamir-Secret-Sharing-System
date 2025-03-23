import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './ShamirBlockchainTester.css';

/**
 * ShamirBlockchainTester component for testing and diagnosing issues with
 * the Shamir secret sharing system blockchain integration
 */
const ShamirBlockchainTester = ({ 
  provider, 
  signer, 
  registryContract, 
  addLog // Function to add logs to the debug panel
}) => {
  const [testMode, setTestMode] = useState('encode');
  const [originalText, setOriginalText] = useState('');
  const [encodedResult, setEncodedResult] = useState('');
  const [decodedResult, setDecodedResult] = useState('');
  const [status, setStatus] = useState('');

  // Test text encoding/decoding to diagnose issues
  const testEncodeDecode = () => {
    try {
      addLog('info', 'Testing text encoding/decoding', { textLength: originalText.length });
      setStatus('Encoding text...');
      
      // UTF-8 encode the text to bytes
      const textEncoder = new TextEncoder();
      const textBytes = textEncoder.encode(originalText);
      
      addLog('debug', 'Text encoded to bytes', { byteLength: textBytes.length });
      
      // Convert to hex string (simulating blockchain storage)
      const hexString = '0x' + Array.from(textBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      setEncodedResult(hexString);
      addLog('debug', 'Bytes converted to hex', { hexLength: hexString.length });
      
      // Convert hex back to bytes
      setStatus('Decoding hex...');
      const hexStripped = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
      const bytesBack = new Uint8Array(hexStripped.length / 2);
      
      for (let i = 0; i < bytesBack.length; i++) {
        bytesBack[i] = parseInt(hexStripped.substring(i * 2, i * 2 + 2), 16);
      }
      
      addLog('debug', 'Hex converted back to bytes', { byteLength: bytesBack.length });
      
      // Decode bytes back to text
      const textDecoder = new TextDecoder('utf-8');
      const textBack = textDecoder.decode(bytesBack);
      
      setDecodedResult(textBack);
      addLog('success', 'Text successfully round-tripped', { 
        originalLength: originalText.length,
        finalLength: textBack.length,
        match: originalText === textBack
      });
      
      setStatus(originalText === textBack ? 'SUCCESS: Text round-trip successful!' : 'ERROR: Text does not match after round-trip');
    } catch (error) {
      addLog('error', 'Error in encode/decode test', { error: error.message });
      setStatus(`Error: ${error.message}`);
    }
  };

  // Test Json encoding/decoding to diagnose issues
  const testJsonEncodeDecode = () => {
    try {
      // First, ensure we have valid JSON
      let jsonObject;
      try {
        jsonObject = JSON.parse(originalText);
        addLog('debug', 'Successfully parsed input as JSON', { 
          objectType: typeof jsonObject, 
          isArray: Array.isArray(jsonObject)
        });
      } catch (e) {
        // If not valid JSON, create a simple object
        jsonObject = { data: originalText };
        addLog('debug', 'Created JSON object from input text', { keys: Object.keys(jsonObject) });
      }
      
      // Convert JSON object to string
      const jsonString = JSON.stringify(jsonObject);
      addLog('debug', 'Converted to JSON string', { stringLength: jsonString.length });
      
      // UTF-8 encode the JSON string to bytes
      const textEncoder = new TextEncoder();
      const jsonBytes = textEncoder.encode(jsonString);
      
      addLog('debug', 'JSON string encoded to bytes', { byteLength: jsonBytes.length });
      
      // Convert to hex string (simulating blockchain storage)
      const hexString = '0x' + Array.from(jsonBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      setEncodedResult(hexString);
      addLog('debug', 'Bytes converted to hex', { hexLength: hexString.length });
      
      // Convert hex back to bytes
      setStatus('Decoding hex...');
      const hexStripped = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
      const bytesBack = new Uint8Array(hexStripped.length / 2);
      
      for (let i = 0; i < bytesBack.length; i++) {
        bytesBack[i] = parseInt(hexStripped.substring(i * 2, i * 2 + 2), 16);
      }
      
      addLog('debug', 'Hex converted back to bytes', { byteLength: bytesBack.length });
      
      // Decode bytes back to text
      const textDecoder = new TextDecoder('utf-8');
      const jsonBack = textDecoder.decode(bytesBack);
      
      // Parse back to object
      const objectBack = JSON.parse(jsonBack);
      addLog('success', 'JSON successfully round-tripped', { 
        keys: Object.keys(objectBack)
      });
      
      setDecodedResult(jsonBack);
      setStatus('SUCCESS: JSON round-trip successful!');
    } catch (error) {
      addLog('error', 'Error in JSON encode/decode test', { error: error.message });
      setStatus(`Error: ${error.message}`);
    }
  };
  
  // Test encryption/decryption to diagnose issues
  const testEncryptDecrypt = async () => {
    try {
      addLog('info', 'Testing AES encryption/decryption', { textLength: originalText.length });
      setStatus('Generating encryption key...');
      
      // Generate an AES key for encryption
      const encryptionKey = await window.crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256
        },
        true, // extractable
        ["encrypt", "decrypt"]
      );
      
      addLog('debug', 'Generated AES encryption key', {});
      
      // Generate a random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      addLog('debug', 'Generated IV', { ivBytes: Array.from(iv) });
      
      // Encode the text to encrypt
      const textEncoder = new TextEncoder();
      const textBytes = textEncoder.encode(originalText);
      
      // Encrypt the data
      setStatus('Encrypting data...');
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        encryptionKey,
        textBytes
      );
      
      addLog('debug', 'Data encrypted', { 
        originalSize: textBytes.length,
        encryptedSize: encryptedData.byteLength
      });
      
      // Export the key for storage
      const exportedKey = await window.crypto.subtle.exportKey("raw", encryptionKey);
      addLog('debug', 'Key exported', { keySize: exportedKey.byteLength });
      
      // Create a package with everything needed for decryption
      const encryptionPackage = {
        iv: Array.from(iv),
        encryptedData: Array.from(new Uint8Array(encryptedData)),
        key: Array.from(new Uint8Array(exportedKey))
      };
      
      // Convert to JSON
      const packageJson = JSON.stringify(encryptionPackage);
      addLog('debug', 'Created encryption package', { packageSize: packageJson.length });
      
      // Convert to hex for blockchain storage
      const hexString = '0x' + Array.from(new TextEncoder().encode(packageJson))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      setEncodedResult(hexString);
      addLog('debug', 'Package converted to hex', { hexLength: hexString.length });
      
      // Now decrypt
      setStatus('Decoding hex...');
      
      // Convert hex back to bytes
      const hexStripped = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
      const bytesBack = new Uint8Array(hexStripped.length / 2);
      
      for (let i = 0; i < bytesBack.length; i++) {
        bytesBack[i] = parseInt(hexStripped.substring(i * 2, i * 2 + 2), 16);
      }
      
      // Convert bytes back to JSON
      const packageBack = new TextDecoder().decode(bytesBack);
      addLog('debug', 'Hex converted back to package', { packageLength: packageBack.length });
      
      // Parse the JSON
      const parsedPackage = JSON.parse(packageBack);
      addLog('debug', 'Package parsed', { 
        hasIv: !!parsedPackage.iv,
        hasEncryptedData: !!parsedPackage.encryptedData,
        hasKey: !!parsedPackage.key
      });
      
      // Import the key
      setStatus('Importing key...');
      const importedKey = await window.crypto.subtle.importKey(
        "raw",
        new Uint8Array(parsedPackage.key),
        {
          name: "AES-GCM",
          length: 256
        },
        false, // not extractable
        ["decrypt"]
      );
      
      addLog('debug', 'Key imported successfully', {});
      
      // Decrypt the data
      setStatus('Decrypting data...');
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: new Uint8Array(parsedPackage.iv)
        },
        importedKey,
        new Uint8Array(parsedPackage.encryptedData)
      );
      
      addLog('debug', 'Data decrypted', { decryptedSize: decryptedData.byteLength });
      
      // Decode the decrypted data
      const decryptedText = new TextDecoder().decode(decryptedData);
      setDecodedResult(decryptedText);
      
      addLog('success', 'Encryption/decryption test complete', { 
        originalLength: originalText.length,
        finalLength: decryptedText.length,
        match: originalText === decryptedText
      });
      
      setStatus(originalText === decryptedText ? 
        'SUCCESS: Encryption round-trip successful!' : 
        'ERROR: Text does not match after encryption round-trip');
      
    } catch (error) {
      addLog('error', 'Error in encryption test', { error: error.message });
      setStatus(`Error: ${error.message}`);
    }
  };
  
  // Test direct ethers.js utils for blockchain interactions
  const testEthersUtils = () => {
    try {
      addLog('info', 'Testing ethers.js utilities', { textLength: originalText.length });
      setStatus('Testing ethers.js encoding...');
      
      // Convert string to bytes
      const textBytes = ethers.utils.toUtf8Bytes(originalText);
      addLog('debug', 'Converted text to bytes using ethers.js', { bytesLength: textBytes.length });
      
      // Convert bytes to hex
      const hexString = ethers.utils.hexlify(textBytes);
      setEncodedResult(hexString);
      addLog('debug', 'Converted bytes to hex using ethers.js', { hexLength: hexString.length });
      
      // Convert hex back to bytes
      setStatus('Testing ethers.js decoding...');
      const bytesBack = ethers.utils.arrayify(hexString);
      addLog('debug', 'Converted hex back to bytes using ethers.js', { bytesLength: bytesBack.length });
      
      // Convert bytes back to string
      const textBack = ethers.utils.toUtf8String(bytesBack);
      setDecodedResult(textBack);
      
      addLog('success', 'ethers.js utilities test complete', { 
        originalLength: originalText.length,
        finalLength: textBack.length,
        match: originalText === textBack
      });
      
      setStatus(originalText === textBack ? 
        'SUCCESS: ethers.js round-trip successful!' : 
        'ERROR: Text does not match after ethers.js round-trip');
      
    } catch (error) {
      addLog('error', 'Error in ethers.js test', { error: error.message });
      setStatus(`Error: ${error.message}`);
    }
  };
  
  // Simulate the blockchain operations without actually using the blockchain
  const testBlockchainSimulation = async () => {
    if (!originalText) {
      addLog('warn', 'No text provided for simulation', {});
      setStatus('Please enter some text first');
      return;
    }
    
    try {
      addLog('info', 'Simulating blockchain secret sharing', { 
        textLength: originalText.length 
      });
      setStatus('Step 1: Generating AES key...');
      
      // 1. Generate an AES key
      const aesKey = await window.crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256
        },
        true,
        ["encrypt", "decrypt"]
      );
      
      // 2. Generate IV and encrypt the secret
      setStatus('Step 2: Encrypting secret...');
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const secretBytes = new TextEncoder().encode(originalText);
      
      const encryptedSecret = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        aesKey,
        secretBytes
      );
      
      // 3. Export the AES key
      const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
      
      // 4. Package everything for blockchain storage
      const packageObj = {
        iv: Array.from(iv),
        encryptedSecret: Array.from(new Uint8Array(encryptedSecret)),
        aesKey: Array.from(new Uint8Array(rawAesKey)),
        recipientKeys: ["test-recipient-key"] // Simulated recipient key
      };
      
      // 5. Convert to JSON string
      const packageJson = JSON.stringify(packageObj);
      addLog('debug', 'Created encryption package', { 
        packageSize: packageJson.length,
        objectKeys: Object.keys(packageObj)
      });
      
      // 6. Convert to hex for blockchain
      setStatus('Step 3: Converting to hex for blockchain...');
      const packageHex = '0x' + Array.from(new TextEncoder().encode(packageJson))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      setEncodedResult(packageHex);
      addLog('debug', 'Package converted to hex', { 
        hexLength: packageHex.length,
        preview: packageHex.substring(0, 50) + '...'
      });
      
      // 7. Convert to bytes array for contract
      const packageBytes = ethers.utils.arrayify(packageHex);
      addLog('debug', 'Hex converted to bytes array', { 
        bytesLength: packageBytes.length
      });
      
      // 8. Simulate blockchain storage and retrieval 
      // (normally this would be splitAndDeploy and reconstructSecret)
      setStatus('Step 4: Simulating blockchain storage...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate blockchain delay
      
      // 9. Simulate retrieval - convert bytes back to hex
      const retrievedHex = ethers.utils.hexlify(packageBytes);
      addLog('debug', 'Retrieved hex from blockchain', { 
        hexLength: retrievedHex.length,
        matchesOriginal: retrievedHex === packageHex
      });
      
      // 10. Convert hex to JSON string
      setStatus('Step 5: Converting from hex...');
      const retrievedJson = new TextDecoder().decode(ethers.utils.arrayify(retrievedHex));
      addLog('debug', 'Converted hex to JSON string', { 
        jsonLength: retrievedJson.length
      });
      
      // 11. Parse JSON
      setStatus('Step 6: Parsing JSON...');
      const retrievedPackage = JSON.parse(retrievedJson);
      addLog('debug', 'Parsed JSON package', { 
        hasIv: !!retrievedPackage.iv,
        hasEncryptedSecret: !!retrievedPackage.encryptedSecret,
        hasAesKey: !!retrievedPackage.aesKey
      });
      
      // 12. Import AES key
      setStatus('Step 7: Importing AES key...');
      const importedKey = await window.crypto.subtle.importKey(
        "raw",
        new Uint8Array(retrievedPackage.aesKey),
        {
          name: "AES-GCM",
          length: 256
        },
        false,
        ["decrypt"]
      );
      
      // 13. Decrypt the secret
      setStatus('Step 8: Decrypting secret...');
      const decryptedBytes = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: new Uint8Array(retrievedPackage.iv)
        },
        importedKey,
        new Uint8Array(retrievedPackage.encryptedSecret)
      );
      
      // 14. Convert decrypted bytes to string
      const decryptedText = new TextDecoder().decode(decryptedBytes);
      setDecodedResult(decryptedText);
      
      addLog('success', 'Blockchain simulation complete', { 
        originalLength: originalText.length,
        decryptedLength: decryptedText.length,
        match: originalText === decryptedText
      });
      
      setStatus(originalText === decryptedText ? 
        'SUCCESS: Blockchain simulation successful!' : 
        'ERROR: Secret does not match after simulation');
      
    } catch (error) {
      addLog('error', 'Error in blockchain simulation', { error: error.message });
      setStatus(`Error: ${error.message}`);
    }
  };

  // Run the selected test based on the test mode
  const runTest = async () => {
    switch (testMode) {
      case 'encode':
        testEncodeDecode();
        break;
      case 'json':
        testJsonEncodeDecode();
        break;
      case 'encrypt':
        await testEncryptDecrypt();
        break;
      case 'ethers':
        testEthersUtils();
        break;
      case 'blockchain':
        await testBlockchainSimulation();
        break;
      default:
        addLog('error', 'Unknown test mode', { mode: testMode });
    }
  };

  return (
    <div className="blockchain-tester">
      <h2>Shamir Blockchain Tester</h2>
      
      <div className="test-selector">
        <button 
          className={testMode === 'encode' ? 'active' : ''} 
          onClick={() => setTestMode('encode')}
        >
          Text Encoding
        </button>
        <button 
          className={testMode === 'json' ? 'active' : ''} 
          onClick={() => setTestMode('json')}
        >
          JSON Handling
        </button>
        <button 
          className={testMode === 'encrypt' ? 'active' : ''} 
          onClick={() => setTestMode('encrypt')}
        >
          Encryption
        </button>
        <button 
          className={testMode === 'ethers' ? 'active' : ''} 
          onClick={() => setTestMode('ethers')}
        >
          Ethers.js Utils
        </button>
        <button 
          className={testMode === 'blockchain' ? 'active' : ''} 
          onClick={() => setTestMode('blockchain')}
        >
          Full Simulation
        </button>
      </div>
      
      <div className="test-input">
        <label>
          Test Input:
          <textarea 
            value={originalText} 
            onChange={(e) => setOriginalText(e.target.value)}
            placeholder="Enter text to test encoding/encryption"
            rows={4}
          />
        </label>
        
        <button onClick={runTest} className="run-test-btn">
          Run {testMode === 'encode' ? 'Encoding' : 
               testMode === 'json' ? 'JSON' : 
               testMode === 'encrypt' ? 'Encryption' : 
               testMode === 'ethers' ? 'Ethers.js' : 
               'Blockchain'} Test
        </button>
      </div>
      
      {status && (
        <div className={`test-status ${status.includes('ERROR') ? 'error' : 
                                        status.includes('SUCCESS') ? 'success' : ''}`}>
          {status}
        </div>
      )}
      
      <div className="test-results">
        <div className="result-section">
          <h3>{testMode === 'encrypt' ? 'Encrypted Package (Hex):' : 
               testMode === 'blockchain' ? 'Blockchain Data (Hex):' :
               'Encoded Result (Hex):'}</h3>
          <pre className="result-box">
            {encodedResult || 'No result yet'}
          </pre>
        </div>
        
        <div className="result-section">
          <h3>{testMode === 'encrypt' ? 'Decrypted Result:' : 
               testMode === 'blockchain' ? 'Reconstructed Secret:' :
               'Decoded Result:'}</h3>
          <pre className="result-box">
            {decodedResult || 'No result yet'}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ShamirBlockchainTester;