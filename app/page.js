'use client';

import {useEffect,useMemo,useState} from 'react';

const KEY='campweight-s2'; // bewusst gleich: vorhandene Sprint-2-Daten bleiben erhalten
const initial={
  camper:{mode:'caravan',name:'Mein Camper',baseWeight:1320,maxWeight:1700},
  tow:{name:'',maxWeight:'',brakedLimit:'',unbrakedLimit:'',noseLimit:'',trailerBraked:true},
  license:{class:'B96'},
  items:[
    {id:'1',name:'Campingstuhl',category:'Campingmöbel',weight:3.2,owned:4,loaded:2,position:'Mitte',basic:true},
    {id:'2',name:'Gasflasche 11 kg voll',category:'Gas',weight:22,owned:2,loaded:1,position:'Deichselkasten',basic:true},
    {id:'3',name:'Cadac Grill',category:'Grill',weight:8.4,owned:1,loaded:1,position:'Hinten',basic:false}
  ]
};

const cats=['Campingmöbel','Küche','Grill','Gas','Wasser','Technik','Kleidung','Kinder','Werkzeug','Sicherheit','Sonstiges'];
const pos=['Deichselkasten','Vorne','Mitte','Hinten','Heckträger','Zugfahrzeug'];
const licenses=[
  ['B','B'],['B96','B96'],['BE','BE'],['C1','C1'],['C1E','C1E'],['C','C'],['CE','CE'],
  ['old3','Klasse 3 (alt)'],['old2','Klasse 2 (alt)'],['old1','Klasse 1 (alt)'],['old4','Klasse 4 (alt)'],['old5','Klasse 5 (alt)']
];
const kg=n=>`${Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} kg`;

export default function Home(){
  const [ready,setReady]=useState(false),[tab,setTab]=useState('dashboard');
  const [camper,setCamper]=useState(initial.camper),[tow,setTow]=useState(initial.tow),[license,setLicense]=useState(initial.license),[items,setItems]=useState(initial.items);
  const [selHome,setSelHome]=useState(''),[selCamper,setSelCamper]=useState(''),[editId,setEditId]=useState(null);
  const [form,setForm]=useState({name:'',category:'Sonstiges',weight:'',owned:1,position:'Mitte',basic:false});

  useEffect(()=>{
    try{
      const x=JSON.parse(localStorage.getItem(KEY)||'null');
      if(x){
        setCamper({...initial.camper,...(x.camper||{})});
        setTow({...initial.tow,...(x.tow||{})});
        setLicense({...initial.license,...(x.license||{})});
        setItems(Array.isArray(x.items)?x.items:initial.items);
      }
    }catch{}finally{setReady(true)}
  },[]);
  useEffect(()=>{if(ready)localStorage.setItem(KEY,JSON.stringify({camper,tow,license,items}))},[ready,camper,tow,license,items]);

  const pack=useMemo(()=>items.reduce((s,i)=>s+Number(i.loaded||0)*Number(i.weight||0),0),[items]);
  const total=Number(camper.baseWeight||0)+pack;
  const reserve=Number(camper.maxWeight||0)-total;
  const basics=items.filter(i=>i.basic),home=items.filter(i=>i.owned-i.loaded>0),loaded=items.filter(i=>i.loaded>0);
  const basicWeight=basics.reduce((s,i)=>s+i.loaded*i.weight,0),travelWeight=pack-basicWeight;
  const rearWeight=loaded.filter(i=>['Hinten','Heckträger'].includes(i.position)).reduce((s,i)=>s+i.loaded*i.weight,0);
  const frontWeight=loaded.filter(i=>['Vorne','Deichselkasten'].includes(i.position)).reduce((s,i)=>s+i.loaded*i.weight,0);

  const resetForm=()=>{setEditId(null);setForm({name:'',category:'Sonstiges',weight:'',owned:1,position:'Mitte',basic:false})};
  function saveItem(){
    const name=form.name.trim(),weight=Number(form.weight),owned=Math.max(1,Number(form.owned||1));
    if(!name||weight<=0){alert('Bitte Produktname und Gewicht eintragen.');return}
    if(editId)setItems(a=>a.map(i=>i.id===editId?{...i,...form,name,weight,owned,loaded:Math.min(i.loaded,owned)}:i));
    else setItems(a=>[...a,{id:String(Date.now()),...form,name,weight,owned,loaded:form.basic?owned:0}]);
    resetForm();
  }
  function edit(i){setEditId(i.id);setForm({name:i.name,category:i.category,weight:i.weight,owned:i.owned,position:i.position,basic:i.basic});setTab('inventory')}
  function del(id){const i=items.find(x=>x.id===id);if(i&&confirm(`„${i.name}“ löschen?`))setItems(a=>a.filter(x=>x.id!==id))}
  function qty(id,d){setItems(a=>a.map(i=>i.id===id?{...i,loaded:Math.max(0,Math.min(i.owned,i.loaded+d))}:i))}
  function setAll(id,loadedAll){setItems(a=>a.map(i=>i.id===id?{...i,loaded:loadedAll?i.owned:0}:i))}
  function loadEverything(){setItems(a=>a.map(i=>({...i,loaded:i.owned})))}
  function unloadTravel(){setItems(a=>a.map(i=>({...i,loaded:i.basic?Math.min(i.owned,Math.max(1,i.loaded)):0})))}

  const licenseCheck=checkLicense({mode:camper.mode,license:license.class,camperMax:Number(camper.maxWeight||0),towMax:Number(tow.maxWeight||0)});
  const techCheck=checkTechnical({mode:camper.mode,currentTrailerWeight:total,tow,camperMax:Number(camper.maxWeight||0),reserve});

  if(!ready)return <main className='loading'>CampWeight wird geladen …</main>;

  const nav=[['dashboard','Dashboard'],['camper','Mein Camper'],['inventory','Inventar'],['basic','Grundausstattung'],['loading','Beladung']];
  if(camper.mode==='caravan')nav.push(['tow','Zugfahrzeug']);
  nav.push(['license','Führerschein-Check']);

  return <div className='shell'>
    <aside>
      <div className='brand'><b>CampWeight</b><span>Pack smart. Travel safe.</span></div>
      <nav>{nav.map(([id,l])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{l}</button>)}</nav>
      <small>Lokale Testversion · automatische Speicherung</small>
    </aside>

    <main className='content'>
      <header><div><p>CampWeight · Sprint 3</p><h1>{nav.find(n=>n[0]===tab)?.[1]||'CampWeight'}</h1></div><strong className={`status ${reserve<0?'bad':reserve<50?'warn':'ok'}`}>{reserve<0?`${kg(Math.abs(reserve))} zu viel`:`${kg(reserve)} Reserve`}</strong></header>

      {tab==='dashboard'&&<>
        <section className='stats'><Stat t='Basisgewicht' v={kg(camper.baseWeight)}/><Stat t='Grundausstattung' v={kg(basicWeight)}/><Stat t='Reisegepäck' v={kg(travelWeight)}/><Stat t='Gesamt' v={kg(total)}/></section>
        <section className='two'>
          <Card title='Gewichtsstatus'><Progress total={total} max={camper.maxWeight}/><p className='row'><span>zGG</span><b>{kg(camper.maxWeight)}</b></p><p className='row'><span>Aktuell</span><b>{kg(total)}</b></p><p className='row'><span>Reserve</span><b>{kg(reserve)}</b></p></Card>
          <Card title='Führerschein & Technik'><CheckBox result={licenseCheck}/>{camper.mode==='caravan'&&<CheckBox result={techCheck}/>}<button onClick={()=>setTab('license')}>Details prüfen</button></Card>
        </section>
        {camper.mode==='caravan'&&<section className='two'>
          <Card title='Beladungsverteilung'><p className='row'><span>Vorne / Deichselkasten</span><b>{kg(frontWeight)}</b></p><p className='row'><span>Hinten / Heckträger</span><b>{kg(rearWeight)}</b></p><div className={`hint ${rearWeight>frontWeight+25?'hintWarn':''}`}>{rearWeight>frontWeight+25?'Viel Gewicht liegt hinten. Das kann die Stützlast reduzieren. Die tatsächliche Stützlast bitte messen.':'Die grobe Verteilung wirkt unauffällig. Die tatsächliche Stützlast bitte trotzdem messen.'}</div></Card>
          <Card title='Aktueller Camper'><h3>{camper.name}</h3><p>{camper.mode==='caravan'?'Wohnwagen / Gespann':'Wohnmobil'}</p><button onClick={()=>setTab('camper')}>Bearbeiten</button></Card>
        </section>}
      </>}

      {tab==='camper'&&<Card title='Mein Camper'>
        <label>Name / Modell<input value={camper.name} onChange={e=>setCamper(c=>({...c,name:e.target.value}))}/></label>
        <label>Fahrzeugtyp<select value={camper.mode} onChange={e=>{const mode=e.target.value;setCamper(c=>({...c,mode}));if(mode==='motorhome'&&tab==='tow')setTab('camper')}}><option value='caravan'>Wohnwagen / Gespann</option><option value='motorhome'>Wohnmobil</option></select></label>
        <label>Basisgewicht (kg)<input type='number' value={camper.baseWeight} onChange={e=>setCamper(c=>({...c,baseWeight:e.target.value}))}/><small>Idealerweise tatsächlich gewogenes Basisgewicht ohne Reisegepäck.</small></label>
        <label>zGG (kg)<input type='number' value={camper.maxWeight} onChange={e=>setCamper(c=>({...c,maxWeight:e.target.value}))}/><small>Fahrzeugschein: Feld F.2</small></label>
        {camper.mode==='caravan'?<div className='hint'>Wohnwagenmodus aktiv: Zugfahrzeug, Anhängelast, Stützlast und Gespann-Führerscheinprüfung werden berücksichtigt.</div>:<div className='hint'>Wohnmobilmodus aktiv: Zugfahrzeug-, Anhängelast- und Stützlastthemen sind ausgeblendet. Der Führerschein-Check bewertet nur das zGG des Wohnmobils.</div>}
      </Card>}

      {tab==='inventory'&&<><Card title={editId?'Produkt bearbeiten':'Inventar-Produkt hinzufügen'}><div className='form'>{[['Produktname','name'],['Gewicht/Stück (kg)','weight'],['Besitz','owned']].map(([l,k])=><label key={k}>{l}<input type={k==='name'?'text':'number'} step={k==='weight'?'0.01':'1'} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></label>)}<label>Kategorie<select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{cats.map(x=><option key={x}>{x}</option>)}</select></label><label>Position<select value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))}>{pos.map(x=><option key={x}>{x}</option>)}</select></label></div><label className='check'><input type='checkbox' checked={form.basic} onChange={e=>setForm(f=>({...f,basic:e.target.checked}))}/> Grundausstattung</label><div className='buttons'><button onClick={saveItem}>{editId?'Speichern':'Hinzufügen'}</button>{editId&&<button className='secondary' onClick={resetForm}>Abbrechen</button>}</div></Card><Card title='Mein Inventar'><Table items={items} edit={edit} del={del}/></Card></>}

      {tab==='basic'&&<Card title='Camper-Grundausstattung'>{basics.length?<Table items={basics} edit={edit} del={del}/>:<p>Noch keine Grundausstattung markiert.</p>}</Card>}

      {tab==='loading'&&<><Card title='Camper beladen'><div className='topButtons'><button onClick={loadEverything}>Alles einladen</button><button className='secondary' onClick={unloadTravel}>Reisegepäck ausladen</button></div><div className='dual'><div><h3>Zuhause / verfügbar</h3><select size='12' value={selHome} onChange={e=>setSelHome(e.target.value)}>{home.map(i=><option key={i.id} value={i.id}>{i.name} · zuhause {i.owned-i.loaded}/{i.owned}</option>)}</select></div><div className='arrows'><button onClick={()=>selHome&&qty(selHome,1)}>1 →</button><button onClick={()=>selHome&&setAll(selHome,true)}>Alle →</button><button className='secondary' onClick={()=>selCamper&&qty(selCamper,-1)}>← 1</button><button className='secondary' onClick={()=>selCamper&&setAll(selCamper,false)}>← Alle</button></div><div><h3>Im Camper</h3><select size='12' value={selCamper} onChange={e=>setSelCamper(e.target.value)}>{loaded.map(i=><option key={i.id} value={i.id}>{i.loaded}× {i.name} · {kg(i.loaded*i.weight)} · {i.position}</option>)}</select></div></div></Card><section className='stats'><Stat t='Packgewicht' v={kg(pack)}/><Stat t='Gesamtgewicht' v={kg(total)}/><Stat t='Reserve' v={kg(reserve)}/><Stat t='Im Camper' v={`${loaded.reduce((s,i)=>s+i.loaded,0)} Stück`}/></section></>}

      {tab==='tow'&&camper.mode==='caravan'&&<>
        <Card title='Zugfahrzeug anlegen'>
          <div className='form towForm'>
            <label>Hersteller / Modell<input value={tow.name} onChange={e=>setTow(t=>({...t,name:e.target.value}))} placeholder='z. B. Volvo XC60 T8'/></label>
            <label>zGG Zugfahrzeug (kg)<input type='number' value={tow.maxWeight} onChange={e=>setTow(t=>({...t,maxWeight:e.target.value}))}/><small>Fahrzeugschein: Feld F.2</small></label>
            <label>Anhängelast gebremst (kg)<input type='number' value={tow.brakedLimit} onChange={e=>setTow(t=>({...t,brakedLimit:e.target.value}))}/><small>Fahrzeugschein: Feld O.1</small></label>
            <label>Anhängelast ungebremst (kg)<input type='number' value={tow.unbrakedLimit} onChange={e=>setTow(t=>({...t,unbrakedLimit:e.target.value}))}/><small>Fahrzeugschein: Feld O.2</small></label>
            <label>Max. Stützlast Zugfahrzeug (kg)<input type='number' value={tow.noseLimit} onChange={e=>setTow(t=>({...t,noseLimit:e.target.value}))}/><small>Je nach Fahrzeug Feld 13, COC oder Betriebsanleitung. Maßgeblich ist immer der niedrigste zulässige Wert von Fahrzeug, Kupplung und Anhänger.</small></label>
          </div>
          <label className='check'><input type='checkbox' checked={!!tow.trailerBraked} onChange={e=>setTow(t=>({...t,trailerBraked:e.target.checked}))}/> Wohnwagen / Anhänger ist gebremst</label>
        </Card>
        <Card title='Technischer Gespann-Check'><CheckBox result={techCheck}/><p className='note'>Für die Anhängelast vergleichen wir das aktuell berechnete Wohnwagengewicht mit O.1 bzw. O.2. Entscheidend sind im echten Betrieb die tatsächlichen Massen und die Angaben in Fahrzeugpapieren/COC.</p></Card>
      </>}

      {tab==='license'&&<>
        <Card title='Führerschein auswählen'>
          <label>Führerscheinklasse<select value={license.class} onChange={e=>setLicense({class:e.target.value})}>{licenses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <div className='hint'>{camper.mode==='caravan'?'Für den Gespann-Check werden die zulässigen Gesamtmassen von Zugfahrzeug und Wohnwagen verwendet – nicht die aktuelle Beladung.':'Für den Wohnmobil-Check wird die zulässige Gesamtmasse des Wohnmobils verwendet.'}</div>
        </Card>
        <Card title='Ergebnis'><CheckBox result={licenseCheck}/>{licenseCheck.details?.map((d,i)=><p className='resultLine' key={i}>{d}</p>)}</Card>
        {camper.mode==='caravan'&&<Card title='Technische Prüfung'><CheckBox result={techCheck}/>{techCheck.details?.map((d,i)=><p className='resultLine' key={i}>{d}</p>)}</Card>}
        <Card title='Hinweis zu alten deutschen Führerscheinklassen'><p className='note'>Bei alten Klassen können Besitzstandsrechte, Umtausch, Schlüsselzahlen, Achszahl sowie Alters-/Gesundheitsvorgaben eine Rolle spielen. CampWeight zeigt deshalb bei komplexen Altklassen bewusst einen Prüfhinweis statt einer pauschalen Freigabe.</p></Card>
      </>}

      <section className='legal'><b>Rechtlicher Hinweis:</b> Die berechneten Werte und Empfehlungen dienen ausschließlich der Orientierung. Die Verantwortung für ordnungsgemäße Beladung, Fahrerlaubnis, gesetzliche Vorschriften und Verkehrssicherheit liegt beim Fahrzeugführer.</section>
    </main>
  </div>
}

function checkLicense({mode,license,camperMax,towMax}){
  if(!camperMax)return {level:'neutral',title:'Daten fehlen',text:'Bitte zuerst das zGG des Campers eintragen.',details:[]};

  if(mode==='motorhome'){
    if(['B','B96','BE'].includes(license))return camperMax<=3500?ok('Führerschein passend',`Mit ${labelLicense(license)} ist dieses Wohnmobil nach zGG grundsätzlich abgedeckt.`,[`Wohnmobil zGG: ${kg(camperMax)} · Grenze Klasse B: 3.500 kg.`]):bad('Führerschein reicht nicht',`Das Wohnmobil überschreitet 3.500 kg zGG. ${labelLicense(license)} reicht für das Wohnmobil selbst nicht aus.`,[`Wohnmobil zGG: ${kg(camperMax)}.`]);
    if(['C1','C1E'].includes(license))return camperMax<=7500?ok('Führerschein passend','Das Wohnmobil liegt innerhalb der C1-Gewichtsgrenze.',[`Wohnmobil zGG: ${kg(camperMax)} · C1 bis 7.500 kg.`]):bad('Führerschein reicht nicht','Das Wohnmobil überschreitet 7.500 kg zGG.',[`Wohnmobil zGG: ${kg(camperMax)}.`]);
    if(['C','CE'].includes(license))return ok('Führerschein passend','Klasse C/CE deckt ein Wohnmobil dieser Gewichtsklasse grundsätzlich ab.',[`Wohnmobil zGG: ${kg(camperMax)}.`]);
    if(license==='old3')return camperMax<=7500?warn('Alte Klasse 3 – grundsätzlich passend','Die alte Klasse 3 umfasste Kfz bis 7.500 kg. Besitzstands-/Umtauschangaben bitte am Führerschein prüfen.',[`Wohnmobil zGG: ${kg(camperMax)}.`]):bad('Klasse 3 alt reicht nicht','Das Wohnmobil überschreitet 7.500 kg zGG.',[`Wohnmobil zGG: ${kg(camperMax)}.`]);
    if(license==='old2')return warn('Alte Klasse 2 – Detailprüfung nötig','Für schwere Fahrzeuge grundsätzlich relevant, aber Alters-, Gesundheits- und Besitzstandsregeln können entscheidend sein.',[`Wohnmobil zGG: ${kg(camperMax)}.`]);
    return bad('Führerschein nicht passend','Diese alte Führerscheinklasse deckt ein übliches Wohnmobil nicht ab.',[`Gewählte Klasse: ${labelLicense(license)}.`]);
  }

  if(!towMax)return {level:'neutral',title:'Daten fehlen',text:'Bitte zGG des Zugfahrzeugs (F.2) eintragen.',details:[]};
  const combo=camperMax+towMax;
  if(license==='B'){
    const allowed=camperMax<=750 ? towMax<=3500 : combo<=3500;
    return allowed?ok('Klasse B ausreichend','Das Gespann liegt innerhalb der B-Regeln.',[`Zugfahrzeug zGG: ${kg(towMax)}`,`Wohnwagen zGG: ${kg(camperMax)}`,`Summe zGG: ${kg(combo)}`]):bad('Klasse B nicht ausreichend','Die zulässigen Gesamtmassen überschreiten den für B zulässigen Rahmen.',[`Summe zGG: ${kg(combo)}.`]);
  }
  if(license==='B96'){
    const allowed=towMax<=3500 && (camperMax<=750 || combo<=4250);
    return allowed?ok('B96 ausreichend','Das Gespann liegt innerhalb der B96-Grenze.',[`Summe zGG: ${kg(combo)} · maximal 4.250 kg bei Anhänger über 750 kg.`]):bad('B96 nicht ausreichend','Die Kombination überschreitet den B96-Rahmen.',[`Summe zGG: ${kg(combo)}.`]);
  }
  if(license==='BE'){
    const allowed=towMax<=3500 && camperMax<=3500;
    return allowed?ok('BE ausreichend','Zugfahrzeug und Wohnwagen liegen innerhalb der BE-Grenzen.',[`Zugfahrzeug zGG: ${kg(towMax)}`,`Wohnwagen zGG: ${kg(camperMax)} · Anhängergrenze BE: 3.500 kg.`]):bad('BE nicht ausreichend','Mindestens eine zulässige Gesamtmasse überschreitet den BE-Rahmen.',[`Zugfahrzeug zGG: ${kg(towMax)}`,`Wohnwagen zGG: ${kg(camperMax)}`]);
  }
  if(license==='C1')return camperMax<=750?warn('C1: Anhänger eingeschränkt','C1 allein erlaubt am C1-Fahrzeug grundsätzlich nur Anhänger bis 750 kg. Für einen typischen Wohnwagen ist eine E-Berechtigung relevant.',[`Wohnwagen zGG: ${kg(camperMax)}.`]):bad('C1 allein reicht nicht','Für einen Anhänger über 750 kg ist C1 allein nicht ausreichend.',[`Wohnwagen zGG: ${kg(camperMax)}.`]);
  if(license==='C1E'){
    const allowed=combo<=12000;
    return allowed?ok('C1E grundsätzlich ausreichend','Die Kombination liegt innerhalb von 12.000 kg zGG.',[`Summe zGG: ${kg(combo)}.`]):bad('C1E nicht ausreichend','Die Kombination überschreitet 12.000 kg zGG.',[`Summe zGG: ${kg(combo)}.`]);
  }
  if(license==='C')return camperMax<=750?warn('C: Anhänger eingeschränkt','Klasse C allein erlaubt grundsätzlich nur Anhänger bis 750 kg. Für einen typischen Wohnwagen ist CE erforderlich.',[`Wohnwagen zGG: ${kg(camperMax)}.`]):bad('C allein reicht nicht','Für einen Anhänger über 750 kg ist C allein nicht ausreichend.',[`Wohnwagen zGG: ${kg(camperMax)}.`]);
  if(license==='CE')return ok('CE grundsätzlich ausreichend','CE deckt Fahrzeugkombinationen mit schweren Anhängern grundsätzlich ab.',[`Summe zGG: ${kg(combo)}.`]);
  if(license==='old3')return warn('Alte Klasse 3 – typisches Gespann meist abgedeckt','Klasse 3 umfasste u. a. Kfz bis 7.500 kg und bestimmte Züge. Achszahl, Besitzstandsrechte und heutige Schlüsselzahlen müssen zusätzlich geprüft werden.',[`Zugfahrzeug zGG: ${kg(towMax)}`,`Wohnwagen zGG: ${kg(camperMax)}`,`Summe zGG: ${kg(combo)}`]);
  if(license==='old2')return warn('Alte Klasse 2 – Detailprüfung nötig','Für schwere Fahrzeugkombinationen grundsätzlich relevant; Alters-, Gesundheits- und Besitzstandsregeln können entscheidend sein.',[`Summe zGG: ${kg(combo)}.`]);
  return bad('Führerschein nicht passend','Diese alte Führerscheinklasse ist für ein übliches Pkw-Wohnwagen-Gespann nicht ausreichend.',[`Gewählte Klasse: ${labelLicense(license)}.`]);
}

function checkTechnical({mode,currentTrailerWeight,tow,camperMax,reserve}){
  if(mode!=='caravan')return {level:'neutral',title:'Nicht relevant',text:'Wohnmobilmodus – keine Zugfahrzeugprüfung.',details:[]};
  const limit=Number(tow.trailerBraked?tow.brakedLimit:tow.unbrakedLimit)||0;
  const details=[];
  let level='ok';
  if(reserve<0){level='bad';details.push(`Wohnwagen ist nach aktueller Berechnung um ${kg(Math.abs(reserve))} über zGG.`)}
  else details.push(`Wohnwagen-Gewicht aktuell geschätzt: ${kg(currentTrailerWeight)}.`);
  if(limit){
    if(currentTrailerWeight>limit){level='bad';details.push(`Geschätztes aktuelles Anhängergewicht liegt über der eingetragenen Anhängelast von ${kg(limit)}.`)}
    else details.push(`Anhängelast ${tow.trailerBraked?'O.1':'O.2'}: ${kg(limit)} – nach aktueller Schätzung eingehalten.`);
  }else{
    if(level!=='bad')level='neutral';details.push(`Anhängelast ${tow.trailerBraked?'O.1':'O.2'} fehlt.`)
  }
  if(tow.noseLimit)details.push(`Max. eingetragene Stützlast Zugfahrzeug: ${kg(tow.noseLimit)}. Tatsächliche Stützlast muss gemessen werden.`);
  return level==='bad'?bad('Technische Grenze prüfen','Mindestens eine technische Gewichtsgrenze ist kritisch.',details):level==='neutral'?{level:'neutral',title:'Technikdaten unvollständig',text:'Für die vollständige Prüfung fehlen noch Werte aus dem Fahrzeugschein.',details}:ok('Technische Basisprüfung unauffällig','Die eingegebenen Basiswerte ergeben aktuell keinen offensichtlichen Konflikt.',details);
}

function ok(title,text,details=[]){return {level:'ok',title,text,details}}
function warn(title,text,details=[]){return {level:'warn',title,text,details}}
function bad(title,text,details=[]){return {level:'bad',title,text,details}}
function labelLicense(v){return Object.fromEntries(licenses)[v]||v}
function CheckBox({result}){return <div className={`checkBox ${result.level||'neutral'}`}><b>{result.title}</b><span>{result.text}</span></div>}
function Card({title,children}){return <section className='card'><h2>{title}</h2>{children}</section>}
function Stat({t,v}){return <div className='stat'><span>{t}</span><b>{v}</b></div>}
function Progress({total,max}){const p=max?Math.min(100,total/max*100):0;return <div className='progress'><div className={total>max?'fill red':p>90?'fill yellow':'fill'} style={{width:`${p}%`}}/></div>}
function Table({items,edit,del}){return <div className='table'><table><thead><tr><th>Produkt</th><th>Kategorie</th><th>Gewicht</th><th>Besitz</th><th>Zuhause</th><th>Im Camper</th><th>Position</th><th>Grundausstattung</th><th>Aktion</th></tr></thead><tbody>{items.map(i=><tr key={i.id}><td><b>{i.name}</b></td><td>{i.category}</td><td>{kg(i.weight)}</td><td>{i.owned}</td><td>{i.owned-i.loaded}</td><td>{i.loaded}</td><td>{i.position}</td><td>{i.basic?'Ja':'Nein'}</td><td><div className='mini'><button onClick={()=>edit(i)}>Bearbeiten</button><button className='danger' onClick={()=>del(i.id)}>Löschen</button></div></td></tr>)}</tbody></table></div>}
