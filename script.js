
import { 
    auth, 
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    ref, 
    set,
    get
} from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');

    // Tab switching functions
    loginTab.addEventListener('click', () => switchTabs(true));
    registerTab.addEventListener('click', () => switchTabs(false));

    function switchTabs(showLogin = true) {
        if (showLogin) {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
        }
    }

    // Login handler
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const email = loginForm.querySelector('input[type="email"]').value;
            const password = loginForm.querySelector('input[type="password"]').value;

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (!user.emailVerified) {
                alert('Bitte bestätige zuerst deine E-Mail-Adresse!');
                await signOut(auth);
                return;
            }

            window.location.href = '/dashboard.html';
        } catch (error) {
            console.error('Login error:', error);
            if (error.code === 'auth/network-request-failed') {
                alert('Netzwerkfehler: Bitte überprüfe deine Internetverbindung');
            } else if (error.code === 'auth/wrong-password') {
                alert('Falsches Passwort');
            } else if (error.code === 'auth/user-not-found') {
                alert('Benutzer nicht gefunden');
            } else {
                alert('Login fehlgeschlagen: ' + error.message);
            }
        }
    });

    // Register handler
    registerBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const username = registerForm.querySelector('input[type="text"]').value;
            const email = registerForm.querySelector('input[type="email"]').value;
            const password = registerForm.querySelectorAll('input[type="password"]')[0].value;
            const confirmPassword = registerForm.querySelectorAll('input[type="password"]')[1].value;

            if (password !== confirmPassword) {
                alert("Die Passwörter stimmen nicht überein!");
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await set(ref(db, `users/${user.uid}`), {
                username,
                email,
                verified: false,
                createdAt: new Date().toISOString()
            });

            await sendEmailVerification(user);
            alert(`Bitte überprüfe deine E-Mails bei ${email} um deinen Account zu aktivieren.`);
            await signOut(auth);
            switchTabs(true);

        } catch (error) {
            console.error('Registration error:', error);
            if (error.code === 'auth/email-already-in-use') {
                alert('Diese E-Mail-Adresse wird bereits verwendet.');
            } else if (error.code === 'auth/network-request-failed') {
                alert('Netzwerkfehler: Bitte überprüfe deine Internetverbindung');
            } else if (error.code === 'auth/weak-password') {
                alert('Das Passwort ist zu schwach');
            } else {
                alert('Registrierung fehlgeschlagen: ' + error.message);
            }
        }
    });
});
