cd cloud-functions
npm run build
cd ..
$env:GITHUB_TOKEN=$null
git add .
git commit -m "fix: resolve sonarqube issues and rebuild"
git pull https://github.com/roshankumar0036singh/Uni-Event main
