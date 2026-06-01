# Description

Implemented paginated backend queries for `UserFeed.js` to fix the unbounded listener bug where the entire `events` collection was downloaded to every client, causing memory leaks and excess billing.

Fixes #205

## Type of change

- [x] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] This change requires a documentation update

# How Has This Been Tested?

- [x] Code passes Jest `npm run test` syntax checks locally.
- [x] Prettier linting and formatting applied.
- [x] Ensured that `Upcoming`, `Past`, and `Category` filters work properly with `limit(20)` and `startAfter` cursor logic.

# Checklist:

- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I have made corresponding changes to the documentation
- [x] My changes generate no new warnings
- [x] I have added tests that prove my fix is effective or that my feature works
- [x] New and existing unit tests pass locally with my changes
- [x] Any dependent changes have been merged and published in downstream modules
