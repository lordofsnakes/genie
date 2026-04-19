// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAllowanceTransfer} from "../src/interfaces/IAllowanceTransfer.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract MockPermit2 is IAllowanceTransfer {
    struct AllowanceData {
        uint160 amount;
        uint48 expiration;
    }

    mapping(address owner => mapping(address token => mapping(address spender => AllowanceData))) public allowances;

    function approve(
        address token,
        address spender,
        uint160 amount,
        uint48 expiration
    ) external {
        allowances[msg.sender][token][spender] = AllowanceData({
            amount: amount,
            expiration: expiration
        });
    }

    function transferFrom(
        address from,
        address to,
        uint160 amount,
        address token
    ) external {
        AllowanceData storage approval = allowances[from][token][msg.sender];
        require(approval.amount >= amount, "insufficient allowance");
        if (approval.expiration != 0) {
            require(block.timestamp <= approval.expiration, "allowance expired");
        }

        approval.amount -= amount;
        MockUSDC(token).permit2TransferFrom(from, to, amount);
    }
}
