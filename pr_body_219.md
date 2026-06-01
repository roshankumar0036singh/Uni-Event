## 🚀 Description

This PR fixes a critical security vulnerability and race condition in the Early Bird registration logic (Issue #219). Previously, Early Bird eligibility was determined purely on the client-side using a stale `event` object, meaning users could exploit this or multiple concurrent registrations could bypass capacity limits.

By wrapping the unpaid registration flow in a Firestore `runTransaction`, this PR ensures that:
- The `event` document is re-read securely inside an atomic block at the millisecond of registration.
- If multiple users click "Register" at the same time, their requests are serialized.
- Any configured `earlyBirdCapacity` limits are strictly enforced by checking `stats.earlyBirdRegistrations`.

## 📌 Related Issue

Fixes #219

## 📋 Checklist

- [x] I have read the contributing guidelines
- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] My changes generate no new warnings or errors

## 📸 Screenshots / Video

*(Not applicable as these are backend/transactional changes)*

## 💡 Notes for Reviewer

The transaction securely increments `stats.earlyBirdRegistrations` on the event document if the user qualifies for the badge/points, completely resolving the race condition over-allocation concern.
