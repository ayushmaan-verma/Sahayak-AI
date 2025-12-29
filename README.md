[# Sahayak.AI — Government Scheme Assistant 🇮🇳

🚀 **Live MVP**: https://sahayak-ai-478287720120.us-west1.run.app/

**Sahayak.AI** is a production-oriented, AI-powered conversational assistant built to bridge the gap between Indian citizens and government welfare schemes. It simplifies complex government policies into clear, personalized, and actionable guidance using modern Generative AI.

This project focuses on **practical system design**, **scalable architecture**, and **real-world usability**, rather than being a superficial demo.

---

## 🚀 Project Context

Sahayak.AI is developed as a **Minimum Viable Product (MVP)** for **GDG TechSprint – NIT Patna** by **Team Code4Change**.

The MVP validates:
- AI-driven access to government welfare information  
- End-to-end full-stack system design  
- Secure handling of sensitive user data  
- Real-world constraints in AI-assisted product development  

Future versions aim to expand scheme coverage, strengthen security, and move toward production-grade deployment.

---

## 🛠️ Tech Stack

Sahayak.AI is built with a modern, scalable, and performant stack:

- **Frontend Framework**: [React 19](https://react.dev/) - Utilizing the latest Concurrent Rendering features.
- **AI Engine**: [Google Gemini 3 Flash](https://ai.google.dev/) - Powering ultra-fast text, document, and audio processing.
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/) - Custom Glassmorphism design system for a premium feel.
- **Backend & Auth**: [Firebase](https://firebase.google.com/) - Secure Authentication and Real-time Cloud Firestore for data persistence.
- **Voice Intelligence**: [Gemini 2.5 Flash Native Audio](https://ai.google.dev/gemini-api/docs/audio) - Providing human-like Text-to-Speech (TTS) and Speech-to-Text (STT).
- **Build Tool**: [Vite](https://vitejs.dev/) - Optimized for lightning-fast development and production builds.
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Ensuring type safety and enterprise-grade reliability.

---

## ✨ Core Features

- **🤖 Intelligent Multi-modal Chat**: Ask questions via text or voice. Sahayak understands context, eligibility, and government jargon.
- **🌍 Multilingual by Design**: Full support for English, Hindi, Bengali, Marathi, Tamil, Telugu, and Punjabi.
- **📄 AI Document Analysis**: Upload government notices or IDs (PDF/Images) to get instant summaries, eligibility checks, and step-by-step application guides.
- **🎙️ Natural Voice Interaction**: Talk to the assistant and listen to responses with high-quality Indian-accented AI voices.
- **🛡️ Secure Document Locker**: Encrypted storage for your IDs (Aadhaar, PAN, etc.) with real-time sync across devices.
- **📊 Application Tracker**: Keep a pulse on your active government applications with a visual progress tracker.
- **🎯 Personalized Matching**: Algorithms that suggest schemes based on your age, income, state, and category.
- **🌓 Adaptive UI**: Elegant Glassmorphism interface with intelligent Dark and Light mode themes.

---

## 🔥 Step-by-Step Firestore Setup

To ensure Sahayak.AI functions correctly, your Firestore database must follow this architecture.

### 1. Create the Database
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Select your project.
3. Click **Firestore Database** in the sidebar.
4. Click **Create database**.
5. Select **"Start in test mode"** (for initial dev) and choose a location (e.g., `asia-south1` for India).

### 2. Collection Hierarchy & Naming
The app automatically creates these when a user signs up, but here is the structure you should expect:

#### Root Collection: `users`
This collection holds the primary data for every registered citizen.
- **Document ID**: Use the Firebase Authentication `UID` (e.g., `8k9Jm...`).
- **Fields**:
  - `profile`: Map (contains `name`, `age`, `income`, `state`, etc.)
  - `bookmarks`: Array of Objects (each object is a `Scheme`)
  - `locker`: Array of Objects (each object is a `LockerDocument` with base64 data)

#### Sub-collection: `sessions`
Located at `users/{UID}/sessions/`. This allows chat history to grow without hitting the 1MB document limit of the main user profile.
- **Document ID**: Randomly generated or `Date.now()` timestamp.
- **Fields**:
  - `id`: String
  - `title`: String
  - `lastModified`: String (ISO Timestamp)
  - `messages`: Array of Objects (The full chat thread)

### 3. Data Schema Visualization
```text
/users (Collection)
  └── {auth_uid} (Document)
        ├── profile: { name: "Raj", state: "Maharashtra", ... }
        ├── bookmarks: [ { id: "scheme-1", name: "PM-Kisan", ... } ]
        ├── locker: [ { id: "doc-aadhaar", name: "Aadhaar Card", data: "base64..." } ]
        └── /sessions (Sub-collection)
              └── {session_id} (Document)
                    ├── title: "Crop Insurance Enquiry"
                    ├── lastModified: "2023-10-27T..."
                    └── messages: [ { role: "user", content: "..." }, ... ]
```

### 4. Security Rules (Mandatory)
Paste this into the **Rules** tab to prevent users from seeing each other's documents or IDs:

```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    // Lock down the users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Lock down sub-collections (chat history)
      match /sessions/{sessionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## 📦 Getting Started

### Environment Configuration
1. **API Key**: Add your Gemini key to `.env.local` as `GEMINI_API_KEY`.
2. **Firebase Config**: Update `src/services/firebaseService.ts` with your credentials.

### Installation
```bash
npm install
npm run dev
```

---

## ⚖️ Security & Privacy
Sahayak.AI prioritizes user privacy. All personal data is stored in secure Firestore documents. Document processing is transient within the AI context and complies with standard encryption protocols.
](https://sahayak-ai-478287720120.us-west1.run.app/)
