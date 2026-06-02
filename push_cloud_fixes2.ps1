$env:GITHUB_TOKEN=$null
git add cloud-functions/src/onFeedbackSubmit.ts
git add cloud-functions/src/onFeedbackSubmit.test.ts
git commit -m "fix: validate feedback path IDs and verify user attendance/registration"
git push origin fix/issue-519
