import { useEffect } from 'react';
import { EmailAuthProvider, GoogleAuthProvider } from 'firebase/auth';
import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import { auth } from '../firebase';

const FirebaseAuthUI = () => {
  useEffect(() => {
    const ui = firebaseui.auth.AuthUI.getInstance() ?? new firebaseui.auth.AuthUI(auth);

    console.info('FirebaseUI starting');

    ui.start('#firebaseui-auth-container', {
      signInFlow: 'redirect',
      signInSuccessUrl: '/',
      signInOptions: [GoogleAuthProvider.PROVIDER_ID, EmailAuthProvider.PROVIDER_ID],
      callbacks: {
        signInSuccessWithAuthResult: () => {
          console.info('FirebaseUI sign-in success');
          if (typeof window !== 'undefined' && window.location.pathname !== '/') {
            window.location.assign('/');
          }
          return false;
        },
        signInFailure: async (error) => {
          console.error('FirebaseUI sign-in failure', error);
        },
      },
    });

    return () => {
      ui.reset();
    };
  }, []);

  return <div id="firebaseui-auth-container" className="w-full" />;
};

export default FirebaseAuthUI;
