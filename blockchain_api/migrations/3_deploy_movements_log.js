const MovementsLog = artifacts.require("MovementsLog");

module.exports = async function (deployer, network, accounts) {
  const admin = accounts[0]; // admin = primer account de Ganache
  await deployer.deploy(MovementsLog, admin);
};
