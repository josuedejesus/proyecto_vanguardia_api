pragma solidity ^0.8.0;

contract MovementsLog {
    address public admin;
    mapping(bytes32 => bytes32) public latestHash;

    event MovementLogged(
        bytes32 indexed uidKey,
        bytes32 indexed movementHash,
        bytes32 prevHash,
        uint8  movementType,
        uint256 quantity,
        uint256 locationId,
        uint64 ts,
        string metadataURI,
        address indexed actor
    );

    modifier onlyAdmin(){ require(msg.sender == admin, "not admin"); _; }

    constructor(address _admin) { admin = _admin; }
    function setAdmin(address _admin) external onlyAdmin { admin = _admin; }

    function logMovement(
        bytes32 uidKey,
        uint8 movementType,
        uint256 quantity,
        uint256 locationId,
        uint64 ts,
        string calldata metadataURI,
        bytes32 prevHash,
        bytes32 contentHash
    ) external onlyAdmin returns (bytes32 movementHash) {
        if (prevHash != bytes32(0)) {
            require(latestHash[uidKey] == prevHash, "bad prevHash");
        } else {
            require(latestHash[uidKey] == bytes32(0), "already started; use prevHash");
        }

        movementHash = keccak256(abi.encode(
            uidKey, movementType, quantity, locationId, ts, metadataURI, prevHash, contentHash, msg.sender, block.number
        ));

        latestHash[uidKey] = movementHash;

        emit MovementLogged(
            uidKey, movementHash, prevHash, movementType, quantity, locationId, ts, metadataURI, msg.sender
        );
    }
}
