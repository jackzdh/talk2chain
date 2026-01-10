// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGatewayVM {
    function sendDot(
        uint256 destinationChainId,
        bytes calldata destinationAddress,
        uint256 destinationGasLimit
    ) external payable;
}

contract WestendFrequencyCrossChain {
    IGatewayVM public immutable gateway;
    
    uint256 public constant WESTEND_CHAIN_ID = 2000;
    uint256 public constant FREQUENCY_CHAIN_ID = 2001;
    uint256 public constant DESTINATION_GAS_LIMIT = 90000;
    uint256 public constant MIN_CROSS_CHAIN_AMOUNT = 0.01 ether;
    
    event CrossChainTransferInitiated(
        address indexed sender,
        uint256 destinationChainId,
        bytes destinationAddress,
        uint256 amount,
        string networkName,
        bytes32 txHash
    );
    
    event Withdrawal(address indexed to, uint256 amount);
    
    constructor(address _gateway) {
        require(_gateway != address(0), "Invalid gateway address");
        gateway = IGatewayVM(_gateway);
    }
    
    receive() external payable {}
    
    function getGatewayAddress() external view returns (address) {
        return address(gateway);
    }
    
    function getSupportedChains() external pure returns (uint256[2] memory) {
        return [WESTEND_CHAIN_ID, FREQUENCY_CHAIN_ID];
    }
    
    function crossChainTransfer(
        bytes calldata destinationAddress,
        uint256 destinationChainId,
        string memory networkName
    ) public payable {
        require(msg.value >= MIN_CROSS_CHAIN_AMOUNT, "Amount below minimum");
        require(destinationAddress.length == 20, "Invalid destination address length");
        require(
            destinationChainId == WESTEND_CHAIN_ID || 
            destinationChainId == FREQUENCY_CHAIN_ID,
            "Unsupported destination chain"
        );
        
        uint256 amount = msg.value;
        
        gateway.sendDot{value: amount}(
            destinationChainId,
            destinationAddress,
            DESTINATION_GAS_LIMIT
        );
        
        emit CrossChainTransferInitiated(
            msg.sender,
            destinationChainId,
            destinationAddress,
            amount,
            networkName,
            keccak256(abi.encodePacked(msg.sender, block.timestamp))
        );
    }
    
    function transferToWestend(
        bytes calldata destinationAddress
    ) external payable {
        crossChainTransfer(destinationAddress, WESTEND_CHAIN_ID, "Westend");
    }
    
    function transferToFrequency(
        bytes calldata destinationAddress
    ) external payable {
        crossChainTransfer(destinationAddress, FREQUENCY_CHAIN_ID, "Frequency");
    }
    
    function withdraw() external {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        payable(msg.sender).transfer(balance);
        
        emit Withdrawal(msg.sender, balance);
    }
    
    function emergencyWithdraw(address payable to, uint256 amount) external {
        require(to != address(0), "Invalid recipient");
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");
        
        to.transfer(amount);
        
        emit Withdrawal(to, amount);
    }
}