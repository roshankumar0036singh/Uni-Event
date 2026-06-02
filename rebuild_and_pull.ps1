Set-Location cloud-functions
npm run build
Set-Location ..
$env:GITHUB_TOKEN=$null
git add .
git commit -m "fix: resolve sonarqube issues and rebuild"
git pull https://github.com/roshankumar0036singh/Uni-Event main
