// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGatewayVM {
    function sendDot(
        uint256 destinationChainId,
        bytes calldata destinationAddress,
        uint256 destinationGasLimit
    ) external payable;
}

contract MockGateway is IGatewayVM {
    event SendDotCalled(
        uint256 destinationChainId,
        bytes destinationAddress,
        uint256 destinationGasLimit,
        uint256 value
    );

    function sendDot(
        uint256 destinationChainId,
        bytes calldata destinationAddress,
        uint256 destinationGasLimit
    ) external payable override {
        emit SendDotCalled(
            destinationChainId,
            destinationAddress,
            destinationGasLimit,
            msg.value
        );
    }

    receive() external payable {}
}
