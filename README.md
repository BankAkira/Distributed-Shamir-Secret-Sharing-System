# Distributed Shamir Secret Sharing System

A secure on-chain implementation of Shamir's Secret Sharing with isolated share storage.

## Overview

This system implements Shamir's Secret Sharing algorithm on Ethereum, with each share stored in a separate contract for enhanced security and isolation. The system uses a factory pattern with minimal proxies (EIP-1167) for gas-efficient deployment.

## Deployment Order

To deploy the contracts in the correct order:

1. First, deploy the `pyShamir.sol` contract (ShamirSecretSharing)
2. Then deploy the `OptimizedShamirRegistry.sol` contract, passing the address of the ShamirSecretSharing contract to the constructor

The OptimizedShamirRegistry's constructor will automatically:
* Deploy the ShareContract implementation
* Deploy the ShareContractFactory
* Set up the initial configuration

## Using the System

Once deployed, here's how to interact with the system:

### 1. Splitting a Secret

Call `splitAndDeploy` on the registry with:
* The secret data (bytes)
* Number of parts to create
* Threshold required to reconstruct
* Optional description
* Optional array of initial share owners

```solidity
// Example: Split a secret into 3 parts, requiring 2 to reconstruct
bytes memory secret = abi.encode("My sensitive data");
uint8 parts = 3;
uint8 threshold = 2;
string memory description = "Important credentials";
address[] memory owners = new address[](3);
owners[0] = address1;
owners[1] = address2;
owners[2] = address3;

uint256 secretId = registry.splitAndDeploy(secret, parts, threshold, description, owners);
```

### 2. Managing Share Access

Each share owner can:

```solidity
// Get the address of a specific share contract
address shareContractAddr = registry.getShareContractAddress(secretId, shareIndex);
IShareContract shareContract = IShareContract(shareContractAddr);

// Grant access to another user
shareContract.grantAccess(userAddress);

// Transfer ownership to another user
shareContract.transferOwnership(newOwnerAddress);

// Revoke access from a user
shareContract.revokeAccess(userAddress);
```

### 3. Reconstructing a Secret

To reconstruct a secret:

```solidity
// Collect indices of shares you have access to
uint8[] memory shareIndices = new uint8[](2);
shareIndices[0] = 1; // First share
shareIndices[2] = 3; // Third share

// Reconstruct the secret
bytes memory reconstructedSecret = registry.reconstructSecret(secretId, shareIndices);
```

## System Security

This implementation addresses several security concerns:

1. **Isolation**: Each share is stored in a separate contract
2. **Access Control**: Fine-grained control over who can access each share
3. **Reentrancy Protection**: Guards against reentrant attacks
4. **Index Validation**: Prevents duplicate and out-of-range indices
5. **Emergency Controls**: Pause functionality and emergency destroy options
6. **Gas Optimization**: Uses the minimal proxy pattern for efficient deployment

## Key Contract Interactions

1. The Registry deploys and manages share contracts
2. Share contracts store individual shares and manage access rights
3. The Factory efficiently deploys new share contracts using cloning
4. When reconstructing a secret, the Registry collects shares from multiple contracts

## Maintaining the System

As an owner of the registry, you can:
* Pause/unpause the system in emergencies
* Update the factory or implementation contracts if needed
* Transfer ownership of the registry
* Destroy compromised share contracts

## Security Considerations

Before deploying to a production environment:

- Conduct a thorough security audit of all contracts
- Test extensively with different scenarios and edge cases
- Consider implementing additional security measures such as:
  - Time-delay for emergency operations
  - Multi-signature requirements for critical actions
  - Additional access control layers

## Contract Structure

- **pyShamir.sol**: Implementation of Shamir's Secret Sharing algorithm
- **IShareContract.sol**: Interface for Share Contracts
- **IShamirRegistry.sol**: Interface for the Registry
- **ShareContract.sol**: Contract to store a single share with access control
- **ShareContractFactory.sol**: Factory for efficient share contract deployment
- **OptimizedShamirRegistry.sol**: Main registry that coordinates the system

## License

MIT

## Disclaimer

This code is provided as-is. Use at your own risk and always conduct proper security audits before deploying contracts that handle sensitive data.
