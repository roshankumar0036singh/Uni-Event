$env:GITHUB_TOKEN=$null
git add app/src/lib/feedbackService.js
git add app/src/lib/__tests__/feedbackService.test.js
git add cloud-functions/src/onFeedbackSubmit.ts
git commit -m "fix: resolve SonarQube TOCTOU and remaining SSRF/Path Traversal warnings"
git push origin fix/issue-519
