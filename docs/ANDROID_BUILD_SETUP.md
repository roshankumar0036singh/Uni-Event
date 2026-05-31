# Android Build and Release Guide

This guide details how to set up, configure, and trigger the GitHub Actions workflow to build the Android APK and automatically publish it as a GitHub Release.

---

## Build Architecture

The CI/CD workflow `.github/workflows/build-android-apk.yml` is configured to run **local EAS builds** on the GitHub Actions runner. This offers several benefits:
1. **Free / No EAS Cloud Build Quota Limits**: Building locally on the GitHub runner avoids consuming EAS build minutes.
2. **Aggressive Caching**: Speeds up build times by 40–60% by caching:
   - Node modules (`node_modules`)
   - Gradle wrapper and caches (`~/.gradle`)
   - EAS build directory (`~/.eas`)
   - Expo build cache (`app/.expo`)

---

## Setup Guide

To use the build workflow, you must configure secrets in your GitHub repository (**Settings > Secrets and variables > Actions**).

### Required Secret

#### 1. `EXPO_TOKEN`
Required for Expo CLI authentication.
- **How to generate**:
  1. Log into your account on the [Expo Dashboard](https://expo.dev).
  2. Navigate to **Account Settings > Access Tokens**.
  3. Click **Create token**, provide a name, and copy the generated token.
  4. Save it as a repository secret named `EXPO_TOKEN`.

---

### Optional Secrets (for Local Keystore Signing)

By default, if only `EXPO_TOKEN` is provided, the EAS local build automatically downloads the remote credentials (keystore and passwords) managed in your Expo project dashboard.

If you prefer to manage the Android signing credentials entirely inside GitHub Secrets without uploading them to Expo, you can supply the following secrets:

#### 1. `ANDROID_KEYSTORE_BASE64`
The base64-encoded string of your `.jks` or `.keystore` file.
- **To generate the base64 string on macOS**:
  ```bash
  base64 -i my-release-key.keystore -o base64-keystore.txt
  ```
- **To generate the base64 string on Linux**:
  ```bash
  base64 -w 0 my-release-key.keystore > base64-keystore.txt
  ```
  *(If `-w` is unavailable, use: `base64 my-release-key.keystore | tr -d '\n' > base64-keystore.txt`)*
- **To generate the base64 string on Windows (PowerShell)**:
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("my-release-key.keystore")) > base64-keystore.txt
  ```
- Copy the contents of the generated `base64-keystore.txt` and save it as `ANDROID_KEYSTORE_BASE64`.

#### 2. `ANDROID_KEYSTORE_PASSWORD`
The password used to secure your keystore.

#### 3. `ANDROID_KEY_ALIAS`
The alias name you assigned to your key (e.g. `my-key-alias`).

#### 4. `ANDROID_KEY_PASSWORD`
The password for your key alias.

---

## How to Trigger a Build

### Option 1: Create a Release Tag (Automated Release)
Pushing a version tag matching `v*` will trigger the build and automatically attach the resulting APK to a new GitHub Release.
```bash
# Create a new version tag
git tag v1.0.0

# Push the tag to GitHub
git push origin v1.0.0
```

### Option 2: Run Manually (Workflow Dispatch)
1. Go to your repository on GitHub.
2. Click on the **Actions** tab.
3. Select **Build Android APK** in the left sidebar.
4. Click the **Run workflow** dropdown and click **Run workflow**.

---

## Troubleshooting & Best Practices

- **Keystore Generation**: If you do not have a keystore yet, you can let Expo generate one for you by running `eas credentials` in your local terminal and configuring your project.
- **Repository Visibility / Security**: Never commit your keystore file or a raw `credentials.json` to the Git repository. Ensure `credentials.json` and keystores are included in your `app/.gitignore`.
- **EAS Configuration (`eas.json`)**: The configuration uses the `preview` profile to output an APK file. In `app/eas.json`, the build profile defines `"buildType": "apk"`. If you wish to build an App Bundle (`.aab`) for Google Play Store upload, use the `production` profile and modify/extend the workflow to support production signing.
