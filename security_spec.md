# Security Specification — AI Voice Studio

## 1. Data Invariants
1. **Strict Ownership**: A `users/{userId}` document can only be read (`get`), created, updated, or deleted by the authenticated, email-verified user whose `request.auth.uid == userId`. Collection listing (`list`) on `/users` is strictly disabled (`false`) to prevent user enumeration.
2. **Initial Tier Integrity**: On profile creation (`users/{userId}`), `tier` MUST equal `'free'`, `dailyGenerations == 0`, `totalGenerations == 0`, `totalCharacters == 0`, `uid == request.auth.uid`, and `createdAt == request.time && updatedAt == request.time`.
3. **Immutable Identity & Creation Timestamps**: `uid` and `createdAt` on `/users/{userId}` and `id`, `userId`, and `createdAt` on `/users/{userId}/generations/{generationId}` can never be altered after creation.
4. **Master Gate for Subcollections**: Every operation on `/users/{userId}/generations/{generationId}` verifies the existence of the parent `/users/{userId}` document via `exists()` (for single-doc reads/writes) and strictly binds `userId == request.auth.uid`.
5. **Query Enforcer**: `allow list` on `/users/{userId}/generations` explicitly enforces `resource.data.userId == request.auth.uid && request.auth.uid == userId` without calling `get()`/`exists()` inside list rules.
6. **Strict Schema & Bounds**: All strings enforce exact `.size()` bounds matching `firebase-blueprint.json`; ghost/shadow fields are rejected via `keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-User Profile Read**: User B attempts `get(/users/userA)`. Expected: `PERMISSION_DENIED`.
2. **User Collection Enumeration**: Any user attempts `list(/users)`. Expected: `PERMISSION_DENIED`.
3. **Self-Assigned Pro Tier on Create**: User A creates `/users/userA` with `tier: "pro"`. Expected: `PERMISSION_DENIED`.
4. **Ghost Field Injection (Shadow Update)**: User A updates `/users/userA` adding `isAdmin: true` or `credits: 999999`. Expected: `PERMISSION_DENIED`.
5. **Spoofed UID**: User A creates `/users/userA` with `uid: "userB"`. Expected: `PERMISSION_DENIED`.
6. **Fake Client Timestamp**: User A creates `/users/userA` with `createdAt: new Date('2020-01-01')` instead of `request.time`. Expected: `PERMISSION_DENIED`.
7. **Unverified Email Bypass**: Unverified user (`email_verified: false`) attempts write to `/users/userA`. Expected: `PERMISSION_DENIED`.
8. **ID Poisoning**: User A writes `/users/userA/generations/<1500-char-id>` or invalid characters `$bad/id`. Expected: `PERMISSION_DENIED`.
9. **Orphaned Generation Write**: User A attempts to create `/users/userA/generations/gen1` before `/users/userA` exists. Expected: `PERMISSION_DENIED`.
10. **Oversized Script Text Injection (DoW)**: User A writes a 50,000-char `text` payload to `/users/userA/generations/gen1`. Expected: `PERMISSION_DENIED`.
11. **Disallowed Model Enumeration**: User A writes `model: "gemini-1.5-pro"` in `/users/userA/generations/gen1`. Expected: `PERMISSION_DENIED`.
12. **Cross-User History List**: User B queries `list(/users/userA/generations)`. Expected: `PERMISSION_DENIED`.
