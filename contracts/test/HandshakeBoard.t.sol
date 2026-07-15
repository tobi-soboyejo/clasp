// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HandshakeBoard} from "../src/HandshakeBoard.sol";

contract HandshakeBoardTest is Test {
    HandshakeBoard internal board;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        vm.warp(1_752_000_000);
        board = new HandshakeBoard();
    }

    function test_PostAndRead() public {
        vm.prank(alice);
        uint256 id = board.post(
            HandshakeBoard.Kind.Offering,
            HandshakeBoard.Category.CreativeAndDigital,
            "Web design",
            "5-page sites, 1-week turnaround",
            "https://example.com/portfolio",
            150_000
        );
        assertEq(id, 0);
        assertEq(board.listingCount(), 1);

        HandshakeBoard.Listing[] memory page = board.getListings(0, 10);
        assertEq(page.length, 1);
        assertEq(page[0].poster, alice);
        assertEq(uint8(page[0].kind), uint8(HandshakeBoard.Kind.Offering));
        assertEq(uint8(page[0].category), uint8(HandshakeBoard.Category.CreativeAndDigital));
        assertEq(page[0].link, "https://example.com/portfolio");
        assertEq(page[0].title, "Web design");
        assertEq(page[0].rateCents, 150_000);
        assertEq(page[0].postedAt, uint64(block.timestamp));
        assertTrue(page[0].active);
    }

    function test_CloseByPoster() public {
        vm.prank(alice);
        uint256 id = board.post(HandshakeBoard.Kind.Seeking, HandshakeBoard.Category.CreativeAndDigital, "Need a logo", "", "", 0);
        vm.prank(alice);
        board.close(id);
        assertFalse(board.getListings(0, 1)[0].active);
    }

    function test_RevertWhen_CloseByStranger() public {
        vm.prank(alice);
        uint256 id = board.post(HandshakeBoard.Kind.Seeking, HandshakeBoard.Category.CreativeAndDigital, "Need a logo", "", "", 0);
        vm.prank(bob);
        vm.expectRevert(HandshakeBoard.NotPoster.selector);
        board.close(id);
    }

    function test_RevertWhen_CloseTwice() public {
        vm.prank(alice);
        uint256 id = board.post(HandshakeBoard.Kind.Seeking, HandshakeBoard.Category.CreativeAndDigital, "Need a logo", "", "", 0);
        vm.startPrank(alice);
        board.close(id);
        vm.expectRevert(HandshakeBoard.AlreadyClosed.selector);
        board.close(id);
        vm.stopPrank();
    }

    function test_RevertWhen_EmptyOrOversized() public {
        vm.startPrank(alice);
        vm.expectRevert(HandshakeBoard.EmptyTitle.selector);
        board.post(HandshakeBoard.Kind.Seeking, HandshakeBoard.Category.Other, "", "", "", 0);

        bytes memory longTitle = new bytes(81);
        vm.expectRevert(HandshakeBoard.TitleTooLong.selector);
        board.post(HandshakeBoard.Kind.Seeking, HandshakeBoard.Category.Other, string(longTitle), "", "", 0);

        bytes memory longDetails = new bytes(401);
        vm.expectRevert(HandshakeBoard.DetailsTooLong.selector);
        board.post(HandshakeBoard.Kind.Seeking, HandshakeBoard.Category.Other, "ok", string(longDetails), "", 0);

        bytes memory longLink = new bytes(201);
        vm.expectRevert(HandshakeBoard.LinkTooLong.selector);
        board.post(HandshakeBoard.Kind.Seeking, HandshakeBoard.Category.Other, "ok", "", string(longLink), 0);
        vm.stopPrank();
    }

    function test_RevertWhen_CloseUnknown() public {
        vm.expectRevert(HandshakeBoard.UnknownListing.selector);
        board.close(7);
    }

    function test_GetListingsClamps() public {
        vm.prank(alice);
        board.post(HandshakeBoard.Kind.Offering, HandshakeBoard.Category.Other, "A", "", "", 0);
        assertEq(board.getListings(0, 99).length, 1);
        assertEq(board.getListings(1, 1).length, 0);
        assertEq(board.getListings(5, 9).length, 0);
    }
}
