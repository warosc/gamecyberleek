# Online integration boundaries (Phases G/H)

LEEK OPS remains fully playable offline. Phase F persistence uses a versioned local profile and
cannot require a network connection.

Phase G may add accounts, cloud saves, leaderboards, or remote configuration only behind an
explicit service adapter. Authentication, authorization, rate limits, privacy, consent,
observability, backups, and migration policy must be selected before implementation.

Phase H streaming events must enter through a secure server queue with moderation, cooldowns,
abuse prevention, broadcaster controls, and an offline fallback. Browser clients must never hold
provider secrets or accept arbitrary event payloads.
