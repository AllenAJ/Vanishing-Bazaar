// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Bazaar} from "../src/Bazaar.sol";

/// forge script script/Deploy.s.sol --rpc-url $WHITECHAIN_RPC --broadcast
contract Deploy is Script {
    function run() external {
        uint256 key = vm.envUint("SERVER_PRIVATE_KEY");
        IERC20 usdt = IERC20(vm.envAddress("WHITECHAIN_USDT"));
        // The treasury is the server itself: the 1% fee refills the relayer.
        address treasury = vm.addr(key);

        vm.startBroadcast(key);
        Bazaar bazaar = new Bazaar(usdt, treasury, 100);
        vm.stopBroadcast();

        console.log("Bazaar deployed at", address(bazaar));
    }
}
