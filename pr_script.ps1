$env:GITHUB_TOKEN=$null
git config credential.helper ""
git config credential.helper "!gh auth git-credential"
git checkout main
git pull origin main
git checkout -b fix/issue-294
git add firestore.rules
git commit -m "fix: resolve PII leak in event participants"
gh repo fork --remote=true
git push -u origin fix/issue-294
gh pr create --base main --head riddhima25bet10005-a11y:fix/issue-294 --title "fix: resolve PII leak in event participants" --body "Closes #294`n`nRemoved the \`exists\` rule that allowed participants to read all other participants' data and replaced it with a check to ensure only the event owner can read them, in addition to admins and clubs." --repo roshankumar0036singh/Uni-Event
