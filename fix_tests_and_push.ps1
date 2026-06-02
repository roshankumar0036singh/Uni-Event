$env:GITHUB_TOKEN=$null
git add app/src/lib/__tests__/feedbackService.test.js
git commit -m "test: fix tests for feedbackService to resolve SonarCloud analysis"
git push origin fix/issue-519
