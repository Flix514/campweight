'use client';
import {useEffect,useMemo,useState} from 'react';

const KEY='campweight-s2';
const initial={
 camper:{mode:'caravan',name:'Mein Camper',baseWeight:1320,maxWeight:1700},
 items:[
  {id:'1',name:'Campingstuhl',category:'Campingmöbel',weight:3.2,owned:4,loaded:2,position:'Mitte',basic:true},
  {id:'2',name:'Gasflasche 11 kg voll',category:'Gas',weight:22,owned:2,loaded:1,position:'Deichselkasten',basic:true},
  {id:'3',name:'Cadac Grill',category:'Grill',weight:8.4,owned:1,loaded:1,position:'Hinten',basic:false}
 ]
};
const cats=['Campingmöbel','Küche','Grill','Gas','Wasser','Technik','Kleidung','Kinder','Werkzeug','Sicherheit','Sonstiges'];
const pos=['Deichselkasten','Vorne','Mitte','Hinten','Heckträger','Zugfahrzeug'];
const kg=n=>`${Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} kg`;

export default function Home(){
 const [ready,setReady]=useState(false),[tab,setTab]=useState('dashboard');
 const [camper,setCamper]=useState(initial.camper),[items,setItems]=useState(initial.items);
 const [selHome,setSelHome]=useState(''),[selCamper,setSelCamper]=useState(''),[editId,setEditId]=useState(null);
 const [form,setForm]=useState({name:'',category:'Sonstiges',weight:'',owned:1,position:'Mitte',basic:false});
 useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x){setCamper(x.camper||initial.camper);setItems(Array.isArray(x.items)?x.items:initial.items)}}catch{}finally{setReady(true)}},[]);
 useEffect(()=>{if(ready)localStorage.setItem(KEY,JSON.stringify({camper,items}))},[ready,camper,items]);
 const pack=useMemo(()=>items.reduce((s,i)=>s+i.loaded*i.weight,0),[items]);
 const total=Number(camper.baseWeight||0)+pack,reserve=Number(camper.maxWeight||0)-total;
 const basics=items.filter(i=>i.basic),home=items.filter(i=>i.owned-i.loaded>0),loaded=items.filter(i=>i.loaded>0);
 const basicWeight=basics.reduce((s,i)=>s+i.loaded*i.weight,0),travelWeight=pack-basicWeight;
 const resetForm=()=>{setEditId(null);setForm({name:'',category:'Sonstiges',weight:'',owned:1,position:'Mitte',basic:false})};
 function saveItem(){const name=form.name.trim(),weight=Number(form.weight),owned=Math.max(1,Number(form.owned||1));if(!name||weight<=0){alert('Bitte Produktname und Gewicht eintragen.');return}
  if(editId)setItems(a=>a.map(i=>i.id===editId?{...i,...form,name,weight,owned,loaded:Math.min(i.loaded,owned)}:i));
  else setItems(a=>[...a,{id:String(Date.now()),...form,name,weight,owned,loaded:form.basic?owned:0}]);resetForm();}
 function edit(i){setEditId(i.id);setForm({name:i.name,category:i.category,weight:i.weight,owned:i.owned,position:i.position,basic:i.basic});setTab('inventory')}
 function del(id){const i=items.find(x=>x.id===id);if(i&&confirm(`„${i.name}“ löschen?`))setItems(a=>a.filter(x=>x.id!==id))}
 function qty(id,d){setItems(a=>a.map(i=>i.id===id?{...i,loaded:Math.max(0,Math.min(i.owned,i.loaded+d))}:i))}
 function setAll(id,loadedAll){setItems(a=>a.map(i=>i.id===id?{...i,loaded:loadedAll?i.owned:0}:i))}
 function loadEverything(){setItems(a=>a.map(i=>({...i,loaded:i.owned})))}
 function unloadTravel(){setItems(a=>a.map(i=>({...i,loaded:i.basic?Math.min(i.owned,Math.max(1,i.loaded)):0})))}
 if(!ready)return <main className='loading'>CampWeight wird geladen …</main>;
 const nav=[['dashboard','Dashboard'],['camper','Mein Camper'],['inventory','Inventar'],['basic','Grundausstattung'],['loading','Beladung']];
 return <div className='shell'>
  <aside><div className='brand'><b>CampWeight</b><span>Pack smart. Travel safe.</span></div><nav>{nav.map(([id,l])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{l}</button>)}</nav><small>Lokale Testversion · automatische Speicherung</small></aside>
  <main className='content'>
   <header><div><p>CampWeight · Sprint 2</p><h1>{nav.find(n=>n[0]===tab)?.[1]}</h1></div><strong className={`status ${reserve<0?'bad':reserve<50?'warn':'ok'}`}>{reserve<0?`${kg(Math.abs(reserve))} zu viel`:`${kg(reserve)} Reserve`}</strong></header>

   {tab==='dashboard'&&<><section className='stats'><Stat t='Basisgewicht' v={kg(camper.baseWeight)}/><Stat t='Grundausstattung' v={kg(basicWeight)}/><Stat t='Reisegepäck' v={kg(travelWeight)}/><Stat t='Gesamt' v={kg(total)}/></section><section className='two'><Card title='Gewichtsstatus'><Progress total={total} max={camper.maxWeight}/><p className='row'><span>zGG</span><b>{kg(camper.maxWeight)}</b></p><p className='row'><span>Aktuell</span><b>{kg(total)}</b></p><p className='row'><span>Reserve</span><b>{kg(reserve)}</b></p></Card><Card title='Aktueller Camper'><h3>{camper.name}</h3><p>{camper.mode==='caravan'?'Wohnwagen / Gespann':'Wohnmobil'}</p><button onClick={()=>setTab('camper')}>Bearbeiten</button></Card></section></>}

   {tab==='camper'&&<Card title='Mein Camper'><label>Name / Modell<input value={camper.name} onChange={e=>setCamper(c=>({...c,name:e.target.value}))}/></label><label>Fahrzeugtyp<select value={camper.mode} onChange={e=>setCamper(c=>({...c,mode:e.target.value}))}><option value='caravan'>Wohnwagen / Gespann</option><option value='motorhome'>Wohnmobil</option></select></label><label>Basisgewicht (kg)<input type='number' value={camper.baseWeight} onChange={e=>setCamper(c=>({...c,baseWeight:e.target.value}))}/><small>Idealerweise tatsächlich gewogenes Basisgewicht ohne Reisegepäck.</small></label><label>zGG (kg)<input type='number' value={camper.maxWeight} onChange={e=>setCamper(c=>({...c,maxWeight:e.target.value}))}/><small>Fahrzeugschein: Feld F.2</small></label>{camper.mode==='caravan'&&<div className='hint'>Zugfahrzeug und Führerschein-Check folgen im nächsten Sprint.</div>}</Card>}

   {tab==='inventory'&&<><Card title={editId?'Produkt bearbeiten':'Inventar-Produkt hinzufügen'}><div className='form'>{[['Produktname','name'],['Gewicht/Stück (kg)','weight'],['Besitz','owned']].map(([l,k])=><label key={k}>{l}<input type={k==='name'?'text':'number'} step={k==='weight'?'0.01':'1'} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></label>)}<label>Kategorie<select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{cats.map(x=><option key={x}>{x}</option>)}</select></label><label>Position<select value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))}>{pos.map(x=><option key={x}>{x}</option>)}</select></label></div><label className='check'><input type='checkbox' checked={form.basic} onChange={e=>setForm(f=>({...f,basic:e.target.checked}))}/> Grundausstattung</label><div className='buttons'><button onClick={saveItem}>{editId?'Speichern':'Hinzufügen'}</button>{editId&&<button className='secondary' onClick={resetForm}>Abbrechen</button>}</div></Card><Card title='Mein Inventar'><Table items={items} edit={edit} del={del}/></Card></>}

   {tab==='basic'&&<Card title='Camper-Grundausstattung'>{basics.length?<Table items={basics} edit={edit} del={del}/>:<p>Noch keine Grundausstattung markiert.</p>}</Card>}

   {tab==='loading'&&<><Card title='Camper beladen'><div className='topButtons'><button onClick={loadEverything}>Alles einladen</button><button className='secondary' onClick={unloadTravel}>Reisegepäck ausladen</button></div><div className='dual'><div><h3>Zuhause / verfügbar</h3><select size='12' value={selHome} onChange={e=>setSelHome(e.target.value)}>{home.map(i=><option key={i.id} value={i.id}>{i.name} · zuhause {i.owned-i.loaded}/{i.owned}</option>)}</select></div><div className='arrows'><button onClick={()=>selHome&&qty(selHome,1)}>1 →</button><button onClick={()=>selHome&&setAll(selHome,true)}>Alle →</button><button className='secondary' onClick={()=>selCamper&&qty(selCamper,-1)}>← 1</button><button className='secondary' onClick={()=>selCamper&&setAll(selCamper,false)}>← Alle</button></div><div><h3>Im Camper</h3><select size='12' value={selCamper} onChange={e=>setSelCamper(e.target.value)}>{loaded.map(i=><option key={i.id} value={i.id}>{i.loaded}× {i.name} · {kg(i.loaded*i.weight)} · {i.position}</option>)}</select></div></div></Card><section className='stats'><Stat t='Packgewicht' v={kg(pack)}/><Stat t='Gesamtgewicht' v={kg(total)}/><Stat t='Reserve' v={kg(reserve)}/><Stat t='Im Camper' v={`${loaded.reduce((s,i)=>s+i.loaded,0)} Stück`}/></section></>}

   <section className='legal'><b>Rechtlicher Hinweis:</b> Die berechneten Werte dienen ausschließlich der Orientierung. Die Verantwortung für ordnungsgemäße Beladung, gesetzliche Vorschriften und Verkehrssicherheit liegt beim Fahrzeugführer.</section>
  </main>
 </div>}

function Card({title,children}){return <section className='card'><h2>{title}</h2>{children}</section>}
function Stat({t,v}){return <div className='stat'><span>{t}</span><b>{v}</b></div>}
function Progress({total,max}){const p=max?Math.min(100,total/max*100):0;return <div className='progress'><div className={total>max?'fill red':p>90?'fill yellow':'fill'} style={{width:`${p}%`}}/></div>}
function Table({items,edit,del}){return <div className='table'><table><thead><tr><th>Produkt</th><th>Kategorie</th><th>Gewicht</th><th>Besitz</th><th>Zuhause</th><th>Im Camper</th><th>Position</th><th>Grundausstattung</th><th>Aktion</th></tr></thead><tbody>{items.map(i=><tr key={i.id}><td><b>{i.name}</b></td><td>{i.category}</td><td>{kg(i.weight)}</td><td>{i.owned}</td><td>{i.owned-i.loaded}</td><td>{i.loaded}</td><td>{i.position}</td><td>{i.basic?'Ja':'Nein'}</td><td><div className='mini'><button onClick={()=>edit(i)}>Bearbeiten</button><button className='danger' onClick={()=>del(i.id)}>Löschen</button></div></td></tr>)}</tbody></table></div>}
