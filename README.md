# 🎓 Student AI Career Advisor (Cloudflare Pages & Firebase)

A modern, commercial-ready AI Career Advisor web application built for college students. Powered by **Google Gemini AI**, **Cloudflare Pages**, and **Firebase** (Authentication, Firestore Database, and Cloud Storage).

---

## ⚡ Why Cloudflare Pages + Firebase?
1. **100% Free Forever**: Zero hosting fees, zero compute fees on standard quotas.
2. **Commercial-Friendly**: Unlike Vercel Hobby, Cloudflare Pages explicitly permits monetized and commercial projects on its free tier.
3. **Mandatory Student Login**: Students must sign in (with Google or College Email) before accessing the portal. Their career profiles, roadmaps, and PDF resumes are private and securely stored in Firebase.

---

## 🏗️ Project Structure
```
AI Career Advisor/
├── functions/
│   └── api/
│       └── proxy.js         # Cloudflare Pages Function (hides Gemini API key)
├── api/
│   └── proxy.js             # Vercel / local Node fallback proxy
├── index.html               # Frontend Student Portal with Mandatory Login Gate
├── firebase-config.js       # Firebase SDK service layer & config
├── .env.local               # Local development keys
├── .env.example             # Template for environment variables
└── README.md                # Deployment instructions
```

---

## 🚀 Deployment Guide: Cloudflare Pages (Free & 1-Click)

### Step 1: Push Project to GitHub
Initialize git and push this repository to your GitHub account:
```bash
git init
git add .
git commit -m "Initial commit of Student AI Career Advisor"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Deploy on Cloudflare Pages
1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and sign up or log in.
2. In the left navigation, click **Workers & Pages** &rarr; **Create application** &rarr; select the **Pages** tab.
3. Click **Connect to Git** and choose your GitHub repository.
4. Set the Build Configuration:
   - **Framework preset**: None
   - **Build command**: *(leave completely blank)*
   - **Build output directory**: `.` *(or leave blank for root)*
5. Expand **Environment variables** and add:
   - **Variable name**: `GEMINI_API_KEY`
   - **Value**: `<your-gemini-api-key>`
6. Click **Save and Deploy**. Cloudflare will build and give you a free `https://<your-project>.pages.dev` URL!

---

## 🔐 Setup Firebase Authentication & Cloud Storage

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project (e.g. `college-career-portal`).
2. **Enable Authentication**:
   - Go to **Build > Authentication > Sign-in method**.
   - Enable **Google** (set support email).
   - Enable **Email/Password**.
3. **Enable Firestore Database**:
   - Go to **Build > Firestore Database > Create Database**.
   - Set security rules:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /users/{userId}/{document=**} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
     ```
4. **Enable Cloud Storage**:
   - Go to **Build > Storage > Get Started**.
   - Set security rules:
     ```javascript
     rules_version = '2';
     service firebase.storage {
       match /b/{bucket}/o {
         match /resumes/{userId}/{allPaths=**} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
     ```
5. **Paste Config into `firebase-config.js`**:
   - In Firebase Project Settings &rarr; **Your apps** &rarr; Web (`</>`), copy your `firebaseConfig` object and paste it into [`firebase-config.js`](file:///c:/Users/thanujkumar/OneDrive/Desktop/AI%20Career%20Advisor/firebase-config.js).

---

## ✨ Features for Students
- **Mandatory Authentication**: Students sign in with Google or student email.
- **Role Readiness & 15-Year Market Demand**: Half-doughnut fit score and growth line charts.
- **Custom Campus Cover Letter Generator**: Generates 3-paragraph tailored cover letters for matching jobs in seconds.
- **Actionable 3-Step Micro-Roadmap**: Concrete learning steps for missing skills.
- **Live AI Campus Interviewer**: Gemini voice speaks questions aloud and grades student responses in real time.
- **Instant Resume Export**: Downloads A4 PDF and syncs to Firebase Cloud Storage.
