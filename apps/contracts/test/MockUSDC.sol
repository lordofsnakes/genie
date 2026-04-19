// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    address public permit2;

    constructor() ERC20("USD Coin", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setPermit2(address _permit2) external {
        permit2 = _permit2;
    }

    function permit2TransferFrom(address from, address to, uint256 amount) external {
        require(msg.sender == permit2, "only permit2");
        _transfer(from, to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
