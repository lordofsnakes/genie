// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAllowanceTransfer} from "./interfaces/IAllowanceTransfer.sol";

contract GenieRouter {
    address public immutable usdc;
    IAllowanceTransfer public immutable permit2;

    constructor(address _usdc, address _permit2) {
        usdc = _usdc;
        permit2 = IAllowanceTransfer(_permit2);
    }

    /// @notice Route USDC from the calling wallet to the final recipient using Permit2 allowance transfer.
    /// @dev Intended to be called from a bundled MiniKit.sendTransaction flow after Permit2.approve(...)
    function route(address recipient, uint160 amount) external {
        require(recipient != address(0), "invalid recipient");
        require(amount > 0, "invalid amount");
        permit2.transferFrom(msg.sender, recipient, amount, usdc);
    }
}
