// AsymmetricEncryption.js
// Public key cryptography with ephemeral keys for secure secret sharing

const AsymmetricEncryption = {
    // Generate a new key pair for a user
    generateKeyPair: async () => {
      return await window.crypto.subtle.generateKey(
        {
          name: "ECDH",
          namedCurve: "P-256",  // More secure curves available like P-384 or P-521
        },
        true, // extractable
        ["deriveKey", "deriveBits"]
      );
    },
  
    // Export public key to a format that can be stored on chain
    exportPublicKey: async (publicKey) => {
      const exported = await window.crypto.subtle.exportKey("spki", publicKey);
      return btoa(String.fromCharCode.apply(null, new Uint8Array(exported)));
    },
  
    // Import public key from string format
    importPublicKey: async (publicKeyString) => {
      const binaryString = atob(publicKeyString);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return await window.crypto.subtle.importKey(
        "spki",
        bytes,
        {
          name: "ECDH",
          namedCurve: "P-256",
        },
        true,
        []
      );
    },
  
    // Export private key - WARNING: Handle with extreme care
    exportPrivateKey: async (privateKey) => {
      const exported = await window.crypto.subtle.exportKey("pkcs8", privateKey);
      return btoa(String.fromCharCode.apply(null, new Uint8Array(exported)));
    },
  
    // Import private key from string format
    importPrivateKey: async (privateKeyString) => {
      const binaryString = atob(privateKeyString);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return await window.crypto.subtle.importKey(
        "pkcs8",
        bytes,
        {
          name: "ECDH",
          namedCurve: "P-256",
        },
        true,
        ["deriveKey", "deriveBits"]
      );
    },
  
    // Encrypt a secret for multiple recipients
    encryptForRecipients: async (secret, recipientPublicKeys) => {
      // Generate an ephemeral key pair (used just for this encryption)
      const ephemeralKeyPair = await AsymmetricEncryption.generateKeyPair();
      const ephemeralPublicKey = await AsymmetricEncryption.exportPublicKey(ephemeralKeyPair.publicKey);
      
      // Generate a random AES key for actual encryption
      const aesKey = await window.crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256
        },
        true,
        ["encrypt", "decrypt"]
      );
      
      // Encrypt the secret with the AES key
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const secretBytes = new TextEncoder().encode(secret);
      const encryptedSecret = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        aesKey,
        secretBytes
      );
      
      // Export the AES key
      const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
      
      // Encrypt the AES key for each recipient using their public key
      const recipientKeys = [];
      
      for (let i = 0; i < recipientPublicKeys.length; i++) {
        // Import recipient's public key
        const recipientPublicKey = await AsymmetricEncryption.importPublicKey(recipientPublicKeys[i]);
        
        // Derive a shared secret using ephemeral private key and recipient's public key
        const sharedSecret = await window.crypto.subtle.deriveBits(
          {
            name: "ECDH",
            public: recipientPublicKey
          },
          ephemeralKeyPair.privateKey,
          256 // 256 bits
        );
        
        // Convert shared secret to a key for encryption
        const derivedKey = await window.crypto.subtle.importKey(
          "raw",
          sharedSecret,
          {
            name: "AES-GCM",
            length: 256
          },
          false,
          ["encrypt"]
        );
        
        // Encrypt the AES key with the derived key
        const keyIv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedKey = await window.crypto.subtle.encrypt(
          {
            name: "AES-GCM",
            iv: keyIv
          },
          derivedKey,
          rawAesKey
        );
        
        // Store recipient information
        recipientKeys.push({
          keyIv: Array.from(keyIv),
          encryptedKey: Array.from(new Uint8Array(encryptedKey))
        });
      }
      
      // Package everything together
      const result = {
        ephemeralPublicKey: ephemeralPublicKey,
        iv: Array.from(iv),
        encryptedSecret: Array.from(new Uint8Array(encryptedSecret)),
        recipientKeys: recipientKeys
      };
      
      // Convert to JSON for blockchain storage
      return JSON.stringify(result);
    },
  
    // Decrypt a secret using the recipient's private key
    decryptWithPrivateKey: async (encryptedPackage, privateKeyString) => {
      // Parse the encrypted package
      const pkg = JSON.parse(encryptedPackage);
      
      // Import the recipient's private key
      const privateKey = await AsymmetricEncryption.importPrivateKey(privateKeyString);
      
      // Import the ephemeral public key
      const ephemeralPublicKey = await AsymmetricEncryption.importPublicKey(pkg.ephemeralPublicKey);
      
      // Derive the same shared secret using recipient's private key and ephemeral public key
      const sharedSecret = await window.crypto.subtle.deriveBits(
        {
          name: "ECDH",
          public: ephemeralPublicKey
        },
        privateKey,
        256 // 256 bits
      );
      
      // Convert shared secret to a key for decryption
      const derivedKey = await window.crypto.subtle.importKey(
        "raw",
        sharedSecret,
        {
          name: "AES-GCM",
          length: 256
        },
        false,
        ["decrypt"]
      );
  
      // Try to decrypt each recipient key until one works
      let aesKey = null;
      
      for (let i = 0; i < pkg.recipientKeys.length; i++) {
        try {
          const recipientInfo = pkg.recipientKeys[i];
          const keyIv = new Uint8Array(recipientInfo.keyIv);
          const encryptedKey = new Uint8Array(recipientInfo.encryptedKey);
          
          // Try to decrypt the AES key
          const decryptedKeyBuffer = await window.crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: keyIv
            },
            derivedKey,
            encryptedKey
          );
          
          // If we get here, decryption succeeded
          aesKey = await window.crypto.subtle.importKey(
            "raw",
            decryptedKeyBuffer,
            {
              name: "AES-GCM",
              length: 256
            },
            false,
            ["decrypt"]
          );
          
          break;  // Found the right key
        } catch (e) {
          // This wasn't the right key, try the next one
          continue;
        }
      }
      
      if (!aesKey) {
        throw new Error("Failed to decrypt the secret. This key cannot access the secret.");
      }
      
      // Decrypt the actual secret with the AES key
      const iv = new Uint8Array(pkg.iv);
      const encryptedSecret = new Uint8Array(pkg.encryptedSecret);
      
      const decryptedSecret = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        aesKey,
        encryptedSecret
      );
      
      // Convert back to text
      return new TextDecoder().decode(decryptedSecret);
    },
    
    // Utility function to convert encrypted data to hex for blockchain storage
    toHex: (str) => {
      return '0x' + Array.from(new TextEncoder().encode(str))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    },
    
    // Utility function to convert hex back to encrypted data
    fromHex: (hex) => {
      const strippedHex = hex.startsWith('0x') ? hex.slice(2) : hex;
      const bytes = new Uint8Array(strippedHex.length / 2);
      
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(strippedHex.substring(i * 2, i * 2 + 2), 16);
      }
      
      return new TextDecoder().decode(bytes);
    }
  };
  
  export default AsymmetricEncryption;