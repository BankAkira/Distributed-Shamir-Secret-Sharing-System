// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IShareContract.sol";
import "./IShamirRegistry.sol";

/**
 * @title ShareContract
 * @dev A contract that stores a single share of a secret, optimized for cloning
 */
contract ShareContract is IShareContract {
    // Share information
    uint256 public secretId;      // ID of the secret this share belongs to
    uint8 public shareIndex;      // Index of this share
    bytes private shareData;      // The actual share data (private)
    address public owner;         // Current owner of the share
    address public registryAddress; // Address of the registry contract
    
    // Flag to prevent reinitialization
    bool private initialized;
    
    // Reentrancy guard
    bool private _locked;
    
    // Access control
    mapping(address => bool) public authorizedUsers;
    
    // Events
    event Initialized(uint256 secretId, uint8 shareIndex, address owner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AccessGranted(address indexed user);
    event AccessRevoked(address indexed user);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier notInitialized() {
        require(!initialized, "Contract already initialized");
        _;
    }
    
    modifier nonReentrant() {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }
    
    /**
     * @dev Empty constructor for implementation contract
     */
    constructor() {}
    
    /**
     * @dev Initializes the contract (replaces constructor for clones)
     * @param _secretId The ID of the secret
     * @param _shareIndex The index of this share
     * @param _shareData The share data
     * @param _owner The initial owner of the share
     * @param _registryAddress The address of the registry contract
     */
    function initialize(
        uint256 _secretId,
        uint8 _shareIndex,
        bytes memory _shareData,
        address _owner,
        address _registryAddress
    ) external override notInitialized {
        require(_owner != address(0), "Owner cannot be zero address");
        require(_registryAddress != address(0), "Registry cannot be zero address");
        
        secretId = _secretId;
        shareIndex = _shareIndex;
        shareData = _shareData;
        owner = _owner;
        registryAddress = _registryAddress;
        initialized = true;
        
        // Owner is automatically authorized
        authorizedUsers[_owner] = true;
        
        emit Initialized(_secretId, _shareIndex, _owner);
    }
    
    /**
     * @dev Transfers ownership of the share
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address newOwner) public override onlyOwner nonReentrant {
        require(newOwner != address(0), "New owner cannot be the zero address");
        require(newOwner != owner, "New owner must be different from current owner");
        
        // Remove authorization from old owner
        authorizedUsers[owner] = false;
        
        address oldOwner = owner;
        owner = newOwner;
        
        // Authorize new owner
        authorizedUsers[newOwner] = true;
        
        // Update registry (interface call)
        IShamirRegistry registry = IShamirRegistry(registryAddress);
        registry.updateUserSecrets(oldOwner, secretId, false);
        registry.updateUserSecrets(newOwner, secretId, true);
        
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @dev Grants access to the share
     * @param user The address of the user to grant access to
     */
    function grantAccess(address user) public override onlyOwner nonReentrant {
        require(user != address(0), "User cannot be the zero address");
        require(!authorizedUsers[user], "User already has access");
        
        authorizedUsers[user] = true;
        
        // Update registry
        IShamirRegistry registry = IShamirRegistry(registryAddress);
        registry.updateUserSecrets(user, secretId, true);
        
        emit AccessGranted(user);
    }
    
    /**
     * @dev Revokes access to the share
     * @param user The address of the user to revoke access from
     */
    function revokeAccess(address user) public override onlyOwner nonReentrant {
        require(user != address(0), "User cannot be the zero address");
        require(user != owner, "Cannot revoke access from owner");
        require(authorizedUsers[user], "User does not have access");
        
        authorizedUsers[user] = false;
        
        // Update registry
        IShamirRegistry registry = IShamirRegistry(registryAddress);
        registry.updateUserSecrets(user, secretId, false);
        
        emit AccessRevoked(user);
    }
    
    /**
     * @dev Checks if a user has access to the share
     * @param user The address of the user to check
     * @return True if the user has access, false otherwise
     */
    function canAccess(address user) public view override returns (bool) {
        return authorizedUsers[user];
    }
    
    /**
     * @dev Retrieves the share data if the caller is authorized
     * @param requester The address of the requester
     * @return The share data
     */
    function getShareData(address requester) public view override returns (bytes memory) {
        require(authorizedUsers[requester], "Not authorized to access this share");
        return shareData;
    }
    
    /**
     * @dev Self-destructs the contract, only callable by the registry
     * @notice This is for emergency situations only
     */
    function emergencyDestroy() public override nonReentrant {
        require(msg.sender == registryAddress, "Only registry can destroy this contract");
        
        // Transfer any ETH balance to owner before destruction
        // selfdestruct(payable(owner));
    }
}