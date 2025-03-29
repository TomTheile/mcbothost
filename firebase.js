
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set,
    get
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyAOesOedC4jMlZhYpgeCYZ56vqEZqIAbyo",
    authDomain: "afkmcbot-bea87.firebaseapp.com",
    databaseURL: "https://afkmcbot-bea87-default-rtdb.firebaseio.com",
    projectId: "afkmcbot-bea87",
    storageBucket: "afkmcbot-bea87.firebasestorage.app",
    messagingSenderId: "154435725297",
    appId: "1:154435725297:web:ebb31c2be656b32ea3c650",
    measurementId: "G-MXPZJH82R8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const functions = getFunctions(app);

export { 
    auth, 
    db,
    functions,
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    ref, 
    set,
    get
};
