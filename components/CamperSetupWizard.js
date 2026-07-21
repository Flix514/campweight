'use client';

import {useMemo,useState} from 'react';

const makers=['Adria','Bürstner','Dethleffs','Fendt','Hobby','Hymer','Knaus','Tabbert','Weinsberg','Sonstige'];
const currentYear=new Date().getFullYear();

export default function CamperSetupWizard({initialCamper,onComplete,signOut,email}){
  const [step,setStep]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [data,setData]=useState({
    mode:initialCamper?.mode||'caravan',
    nickname:initialCamper?.name==='Mein Camper'?'':initialCamper?.name||'',
    manufacturer:initialCamper?.manufacturer||'',
    model:initialCamper?.model||'',
    year:initialCamper?.modelYear||'',
    baseWeight:initialCamper?.baseWeight||'',
    maxWeight:initialCamper?.maxWeight||'',
    noseWeight:initialCamper?.noseWeight||'',
    addTow:false,
    towName:'',towMaxWeight:'',towBrakedLimit:'',towNoseLimit:''
  });
  const steps=useMemo(()=>[
    'Willkommen','Fahrzeugtyp','Name','Hersteller & Modell','Baujahr','Basisgewicht','Gesamtgewicht',
    ...(data.mode==='caravan'?['Stützlast','Zugfahrzeug']:[]),'Fertig'
  ],[data.mode]);
  const last=steps.length-1;
  const set=(key,value)=>setData(d=>({...d,[key]:value}));
  const displayName=data.nickname.trim()||[data.manufacturer,data.model].filter(Boolean).join(' ').trim()||'Mein Camper';

  function canContinue(){
    const name=steps[step];
    if(name==='Name')return Boolean(data.nickname.trim());
    if(name==='Hersteller & Modell')return Boolean(data.manufacturer.trim()&&data.model.trim());
    if(name==='Baujahr')return Number(data.year)>=1950&&Number(data.year)<=currentYear+1;
    if(name==='Basisgewicht')return Number(data.baseWeight)>0;
    if(name==='Gesamtgewicht')return Number(data.maxWeight)>=Number(data.baseWeight)&&Number(data.maxWeight)>0;
    if(name==='Stützlast')return Number(data.noseWeight)>0;
    if(name==='Zugfahrzeug'&&data.addTow)return Boolean(data.towName.trim());
    return true;
  }
  async function next(){
    setError('');
    if(!canContinue()){setError('Bitte vervollständige die Angaben auf diesem Bildschirm.');return}
    if(step<last){setStep(s=>s+1);return}
    setBusy(true);
    try{await onComplete({...data,name:displayName});}
    catch(e){setError(e?.message||'Speichern nicht möglich. Bitte versuche es erneut.');setBusy(false)}
  }

  const name=steps[step];
  return <main className='setupPage'>
    <section className='setupCard'>
      <div className='setupTop'><img src='/campweight-logo.png' alt='CampWeight'/><button className='linkButton' onClick={signOut}>Abmelden</button></div>
      <div className='stepTrack'><span style={{width:`${(step/(last||1))*100}%`}}/></div>
      <p className='eyebrow'>Einrichtung · Schritt {step+1} von {steps.length}</p>

      {name==='Willkommen'&&<div className='setupCenter'><div className='setupIcon'>🚐</div><h1>Willkommen bei CampWeight</h1><p>Hallo {email}. In wenigen Schritten richten wir deinen Camper ein. Danach siehst du sofort, wie viel Zuladung noch frei ist.</p></div>}
      {name==='Fahrzeugtyp'&&<><h1>Was möchtest du verwalten?</h1><p className='lead'>Wähle den Fahrzeugtyp. Die App passt alle folgenden Funktionen daran an.</p><div className='choiceGrid'><button className={data.mode==='caravan'?'choice activeChoice':'choice'} onClick={()=>set('mode','caravan')}><span>🏕️</span><b>Wohnwagen</b><small>Mit Zugfahrzeug und Stützlast</small></button><button className={data.mode==='motorhome'?'choice activeChoice':'choice'} onClick={()=>set('mode','motorhome')}><span>🚐</span><b>Wohnmobil</b><small>Eigenständiges Reisefahrzeug</small></button></div></>}
      {name==='Name'&&<><h1>Wie heißt dein Camper?</h1><p className='lead'>Ein kurzer persönlicher Name, den du später im Dashboard siehst.</p><label>Campername<input autoFocus value={data.nickname} onChange={e=>set('nickname',e.target.value)} placeholder='z. B. Unser Adria'/></label></>}
      {name==='Hersteller & Modell'&&<><h1>Welcher Camper ist es?</h1><div className='setupFields'><label>Hersteller<select value={data.manufacturer} onChange={e=>set('manufacturer',e.target.value)}><option value=''>Bitte auswählen</option>{makers.map(m=><option key={m}>{m}</option>)}</select></label><label>Modell<input value={data.model} onChange={e=>set('model',e.target.value)} placeholder='z. B. Adora 482 LU'/></label></div></>}
      {name==='Baujahr'&&<><h1>Aus welchem Baujahr?</h1><label>Baujahr<input autoFocus type='number' min='1950' max={currentYear+1} value={data.year} onChange={e=>set('year',e.target.value)} placeholder={String(currentYear)}/></label></>}
      {name==='Basisgewicht'&&<><h1>Wie hoch ist das Basisgewicht?</h1><p className='lead'>Am besten verwendest du ein tatsächlich gewogenes Gewicht ohne Reisegepäck. Fest verbaute Ausstattung soll bereits enthalten sein.</p><label>Basisgewicht in kg<input autoFocus type='number' min='1' value={data.baseWeight} onChange={e=>set('baseWeight',e.target.value)} placeholder='z. B. 1320'/></label></>}
      {name==='Gesamtgewicht'&&<><h1>Wie hoch ist das zulässige Gesamtgewicht?</h1><p className='lead'>Du findest es im Fahrzeugschein im Feld F.2.</p><label>zGG in kg<input autoFocus type='number' min='1' value={data.maxWeight} onChange={e=>set('maxWeight',e.target.value)} placeholder='z. B. 1700'/></label>{Number(data.maxWeight)>0&&Number(data.baseWeight)>0&&<div className='setupResult'><span>Rechnerische Zuladung</span><b>{(Number(data.maxWeight)-Number(data.baseWeight)).toLocaleString('de-DE')} kg</b></div>}</>}
      {name==='Stützlast'&&<><h1>Welche maximale Stützlast gilt?</h1><p className='lead'>Trage zunächst den Wert des Wohnwagens ein. Beim Zugfahrzeug gilt später immer der niedrigere Grenzwert.</p><label>Maximale Stützlast in kg<input autoFocus type='number' min='1' value={data.noseWeight} onChange={e=>set('noseWeight',e.target.value)} placeholder='z. B. 100'/></label></>}
      {name==='Zugfahrzeug'&&<><h1>Zugfahrzeug hinzufügen?</h1><p className='lead'>Das ist optional und kann jederzeit nachgeholt werden.</p><label className='toggleLine'><input type='checkbox' checked={data.addTow} onChange={e=>set('addTow',e.target.checked)}/> Jetzt Zugfahrzeug erfassen</label>{data.addTow&&<div className='setupFields'><label>Name / Modell<input value={data.towName} onChange={e=>set('towName',e.target.value)} placeholder='z. B. Skoda Superb iV'/></label><label>zGG in kg<input type='number' value={data.towMaxWeight} onChange={e=>set('towMaxWeight',e.target.value)}/></label><label>Anhängelast gebremst in kg<input type='number' value={data.towBrakedLimit} onChange={e=>set('towBrakedLimit',e.target.value)}/></label><label>Stützlast in kg<input type='number' value={data.towNoseLimit} onChange={e=>set('towNoseLimit',e.target.value)}/></label></div>}</>}
      {name==='Fertig'&&<div className='setupCenter'><div className='setupIcon'>✅</div><h1>Alles bereit!</h1><p><b>{displayName}</b> wird jetzt gespeichert. Danach gelangst du direkt zu deinem persönlichen Dashboard.</p><div className='summaryBox'><span>{data.mode==='caravan'?'Wohnwagen':'Wohnmobil'}</span><b>{data.manufacturer} {data.model}</b><small>{data.year} · {Number(data.baseWeight).toLocaleString('de-DE')} / {Number(data.maxWeight).toLocaleString('de-DE')} kg</small></div></div>}

      {error&&<div className='authMessage errorMessage'>{error}</div>}
      <div className='setupActions'>{step>0&&<button className='secondary' disabled={busy} onClick={()=>setStep(s=>s-1)}>Zurück</button>}<button disabled={busy} onClick={next}>{busy?'Speichert …':step===last?'Zum Dashboard':'Weiter'}</button></div>
    </section>
  </main>
}
