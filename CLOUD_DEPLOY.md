# ☁️ Cloud Deployment & Distribution Guide

To make your app downloadable and usable by others, the backend must be on the internet (not localhost), and the frontend needs to be built into an APK.

## 1. Hosting the Backend (Free/Cheat Options)

### Option A: Render.com (Recommended)
1.  Push `localmind-ai/backend` to a GitHub repository.
2.  Login to [Render.com](https://render.com).
3.  New **Web Service**.
4.  Connect your repo.
5.  **Runtime**: Docker.
6.  **Environment Variables**: Add `GEMINI_API_KEY`.
7.  Deploy! You will get a URL like `https://localmind-backend.onrender.com`.

### Option B: Railway.app
1.  Login to Railway.
2.  New Project -> Deploy from Repo.
3.  Add `GEMINI_API_KEY` in variables.
4.  Get your public URL.

## 2. Updating the App

Once you have your cloud URL:

1.  Open `frontend/App.js`.
2.  Update `BACKEND_URL`:
    ```javascript
    const BACKEND_URL = 'https://localmind-backend.onrender.com'; // Use YOUR live URL
    ```

## 3. Building the APK (Android)

You need the `eas-cli` and an Expo account.

1.  **Install EAS CLI**:
    ```bash
    npm install -g eas-cli
    ```

2.  **Login**:
    ```bash
    eas login
    ```

3.  **Build**:
    ```bash
    cd frontend
    eas build -p android --profile preview
    ```
    *This will upload your code to Expo, build it, and give you a download link for the .apk file.*

4.  **Share**:
    Send that `.apk` link to your friends!

## 4. Building for iOS
iOS requires an Apple Developer Account ($99/year). If you don't have one, your friends must use **Expo Go** and scan your QR code (tunnel mode required if not on LAN).

```bash
npx expo start --tunnel
```
