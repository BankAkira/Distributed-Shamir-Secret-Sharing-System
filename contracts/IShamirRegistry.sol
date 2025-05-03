// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IShamirRegistry
 * @dev Interface for interacting with the registry contract
 */
interface IShamirRegistry {
    function splitAndDeploy(
        bytes memory secret, 
        uint8 parts, 
        uint8 threshold, 
        string memory description,
        address[] memory initialOwners
    ) external returns (uint256);
    
    function reconstructSecret(uint256 secretId, uint8[] memory shareIndices) external returns (bytes memory);
    
    function getSecretInfo(uint256 secretId) external view returns (
        uint8 parts,
        uint8 threshold,
        uint256 timestamp,
        string memory description,
        uint256 lastAccessTimestamp,
        uint256 accessCount,
        uint256 dataSize
    );
    
    function getShareContractAddress(uint256 secretId, uint8 shareIndex) external view returns (address);
    function getMySecrets() external view returns (uint256[] memory);
    function getMySharesForSecret(uint256 secretId) external view returns (uint8[] memory);
    function secretExists(uint256 secretId) external view returns (bool);
    function updateUserSecrets(address user, uint256 secretId, bool hasAccess) external;
    function emitAccessManagementEvent(uint256 secretId, uint8 shareIndex, string calldata action, address user, address performer) external;
}