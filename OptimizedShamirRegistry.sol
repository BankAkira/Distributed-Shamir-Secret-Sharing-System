// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./pyShamir.sol";
import "./ShareContractFactory.sol";
import "./ShareContract.sol";
import "./IShamirRegistry.sol";
import "./IShareContract.sol";

/**
 * @title OptimizedShamirRegistry
 * @dev A registry contract that manages shares stored in separate contracts using a factory
 */
contract OptimizedShamirRegistry is IShamirRegistry {
    // Core dependencies
    ShamirSecretSharing private shamirContract;
    ShareContractFactory private factory;
    address public shareImplementation;
    
    // Secret management
    struct SecretInfo {
        uint256 id;                  // Unique identifier for the secret
        uint8 parts;                 // Total parts created
        uint8 threshold;             // Threshold required
        uint256 timestamp;           // When the secret was split
        string description;          // Optional description
        uint256 lastAccessTimestamp; // Timestamp of last access attempt
        uint256 accessCount;         // Number of successful reconstructions
        uint256 dataSize;            // Size of the original secret data
    }
    
    // Storage mappings
    mapping(uint256 => SecretInfo) private secrets;
    mapping(uint256 => mapping(uint8 => address)) private shareContracts;
    mapping(address => uint256[]) private userSecrets;
    
    // Contract state
    uint256 private secretIdCounter;
    address public owner;
    bool public paused;
    
    // Security limits
    uint8 public constant MAX_PARTS = 100;       // Maximum number of parts allowed
    uint256 public constant MAX_SECRET_SIZE = 10240; // Maximum size of a secret (10KB)
    
    // Events
    event SecretSplit(
        uint256 indexed secretId, 
        uint8 parts, 
        uint8 threshold, 
        address creator, 
        uint256 dataSize
    );
    event ShareContractDeployed(
        uint256 indexed secretId, 
        uint8 shareIndex, 
        address contractAddress
    );
    event SecretReconstructed(
        uint256 indexed secretId, 
        address reconstructor
    );
    event SecretReconstructionAttempted(
        uint256 indexed secretId, 
        address requester, 
        uint256 timestamp, 
        bool successful
    );
    event EmergencyPauseSet(bool paused);
    event AccessManagementAction(
        uint256 indexed secretId, 
        uint8 shareIndex, 
        string action, 
        address indexed user, 
        address indexed performer
    );
    event SecretAccessed(uint256 indexed secretId, address user);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    /**
     * @dev Constructor to set the ShamirSecretSharing contract and deploy factory
     * @param _shamirContractAddress Address of the ShamirSecretSharing contract
     */
    constructor(address _shamirContractAddress) {
        require(_shamirContractAddress != address(0), "Shamir contract cannot be zero address");
        
        shamirContract = ShamirSecretSharing(_shamirContractAddress);
        owner = msg.sender;
        secretIdCounter = 1;
        paused = false;
        
        // Deploy a share implementation contract for cloning
        shareImplementation = address(new ShareContract());
        
        // Deploy the factory
        factory = new ShareContractFactory(address(this));
    }
    
    /**
     * @dev Splits a secret and deploys separate contracts for each share using the factory
     * @param secret The secret to split
     * @param parts The number of parts to create
     * @param threshold The minimum number of parts needed to reconstruct the secret
     * @param description Optional description of the secret
     * @param initialOwners Array of addresses that will own shares initially
     * @return The ID of the split secret
     */
    function splitAndDeploy(
        bytes memory secret, 
        uint8 parts, 
        uint8 threshold, 
        string memory description,
        address[] memory initialOwners
    ) public override whenNotPaused returns (uint256) {
        // Input validation
        require(parts >= 2 && threshold >= 2, "Parts and threshold must be at least 2");
        require(parts >= threshold, "Parts must be at least equal to threshold");
        require(secret.length > 0, "Secret cannot be empty");
        require(parts <= MAX_PARTS, "Number of parts exceeds maximum allowed");
        require(secret.length <= MAX_SECRET_SIZE, "Secret size exceeds maximum allowed");
        
        // Validate initialOwners if provided
        if (initialOwners.length > 0) {
            require(initialOwners.length == parts, "Initial owners array must match parts count");
            
            // Ensure no zero addresses
            for (uint i = 0; i < initialOwners.length; i++) {
                require(initialOwners[i] != address(0), "Owner cannot be zero address");
            }
        }
        
        // Generate a random seed
        bytes32 seed = keccak256(abi.encodePacked(
            block.timestamp, 
            block.prevrandao, 
            msg.sender, 
            secretIdCounter
        ));
        
        // Call the split function from the ShamirSecretSharing contract
        bytes[] memory splitParts = shamirContract.split(secret, parts, threshold, seed);
        
        // Create a new secret entry
        uint256 secretId = secretIdCounter++;
        secrets[secretId] = SecretInfo({
            id: secretId,
            parts: parts,
            threshold: threshold,
            timestamp: block.timestamp,
            description: description,
            lastAccessTimestamp: 0,
            accessCount: 0,
            dataSize: secret.length
        });
        
        // Deploy a separate contract for each share using the factory
        for (uint8 i = 0; i < parts; i++) {
            uint8 shareIndex = i + 1;
            address shareOwner = initialOwners.length > i ? initialOwners[i] : msg.sender;
            
            // Deploy a new ShareContract via factory
            address shareContractAddr = factory.createShareContract(
                shareImplementation,
                secretId,
                shareIndex,
                splitParts[i],
                shareOwner
            );
            
            // Store the contract address
            shareContracts[secretId][shareIndex] = shareContractAddr;
            
            // Add to owner's secrets if not already there
            bool found = false;
            for (uint j = 0; j < userSecrets[shareOwner].length; j++) {
                if (userSecrets[shareOwner][j] == secretId) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                userSecrets[shareOwner].push(secretId);
            }
            
            emit ShareContractDeployed(secretId, shareIndex, shareContractAddr);
        }
        
        emit SecretSplit(secretId, parts, threshold, msg.sender, secret.length);
        
        return secretId;
    }
    
    /**
     * @dev Retrieves share data from multiple share contracts and reconstructs the secret
     * @param secretId The ID of the secret to reconstruct
     * @param shareIndices The indices of the shares to use
     * @return The reconstructed secret
     */
    function reconstructSecret(uint256 secretId, uint8[] memory shareIndices) 
        public override whenNotPaused returns (bytes memory) 
    {
        SecretInfo storage secretInfo = secrets[secretId];
        require(secretInfo.id == secretId, "Secret does not exist");
        require(shareIndices.length >= secretInfo.threshold, "Not enough shares provided");
        
        // Log reconstruction attempt
        emit SecretReconstructionAttempted(secretId, msg.sender, block.timestamp, false);
        
        // Validate indices and check for duplicates
        bool[] memory usedIndices = new bool[](256); // Max possible indices
        for (uint i = 0; i < shareIndices.length; i++) {
            uint8 shareIndex = shareIndices[i];
            require(!usedIndices[shareIndex], "Duplicate share indices provided");
            usedIndices[shareIndex] = true;
            
            // Verify index is valid and within range
            require(shareIndex > 0 && shareIndex <= secretInfo.parts, "Share index out of range");
        }
        
        // Collect shares from the share contracts
        bytes[] memory collectedShares = new bytes[](shareIndices.length);
        
        for (uint i = 0; i < shareIndices.length; i++) {
            uint8 shareIndex = shareIndices[i];
            
            // Get the share contract address
            address shareContractAddr = shareContracts[secretId][shareIndex];
            require(shareContractAddr != address(0), "Share contract not found");
            
            // Create an interface to the share contract
            IShareContract shareContract = IShareContract(shareContractAddr);
            
            // Check authorization and get share data
            require(
                shareContract.canAccess(msg.sender),
                "Not authorized to access this share"
            );
            
            collectedShares[i] = shareContract.getShareData(msg.sender);
        }
        
        // Call the combine function from the ShamirSecretSharing contract
        bytes memory reconstructedSecret = shamirContract.combine(collectedShares);
        
        // Update secret access information
        secretInfo.lastAccessTimestamp = block.timestamp;
        secretInfo.accessCount++;
        
        // Log successful reconstruction
        emit SecretReconstructed(secretId, msg.sender);
        emit SecretReconstructionAttempted(secretId, msg.sender, block.timestamp, true);
        
        return reconstructedSecret;
    }
    
    /**
     * @dev Gets information about a secret
     * @param secretId The ID of the secret
     */
    function getSecretInfo(uint256 secretId) public view override returns (
        uint8 parts,
        uint8 threshold,
        uint256 timestamp,
        string memory description,
        uint256 lastAccessTimestamp,
        uint256 accessCount,
        uint256 dataSize
    ) {
        SecretInfo storage secretInfo = secrets[secretId];
        require(secretInfo.id == secretId, "Secret does not exist");
        
        return (
            secretInfo.parts,
            secretInfo.threshold,
            secretInfo.timestamp,
            secretInfo.description,
            secretInfo.lastAccessTimestamp,
            secretInfo.accessCount,
            secretInfo.dataSize
        );
    }
    
    /**
     * @dev Gets the address of a share contract
     * @param secretId The ID of the secret
     * @param shareIndex The index of the share
     * @return The address of the share contract
     */
    function getShareContractAddress(uint256 secretId, uint8 shareIndex) 
        public view override returns (address) 
    {
        return shareContracts[secretId][shareIndex];
    }
    
    /**
     * @dev Gets all secrets a user has access to
     * @return An array of secret IDs the user has access to
     */
    function getMySecrets() public view override returns (uint256[] memory) {
        return userSecrets[msg.sender];
    }
    
    /**
     * @dev Gets all share indices owned by the caller for a specific secret
     * @param secretId The ID of the secret
     * @return An array of share indices owned by the caller
     */
    function getMySharesForSecret(uint256 secretId) public view override returns (uint8[] memory) {
        // Check if the secret exists
        require(secrets[secretId].id == secretId, "Secret does not exist");
        
        // Find all shares for this secret owned by the caller
        uint8 parts = secrets[secretId].parts;
        uint8[] memory ownedShares = new uint8[](parts); // Maximum possible size
        uint8 count = 0;
        
        for (uint8 i = 1; i <= parts; i++) {
            address shareAddress = shareContracts[secretId][i];
            if (shareAddress != address(0)) {
                IShareContract shareContract = IShareContract(shareAddress);
                if (shareContract.canAccess(msg.sender)) {
                    ownedShares[count] = i;
                    count++;
                }
            }
        }
        
        // Create a properly sized result array
        uint8[] memory result = new uint8[](count);
        for (uint8 i = 0; i < count; i++) {
            result[i] = ownedShares[i];
        }
        
        return result;
    }
    
    /**
     * @dev Checks if a secret exists
     * @param secretId The ID of the secret
     * @return True if the secret exists, false otherwise
     */
    function secretExists(uint256 secretId) public view override returns (bool) {
        return secrets[secretId].id == secretId;
    }
    
    /**
     * @dev Updates a user's secrets list when they gain or lose access to a share
     * @param user The address of the user
     * @param secretId The ID of the secret
     * @param hasAccess Whether the user has access to any share of the secret
     */
    function updateUserSecrets(address user, uint256 secretId, bool hasAccess) external override {
        // Verify caller is a valid share contract for this secret
        bool isValidCaller = false;
        for (uint8 i = 1; i <= secrets[secretId].parts; i++) {
            if (shareContracts[secretId][i] == msg.sender) {
                isValidCaller = true;
                break;
            }
        }
        require(isValidCaller, "Only share contracts can call this function");
        
        if (hasAccess) {
            // Add to user's secrets if not already there
            bool found = false;
            for (uint i = 0; i < userSecrets[user].length; i++) {
                if (userSecrets[user][i] == secretId) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                userSecrets[user].push(secretId);
            }
        } else {
            // Check if user still has access to any share of this secret
            bool stillHasAccess = false;
            for (uint8 i = 1; i <= secrets[secretId].parts; i++) {
                address shareContractAddr = shareContracts[secretId][i];
                if (shareContractAddr != address(0)) {
                    IShareContract shareContract = IShareContract(shareContractAddr);
                    if (shareContract.canAccess(user)) {
                        stillHasAccess = true;
                        break;
                    }
                }
            }
            
            // If no access remains, remove from user's secrets
            if (!stillHasAccess) {
                uint256[] storage userSecretsList = userSecrets[user];
                for (uint i = 0; i < userSecretsList.length; i++) {
                    if (userSecretsList[i] == secretId) {
                        userSecretsList[i] = userSecretsList[userSecretsList.length - 1];
                        userSecretsList.pop();
                        break;
                    }
                }
            }
        }
    }
    
    /**
     * @dev Helper function to emit access management events from share contracts
     * @param secretId The ID of the secret
     * @param shareIndex The index of the share
     * @param action The action performed (e.g., "ACCESS_GRANTED", "ACCESS_REVOKED", "OWNERSHIP_TRANSFERRED")
     * @param user The address of the user affected
     * @param performer The address of the user performing the action
     */
    function emitAccessManagementEvent(
        uint256 secretId, 
        uint8 shareIndex, 
        string calldata action, 
        address user, 
        address performer
    ) external override {
        // Verify caller is a valid share contract for this secret
        require(
            shareContracts[secretId][shareIndex] == msg.sender, 
            "Only the actual share contract can call this function"
        );
        
        // Emit a comprehensive event for monitoring and auditing
        emit AccessManagementAction(secretId, shareIndex, action, user, performer);
    }

    /**
    * @dev Records an access to a secret without revealing the secret
    * @param secretId The ID of the secret being accessed
    */
    function recordSecretAccess(uint256 secretId) public {
        require(secretExists(secretId), "Secret does not exist");
        
        // Update access statistics
        secrets[secretId].lastAccessTimestamp = block.timestamp;
        secrets[secretId].accessCount++;
        
        // Emit an event for tracking
        emit SecretAccessed(secretId, msg.sender);
    }
    
    /**
     * @dev Emergency function to destroy a share contract
     * @param secretId The ID of the secret
     * @param shareIndex The index of the share
     * @notice Only callable by owner
     */
    function emergencyDestroyShare(uint256 secretId, uint8 shareIndex) public onlyOwner {
        address shareContractAddr = shareContracts[secretId][shareIndex];
        require(shareContractAddr != address(0), "Share contract not found");
        
        // Call the emergency destroy function on the share contract
        IShareContract(shareContractAddr).emergencyDestroy();
        
        // Remove from mapping
        delete shareContracts[secretId][shareIndex];
    }
    
    /**
     * @dev Set emergency pause state
     * @param _paused The pause state to set
     */
    function setEmergencyPause(bool _paused) public onlyOwner {
        paused = _paused;
        emit EmergencyPauseSet(_paused);
    }
    
    /**
     * @dev Updates the factory address
     * @param newFactory The address of the new factory
     * @notice Only callable by owner
     */
    function updateFactory(address newFactory) public onlyOwner {
        require(newFactory != address(0), "New factory cannot be the zero address");
        factory = ShareContractFactory(newFactory);
    }
    
    /**
     * @dev Updates the share implementation address
     * @param newImplementation The address of the new share implementation
     * @notice Only callable by owner
     */
    function updateShareImplementation(address newImplementation) public onlyOwner {
        require(newImplementation != address(0), "New implementation cannot be the zero address");
        shareImplementation = newImplementation;
    }
    
    /**
     * @dev Transfer ownership of the registry
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be the zero address");
        owner = newOwner;
    }
}