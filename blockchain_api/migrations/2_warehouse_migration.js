const WarehouseTransfer = artifacts.require("WarehouseTransfer");

module.exports = function(deployer) {
    deployer.deploy(WarehouseTransfer);
};