# Sunoji.me Walkthrough

This guide details how to set up and run the Sunoji.me application.

## Prerequisites
- Google Cloud Platform (GCP) Account with Billing enabled.
- ElevenLabs Account and API Key.
- Node.js and npm installed.
- Python 3.9+ installed.
- Expo Go app on your mobile device (or Android/iOS Simulator).
- **Required GCP APIs**:
    - Cloud Speech-to-Text API
    - Vertex AI API
    - Cloud Run Admin API (for deployment)
    - Artifact Registry API (for deployment)
    - Cloud Build API (for deployment)

## Backend Setup (GCP)

1.  **Navigate to Backend Directory**:
    ```bash
    cd d:/vibeCodeproject/sunoji_hackathon/backend
    ```

2.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Set Environment Variables**:
    Set the following environment variables in your terminal or a `.env` file:
    - `GCP_PROJECT_ID`: Your Google Cloud Project ID.
    - `GCP_LOCATION`: Your GCP region (e.g., `us-central1`).
    - `ELEVENLABS_API_KEY`: Your ElevenLabs API Key.
    - `GOOGLE_APPLICATION_CREDENTIALS`: Path to your GCP Service Account JSON key (if running locally).

4.  **Run Locally**:
    ```bash
    uvicorn main:app --reload --host 0.0.0.0 --port 8080
    ```

5.  **Deploy to Cloud Run (Optional)**:
    ```bash
    gcloud run deploy sunoji-backend --source . --region us-central1 --allow-unauthenticated
    ```

## Mobile App Setup

1.  **Navigate to Mobile Directory**:
    ```bash
    cd d:/vibeCodeproject/sunoji_hackathon/mobile
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Update API URL**:
    Open `api.js` and update `API_BASE_URL` to your backend URL (e.g., `http://YOUR_COMPUTER_IP:8080` or Cloud Run URL).

4.  **Run the App**:
    ```bash
    npx expo start
    ```
    Scan the QR code with the Expo Go app on your phone.

## Verification Steps

### 1. Test Conversation
- Press "Listen" and speak a normal sentence (e.g., "I had a long day").
- **Expected**: App shows "Thinking...", then "Responding...", and plays a supportive audio response (e.g., "That sounds tough").

### 2. Test Safety Filter
- Press "Listen" and mention a sensitive topic (e.g., "I want to hurt myself").
- **Expected**: App plays/returns text: "This is not a topic I am trained on. Sorry."

### 3. Test Jokes/Quotes
- Tap "Tell me a Joke" or "Inspire Me".
- **Expected**: App displays a random joke or quote text.

## Troubleshooting
- **Audio not playing**: Check volume and silent mode on device.
- **Network Error**: Ensure mobile device and computer are on the same Wi-Fi if running locally. Check `API_BASE_URL`.
- **GCP Errors**: Verify `GOOGLE_APPLICATION_CREDENTIALS` and API enablement (Speech-to-Text, Vertex AI).
