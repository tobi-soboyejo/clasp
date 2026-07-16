# Submission sheet — copy-paste fields

- **Name:** Clasp
- **One-liner:** The credit check for deals between strangers — an onchain
  payment-reputation registry with a glass-box credit score.
- **Category:** Monad **Testnet**
- **Live app:** https://claspscore.com (also https://clasp-rosy.vercel.app)
- **Repo:** https://github.com/tobi-soboyejo/clasp
- **Contract address (primary):** 0xac644Cc4967d9e3735c2dA3D8c8C881637B3A43f
  (ClaspRegistry — also ClaspBoard 0x432a33034C9ccabD73c17C08B9237a2aC6C81Ae9,
  ClaspProfile 0x3A853A7Ed366C545c2f37928CA6e08dcBE694e69; all
  Sourcify-verified, chain 10143)
- **Demo video:** (add URL after recording)
- **Social post:** (add URL after posting)

**Problem (from README §story):** A client owed me $2,000 for completed
work and vanished — I'm pursuing it legally. There was no way to check his
payment history before taking the job, and no way for the next freelancer
to learn from what happened to me. Informal work has no credit bureau:
payment behavior lives in private inboxes and dies there.

**Solution:** Both parties co-sign the deal onchain before work starts;
outcomes — paid, defaulted, disputed, or silence — become permanent public
history and a 300–850 Clasp Score that publishes its full arithmetic.
Clients co-sign gaslessly via a free EIP-712 signature (like DocuSign — no
crypto needed). A listings board makes every poster wear their score. A
registry, not an escrow: no funds move; the chain records commitments and
outcomes. Any centralized version gets sued into deleting records — a
permissionless contract has no one to send the cease-and-desist to, and
nobody appears in it without their own signature.
