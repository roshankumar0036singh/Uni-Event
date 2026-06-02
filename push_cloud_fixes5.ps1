$env:GITHUB_TOKEN=$null
git add app/src/lib/feedbackService.js
git add cloud-functions/src/onFeedbackSubmit.ts
git commit -m "fix: refactor onFeedbackSubmit to reduce Cognitive Complexity and remove unused import"
git push origin fix/issue-519
