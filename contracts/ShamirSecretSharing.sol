// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ShamirSecretSharing {
    // Debug events to log inputs and outputs
    event DebugSplit(uint8 parts, uint8 threshold, uint secretLength, bytes32 seed);
    event DebugSplitOutput(uint partsGenerated, uint firstPartLength);
    event DebugCombine(uint partsCount, uint firstPartLength);
    event DebugCombineOutput(uint secretLength);
    event DebugPolynomial(uint8 degree, uint8 intercept);
    event DebugEvaluation(uint8 x, uint8 value);
    
    // Store the last split parts for easy retrieval (in a real application, you'd use events)
    bytes[] private lastSplitParts;
    
    // Utility functions for finite field operations in GF(256)
    
    /**
     * @dev Adds two numbers in the finite field GF(256)
     */
    function add(uint8 a, uint8 b) internal pure returns (uint8) {
        return a ^ b;
    }
    
    /**
     * @dev Multiplies two numbers in the finite field GF(256)
     */
    function mul(uint8 a, uint8 b) internal pure returns (uint8) {
        uint8 r = 0;
        int8 i = 8;
        
        while (i > 0) {
            i--;
            uint8 p1 = (((b >> uint8(i)) & 1) == 1) ? a : 0;
            uint8 p2 = (((r >> 7) & 1) == 1) ? 0x1B : 0;
            uint8 p3 = r << 1;
            r = uint8(p1 ^ p2 ^ p3);
        }
        
        return r;
    }
    
    /**
     * @dev Calculates the multiplicative inverse in GF(256)
     */
    function inverse(uint8 a) internal pure returns (uint8) {
        require(a != 0, "Cannot calculate inverse of 0");
        
        uint8 b = mul(a, a);
        uint8 c = mul(a, b);
        b = mul(c, c);
        b = mul(b, b);
        c = mul(b, c);
        b = mul(b, b);
        b = mul(b, b);
        b = mul(b, c);
        b = mul(b, b);
        b = mul(a, b);
        return mul(b, b);
    }
    
    /**
     * @dev Divides two numbers in the finite field GF(256)
     */
    function div(uint8 a, uint8 b) internal pure returns (uint8) {
        require(b != 0, "Division by zero");
        if (a == 0) return 0;
        return mul(a, inverse(b));
    }
    
    /**
     * @dev Represents a polynomial with coefficients in GF(256)
     */
    struct Polynomial {
        uint8[] coefficients;
    }
    
    /**
     * @dev Evaluates a polynomial at point x using Horner's method
     */
    function evaluatePolynomial(Polynomial memory poly, uint8 x) internal returns (uint8) {
        // Origin case
        if (x == 0) {
            emit DebugEvaluation(x, poly.coefficients[0]);
            return poly.coefficients[0];
        }
        
        uint degree = poly.coefficients.length - 1;
        uint8 out = poly.coefficients[degree];
        
        for (int i = int(degree) - 1; i >= 0; i--) {
            uint8 coeff = poly.coefficients[uint(i)];
            // uint8 prev = out;
            out = add(mul(out, x), coeff);
            
            // Log intermediate values for the first few iterations if needed
            if (i >= int(degree) - 3) {
                emit DebugEvaluation(
                    x, 
                    out
                );
            }
        }
        
        return out;
    }
    
    /**
     * @dev Creates a polynomial with given intercept and degree
     */
    function makePolynomial(uint8 intercept, uint8 degree, bytes32 seed) internal returns (Polynomial memory) {
        emit DebugPolynomial(degree, intercept);
        
        Polynomial memory poly;
        poly.coefficients = new uint8[](degree + 1);
        poly.coefficients[0] = intercept;
        
        // Generate pseudo-random coefficients using the seed
        for (uint8 i = 1; i <= degree; i++) {
            poly.coefficients[i] = uint8(uint(keccak256(abi.encodePacked(seed, i))));
        }
        
        return poly;
    }
    
    /**
     * @dev Interpolates a polynomial using Lagrange interpolation
     */
    function interpolatePolynomial(uint8[] memory xSamples, uint8[] memory ySamples, uint8 x) internal returns (uint8) {
        uint limit = xSamples.length;
        uint8 result = 0;
        
        for (uint i = 0; i < limit; i++) {
            uint8 basis = 1;
            for (uint j = 0; j < limit; j++) {
                if (i != j) {
                    uint8 num = add(x, xSamples[j]);
                    uint8 den = add(xSamples[i], xSamples[j]);
                    uint8 term = div(num, den);
                    basis = mul(basis, term);
                    
                    // Log intermediate calculations for the first point only
                    if (i == 0 && j < 2) {
                        emit DebugEvaluation(term, basis);
                    }
                }
            }
            uint8 group = mul(ySamples[i], basis);
            // uint8 prevResult = result;
            result = add(result, group);
            
            // Log intermediate results
            if (i < 2) {
                emit DebugEvaluation(group, result);
            }
        }
        
        return result;
    }
    
    /**
     * @dev Generates unique x coordinates
     */
    function generateXCoordinates(uint8 n, bytes32 seed) internal pure returns (uint8[] memory) {
        uint8[] memory xCoordinates = new uint8[](n);
        bool[] memory used = new bool[](256);
        
        for (uint8 i = 0; i < n; i++) {
            // Generate a pseudo-random number using the seed and counter
            uint8 x = uint8(uint(keccak256(abi.encodePacked(seed, i))) % 255) + 1;
            
            // Find an unused value (simple linear probing)
            while (used[x]) {
                x = (x + 1) % 255 + 1; // Ensure x is never 0
            }
            
            xCoordinates[i] = x;
            used[x] = true;
        }
        
        return xCoordinates;
    }
    
    /**
     * @dev Returns the last generated split parts
     * @return An array of bytes with each part
     */
    function getLastSplitParts() public view returns (bytes[] memory) {
        return lastSplitParts;
    }
    
    /**
     * @dev Splits a secret into parts
     * @param secret The secret to split
     * @param parts The number of parts to create
     * @param threshold The minimum number of parts needed to reconstruct the secret
     * @param seed A random seed for generating the polynomial
     * @return An array of bytes with each part
     */
    function split(bytes memory secret, uint8 parts, uint8 threshold, bytes32 seed) public returns (bytes[] memory) {
        // Log input parameters for debugging
        emit DebugSplit(parts, threshold, secret.length, seed);
        
        // Sanity checks
        require(parts >= 2 && threshold >= 2, "Parts and threshold must be greater than 1");
        require(parts >= threshold, "Parts must be greater than or equal to threshold");
        require(parts <= 255, "Parts must be less than 256");
        require(secret.length >= 1, "Secret must be at least 1 byte long");
        
        // Generate x coordinates
        uint8[] memory xCoordinates = generateXCoordinates(parts, seed);
        
        // Log the first few x coordinates
        for (uint i = 0; i < parts && i < 5; i++) {
            emit DebugEvaluation(xCoordinates[i], 0); // Using DebugEvaluation to log xCoordinates
        }
        
        // Allocate output array
        bytes[] memory output = new bytes[](parts);
        for (uint i = 0; i < parts; i++) {
            bytes memory part = new bytes(secret.length + 1);
            part[secret.length] = bytes1(xCoordinates[i]);
            output[i] = part;
        }
        
        // Split the secret
        for (uint i = 0; i < secret.length; i++) {
            // Only log a sample of bytes for very large secrets
            if (i < 5 || i % (secret.length / 10) == 0) {
                emit DebugEvaluation(uint8(i), uint8(uint8(secret[i]))); // Log the original secret byte
            }
            
            Polynomial memory polynomial = makePolynomial(uint8(uint8(secret[i])), threshold - 1, keccak256(abi.encodePacked(seed, i)));
            
            for (uint j = 0; j < parts; j++) {
                uint8 x = xCoordinates[j];
                uint8 y = evaluatePolynomial(polynomial, x);
                output[j][i] = bytes1(y);
                
                // Only log a sample for debugging
                if (i < 2 && j < 2) {
                    emit DebugEvaluation(x, y); // Log the generated share value
                }
            }
        }
        
        // Store the last split parts for easy retrieval
        lastSplitParts = output;
        
        // Log output information
        emit DebugSplitOutput(output.length, output.length > 0 ? output[0].length : 0);
        
        return output;
    }
    
    /**
     * @dev Combines parts to reconstruct the secret
     * @param parts An array of bytes with each part
     * @return The reconstructed secret
     */
    function combine(bytes[] memory parts) public returns (bytes memory) {
        // Log input parameters for debugging
        emit DebugCombine(parts.length, parts.length > 0 ? parts[0].length : 0);
        
        // Verify enough parts are present
        require(parts.length >= 2, "Not enough parts to combine");
        
        // Verify all parts are the same length
        uint firstPartLen = parts[0].length;
        require(firstPartLen >= 2, "Part is too short");
        
        for (uint i = 1; i < parts.length; i++) {
            require(parts[i].length == firstPartLen, "Parts are not the same length");
        }
        
        // Create a buffer to store the reconstructed secret
        bytes memory secret = new bytes(firstPartLen - 1);
        
        // Buffers to store the samples
        uint8[] memory xSamples = new uint8[](parts.length);
        uint8[] memory ySamples = new uint8[](parts.length);
        
        // Set the x value for each sample and ensure no duplicate values
        bool[256] memory checkMap;
        
        for (uint i = 0; i < parts.length; i++) {
            uint8 samp = uint8(uint8(parts[i][firstPartLen - 1]));
            require(!checkMap[samp], "Duplicate sample");
            checkMap[samp] = true;
            xSamples[i] = samp;
            
            // Log x values for debugging
            emit DebugEvaluation(samp, 0); // Using DebugEvaluation to log x values
        }
        
        // Reconstruct each byte
        for (uint idx = 0; idx < firstPartLen - 1; idx++) {
            // Only debug log a sample of bytes for very large secrets
            bool shouldLog = (idx < 5 || idx % (firstPartLen / 10) == 0);
            
            for (uint i = 0; i < parts.length; i++) {
                ySamples[i] = uint8(uint8(parts[i][idx]));
                
                // Log y samples for debugging (only for the first few bytes)
                if (shouldLog && i < 3) {
                    emit DebugEvaluation(xSamples[i], ySamples[i]);
                }
            }
            
            // Interpolate the polynomial and compute the value at 0
            uint8 val = interpolatePolynomial(xSamples, ySamples, 0);
            
            // Log the recovered value for debugging (only for the first few bytes)
            if (shouldLog) {
                emit DebugEvaluation(0, val);
            }
            
            // Set the reconstructed byte
            secret[idx] = bytes1(val);
        }
        
        // Log output information
        emit DebugCombineOutput(secret.length);
        
        return secret;
    }
}