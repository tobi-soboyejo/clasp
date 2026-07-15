// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ClaspRegistry} from "../src/ClaspRegistry.sol";

contract ClaspRegistryTest is Test {
    ClaspRegistry internal registry;

    address internal freelancer = makeAddr("freelancer");
    address internal client = makeAddr("client");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant AMOUNT_CENTS = 200_000; // $2,000.00 CAD
    uint64 internal deadline;
    bytes32 internal constant SCOPE_HASH = keccak256("Design and ship marketing site, 5 pages");
    bytes32 internal constant REASON_HASH = keccak256("Work was never delivered to spec");

    function setUp() public {
        vm.warp(1_752_000_000); // fixed base time so deadline math is deterministic
        registry = new ClaspRegistry();
        deadline = uint64(block.timestamp + 7 days);
    }

    // ---------------------------------------------------------------- helpers

    function _create() internal returns (uint256 id) {
        vm.prank(freelancer);
        id = registry.createAgreement(client, AMOUNT_CENTS, deadline, SCOPE_HASH);
    }

    function _createActive() internal returns (uint256 id) {
        id = _create();
        vm.prank(client);
        registry.cosign(id);
    }

    function _createDefaulted() internal returns (uint256 id) {
        id = _createActive();
        vm.warp(deadline + 1);
        vm.prank(freelancer);
        registry.flagDefault(id);
    }

    // ------------------------------------------------------------ happy path

    function test_HappyPath_CreateCosignConfirmPaid() public {
        vm.expectEmit(true, true, true, true);
        emit ClaspRegistry.AgreementCreated(
            0, freelancer, client, AMOUNT_CENTS, deadline, SCOPE_HASH
        );
        uint256 id = _create();

        ClaspRegistry.Agreement memory a = registry.getAgreement(id);
        assertEq(uint8(a.status), uint8(ClaspRegistry.Status.Proposed));
        assertEq(a.freelancer, freelancer);
        assertEq(a.client, client);
        assertEq(a.amountCents, AMOUNT_CENTS);
        assertEq(a.deadline, deadline);
        assertEq(a.createdAt, uint64(block.timestamp));
        assertEq(a.scopeHash, SCOPE_HASH);
        assertEq(registry.agreementCount(), 1);

        vm.warp(block.timestamp + 1 hours);
        vm.expectEmit(true, true, true, true);
        emit ClaspRegistry.AgreementCosigned(id, freelancer, client);
        vm.prank(client);
        registry.cosign(id);

        a = registry.getAgreement(id);
        assertEq(uint8(a.status), uint8(ClaspRegistry.Status.Active));
        assertEq(a.cosignedAt, uint64(block.timestamp));

        vm.warp(block.timestamp + 3 days);
        vm.expectEmit(true, true, true, true);
        emit ClaspRegistry.PaymentConfirmed(id, freelancer, client);
        vm.prank(client);
        registry.confirmPaid(id);

        a = registry.getAgreement(id);
        assertEq(uint8(a.status), uint8(ClaspRegistry.Status.Paid));
        assertEq(a.resolvedAt, uint64(block.timestamp));
    }

    function test_SequentialIdsAcrossAgreements() public {
        uint256 first = _create();
        vm.prank(freelancer);
        uint256 second = registry.createAgreement(stranger, 50_000, deadline, SCOPE_HASH);
        assertEq(first, 0);
        assertEq(second, 1);
        assertEq(registry.agreementCount(), 2);
    }

    // --------------------------------------------------- default and dispute

    function test_DefaultThenDispute() public {
        uint256 id = _createActive();

        vm.warp(deadline + 1);
        vm.expectEmit(true, true, true, true);
        emit ClaspRegistry.DefaultFlagged(id, freelancer, client);
        vm.prank(freelancer);
        registry.flagDefault(id);

        ClaspRegistry.Agreement memory a = registry.getAgreement(id);
        assertEq(uint8(a.status), uint8(ClaspRegistry.Status.Defaulted));
        uint64 flaggedAt = a.resolvedAt;
        assertEq(flaggedAt, uint64(block.timestamp));

        // client disputes on the last second of the window
        vm.warp(uint256(flaggedAt) + registry.DISPUTE_WINDOW());
        vm.expectEmit(true, true, true, true);
        emit ClaspRegistry.DefaultDisputed(id, freelancer, client, REASON_HASH);
        vm.prank(client);
        registry.dispute(id, REASON_HASH);

        a = registry.getAgreement(id);
        assertEq(uint8(a.status), uint8(ClaspRegistry.Status.Disputed));
        assertEq(a.disputeHash, REASON_HASH);
        assertEq(a.resolvedAt, flaggedAt); // default-flag time is preserved
        assertEq(a.disputedAt, uint64(block.timestamp));
    }

    function test_SilentDefault_WindowPassesUndisputed() public {
        uint256 id = _createDefaulted();

        vm.warp(block.timestamp + registry.DISPUTE_WINDOW() + 1);
        vm.prank(client);
        vm.expectRevert(ClaspRegistry.DisputeWindowClosed.selector);
        registry.dispute(id, REASON_HASH);

        ClaspRegistry.Agreement memory a = registry.getAgreement(id);
        assertEq(uint8(a.status), uint8(ClaspRegistry.Status.Defaulted));
    }

    // -------------------------------------------------- createAgreement guards

    function test_RevertWhen_CreateWithSelfAsClient() public {
        vm.prank(freelancer);
        vm.expectRevert(ClaspRegistry.ClientIsSelf.selector);
        registry.createAgreement(freelancer, AMOUNT_CENTS, deadline, SCOPE_HASH);
    }

    function test_RevertWhen_CreateWithZeroClient() public {
        vm.prank(freelancer);
        vm.expectRevert(ClaspRegistry.ClientIsZero.selector);
        registry.createAgreement(address(0), AMOUNT_CENTS, deadline, SCOPE_HASH);
    }

    function test_RevertWhen_CreateWithPastDeadline() public {
        vm.prank(freelancer);
        vm.expectRevert(ClaspRegistry.DeadlineNotInFuture.selector);
        registry.createAgreement(client, AMOUNT_CENTS, uint64(block.timestamp), SCOPE_HASH);
    }

    // ------------------------------------------------------------ cosign guards

    function test_RevertWhen_CosignByNonClient() public {
        uint256 id = _create();
        vm.prank(stranger);
        vm.expectRevert(ClaspRegistry.NotClient.selector);
        registry.cosign(id);
    }

    function test_RevertWhen_CosignByFreelancer() public {
        uint256 id = _create();
        vm.prank(freelancer);
        vm.expectRevert(ClaspRegistry.NotClient.selector);
        registry.cosign(id);
    }

    function test_RevertWhen_CosignTwice() public {
        uint256 id = _createActive();
        vm.prank(client);
        vm.expectRevert(ClaspRegistry.WrongStatus.selector);
        registry.cosign(id);
    }

    function test_RevertWhen_CosignAfterDeadline_ProposalExpired() public {
        uint256 id = _create();
        vm.warp(deadline + 1);
        vm.prank(client);
        vm.expectRevert(ClaspRegistry.ProposalExpired.selector);
        registry.cosign(id);
    }

    // -------------------------------------------------------- confirmPaid guards

    function test_RevertWhen_ConfirmPaidByNonClient() public {
        uint256 id = _createActive();
        vm.prank(freelancer);
        vm.expectRevert(ClaspRegistry.NotClient.selector);
        registry.confirmPaid(id);
    }

    function test_RevertWhen_ConfirmPaidWhileProposed() public {
        uint256 id = _create();
        vm.prank(client);
        vm.expectRevert(ClaspRegistry.WrongStatus.selector);
        registry.confirmPaid(id);
    }

    function test_RevertWhen_ConfirmPaidAfterDefault() public {
        uint256 id = _createDefaulted();
        vm.prank(client);
        vm.expectRevert(ClaspRegistry.WrongStatus.selector);
        registry.confirmPaid(id);
    }

    // -------------------------------------------------------- flagDefault guards

    function test_RevertWhen_FlagDefaultByClient() public {
        uint256 id = _createActive();
        vm.warp(deadline + 1);
        vm.prank(client);
        vm.expectRevert(ClaspRegistry.NotFreelancer.selector);
        registry.flagDefault(id);
    }

    function test_RevertWhen_FlagDefaultBeforeDeadline() public {
        uint256 id = _createActive();
        vm.prank(freelancer);
        vm.expectRevert(ClaspRegistry.DeadlineNotPassed.selector);
        registry.flagDefault(id);
    }

    function test_RevertWhen_FlagDefaultExactlyAtDeadline() public {
        uint256 id = _createActive();
        vm.warp(deadline);
        vm.prank(freelancer);
        vm.expectRevert(ClaspRegistry.DeadlineNotPassed.selector);
        registry.flagDefault(id);
    }

    function test_RevertWhen_FlagDefaultWhileProposed() public {
        uint256 id = _create();
        vm.warp(deadline + 1);
        vm.prank(freelancer);
        vm.expectRevert(ClaspRegistry.WrongStatus.selector);
        registry.flagDefault(id);
    }

    function test_RevertWhen_FlagDefaultAfterPaid() public {
        uint256 id = _createActive();
        vm.prank(client);
        registry.confirmPaid(id);
        vm.warp(deadline + 1);
        vm.prank(freelancer);
        vm.expectRevert(ClaspRegistry.WrongStatus.selector);
        registry.flagDefault(id);
    }

    // ------------------------------------------------------------ dispute guards

    function test_RevertWhen_DisputeByNonClient() public {
        uint256 id = _createDefaulted();
        vm.prank(freelancer);
        vm.expectRevert(ClaspRegistry.NotClient.selector);
        registry.dispute(id, REASON_HASH);
    }

    function test_RevertWhen_DisputeWhileActive() public {
        uint256 id = _createActive();
        vm.prank(client);
        vm.expectRevert(ClaspRegistry.WrongStatus.selector);
        registry.dispute(id, REASON_HASH);
    }

    function test_RevertWhen_DisputeTwice() public {
        uint256 id = _createDefaulted();
        vm.prank(client);
        registry.dispute(id, REASON_HASH);
        vm.prank(client);
        vm.expectRevert(ClaspRegistry.WrongStatus.selector);
        registry.dispute(id, REASON_HASH);
    }

    // ------------------------------------------------------------------- misc

    function test_RevertWhen_UnknownAgreementId() public {
        vm.expectRevert(ClaspRegistry.UnknownAgreement.selector);
        registry.getAgreement(0);

        vm.prank(client);
        vm.expectRevert(ClaspRegistry.UnknownAgreement.selector);
        registry.cosign(42);
    }

    function test_DisputeWindowIs14Days() public view {
        assertEq(registry.DISPUTE_WINDOW(), 14 days);
    }

    function test_GetAgreementsBatch() public {
        _create();
        vm.prank(freelancer);
        registry.createAgreement(stranger, 50_000, deadline, SCOPE_HASH);
        vm.prank(stranger);
        registry.createAgreement(client, 75_000, deadline, SCOPE_HASH);

        ClaspRegistry.Agreement[] memory page = registry.getAgreements(0, 3);
        assertEq(page.length, 3);
        assertEq(page[0].client, client);
        assertEq(page[1].client, stranger);
        assertEq(page[2].freelancer, stranger);

        // toId clamped to count; empty and inverted ranges return empty
        assertEq(registry.getAgreements(1, 99).length, 2);
        assertEq(registry.getAgreements(3, 3).length, 0);
        assertEq(registry.getAgreements(2, 1).length, 0);
        assertEq(registry.getAgreements(99, 100).length, 0);
    }
}
