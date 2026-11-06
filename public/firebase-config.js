/**
 * Firebase Configuration & Service Layer
 * 
 * Instructions:
 * 1. Go to Firebase Console (https://console.firebase.google.com/).
 * 2. Create or select your Firebase project.
 * 3. Enable:
 *    - Authentication -> Sign-in method -> Enable "Email/Password" and "Google".
 *    - Firestore Database -> Create database (Start in test mode or with rules below).
 *    - Cloud Storage -> Create bucket (Start in test mode or with rules below).
 * 4. In Project Settings -> General -> Your apps -> Add Web App, copy your firebaseConfig here.
 */

const firebaseConfig = {
    apiKey: "AIzaSyAv6QilMTKazOqdUwwIoznDliigbfDU-O8",
    authDomain: "studentaicareer-f3e32.firebaseapp.com",
    projectId: "studentaicareer-f3e32",
    storageBucket: "studentaicareer-f3e32.firebasestorage.app",
    messagingSenderId: "543931394650",
    appId: "1:543931394650:web:fab5788d5d364ba3794663"
  };

// --- Firebase Service Wrapper ---
(function(window) {
    "use strict";

    let isInitialized = false;
    let auth = null;
    let db = null;
    let storage = null;

    // Check if user filled in real credentials
    const isConfigured = Boolean(
        firebaseConfig.apiKey && 
        firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" && 
        firebaseConfig.projectId !== "YOUR_PROJECT_ID"
    );

    if (isConfigured && typeof firebase !== 'undefined') {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            auth = firebase.auth();
            db = firebase.firestore();
            try {
                storage = firebase.storage();
            } catch (storageErr) {
                console.info("Firebase Cloud Storage optional, continuing on Spark free tier.");
            }
            isInitialized = true;
            console.log("Firebase initialized successfully.");
        } catch (err) {
            console.error("Firebase initialization failed:", err);
        }
    } else {
        console.warn("Firebase is running in setup mode. Please insert your keys in firebase-config.js to enable Cloud Auth and Storage.");
    }

    const FirebaseService = {
        isConfigured: () => isConfigured && isInitialized,

        // --- Authentication ---
        onAuthStateChanged: (callback) => {
            if (!isInitialized || !auth) {
                callback(null);
                return () => {};
            }
            return auth.onAuthStateChanged(callback);
        },

        getCurrentUser: () => {
            return auth ? auth.currentUser : null;
        },

        signInWithGoogle: async () => {
            if (!isInitialized || !auth) {
                throw new Error("Firebase is not configured. Please paste your Firebase credentials into firebase-config.js.");
            }
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            try {
                return await auth.signInWithPopup(provider);
            } catch (err) {
                // If popup was blocked by browser, automatically attempt redirect
                if (err.code === 'auth/popup-blocked') {
                    console.warn("Popup blocked by browser. Automatically trying signInWithRedirect...");
                    return await auth.signInWithRedirect(provider);
                }
                throw err;
            }
        },

        signInWithGoogleRedirect: async () => {
            if (!isInitialized || !auth) {
                throw new Error("Firebase is not configured. Please paste your Firebase credentials into firebase-config.js.");
            }
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            return auth.signInWithRedirect(provider);
        },

        checkRedirectResult: async () => {
            if (!isInitialized || !auth) return null;
            try {
                const result = await auth.getRedirectResult();
                return result ? result.user : null;
            } catch (err) {
                console.error("Firebase redirect result error:", err);
                throw err;
            }
        },

        signInWithEmail: async (email, password) => {
            if (!isInitialized || !auth) {
                throw new Error("Firebase is not configured. Please paste your Firebase credentials into firebase-config.js.");
            }
            return auth.signInWithEmailAndPassword(email, password);
        },

        signUpWithEmail: async (email, password, displayName) => {
            if (!isInitialized || !auth) {
                throw new Error("Firebase is not configured. Please paste your Firebase credentials into firebase-config.js.");
            }
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            if (displayName && userCredential.user) {
                await userCredential.user.updateProfile({ displayName });
            }
            return userCredential;
        },

        signOut: async () => {
            if (!isInitialized || !auth) return;
            return auth.signOut();
        },

        // --- Firestore: User Profile & Career Data ---
        saveUserProfile: async (profileData) => {
            if (!isInitialized || !db) {
                throw new Error("Firebase Firestore is not configured.");
            }
            const user = auth.currentUser;
            if (!user) throw new Error("Please sign in to save your profile to the cloud.");

            const userRef = db.collection('users').doc(user.uid);
            return userRef.set({
                ...profileData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                userEmail: user.email,
                userName: user.displayName || profileData.userName || ''
            }, { merge: true });
        },

        loadUserProfile: async () => {
            if (!isInitialized || !db) {
                throw new Error("Firebase Firestore is not configured.");
            }
            const user = auth.currentUser;
            if (!user) throw new Error("Please sign in to load your saved profile.");

            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        },

        // --- Firebase Cloud Storage: Resumes ---
        uploadResumePDF: async (pdfBlob, filename) => {
            if (!isInitialized || !storage) {
                throw new Error("Firebase Storage is not configured.");
            }
            const user = auth.currentUser;
            if (!user) throw new Error("Please sign in to upload your resume to the cloud.");

            const cleanFileName = filename || `resume_${Date.now()}.pdf`;
            const storageRef = storage.ref().child(`resumes/${user.uid}/${Date.now()}_${cleanFileName}`);
            
            const snapshot = await storageRef.put(pdfBlob, {
                contentType: 'application/pdf',
                customMetadata: {
                    userId: user.uid,
                    uploadedAt: new Date().toISOString()
                }
            });

            const downloadUrl = await snapshot.ref.getDownloadURL();

            // Save record in user's resumes history in Firestore
            if (db) {
                await db.collection('users').doc(user.uid).collection('resumes').add({
                    fileName: cleanFileName,
                    downloadUrl: downloadUrl,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            return { downloadUrl, fileName: cleanFileName };
        },

        getUserResumes: async () => {
            if (!isInitialized || !db) return [];
            const user = auth.currentUser;
            if (!user) return [];

            const snapshot = await db.collection('users').doc(user.uid)
                .collection('resumes')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
    };

    window.FirebaseService = FirebaseService;
})(window);

