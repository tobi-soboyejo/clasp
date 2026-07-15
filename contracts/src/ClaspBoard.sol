// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ClaspBoard
/// @notice A minimal public job board that lives beside ClaspRegistry:
///         freelancers post availability, clients post work. Listing text is
///         stored onchain (v1 has no backend and hashes can't be shared
///         between browsers) — fine at this scale, and it keeps the whole
///         product readable from public state alone. The point of the board
///         is the pairing: every poster's wallet links to their payment
///         history and Clasp Score in the registry.
contract ClaspBoard {
    enum Kind {
        Offering, // selling services, goods, availability
        Seeking // buying, hiring, requesting
    }

    /// Broad on purpose: the promise-to-pay primitive isn't gig-only.
    enum Category {
        Services,
        TradesAndField,
        CreativeAndDigital,
        GoodsAndGaming,
        RentalsAndProperty,
        Other
    }

    struct Listing {
        address poster;
        Kind kind;
        Category category;
        string title;
        string details;
        string link; // optional work/portfolio/evidence URL
        uint256 rateCents; // CAD cents, informational (0 = negotiable)
        uint64 postedAt;
        bool active;
    }

    uint256 public constant MAX_TITLE_BYTES = 80;
    uint256 public constant MAX_DETAILS_BYTES = 400;
    uint256 public constant MAX_LINK_BYTES = 200;

    Listing[] private _listings;

    event ListingPosted(
        uint256 indexed id, address indexed poster, Kind kind, string title
    );
    event ListingClosed(uint256 indexed id, address indexed poster);

    error UnknownListing();
    error NotPoster();
    error AlreadyClosed();
    error EmptyTitle();
    error TitleTooLong();
    error DetailsTooLong();
    error LinkTooLong();

    function post(
        Kind kind,
        Category category,
        string calldata title,
        string calldata details,
        string calldata link,
        uint256 rateCents
    ) external returns (uint256 id) {
        if (bytes(title).length == 0) revert EmptyTitle();
        if (bytes(title).length > MAX_TITLE_BYTES) revert TitleTooLong();
        if (bytes(details).length > MAX_DETAILS_BYTES) revert DetailsTooLong();
        if (bytes(link).length > MAX_LINK_BYTES) revert LinkTooLong();

        id = _listings.length;
        _listings.push(
            Listing({
                poster: msg.sender,
                kind: kind,
                category: category,
                title: title,
                details: details,
                link: link,
                rateCents: rateCents,
                postedAt: uint64(block.timestamp),
                active: true
            })
        );
        emit ListingPosted(id, msg.sender, kind, title);
    }

    function close(uint256 id) external {
        if (id >= _listings.length) revert UnknownListing();
        Listing storage l = _listings[id];
        if (msg.sender != l.poster) revert NotPoster();
        if (!l.active) revert AlreadyClosed();
        l.active = false;
        emit ListingClosed(id, msg.sender);
    }

    function getListings(uint256 fromId, uint256 toId)
        external
        view
        returns (Listing[] memory page)
    {
        if (toId > _listings.length) toId = _listings.length;
        if (fromId >= toId) return new Listing[](0);
        page = new Listing[](toId - fromId);
        for (uint256 i = fromId; i < toId; ++i) {
            page[i - fromId] = _listings[i];
        }
    }

    function listingCount() external view returns (uint256) {
        return _listings.length;
    }
}
