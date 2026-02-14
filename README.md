# LocalMind AI 🇮🇳

LocalMind AI is a hyperlocal, multimodal AI assistant for India. It uses your camera, location, and Gemini 1.5 Flash to provide real-time, actionable intelligence about your surroundings.

## Features 🚀

-   **Multimodal Analysis**: Understands what it sees (Camera) and where it is (GPS).
-   **Hyperlocal Intelligence**: Identifies shops, street signs, and estimates local prices/rules in India.
-   **Multilingual**: Responds in English, Hindi/Hinglish based on context.
-   **Hackathon Ready**: One-command backend deployment.

## Tech Stack 🛠️

-   **Frontend**: Expo (React Native) - Android First.
-   **Backend**: FastAPI (Python) + Google Gemini 1.5 Flash.
-   **Infrastructure**: Docker & Docker Compose.

## Prerequisites 📋

-   **Docker** & **Docker Compose** (v2) installed.
-   **Node.js** (v20+) & **npm** installed.
-   **Expo Go** app on your Android/iOS device.
-   **Gemini API Key**: [Get it here](https://aistudio.google.com/app/apikey).

## Quick Start 🏁

### 1. Backend Setup

The project includes a `deploy.sh` script to spin up the backend.

```bash
cd localmind-ai
# Initial setup (first time only)
cp .env.example .env
# EDITOR .env  <-- Add your GEMINI_API_KEY here!

# Deploy
./deploy.sh
```

This will start the backend on `http://localhost:8000`.

### 2. Frontend Setup

```bash
cd localmind-ai/frontend
npm install
npm start
```

Scan the QR code with the **Expo Go** app on your phone.

> **Note for Emulator**: If running on Android Emulator, the app is pre-configured to connect to `http://10.0.2.2:8000`.
>
> **Note for Real Device**: Open `frontend/App.js` and change `BACKEND_URL` to your computer's LAN IP (e.g., `http://192.168.1.5:8000`).

## Usage 📱

1.  Open the app.
2.  Grant Camera and Location permissions.
3.  Point camera at a street sign, shop, or object.
4.  (Optional) Type a question like "Is this safe?" or "Price?".
5.  Tap **Capture** (White Circle).
6.  View the AI's analysis!

## Testing Backend Manually

You can test the backend without the app using the test script:

```bash
# Make sure backend is running
python3 backend/test_backend.py
```
