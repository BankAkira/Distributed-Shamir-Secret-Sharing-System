// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IShareContract.sol";

/**
 * @title ShareContractFactory
 * @dev Factory contract for deploying ShareContracts with minimal gas cost
 */
contract ShareContractFactory {
    // Registry address
    address public registryAddress;
    
    // Events
    event ShareContractCreated(address indexed contractAddress, uint256 indexed secretId, uint8 shareIndex);
    
    /**
     * @dev Constructor to set the registry address
     * @param _registryAddress Address of the ShamirSecretRegistry contract
     */
    constructor(address _registryAddress) {
        require(_registryAddress != address(0), "Registry address cannot be zero");
        registryAddress = _registryAddress;
    }
    
    /**
     * @dev Creates a new ShareContract using minimal proxy pattern (EIP-1167)
     * @param implementation The address of the ShareContract implementation
     * @param secretId The ID of the secret
     * @param shareIndex The index of this share
     * @param shareData The share data
     * @param owner The initial owner of the share
     * @return The address of the newly created ShareContract
     */
    function createShareContract(
        address implementation,
        uint256 secretId,
        uint8 shareIndex,
        bytes memory shareData,
        address owner
    ) public returns (address) {
        require(msg.sender == registryAddress, "Only registry can create share contracts");
        require(implementation != address(0), "Implementation cannot be zero address");
        require(owner != address(0), "Owner cannot be zero address");
        
        // Create clone using minimal proxy pattern
        address clone = createClone(implementation);
        
        // Initialize the clone
        IShareContract(clone).initialize(secretId, shareIndex, shareData, owner, registryAddress);
        
        emit ShareContractCreated(clone, secretId, shareIndex);
        
        return clone;
    }
    
    // /**
    //  * @dev Creates a minimal proxy clone of an existing contract (EIP-1167)
    //  * @param target The implementation contract to clone
    //  * @return The address of the newly created clone
    //  */
    function createClone(address target) internal returns (address result) {
        bytes20 targetBytes = bytes20(target);
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x14), targetBytes)
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            result := create(0, clone, 0x37)
        }
        return result;
    }
}