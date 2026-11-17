# Master Admin two-person rule

Exactly two seats. They are filled from environment variables, not from a hardcoded password. The primary seat defaults to Nicholas Will. The secondary seat is named Lead Pastor and has no email until it is set.

In-app grant of a third Master Admin is rejected. Revoke runs only when both current Master Admins have approved. With one seat empty, both actions are rejected so one person cannot appoint or remove the other. Restoring the empty seat is the env var on the next process, which is the same path as the original seed.

Master Admins still step up for Tier 3, and those reads are audited.
