// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ClaspProfile} from "../src/ClaspProfile.sol";

contract ClaspProfileTest is Test {
    ClaspProfile internal profiles;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        vm.warp(1_752_000_000);
        profiles = new ClaspProfile();
    }

    function test_SetAndGet() public {
        vm.prank(alice);
        profiles.setProfile("Lakeshore Solar Co.", "https://example.com");
        ClaspProfile.Profile memory p = profiles.getProfile(alice);
        assertEq(p.name, "Lakeshore Solar Co.");
        assertEq(p.link, "https://example.com");
        assertEq(p.updatedAt, uint64(block.timestamp));
    }

    function test_OverwriteAndClear() public {
        vm.startPrank(alice);
        profiles.setProfile("First", "");
        profiles.setProfile("Second", "https://x.com");
        assertEq(profiles.getProfile(alice).name, "Second");
        profiles.setProfile("", "");
        assertEq(profiles.getProfile(alice).name, "");
        vm.stopPrank();
    }

    function test_NamesAreNotUnique() public {
        vm.prank(alice);
        profiles.setProfile("Same Name", "");
        vm.prank(bob);
        profiles.setProfile("Same Name", "");
        assertEq(profiles.getProfile(alice).name, "Same Name");
        assertEq(profiles.getProfile(bob).name, "Same Name");
    }

    function test_RevertWhen_TooLong() public {
        bytes memory longName = new bytes(41);
        vm.prank(alice);
        vm.expectRevert(ClaspProfile.NameTooLong.selector);
        profiles.setProfile(string(longName), "");

        bytes memory longLink = new bytes(201);
        vm.prank(alice);
        vm.expectRevert(ClaspProfile.LinkTooLong.selector);
        profiles.setProfile("ok", string(longLink));
    }

    function test_BatchGet() public {
        vm.prank(alice);
        profiles.setProfile("Alice Co", "");
        address[] memory q = new address[](2);
        q[0] = alice;
        q[1] = bob;
        ClaspProfile.Profile[] memory out = profiles.getProfiles(q);
        assertEq(out[0].name, "Alice Co");
        assertEq(out[1].name, "");
    }
}
