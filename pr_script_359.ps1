$env:GITHUB_TOKEN=$null
git config credential.helper ""
git config credential.helper "!gh auth git-credential"
git fetch upstream
git checkout main
git merge upstream/main
git checkout -b fix/issue-359
git add firestore.rules
git commit -m "fix: resolve chat identity spoofing in event messages"
git push -u origin fix/issue-359
gh pr create --base main --head riddhima25bet10005-a11y:fix/issue-359 --title "fix: resolve chat identity spoofing in event messages" --body "Closes #359`n`nEnforced that senderId matches request.auth.uid for creating event messages." --repo roshankumar0036singh/Uni-Event
