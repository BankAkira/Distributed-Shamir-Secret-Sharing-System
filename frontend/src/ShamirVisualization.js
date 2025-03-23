// ShamirVisualization.js
import React, { useState, useEffect } from 'react';

/**
 * A component that visualizes the Shamir secret sharing process
 * for educational purposes
 */
const ShamirVisualization = () => {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [secretText, setSecretText] = useState("A very secret message");
  const [numberOfShares, setNumberOfShares] = useState(3);
  const [threshold, setThreshold] = useState(2);
  const [shareData, setShareData] = useState([]);
  const [reconstructionShares, setReconstructionShares] = useState([]);
  const [reconstructedSecret, setReconstructedSecret] = useState('');

  // Colors for visualization
  const colors = ['#e91e63', '#2196f3', '#ff9800', '#4caf50', '#9c27b0', '#795548'];

  // Reset the simulation
  const resetSimulation = () => {
    setStep(0);
    setAnimating(false);
    setShareData([]);
    setReconstructionShares([]);
    setReconstructedSecret('');
  };

  // Run the simulation
  const runSimulation = async () => {
    resetSimulation();
    setAnimating(true);
    
    // Step 1: Convert secret to bytes
    await timeout(500);
    setStep(1);
    
    const secretBytes = new TextEncoder().encode(secretText);
    const byteArray = Array.from(secretBytes);
    
    await timeout(1000);
    setStep(2);
    
    // Step 2: Generate random coefficients for each polynomial
    const coefficients = [];
    for (let i = 0; i < byteArray.length; i++) {
      // Each byte gets its own polynomial
      const polynomial = [byteArray[i]]; // The first coefficient is the secret byte
      
      // Generate random coefficients for the polynomial
      for (let j = 1; j < threshold; j++) {
        polynomial.push(Math.floor(Math.random() * 256));
      }
      
      coefficients.push(polynomial);
    }
    
    await timeout(1000);
    setStep(3);
    
    // Step 3: Generate shares
    const shares = [];
    for (let i = 1; i <= numberOfShares; i++) {
      // Each share consists of x (the share index) and y values for each byte
      const shareValues = [];
      
      for (let b = 0; b < byteArray.length; b++) {
        // Evaluate the polynomial for this byte at x = i
        let y = coefficients[b][0]; // Start with the constant term (the secret)
        
        for (let j = 1; j < coefficients[b].length; j++) {
          // Compute x^j * coefficient[j]
          let term = coefficients[b][j];
          for (let k = 0; k < j; k++) {
            term = (term * i) % 256; // Simple modular multiplication
          }
          y = (y + term) % 256;
        }
        
        shareValues.push(y);
      }
      
      shares.push({
        x: i,
        yValues: shareValues,
        color: colors[(i - 1) % colors.length]
      });
    }
    
    setShareData(shares);
    
    await timeout(1000);
    setStep(4);
    
    // Step 4: Simulate distribution
    await timeout(1000);
    setStep(5);
    
    // Step 5: Reconstruct from a subset of shares
    // Select random shares for reconstruction (threshold number)
    const selectedIndices = [];
    while (selectedIndices.length < threshold) {
      const idx = Math.floor(Math.random() * numberOfShares);
      if (!selectedIndices.includes(idx)) {
        selectedIndices.push(idx);
      }
    }
    
    const selectedShares = selectedIndices.map(idx => shares[idx]);
    setReconstructionShares(selectedShares);
    
    await timeout(1000);
    setStep(6);
    
    // Step 6: Perform Lagrange interpolation
    const reconstructedBytes = new Uint8Array(byteArray.length);
    
    for (let b = 0; b < byteArray.length; b++) {
      // Interpolate each byte separately
      let result = 0;
      
      // Collect x and y values for this byte
      const xValues = selectedShares.map(s => s.x);
      const yValues = selectedShares.map(s => s.yValues[b]);
      
      // Perform Lagrange interpolation
      for (let i = 0; i < selectedShares.length; i++) {
        let term = yValues[i];
        
        for (let j = 0; j < selectedShares.length; j++) {
          if (i !== j) {
            // Calculate basis polynomial value
            // L_i(x) = Π (x - x_j) / (x_i - x_j)
            let numerator = 0 - xValues[j];
            numerator = numerator < 0 ? numerator + 256 : numerator;
            
            let denominator = xValues[i] - xValues[j];
            denominator = denominator < 0 ? denominator + 256 : denominator;
            
            // Find modular inverse of denominator
            let inverse = 1;
            for (let k = 1; k < 256; k++) {
              if ((denominator * k) % 256 === 1) {
                inverse = k;
                break;
              }
            }
            
            term = (term * numerator * inverse) % 256;
            if (term < 0) term += 256;
          }
        }
        
        result = (result + term) % 256;
      }
      
      reconstructedBytes[b] = result;
    }
    
    // Convert reconstructed bytes back to string
    const reconstructed = new TextDecoder().decode(reconstructedBytes);
    setReconstructedSecret(reconstructed);
    
    await timeout(1000);
    setStep(7);
    
    setAnimating(false);
  };

  // Helper function for animation timing
  const timeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Render a visualization of a share
  const renderShare = (share, idx, isReconstruction = false) => {
    return (
      <div
        key={`share-${idx}`}
        style={{
          border: `2px solid ${share.color}`,
          borderRadius: '8px',
          padding: '15px',
          margin: '10px',
          backgroundColor: `${share.color}0f`,
          position: 'relative',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          transform: isReconstruction ? 'scale(1.05)' : 'none',
          boxShadow: isReconstruction ? '0 4px 10px rgba(0,0,0,0.15)' : 'none'
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          Share {share.x}
        </div>
        <div style={{ 
          fontSize: '12px', 
          fontFamily: 'monospace',
          backgroundColor: 'rgba(255,255,255,0.8)',
          padding: '5px',
          borderRadius: '4px'
        }}>
          x={share.x}, y=[
          {share.yValues.slice(0, 5).map((y, i) => (
            <span key={i} style={{ display: 'inline-block', margin: '0 2px' }}>
              {y.toString(16).padStart(2, '0')}
            </span>
          ))}
          {share.yValues.length > 5 ? '...' : ''}
          ]
        </div>
        {isReconstruction && (
          <div style={{
            position: 'absolute',
            top: '-10px',
            right: '-10px',
            backgroundColor: share.color,
            color: 'white',
            borderRadius: '50%',
            width: '25px',
            height: '25px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            ✓
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      maxWidth: '1000px',
      margin: '0 auto'
    }}>
      <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>
        Shamir's Secret Sharing Visualization
      </h2>
      
      <div style={{ marginBottom: '20px' }}>
        <p>
          This visualization demonstrates how Shamir's Secret Sharing works by splitting
          a secret into multiple parts and then reconstructing it from a subset of those parts.
        </p>
      </div>
      
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Secret Text:
          </label>
          <input
            type="text"
            value={secretText}
            onChange={(e) => setSecretText(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
            disabled={animating}
          />
        </div>
        
        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Number of Shares:
          </label>
          <select
            value={numberOfShares}
            onChange={(e) => setNumberOfShares(parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
            disabled={animating}
          >
            {[2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        
        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Threshold:
          </label>
          <select
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
            disabled={animating || parseInt(threshold) > parseInt(numberOfShares)}
          >
            {Array.from({ length: numberOfShares - 1 }, (_, i) => i + 2).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        
        <div style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
          <button
            onClick={runSimulation}
            disabled={animating}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: animating ? 'not-allowed' : 'pointer',
              opacity: animating ? 0.7 : 1
            }}
          >
            {animating ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>
      </div>
      
      {/* Progress steps */}
      <div style={{
        display: 'flex',
        marginBottom: '30px',
        position: 'relative'
      }}>
        {[
          'Start',
          'Convert to Bytes',
          'Generate Polynomials',
          'Create Shares',
          'Distribute Shares',
          'Select Shares',
          'Reconstruct',
          'Complete'
        ].map((label, idx) => (
          <div key={idx} style={{
            flex: 1,
            textAlign: 'center',
            position: 'relative',
            zIndex: 1
          }}>
            <div style={{
              width: '25px',
              height: '25px',
              borderRadius: '50%',
              backgroundColor: idx <= step ? '#4caf50' : '#e0e0e0',
              color: idx <= step ? 'white' : '#555',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 5px',
              fontSize: '12px',
              transition: 'background-color 0.3s ease'
            }}>
              {idx + 1}
            </div>
            <div style={{
              fontSize: '12px',
              color: idx <= step ? '#333' : '#999',
              transition: 'color 0.3s ease'
            }}>
              {label}
            </div>
          </div>
        ))}
        
        <div style={{
          position: 'absolute',
          height: '2px',
          backgroundColor: '#e0e0e0',
          top: '12px',
          left: '15px',
          right: '15px',
          zIndex: 0
        }}></div>
        
        <div style={{
          position: 'absolute',
          height: '2px',
          backgroundColor: '#4caf50',
          top: '12px',
          left: '15px',
          width: `${Math.min(100, (step / 7) * 100)}%`,
          transition: 'width 0.5s ease',
          zIndex: 0
        }}></div>
      </div>
      
      {/* Visualization area */}
      <div style={{
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        minHeight: '300px'
      }}>
        {step === 0 && (
          <div style={{ textAlign: 'center', color: '#666', paddingTop: '100px' }}>
            Click "Run Simulation" to start the visualization
          </div>
        )}
        
        {step >= 1 && (
          <div>
            <h3 style={{ marginTop: 0 }}>Original Secret</h3>
            <div style={{
              backgroundColor: '#e8f5e9',
              padding: '15px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontFamily: 'monospace',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {secretText}
              
              {step === 1 && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(33, 150, 243, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 1s infinite'
                }}>
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                  }}>
                    Converting to bytes...
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {step >= 2 && (
          <div>
            <h3>Polynomial Creation</h3>
            <div style={{
              backgroundColor: '#e3f2fd',
              padding: '15px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontFamily: 'monospace'
            }}>
              Generating {threshold-1}-degree polynomials for each byte...
              {step === 2 && (
                <div style={{ 
                  marginTop: '10px',
                  height: '5px',
                  backgroundColor: '#bbdefb',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: '30%',
                    backgroundColor: '#2196f3',
                    borderRadius: '2px',
                    animation: 'progress 1.5s infinite'
                  }}></div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {step >= 3 && (
          <div>
            <h3>Generated Shares</h3>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              {shareData.map((share, idx) => renderShare(share, idx))}
            </div>
          </div>
        )}
        
        {step >= 5 && (
          <div style={{ marginTop: '30px' }}>
            <h3>Share Selection for Reconstruction</h3>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              {reconstructionShares.map((share, idx) => renderShare(share, idx, true))}
            </div>
            <div style={{
              textAlign: 'center',
              marginTop: '15px',
              padding: '10px',
              backgroundColor: '#e8eaf6',
              borderRadius: '4px'
            }}>
              Using {reconstructionShares.length} out of {shareData.length} shares for reconstruction
              {step === 5 && <span> (selecting shares...)</span>}
            </div>
          </div>
        )}
        
        {step >= 6 && (
          <div style={{ marginTop: '30px' }}>
            <h3>Secret Reconstruction</h3>
            <div style={{
              backgroundColor: '#fff3e0',
              padding: '15px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontFamily: 'monospace'
            }}>
              Applying Lagrange interpolation to reconstruct the secret...
              {step === 6 && (
                <div style={{ 
                  marginTop: '10px',
                  height: '5px',
                  backgroundColor: '#ffe0b2',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: '30%',
                    backgroundColor: '#ff9800',
                    borderRadius: '2px',
                    animation: 'progress 1.5s infinite'
                  }}></div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {step >= 7 && (
          <div style={{ marginTop: '30px' }}>
            <h3>Reconstructed Secret</h3>
            <div style={{
              backgroundColor: '#e8f5e9',
              padding: '15px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontFamily: 'monospace',
              border: '2px solid #4caf50'
            }}>
              {reconstructedSecret}
            </div>
            <div style={{
              textAlign: 'center',
              padding: '10px',
              backgroundColor: '#e8f5e9',
              borderRadius: '4px',
              color: '#2e7d32',
              fontWeight: 'bold'
            }}>
              {secretText === reconstructedSecret ? 
                '✓ Secret successfully reconstructed!' : 
                '✗ Reconstruction failed!'
              }
            </div>
          </div>
        )}
      </div>
      
      <style>
        {`
          @keyframes pulse {
            0% { background-color: rgba(33, 150, 243, 0.1); }
            50% { background-color: rgba(33, 150, 243, 0.2); }
            100% { background-color: rgba(33, 150, 243, 0.1); }
          }
          
          @keyframes progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
        `}
      </style>
    </div>
  );
};

export default ShamirVisualization;