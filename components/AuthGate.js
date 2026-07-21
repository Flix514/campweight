'use client';

import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMessage('');
    const redirect = typeof window !== 'undefined' ? window.location.origin : undefined;
    const result = mode === 'register'
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    if (mode === 'register' && !result.data.session) {
      setMessage('Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse.');
    }
  }

  if (!isSupabaseConfigured) return <SetupMissing />;
  if (loading) return <div className="authPage"><div className="authCard">CampWeight wird geladen …</div></div>;
  if (session) return children({ session, signOut: () => supabase.auth.signOut() });

  return <div className="authPage"><form className="authCard" onSubmit={submit}>
    <img src="/campweight-logo.png" alt="CampWeight" className="authLogo" />
    <h1>{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</h1>
    <p>Deine Camper- und Inventardaten werden deinem Konto zugeordnet.</p>
    <label>E-Mail<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
    <label>Passwort<input type="password" minLength="8" autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} required /></label>
    {message && <div className="authMessage">{message}</div>}
    <button disabled={busy}>{busy ? 'Bitte warten …' : mode === 'login' ? 'Anmelden' : 'Registrieren'}</button>
    <button type="button" className="secondary" onClick={()=>{setMode(mode==='login'?'register':'login');setMessage('')}}>
      {mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Bereits registriert? Anmelden'}
    </button>
  </form></div>;
}

function SetupMissing(){return <div className="authPage"><div className="authCard"><h1>Supabase-Konfiguration fehlt</h1><p>Lege die Datei <code>.env.local</code> anhand von <code>.env.example</code> an und starte die App neu.</p></div></div>}
