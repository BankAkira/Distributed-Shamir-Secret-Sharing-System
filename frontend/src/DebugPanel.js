import React, { useState } from 'react';
import './DebugPanel.css';

const DebugPanel = ({ 
  logs = [], 
  addLog, 
  logState, 
  rawData,
  secretId,
  selectedShares,
  onDebugReconstruction
}) => {
  const [testText, setTestText] = useState('');
  const [activeTab, setActiveTab] = useState('logs');
  
  const clearLogs = () => {
    addLog('info', 'Logs cleared', null);
    window.localStorage.setItem('debugLogs', JSON.stringify([]));
  };
  
  const runDataTest = async () => {
    addLog('info', 'Running data test', { testText });
    
    try {
      // Test hex conversion
      addLog('info', 'Testing hex conversion', null);
      
      const asHex = '0x' + Array.from(new TextEncoder().encode(testText))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      addLog('debug', 'Converted to hex', { 
        hex: asHex.length > 100 ? asHex.substring(0, 100) + '...' : asHex
      });
      
      // Test from hex
      const fromHex = (hex) => {
        const strippedHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        const bytes = new Uint8Array(strippedHex.length / 2);
        
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(strippedHex.substring(i * 2, i * 2 + 2), 16);
        }
        
        return new TextDecoder().decode(bytes);
      };
      
      const backFromHex = fromHex(asHex);
      addLog('debug', 'Converted back from hex', { 
        result: backFromHex.length > 100 ? backFromHex.substring(0, 100) + '...' : backFromHex 
      });
      
      // Test JSON serialization/deserialization
      try {
        const jsonObj = JSON.parse(testText);
        addLog('success', 'Successfully parsed as JSON', {
          objectType: typeof jsonObj,
          isArray: Array.isArray(jsonObj)
        });
      } catch (e) {
        addLog('warn', 'Not valid JSON', { error: e.message });
        
        // Try to create a valid JSON object
        try {
          const obj = { data: testText };
          const json = JSON.stringify(obj);
          addLog('info', 'Created valid JSON from text', { jsonLength: json.length });
          
          // Test round-trip through hex
          const jsonHex = '0x' + Array.from(new TextEncoder().encode(json))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          addLog('debug', 'JSON as hex', { 
            hex: jsonHex.length > 100 ? jsonHex.substring(0, 100) + '...' : jsonHex 
          });
          
          const jsonBack = fromHex(jsonHex);
          try {
            const objBack = JSON.parse(jsonBack);
            addLog('success', 'Successfully round-tripped through hex', {
              originalSize: testText.length,
              roundTripSize: objBack.data.length,
              matches: objBack.data === testText
            });
          } catch (e) {
            addLog('error', 'Failed to parse JSON after hex conversion', { error: e.message });
          }
        } catch (e) {
          addLog('error', 'Error creating test JSON', { error: e.message });
        }
      }
    } catch (e) {
      addLog('error', 'Test error', { error: e.message });
    }
  };
  
  const inspectRawData = () => {
    if (!rawData) {
      addLog('warn', 'No raw data available', null);
      return;
    }
    
    try {
      addLog('info', 'Inspecting raw data', {
        type: typeof rawData,
        isArray: Array.isArray(rawData),
        length: rawData.length || 0
      });
      
      // Convert to various formats for inspection
      
      // As string
      try {
        const asString = String(rawData);
        addLog('debug', 'As string', { 
          preview: asString.length > 100 ? asString.substring(0, 100) + '...' : asString,
          length: asString.length
        });
      } catch (e) {
        addLog('error', 'Error converting to string', { error: e.message });
      }
      
      // As hex
      try {
        let hexString = "";
        if (rawData instanceof Uint8Array) {
          hexString = Array.from(rawData)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        } else {
          hexString = Array.from(new Uint8Array(rawData))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        }
        
        addLog('debug', 'As hex', { 
          preview: hexString.length > 100 ? hexString.substring(0, 100) + '...' : hexString,
          length: hexString.length
        });
      } catch (e) {
        addLog('error', 'Error converting to hex', { error: e.message });
      }
      
      // Try to parse as JSON
      try {
        const jsonString = new TextDecoder().decode(
          rawData instanceof Uint8Array ? rawData : new Uint8Array(rawData)
        );
        const jsonObj = JSON.parse(jsonString);
        addLog('success', 'Successfully parsed as JSON', {
          objectType: typeof jsonObj,
          isArray: Array.isArray(jsonObj),
          keys: Object.keys(jsonObj)
        });
      } catch (e) {
        addLog('warn', 'Not directly parseable as JSON', { error: e.message });
      }
      
      // Byte analysis
      try {
        const bytes = rawData instanceof Uint8Array ? rawData : new Uint8Array(rawData);
        const byteStats = {
          length: bytes.length,
          first20: Array.from(bytes.slice(0, 20)),
          nonPrintable: 0,
          zeroes: 0
        };
        
        for (const byte of bytes) {
          if (byte === 0) byteStats.zeroes++;
          if (byte < 32 || byte > 126) byteStats.nonPrintable++;
        }
        
        byteStats.percentNonPrintable = (byteStats.nonPrintable / bytes.length * 100).toFixed(2) + '%';
        byteStats.percentZeroes = (byteStats.zeroes / bytes.length * 100).toFixed(2) + '%';
        
        addLog('debug', 'Byte analysis', byteStats);
      } catch (e) {
        addLog('error', 'Error analyzing bytes', { error: e.message });
      }
    } catch (e) {
      addLog('error', 'Error inspecting raw data', { error: e.message });
    }
  };
  
  // Utility to test encryption/decryption directly
  const testBasicEncryption = async () => {
    if (!testText) {
      addLog('warn', 'No test text provided', null);
      return;
    }
    
    addLog('info', 'Testing basic encryption/decryption', { textLength: testText.length });
    
    try {
      // Generate AES key
      const aesKey = await window.crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256
        },
        true,
        ["encrypt", "decrypt"]
      );
      addLog('debug', 'Generated AES key', null);
      
      // Encrypt
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const data = new TextEncoder().encode(testText);
      
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        aesKey,
        data
      );
      
      addLog('debug', 'Encrypted data', { 
        encryptedSize: encryptedData.byteLength,
        ivSize: iv.byteLength
      });
      
      // Create a package
      const rawKeyData = await window.crypto.subtle.exportKey("raw", aesKey);
      
      const encryptedPackage = {
        iv: Array.from(iv),
        encryptedData: Array.from(new Uint8Array(encryptedData)),
        key: Array.from(new Uint8Array(rawKeyData))
      };
      
      const packageJson = JSON.stringify(encryptedPackage);
      addLog('debug', 'Created package', { jsonSize: packageJson.length });
      
      // Convert to hex for blockchain (simulate)
      const packageHex = '0x' + Array.from(new TextEncoder().encode(packageJson))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      addLog('debug', 'Package as hex', { hexSize: packageHex.length });
      
      // Convert back from hex
      const hexToString = (hex) => {
        const strippedHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        const bytes = new Uint8Array(strippedHex.length / 2);
        
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(strippedHex.substring(i * 2, i * 2 + 2), 16);
        }
        
        return new TextDecoder().decode(bytes);
      };
      
      const recoveredPackageJson = hexToString(packageHex);
      addLog('debug', 'Recovered package from hex', { jsonSize: recoveredPackageJson.length });
      
      // Parse and decrypt
      const recoveredPackage = JSON.parse(recoveredPackageJson);
      
      // Import the key
      const importedKey = await window.crypto.subtle.importKey(
        "raw",
        new Uint8Array(recoveredPackage.key),
        {
          name: "AES-GCM",
          length: 256
        },
        false,
        ["decrypt"]
      );
      
      // Decrypt
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: new Uint8Array(recoveredPackage.iv)
        },
        importedKey,
        new Uint8Array(recoveredPackage.encryptedData)
      );
      
      const decryptedText = new TextDecoder().decode(decryptedData);
      
      addLog('success', 'Successfully decrypted', { 
        decryptedLength: decryptedText.length,
        matches: decryptedText === testText
      });
      
    } catch (e) {
      addLog('error', 'Encryption test error', { error: e.message });
    }
  };
  
  const renderLogLevel = (level) => {
    const colors = {
      error: '#f44336',
      warn: '#ff9800',
      info: '#2196f3',
      debug: '#9e9e9e',
      success: '#4caf50'
    };
    
    return (
      <span 
        className="log-level" 
        style={{ 
          backgroundColor: colors[level] || '#9e9e9e',
          padding: '2px 6px',
          borderRadius: '3px',
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold'
        }}
      >
        {level.toUpperCase()}
      </span>
    );
  };
  
  const renderLogData = (data) => {
    if (data === null || data === undefined) return null;
    
    if (typeof data === 'object') {
      return (
        <pre className="log-data">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }
    
    return <span className="log-data">{data.toString()}</span>;
  };
  
  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h2>Debug Panel</h2>
        <div className="debug-tabs">
          <button 
            className={activeTab === 'logs' ? 'active' : ''} 
            onClick={() => setActiveTab('logs')}
          >
            Logs
          </button>
          <button 
            className={activeTab === 'tools' ? 'active' : ''} 
            onClick={() => setActiveTab('tools')}
          >
            Tools
          </button>
          <button 
            className={activeTab === 'data' ? 'active' : ''} 
            onClick={() => setActiveTab('data')}
          >
            Data Inspector
          </button>
        </div>
      </div>
      
      <div className="debug-content">
        {activeTab === 'logs' && (
          <div className="debug-logs">
            <div className="debug-controls">
              <button onClick={clearLogs}>Clear Logs</button>
              <button onClick={logState}>Log App State</button>
            </div>
            
            <div className="logs-container">
              {logs.map((log, index) => (
                <div className="log-entry" key={index}>
                  <div className="log-header">
                    <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    {renderLogLevel(log.level)}
                    <span className="log-message">{log.message}</span>
                  </div>
                  {renderLogData(log.data)}
                </div>
              ))}
              
              {logs.length === 0 && (
                <div className="empty-logs">No logs yet</div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'tools' && (
          <div className="debug-tools">
            <h3>Test Encryption/Decryption</h3>
            <div className="tool-section">
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Enter text to test encryption/decryption"
                rows={5}
              />
              <div className="tool-actions">
                <button onClick={runDataTest}>Test Hex Conversion</button>
                <button onClick={testBasicEncryption}>Test Encryption</button>
              </div>
            </div>
            
            <h3>Secret Reconstruction</h3>
            <div className="tool-section">
              <div className="tool-info">
                <p>Secret ID: {secretId || 'None selected'}</p>
                <p>Shares: {selectedShares.map(s => s.shareId).join(', ') || 'None selected'}</p>
              </div>
              <div className="tool-actions">
                <button 
                  onClick={onDebugReconstruction}
                  disabled={!secretId || selectedShares.length === 0}
                >
                  Test Reconstruction
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'data' && (
          <div className="data-inspector">
            <h3>Raw Data Inspector</h3>
            <div className="inspector-controls">
              <button 
                onClick={inspectRawData}
                disabled={!rawData}
              >
                Analyze Raw Data
              </button>
            </div>
            
            {!rawData && (
              <div className="no-data">
                <p>No data available for inspection.</p>
                <p>Perform a "Test Reconstruction" in the Tools tab to load data.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;