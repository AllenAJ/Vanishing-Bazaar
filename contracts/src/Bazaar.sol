// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title Vanishing Bazaar checkout
/// @notice Gasless USDT checkout for pop-up stalls. The buyer signs an order and a USDT permit;
///         anyone (in practice our relayer) submits them. The relayer cannot change who pays,
///         who gets paid or how much, because the buyer signed all three.
contract Bazaar is EIP712 {
    using SafeERC20 for IERC20;

    struct Order {
        bytes32 stallKey; // Arkiv entity key of the stall
        address seller;
        address buyer;
        uint256 price; // in USDT base units (6 decimals)
        uint256 deadline;
    }

    struct PermitSig {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    bytes32 public constant ORDER_TYPEHASH =
        keccak256("Order(bytes32 stallKey,address seller,address buyer,uint256 price,uint256 deadline)");

    uint16 public constant MAX_FEE_BPS = 500;

    IERC20 public immutable usdt;
    address public immutable treasury;
    uint16 public immutable feeBps;

    /// @notice Order digests that have already been paid.
    mapping(bytes32 => bool) public filled;

    event Sold(
        bytes32 indexed stallKey,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 fee,
        bytes32 orderDigest
    );

    error OrderExpired();
    error OrderAlreadyFilled();
    error BadSignature();
    error ZeroPrice();
    error FeeTooHigh();

    constructor(IERC20 usdt_, address treasury_, uint16 feeBps_) EIP712("VanishingBazaar", "1") {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        usdt = usdt_;
        treasury = treasury_;
        feeBps = feeBps_;
    }

    function orderDigest(Order calldata order) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(ORDER_TYPEHASH, order.stallKey, order.seller, order.buyer, order.price, order.deadline)
            )
        );
    }

    /// @notice Pay for a stall item with a signed order and a signed USDT permit.
    /// @dev The permit is wrapped in try/catch so a front-run permit (same signature submitted
    ///      directly to the token) cannot grief the purchase: the allowance is then already set.
    function buy(Order calldata order, PermitSig calldata permit, bytes calldata buyerSig) external {
        if (block.timestamp > order.deadline) revert OrderExpired();
        if (order.price == 0) revert ZeroPrice();

        bytes32 digest = orderDigest(order);
        if (filled[digest]) revert OrderAlreadyFilled();
        if (ECDSA.recover(digest, buyerSig) != order.buyer) revert BadSignature();
        filled[digest] = true;

        try IERC20Permit(address(usdt)).permit(
            order.buyer, address(this), order.price, permit.deadline, permit.v, permit.r, permit.s
        ) {} catch {}

        uint256 fee = order.price * feeBps / 10_000;
        usdt.safeTransferFrom(order.buyer, order.seller, order.price - fee);
        if (fee > 0) usdt.safeTransferFrom(order.buyer, treasury, fee);

        emit Sold(order.stallKey, order.seller, order.buyer, order.price, fee, digest);
    }
}
