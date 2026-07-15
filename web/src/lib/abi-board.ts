// Generated from contracts/out/ClaspBoard.sol/ClaspBoard.json
// Regenerate: node scripts/gen-abi.cjs
export const boardAbi = [
  {
    "type": "function",
    "name": "MAX_DETAILS_BYTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_LINK_BYTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_TITLE_BYTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "close",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getListings",
    "inputs": [
      {
        "name": "fromId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "toId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "page",
        "type": "tuple[]",
        "internalType": "struct ClaspBoard.Listing[]",
        "components": [
          {
            "name": "poster",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum ClaspBoard.Kind"
          },
          {
            "name": "category",
            "type": "uint8",
            "internalType": "enum ClaspBoard.Category"
          },
          {
            "name": "title",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "details",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "link",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "rateCents",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "postedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "active",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "listingCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "post",
    "inputs": [
      {
        "name": "kind",
        "type": "uint8",
        "internalType": "enum ClaspBoard.Kind"
      },
      {
        "name": "category",
        "type": "uint8",
        "internalType": "enum ClaspBoard.Category"
      },
      {
        "name": "title",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "details",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "link",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "rateCents",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ListingClosed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "poster",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ListingPosted",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "poster",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "kind",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum ClaspBoard.Kind"
      },
      {
        "name": "title",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyClosed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DetailsTooLong",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EmptyTitle",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LinkTooLong",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotPoster",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TitleTooLong",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnknownListing",
    "inputs": []
  }
] as const;
