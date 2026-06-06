# WORK-IN-PR

This draft PR picks up issue #568 — Organizer Bounties.

Plan:
- Read app/screens/EventDetailsScreen.tsx and cloud-functions/src/events/index.ts
- Implement volunteer points feature: ensure points awarded when volunteers complete check-in.
- Add unit tests for cloud-functions and integration test for front-end button flow.
- Update README with usage and admin instructions.

Implementation steps:
1) Add serverless function 'awardPoints' to cloud-functions/src/events
2) Wire frontend EventDetailsScreen to call '/api/awardPoints' after check-in confirmation
3) Add tests and docs

Acceptance Criteria:
- Volunteers receive points on successful check-in
- Admins can view points aggregated per club
