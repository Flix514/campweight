
'use client';

import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    );

    const isRecoveryLink =
      hashParams.get('type') === 'recovery' ||
      new URLSearchParams(window.location.search).get('type') === 'recovery';

    if (isRecoveryLink) {
      setRecovery(true);
      setMode('update');
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!active) return;

        setSession(nextSession ?? null);

        if (event === 'PASSWORD_RECOVERY') {
          setRecovery(true);
          setMode('update');
          setMessage('');
        }
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  function changeMode(nextMode) {
    setMode(nextMode);
    setMessage('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (!supabase || busy) return;

    setBusy(true);
    setMessage('');

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: window.location.origin + window.location.pathname
          }
        );

        if (error) throw error;

        setMessage(
          'Falls ein Konto mit dieser E-Mail-Adresse existiert, erhältst du einen Link zum Zurücksetzen.'
        );
        return;
      }

      if (mode === 'update') {
        if (!session) {
          setMessage(
            'Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.'
          );
          return;
        }

        if (password !== confirmPassword) {
          setMessage('Die Passwörter stimmen nicht überein.');
          return;
        }

        const { error } = await supabase.auth.updateUser({
          password
        });

        if (error) throw error;

        setRecovery(false);
        setPassword('');
        setConfirmPassword('');
        setMessage('');
        window.history.replaceState(
          null,
          '',
          window.location.pathname
        );

        await supabase.auth.signOut();
        setSession(null);
        setMode('login');
        setMessage(
          'Dein Passwort wurde geändert. Bitte melde dich erneut an.'
        );
        return;
      }

      if (mode === 'register' && password !== confirmPassword) {
        setMessage('Die Passwörter stimmen nicht überein.');
        return;
      }

      const redirect = window.location.origin;

      const result = mode === 'register'
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: redirect }
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
          });

      if (result.error) throw result.error;

      if (mode === 'register' && !result.data.session) {
        setMessage(
          'Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse.'
        );
      }
    } catch (error) {
      setMessage(
        error?.message || 'Ein Fehler ist aufgetreten. Bitte erneut versuchen.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) return <SetupMissing />;

  if (loading) {
    return (
      <div className="authPage">
        <div className="authCard">CampWeight wird geladen …</div>
      </div>
    );
  }

  if (session && !recovery) {
    return children({
      session,
      signOut: () => supabase.auth.signOut()
    });
  }

  const isUpdate = mode === 'update';
  const isForgot = mode === 'forgot';
  const isRegister = mode === 'register';

  return (
    <div className="authPage">
      <form className="authCard" onSubmit={submit}>
        <img
          src="/campweight-logo.png"
          alt="CampWeight"
          className="authLogo"
        />

        <h1>
          {isUpdate
            ? 'Neues Passwort'
            : isForgot
              ? 'Passwort vergessen?'
              : isRegister
                ? 'Konto erstellen'
                : 'Anmelden'}
        </h1>

        <p>
          {isUpdate
            ? 'Vergib ein neues Passwort für dein CampWeight-Konto.'
            : isForgot
              ? 'Wir senden dir einen Link zum Zurücksetzen.'
              : 'Deine Camper- und Inventardaten werden deinem Konto zugeordnet.'}
        </p>

        {!isUpdate && (
          <label>
            E-Mail
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </label>
        )}

        {!isForgot && (
          <label>
            Passwort
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                autoComplete={
                  isRegister || isUpdate
                    ? 'new-password'
                    : 'current-password'
                }
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingRight: 52, width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={
                  showPassword
                    ? 'Passwort verbergen'
                    : 'Passwort anzeigen'
                }
                title={
                  showPassword
                    ? 'Passwort verbergen'
                    : 'Passwort anzeigen'
                }
                style={{
                  position: 'absolute',
                  right: 5,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 40,
                  padding: 5,
                  background: 'transparent',
                  color: 'inherit',
                  border: 0,
                  cursor: 'pointer'
                }}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </label>
        )}

        {(isRegister || isUpdate) && (
          <label>
            Passwort wiederholen
            <input
              type={showPassword ? 'text' : 'password'}
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </label>
        )}

        {message && <div className="authMessage">{message}</div>}

        <button type="submit" disabled={busy}>
          {busy
            ? 'Bitte warten …'
            : isUpdate
              ? 'Passwort speichern'
              : isForgot
                ? 'Link anfordern'
                : isRegister
                  ? 'Registrieren'
                  : 'Anmelden'}
        </button>

        {!isUpdate && (
          <button
            type="button"
            className="secondary"
            onClick={() => changeMode(
              isForgot ? 'login' : isRegister ? 'login' : 'register'
            )}
          >
            {isForgot
              ? 'Zurück zur Anmeldung'
              : isRegister
                ? 'Bereits registriert? Anmelden'
                : 'Noch kein Konto? Registrieren'}
          </button>
        )}

        {mode === 'login' && (
          <button
            type="button"
            className="secondary"
            onClick={() => changeMode('forgot')}
          >
            Passwort vergessen?
          </button>
        )}

        {isUpdate && (
          <p style={{ fontSize: 13 }}>
            Der Zurücksetzungslink ist nur begrenzt gültig.
          </p>
        )}
      </form>
    </div>
  );
}

function SetupMissing() {
  return (
    <div className="authPage">
      <div className="authCard">
        <h1>Supabase-Konfiguration fehlt</h1>
        <p>
          Lege die Datei <code>.env.local</code> anhand von{' '}
          <code>.env.example</code> an und starte die App neu.
        </p>
      </div>
    </div>
  );
}
