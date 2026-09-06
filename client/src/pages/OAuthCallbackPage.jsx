import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeOAuthLogin } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const providerError = searchParams.get('error');
    const token = searchParams.get('token');

    if (providerError) {
      setError('The provider could not complete sign-in. Please try again.');
      return;
    }
    if (!token) {
      setError('No sign-in token was received. Please try again.');
      return;
    }

    completeOAuthLogin(token).then((result) => {
      if (result.success) navigate('/', { replace: true });
      else setError(result.error);
    });
  }, [completeOAuthLogin, navigate, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-darkbg-950 p-4">
      <section className="w-full max-w-sm rounded-2xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border p-6 text-center shadow-xl">
        {error ? (
          <>
            <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
            <h1 className="mt-3 font-bold text-slate-900 dark:text-white">Sign-in unsuccessful</h1>
            <p className="mt-2 text-sm text-slate-500">{error}</p>
            <button onClick={() => navigate('/', { replace: true })} className="mt-5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Return to AyuSakshi</button>
          </>
        ) : (
          <>
            <LoaderCircle className="w-8 h-8 mx-auto animate-spin text-emerald-600" />
            <h1 className="mt-3 font-bold text-slate-900 dark:text-white">Completing sign-in</h1>
            <p className="mt-2 text-sm text-slate-500">Please wait while we securely sign you in.</p>
          </>
        )}
      </section>
    </main>
  );
};
