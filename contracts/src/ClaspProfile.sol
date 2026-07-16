// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ClaspProfile
/// @notice Self-declared display names for wallets in the Clasp registry.
///         Deliberately NOT a unique-username registry: names don't replace
///         the address or the score, they annotate them, and the UI always
///         shows the address alongside. Squatting a name gains nothing —
///         identity here is the address + its record; the name is a human
///         handle. Empty name clears the profile.
contract ClaspProfile {
    struct Profile {
        string name;
        string link;
        uint64 updatedAt;
    }

    uint256 public constant MAX_NAME_BYTES = 40;
    uint256 public constant MAX_LINK_BYTES = 200;

    mapping(address => Profile) private _profiles;

    event ProfileSet(address indexed wallet, string name, string link);

    error NameTooLong();
    error LinkTooLong();

    function setProfile(string calldata name, string calldata link) external {
        if (bytes(name).length > MAX_NAME_BYTES) revert NameTooLong();
        if (bytes(link).length > MAX_LINK_BYTES) revert LinkTooLong();
        _profiles[msg.sender] =
            Profile({name: name, link: link, updatedAt: uint64(block.timestamp)});
        emit ProfileSet(msg.sender, name, link);
    }

    function getProfile(address wallet) external view returns (Profile memory) {
        return _profiles[wallet];
    }

    function getProfiles(address[] calldata wallets)
        external
        view
        returns (Profile[] memory out)
    {
        out = new Profile[](wallets.length);
        for (uint256 i = 0; i < wallets.length; ++i) {
            out[i] = _profiles[wallets[i]];
        }
    }
}
