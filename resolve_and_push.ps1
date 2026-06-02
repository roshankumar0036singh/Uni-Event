cd cloud-functions
git checkout --theirs package-lock.json lib/
npm install
npm run build
cd ..
git add cloud-functions/src/index.ts cloud-functions/package-lock.json cloud-functions/lib/
git commit --no-edit
git push origin fix/issue-519
