// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract WarehouseTransfer {
    // Mapping para trackear qué bodega tiene cada producto
    mapping(uint256 => address) public productWarehouse;
    
    // Dueño del contrato (puede inicializar productos)
    address public owner;
    
    // Eventos para tracking
    event ProductTransferred(uint256 productId, address fromWarehouse, address toWarehouse);
    event OwnershipVerified(uint256 productId, address warehouse, bool isOwner);
    
    // Modifier para solo owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    // Inicializar productos con bodegas iniciales (solo owner)
    function initializeProducts(uint256[] memory productIds, address[] memory warehouses) public onlyOwner {
        require(productIds.length == warehouses.length, "Arrays must have same length");
        
        for (uint256 i = 0; i < productIds.length; i++) {
            productWarehouse[productIds[i]] = warehouses[i];
        }
    }
    
    // Transferir producto (solo la bodega actual puede transferir)
    function transferProduct(uint256 productId, address toWarehouse) public {
        require(productWarehouse[productId] != address(0), "Product does not exist");
        require(productWarehouse[productId] == msg.sender, "Not the current warehouse owner");
        require(toWarehouse != address(0), "Invalid warehouse address");
        require(toWarehouse != msg.sender, "Cannot transfer to same warehouse");
        
        address fromWarehouse = productWarehouse[productId];
        productWarehouse[productId] = toWarehouse;
        
        emit ProductTransferred(productId, fromWarehouse, toWarehouse);
    }
    
    // Verificar ownership (función view - sin costo de gas)
    function verifyOwnership(uint256 productId, address warehouse) public view returns (bool) {
        return productWarehouse[productId] == warehouse;
    }
    
    // Obtener bodega actual de un producto
    function getProductWarehouse(uint256 productId) public view returns (address) {
        return productWarehouse[productId];
    }
    
    // Verificar si producto existe
    function productExists(uint256 productId) public view returns (bool) {
        return productWarehouse[productId] != address(0);
    }

    
}