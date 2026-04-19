// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {GenieRouter} from "../src/GenieRouter.sol";
import {MockUSDC} from "./MockUSDC.sol";
import {MockPermit2} from "./MockPermit2.sol";

contract GenieRouterTest is Test {
    GenieRouter public router;
    MockUSDC public usdc;
    MockPermit2 public permit2;
    address public user;
    address public recipient;

    function setUp() public {
        user = makeAddr("user");
        recipient = makeAddr("recipient");

        usdc = new MockUSDC();
        permit2 = new MockPermit2();
        usdc.setPermit2(address(permit2));
        router = new GenieRouter(address(usdc), address(permit2));
    }

    function _approveRouter(address owner_, uint160 amount, uint48 expiration) internal {
        vm.prank(owner_);
        permit2.approve(address(usdc), address(router), amount, expiration);
    }

    function test_ConstructorSetsUsdcAndPermit2() public {
        assertEq(router.usdc(), address(usdc));
        assertEq(address(router.permit2()), address(permit2));
    }

    function test_RouteTransfersExactUsdcAmountToRecipient() public {
        uint160 amount = 10 * 1e6; // 10 USDC

        usdc.mint(user, amount);
        _approveRouter(user, amount, uint48(block.timestamp + 1 hours));

        vm.prank(user);
        router.route(recipient, amount);

        assertEq(usdc.balanceOf(user), 0);
        assertEq(usdc.balanceOf(recipient), amount);
    }

    function test_RouteRevertsForInvalidRecipient() public {
        uint160 amount = 10 * 1e6;
        usdc.mint(user, amount);
        _approveRouter(user, amount, uint48(block.timestamp + 1 hours));

        vm.prank(user);
        vm.expectRevert("invalid recipient");
        router.route(address(0), amount);
    }

    function test_RouteRevertsForZeroAmount() public {
        vm.prank(user);
        vm.expectRevert("invalid amount");
        router.route(recipient, 0);
    }

    function test_RouteRevertsForExpiredAllowance() public {
        uint160 amount = 10 * 1e6;
        usdc.mint(user, amount);
        _approveRouter(user, amount, uint48(block.timestamp - 1));

        vm.prank(user);
        vm.expectRevert();
        router.route(recipient, amount);
    }

    function test_RouteRevertsWhenAmountExceedsAllowance() public {
        uint160 approvedAmount = 10 * 1e6;
        uint160 requestedAmount = 11 * 1e6;
        usdc.mint(user, requestedAmount);
        _approveRouter(user, approvedAmount, uint48(block.timestamp + 1 hours));

        vm.prank(user);
        vm.expectRevert("insufficient allowance");
        router.route(recipient, requestedAmount);
    }

    function test_RouteConsumesAllowance() public {
        uint160 approvedAmount = 10 * 1e6;
        uint160 firstSend = 4 * 1e6;
        uint160 secondSend = 6 * 1e6;
        usdc.mint(user, approvedAmount);
        _approveRouter(user, approvedAmount, uint48(block.timestamp + 1 hours));

        vm.prank(user);
        router.route(recipient, firstSend);
        assertEq(usdc.balanceOf(recipient), firstSend);

        vm.prank(user);
        router.route(recipient, secondSend);
        assertEq(usdc.balanceOf(recipient), approvedAmount);
    }
}
