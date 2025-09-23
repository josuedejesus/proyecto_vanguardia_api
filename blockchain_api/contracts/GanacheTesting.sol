pragma solidity ^0.8.0;
// solidity >=0.4.22 <0.9.0 

contract GanacheTesting {
  address public owner = msg.sender;
  string public message;

  // this function runs when the contract is deployed
  constructor() {
    
    message = "Probando por 2da vez el Ganache Smart Contract!";
  }

  modifier ownerOnly() {
    require(
      msg.sender == owner,
      "Restrict to ownerTu"
    );
    _;
  }

  // this function can be only be executed by the owner of the contract
  function setMessage(string memory _message) 
    public 
    ownerOnly 
    returns(string memory) 
  {
    // empty constraint check
    require(bytes(_message).length > 0);

    // new message is set and returned
    message = _message;
    return message;
  }
}