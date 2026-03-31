---
name: Campaign + Escrow Fee System
description: Two-PDA architecture for campaigns (0% fee) flowing into escrow (3% fee), with solo and collaborative release modes
type: project
---

renaissBlock is building a campaign/fundraising system with a two-PDA architecture:
- PDA1 (Campaign Escrow): backers contribute at 0% fee, all-or-nothing by deadline
- PDA2 (Project Escrow): funds locked for production, 3% fee on release

Two release modes for PDA2:
- Collaborative: writer approves milestones → artist 97% + rB 3%
- Solo: chapter published on rB → creator 97% + rB 3% (serialized release, e.g. 6 chapters = 1/6 per publish)

Safety: if no escrow contracts created within 60 days of campaign funding, auto-reclaim (no vote needed).
Solo failure = full refund possible (no funds released until publish).
Collab failure = partial refund (some milestones already paid).

Campaign accessed from Studio section as a 4th content type card.

**Why:** renaissBlock evolved from a content marketplace into an escrow platform for collaboration. Campaigns add fundraising to the mix. 3% escrow fee is the primary revenue channel (no fee on campaigns to avoid double taxation).

**How to apply:** All escrow-related work should account for the two PDA architecture. Content sales fees (1-10% by tier) are separate from the 3% escrow fee.
