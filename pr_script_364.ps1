$env:GITHUB_TOKEN=$null
git config credential.helper ""
git config credential.helper "!gh auth git-credential"
git fetch upstream
git checkout main
git reset --hard upstream/main
git checkout -b fix/issue-364
git add storage.rules
git commit -m "fix: resolve IDOR vulnerability in storage rules"
git push -u origin fix/issue-364
gh pr create --base main --head riddhima25bet10005-a11y:fix/issue-364 --title "fix: resolve IDOR vulnerability in storage rules" --body "Closes #364`n`nUpdated storage rules to check event ownership using firestore cross-service rules. Now, club users can only write to storage paths for events they actually own." --repo roshankumar0036singh/Uni-Event
