// ShamirClient.js
// Client-side implementation of Shamir's Secret Sharing

const ShamirClient = {
  // Finite field operations in GF(256)
  gf256: {
    // Addition in GF(256) is XOR
    add: (a, b) => a ^ b,
    
    // Multiplication in GF(256)
    mul: (a, b) => {
      let result = 0;
      let temp_a = a;
      let temp_b = b;
      
      for (let i = 0; i < 8; i++) {
        if ((temp_b & 1) !== 0) {
          result ^= temp_a;
        }
        
        const highBitSet = (temp_a & 0x80) !== 0;
        temp_a <<= 1;
        
        if (highBitSet) {
          temp_a ^= 0x1B; // GF(256) irreducible polynomial: x^8 + x^4 + x^3 + x + 1
        }
        
        temp_b >>= 1;
      }
      
      return result & 0xFF;
    },
    
    // Division in GF(256)
    div: (a, b) => {
      if (b === 0) throw new Error("Division by zero in GF(256)");
      if (a === 0) return 0;
      
      return ShamirClient.gf256.mul(a, ShamirClient.gf256.inverse(b));
    },
    
    // Find the multiplicative inverse in GF(256)
    inverse: (a) => {
      if (a === 0) throw new Error("Cannot invert zero in GF(256)");
      
      // Extended Euclidean algorithm to find inverse in GF(256)
      // We're using a lookup table for performance
      const inverseTable = [
        0x00, 0x01, 0x8D, 0xF6, 0xCB, 0x52, 0x7B, 0xD1, 0xE8, 0x4F, 0x29, 0xC0, 0xB0, 0xE1, 0xE5, 0xC7, 
        0x74, 0xB4, 0xAA, 0x4B, 0x99, 0x2B, 0x60, 0x5F, 0x58, 0x3F, 0xFD, 0xCC, 0xFF, 0x40, 0xEE, 0xB2, 
        0x3A, 0x6E, 0x5A, 0xF1, 0x55, 0x4D, 0xA8, 0xC9, 0xC1, 0x0A, 0x98, 0x15, 0x30, 0x44, 0xA2, 0xC2, 
        0x2C, 0x45, 0x92, 0x6C, 0xF3, 0x39, 0x66, 0x42, 0xF2, 0x35, 0x20, 0x6F, 0x77, 0xBB, 0x59, 0x19, 
        0x1D, 0xFE, 0x37, 0x67, 0x2D, 0x31, 0xF5, 0x69, 0xA7, 0x64, 0xAB, 0x13, 0x54, 0x25, 0xE9, 0x09, 
        0xED, 0x5C, 0x05, 0xCA, 0x4C, 0x24, 0x87, 0xBF, 0x18, 0x3E, 0x22, 0xF0, 0x51, 0xEC, 0x61, 0x17, 
        0x16, 0x5E, 0xAF, 0xD3, 0x49, 0xA6, 0x36, 0x43, 0xF4, 0x47, 0x91, 0xDF, 0x33, 0x93, 0x21, 0x3B, 
        0x79, 0xB7, 0x97, 0x85, 0x10, 0xB5, 0xBA, 0x3C, 0xB6, 0x70, 0xD0, 0x06, 0xA1, 0xFA, 0x81, 0x82, 
        0x83, 0x7E, 0x7F, 0x80, 0x96, 0x73, 0xBE, 0x56, 0x9B, 0x9E, 0x95, 0xD9, 0xF7, 0x02, 0xB9, 0xA4, 
        0xDE, 0x6A, 0x32, 0x6D, 0xD8, 0x8A, 0x84, 0x72, 0x2A, 0x14, 0x9F, 0x88, 0xF9, 0xDC, 0x89, 0x9A, 
        0xFB, 0x7C, 0x2E, 0xC3, 0x8F, 0xB8, 0x65, 0x48, 0x26, 0xC8, 0x12, 0x4A, 0xCE, 0xE7, 0xD2, 0x62, 
        0x0C, 0xE0, 0x1F, 0xEF, 0x11, 0x75, 0x78, 0x71, 0xA5, 0x8E, 0x76, 0x3D, 0xBD, 0xBC, 0x86, 0x57, 
        0x0B, 0x28, 0x2F, 0xA3, 0xDA, 0xD4, 0xE4, 0x0F, 0xA9, 0x27, 0x53, 0x04, 0x1B, 0xFC, 0xAC, 0xE6, 
        0x7A, 0x07, 0xAE, 0x63, 0xC5, 0xDB, 0xE2, 0xEA, 0x94, 0x8B, 0xC4, 0xD5, 0x9D, 0xF8, 0x90, 0x6B, 
        0xB1, 0x0D, 0xD6, 0xEB, 0xC6, 0x0E, 0xCF, 0xAD, 0x08, 0x4E, 0xD7, 0xE3, 0x5D, 0x50, 0x1E, 0xB3, 
        0x5B, 0x23, 0x38, 0x34, 0x68, 0x46, 0x03, 0x8C, 0xDD, 0x9C, 0x7D, 0xA0, 0xCD, 0x1A, 0x41, 0x1C
      ];
      
      return inverseTable[a];
    }
  },
  
  // Lagrange interpolation to reconstruct the secret
  interpolate: (shares, x) => {
    let result = 0;
    const gf256 = ShamirClient.gf256;
    
    // Collect x values (the share indices)
    const xValues = shares.map(s => s.x);
    const yValues = shares.map(s => s.y);
    
    // Perform Lagrange interpolation
    for (let i = 0; i < shares.length; i++) {
      let basis = 1; // Lagrange basis polynomial
      
      for (let j = 0; j < shares.length; j++) {
        if (i !== j) {
          // Calculate basis polynomial value
          // L_i(x) = Π (x - x_j) / (x_i - x_j)
          const num = gf256.add(x, xValues[j]);
          const denom = gf256.add(xValues[i], xValues[j]);
          const term = gf256.div(num, denom);
          basis = gf256.mul(basis, term);
        }
      }
      
      // Multiply basis by y value and add to result
      const contribution = gf256.mul(yValues[i], basis);
      result = gf256.add(result, contribution);
    }
    
    return result;
  },
  
  // Safely convert ethers.js bytes to a regular Uint8Array
  safelyConvertBytes: (data) => {
    // Check if it's already an array or Uint8Array
    if (Array.isArray(data) || data instanceof Uint8Array) {
      return new Uint8Array(data);
    }
    
    // If it's an ethers.js Bytes object (has a hex representation)
    if (typeof data === 'object' && data._hex) {
      // Convert hex string to bytes
      const hex = data._hex.startsWith('0x') ? data._hex.slice(2) : data._hex;
      const bytes = new Uint8Array(hex.length / 2);
      
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      
      return bytes;
    }
    
    // If it's a hex string
    if (typeof data === 'string' && data.startsWith('0x')) {
      const hex = data.slice(2);
      const bytes = new Uint8Array(hex.length / 2);
      
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      
      return bytes;
    }
    
    // If we got here, we don't know how to handle this data
    console.error("Unknown data format:", data);
    throw new Error("Could not convert share data to bytes. Unknown format.");
  },
  
  // Reconstruct a secret from shares
  reconstructSecret: (shares) => {
    if (!shares || shares.length < 2) {
      throw new Error("At least 2 shares are required for reconstruction");
    }
    
    // Log the shares for debugging
    console.log("Shares received:", shares);
    
    try {
      // Extract the shares data and parse it
      const parsedShares = shares.map(shareData => {
        // Convert whatever format we received to a Uint8Array
        const bytes = ShamirClient.safelyConvertBytes(shareData);
        
        if (bytes.length === 0) {
          throw new Error("Share data is empty");
        }
        
        // Get the x coordinate (the last byte of each share)
        const x = bytes[bytes.length - 1];
        
        // Get the y values (all bytes except the last one)
        const yValues = bytes.slice(0, bytes.length - 1);
        
        return { x, yValues };
      });
      
      // Ensure all shares have yValues and they're all the same length
      if (parsedShares.some(share => !share.yValues || share.yValues.length === 0)) {
        throw new Error("One or more shares have no data");
      }
      
      const lengths = parsedShares.map(share => share.yValues.length);
      const allSameLength = lengths.every(len => len === lengths[0]);
      
      if (!allSameLength) {
        throw new Error("Shares have inconsistent data lengths");
      }
      
      // The length of the reconstructed secret is the length of the y values
      const secretLength = parsedShares[0].yValues.length;
      
      // Prepare buffer for the reconstructed secret
      const secretBytes = new Uint8Array(secretLength);
      
      // Reconstruct each byte of the secret
      for (let i = 0; i < secretLength; i++) {
        // Collect the shares for this byte position
        const sharesForPosition = parsedShares.map(share => ({
          x: share.x,
          y: share.yValues[i]
        }));
        
        // Interpolate to find the original value
        secretBytes[i] = ShamirClient.interpolate(sharesForPosition, 0);
      }
      
      return secretBytes;
    } catch (error) {
      console.error("Error in reconstructSecret:", error);
      throw new Error(`Failed to reconstruct secret: ${error.message}`);
    }
  },
  
  // Utility to convert bytes to string
  bytesToString: (bytes) => {
    try {
      // Try to decode as UTF-8
      return new TextDecoder().decode(bytes);
    } catch (err) {
      // If decoding fails, return a hex representation
      return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  }
};

export default ShamirClient;