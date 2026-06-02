$env:GITHUB_TOKEN=$null
git add cloud-functions/src/onFeedbackSubmit.ts
git add cloud-functions/src/onFeedbackSubmit.test.ts
git commit -m "fix: validate feedback submit data and add unit tests to resolve SonarCloud"
git push origin fix/issue-519
