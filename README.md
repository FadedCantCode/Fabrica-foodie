# Fabrica Foodie

Fabrica Foodie is a personal food library for saving restaurant and food recommendations from Threads.

The long-term goal is simple: when a Threads user mentions `@fabrica_tw`, Fabrica saves the recommendation into that user's food library. While the Meta app is still in development or waiting for review, the app also supports a manual import flow where users paste Threads text or a Threads link into the site.

## Features

- Google sign-in with Firebase Authentication
- Private food library per Firebase user
- Manual Threads import for MVP testing
- AI-assisted food card extraction with Gemini
- Saves source text, Threads link, author handle, confidence, and verification status
- Tracks consumer-facing details:
  - main offer / signature items
  - reputation summary
  - recent promotions
  - business hours
- Optional Threads webhook endpoint for future `@fabrica_tw` automation

## Tech Stack

- Next.js 14
- React 18
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Gemini API
- Vercel

## Required Environment Variables

Set these in Vercel:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
GEMINI_API_KEY=your_gemini_api_key
```

Optional for Threads webhook support:

```env
THREADS_ACCESS_TOKEN=your_threads_access_token
THREADS_VERIFY_TOKEN=your_webhook_verify_token
```

## Firebase Setup

Enable Google sign-in:

1. Open Firebase Console.
2. Go to Authentication.
3. Open Sign-in method.
4. Enable Google.
5. Add your Vercel domain to Authorized domains.

Example:

```text
project-fabricafoodie.vercel.app
```

## Firestore Rules

Use rules like this for the Google-login version:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function ownsUserDoc(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    match /artifacts/fabrica-foodie-app/users/{uid}/{document=**} {
      allow read, write: if ownsUserDoc(uid);
    }

    match /artifacts/fabrica-foodie-app/verifiedUsers/{threadsUsername} {
      allow read, write: if false;
    }
  }
}
```

## Manual Threads Import

Because Meta does not send real production webhook events while the app is in development mode, the current MVP flow is:

1. Sign in with Google.
2. Paste a Threads post link, food text, or review into the import modal.
3. Fabrica analyzes the content.
4. The result is saved to the user's food library.

For best results, paste both the Threads link and the post text. If only a link is provided and Threads blocks server-side fetching, Fabrica will save a fallback card and mark uncertain fields as `未確認`.

## Threads Webhook

The webhook route is available at:

```text
/api/threads-webhook
```

The endpoint supports:

- Meta webhook verification
- `@fabrica_tw verify FAB-1234` verification events
- future automatic food saving from Threads mentions

Important: real Threads mention events are not delivered while the Meta app is in development mode. The app must be live and approved for the relevant Threads permissions before production webhook automation works.

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Project Status

This project is currently an MVP. The recommended production path is:

1. Use Google login and manual import while Meta permissions are pending.
2. Keep Firestore locked by Firebase UID.
3. Move future webhook writes to Firebase Admin SDK before enabling public Threads automation.
4. Enable `@fabrica_tw` automatic saving only after Meta App Review and webhook delivery are working.
