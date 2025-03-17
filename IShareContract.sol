// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IShareContract
 * @dev Interface for interacting with share contracts
 */
interface IShareContract {
    function initialize(uint256 _secretId, uint8 _shareIndex, bytes memory _shareData, address _owner, address _registryAddress) external;
    function secretId() external view returns (uint256);
    function shareIndex() external view returns (uint8);
    function owner() external view returns (address);
    function registryAddress() external view returns (address);
    function canAccess(address user) external view returns (bool);
    function getShareData(address requester) external view returns (bytes memory);
    function transferOwnership(address newOwner) external;
    function grantAccess(address user) external;
    function revokeAccess(address user) external;
    function emergencyDestroy() external;
}