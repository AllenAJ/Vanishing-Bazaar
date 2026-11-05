// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit, IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Bazaar} from "../src/Bazaar.sol";

/// Same EIP-712 domain shape as Whitechain's test USDT ("Tether USD", version "1"), 6 decimals.
contract MockUSDT is ERC20Permit {
    constructor() ERC20("Tether USD", "USDT") ERC20Permit("Tether USD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BazaarTest is Test {
    bytes32 constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    IERC20 usdt;
    Bazaar bazaar;

    address treasury = makeAddr("treasury");
    address seller = makeAddr("seller");
    address relayer = makeAddr("relayer");
    uint256 buyerKey = 0xB0B;
    address buyer;

    bytes32 constant STALL = keccak256("stall-1");
    uint256 constant PRICE = 2_500_000; // 2.50 USDT

    function setUp() public virtual {
        buyer = vm.addr(buyerKey);
        MockUSDT mock = new MockUSDT();
        mock.mint(buyer, 10_000_000);
        usdt = IERC20(address(mock));
        bazaar = new Bazaar(usdt, treasury, 100);
    }

    function _order(uint256 price) internal view returns (Bazaar.Order memory) {
        return Bazaar.Order({
            stallKey: STALL, seller: seller, buyer: buyer, price: price, deadline: block.timestamp + 5 minutes
        });
    }

    function _signPermit(uint256 value) internal view returns (Bazaar.PermitSig memory p) {
        p.deadline = block.timestamp + 5 minutes;
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH, buyer, address(bazaar), value, IERC20Permit(address(usdt)).nonces(buyer), p.deadline
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", IERC20Permit(address(usdt)).DOMAIN_SEPARATOR(), structHash));
        (p.v, p.r, p.s) = vm.sign(buyerKey, digest);
    }

    function _signOrder(Bazaar.Order memory o) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(buyerKey, bazaar.orderDigest(o));
        return abi.encodePacked(r, s, v);
    }

    function test_buyPaysSellerAndTreasury() public {
        Bazaar.Order memory o = _order(PRICE);
        uint256 buyerBefore = usdt.balanceOf(buyer);

        vm.prank(relayer);
        bazaar.buy(o, _signPermit(PRICE), _signOrder(o));

        assertEq(usdt.balanceOf(seller), 2_475_000);
        assertEq(usdt.balanceOf(treasury), 25_000);
        assertEq(usdt.balanceOf(buyer), buyerBefore - PRICE);
        assertEq(usdt.balanceOf(relayer), 0);
        assertEq(usdt.allowance(buyer, address(bazaar)), 0);
    }

    function test_relayerCannotRaisePrice() public {
        Bazaar.Order memory o = _order(PRICE);
        bytes memory sig = _signOrder(o);
        Bazaar.PermitSig memory p = _signPermit(PRICE * 4);
        o.price = PRICE * 4;

        vm.expectRevert(Bazaar.BadSignature.selector);
        bazaar.buy(o, p, sig);
    }

    function test_relayerCannotRedirectPayment() public {
        Bazaar.Order memory o = _order(PRICE);
        bytes memory sig = _signOrder(o);
        Bazaar.PermitSig memory p = _signPermit(PRICE);
        o.seller = relayer;

        vm.expectRevert(Bazaar.BadSignature.selector);
        bazaar.buy(o, p, sig);
    }

    function test_orderCannotBeReplayed() public {
        Bazaar.Order memory o = _order(PRICE);
        bytes memory sig = _signOrder(o);
        bazaar.buy(o, _signPermit(PRICE), sig);

        Bazaar.PermitSig memory p2 = _signPermit(PRICE);
        vm.expectRevert(Bazaar.OrderAlreadyFilled.selector);
        bazaar.buy(o, p2, sig);
    }

    function test_expiredOrderReverts() public {
        Bazaar.Order memory o = _order(PRICE);
        bytes memory sig = _signOrder(o);
        Bazaar.PermitSig memory p = _signPermit(PRICE);
        vm.warp(o.deadline + 1);

        vm.expectRevert(Bazaar.OrderExpired.selector);
        bazaar.buy(o, p, sig);
    }

    function test_frontRunPermitStillBuys() public {
        Bazaar.Order memory o = _order(PRICE);
        Bazaar.PermitSig memory p = _signPermit(PRICE);
        // Someone watching the mempool submits the permit straight to the token first.
        IERC20Permit(address(usdt)).permit(buyer, address(bazaar), PRICE, p.deadline, p.v, p.r, p.s);

        bazaar.buy(o, p, _signOrder(o));
        assertEq(usdt.balanceOf(seller), 2_475_000);
    }

    function test_withoutPermitOrAllowanceReverts() public {
        Bazaar.Order memory o = _order(PRICE);
        Bazaar.PermitSig memory junk;
        bytes memory sig = _signOrder(o);
        vm.expectRevert();
        bazaar.buy(o, junk, sig);
    }

    function test_feeCappedAtDeploy() public {
        vm.expectRevert(Bazaar.FeeTooHigh.selector);
        new Bazaar(usdt, treasury, 501);
    }
}

/// Runs the same flow against Whitechain's real test USDT on a fork:
///   forge test --match-contract BazaarForkTest --fork-url https://rpc.testnet.whitechain.io
contract BazaarForkTest is BazaarTest {
    IERC20 constant WHITECHAIN_USDT = IERC20(0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7);

    function setUp() public override {
        if (block.chainid != 1874) vm.skip(true);
        buyer = vm.addr(buyerKey);
        usdt = WHITECHAIN_USDT;
        deal(address(usdt), buyer, 10_000_000);
        bazaar = new Bazaar(usdt, treasury, 100);
    }
}
