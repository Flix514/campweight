
'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import AuthGate from '../components/AuthGate';
import CamperSetupWizard from '../components/CamperSetupWizard';
import {supabase} from '../lib/supabase';

const KEY='campweight-s2'; // bewusst gleich: vorhandene Sprint-2-Daten bleiben erhalten
const initial={
  camper:{mode:'caravan',name:'Mein Camper',baseWeight:1320,maxWeight:1700},
  
tow:{name:'',maxWeight:'',brakedLimit:'',unbrakedLimit:'',noseLimit:'',trailerBraked:true},
  license:{class:'B96'},
  trips:[],
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
const positionToDb={
  'Deichselkasten':'drawbar_box',
  'Vorne':'front',
  'Mitte':'middle',
  'Hinten':'rear',
  'Heckträger':'rear_rack',
  'Zugfahrzeug':'tow_vehicle'
};

const positionFromDb=Object.fromEntries(
  Object.entries(positionToDb).map(([de,en])=>[en,de])
);
const uuid=()=>crypto.randomUUID();
const kg=n=>`${Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} kg`;

export default function Home(){return <AuthGate>{({session,signOut})=><CampWeightApp session={session} signOut={signOut}/>}</AuthGate>}

function CampWeightApp({session,signOut}){
  const [ready,setReady]=useState(false),[tab,setTab]=useState('dashboard');
const [loadingFilter,setLoadingFilter]=useState('all'); 
const [showLoadTripDialog, setShowLoadTripDialog] = useState(false);

  const [camper,setCamper]=useState(initial.camper),[tow,setTow]=useState(initial.tow),[license,setLicense]=useState(initial.license),[items,setItems]=useState(initial.items),[trips,setTrips]=useState(initial.trips);
  const [selHome,setSelHome]=useState(''),[selCamper,setSelCamper]=useState(''),[editId,setEditId]=useState(null);
  const [form,setForm]=useState({name:'',category:'Sonstiges',weight:'',owned:1,position:'Mitte',basic:false});
  const [activeTripId,setActiveTripId]=useState('');
  const [tripForm,setTripForm]=useState({name:'',adults:2,children:0,days:7});
  const [importData,setImportData]=useState({fileName:'',headers:[],rows:[],mapping:{name:'',weight:'',owned:'',category:'',position:'',basic:''},error:'',busy:false});
  const [cloudStatus,setCloudStatus]=useState('lokal');
  const [cloudCamperId,setCloudCamperId]=useState('');
  const [cloudChecked,setCloudChecked]=useState(false);
  const [needsSetup,setNeedsSetup]=useState(false);
  const [cloudLoaded,setCloudLoaded]=useState(false);
  const syncQueue=useRef(Promise.resolve());
  const cloudItemIds=useRef([]),cloudTripIds=useRef([]),cloudTowId=useRef(null);
  const lastCloudSnapshot=useRef('');
  
useEffect(() => {
  const navElement = mobileNavRef.current;
  if (!navElement) return;

  const activeButton = navElement.querySelector('button.active');
  if (!activeButton) return;

  const targetLeft =
    activeButton.offsetLeft -
    navElement.offsetLeft -
    (navElement.clientWidth - activeButton.offsetWidth) / 2;

  navElement.scrollTo({
    left: Math.max(0, targetLeft),
    behavior: 'smooth'
  });
}, [tab, camper.mode, ready, cloudChecked, needsSetup]);

const mobileSwipeStart=useRef(null);
const mobileNavRef=useRef(null);
  
  useEffect(()=>{
    try{
      const x=JSON.parse(localStorage.getItem(KEY)||'null');
      if(x){
        setCamper({...initial.camper,...(x.camper||{})});
        setTow({...initial.tow,...(x.tow||{})});
        setLicense({...initial.license,...(x.license||{})});
        setItems(Array.isArray(x.items)?x.items:initial.items);
        setTrips(Array.isArray(x.trips)?x.trips:initial.trips);
      }
    }catch{}finally{setReady(true)}
  },[]);
  useEffect(()=>{if(ready)localStorage.setItem(KEY,JSON.stringify({camper,tow,license,items,trips}))},[ready,camper,tow,license,items,trips]);

  // Erst Cloud-Daten laden, danach automatische Schreibvorgänge freigeben.
  useEffect(()=>{
    if(!ready||!session?.user?.id)return;
    let cancelled=false;
    const userId=session.user.id;
    (async()=>{
      setCloudLoaded(false);
      setCloudChecked(false);
      setCloudStatus('Cloud wird geladen …');
      try{
        const {data:existing,error:camperError}=await supabase.from('campers').select('*').eq('owner_id',userId).order('created_at',{ascending:true}).limit(1).maybeSingle();
        if(camperError)throw camperError;
        if(cancelled)return;
        let record=existing;
        if(!record){
          // Nur Camper anlegen; kein vorhandenes Inventar überschreiben.
          const {data:created,error}=await supabase.from('campers').insert({owner_id:userId,vehicle_type:camper.mode==='motorhome'?'motorhome':'caravan',name:camper.name,base_weight_kg:Number(camper.baseWeight||0),max_weight_kg:Number(camper.maxWeight||1)}).select('*').single();
          if(error)throw error;
          record=created;
        }
        const id=record.id;
        const [inventoryResult,tripsResult,towResult]=await Promise.all([
          supabase.from('inventory_items').select('*').eq('owner_id',userId).eq('camper_id',id),
          supabase.from('trips').select('*').eq('owner_id',userId).eq('camper_id',id),
          supabase.from('tow_vehicles').select('*').eq('owner_id',userId).eq('camper_id',id).limit(1)
        ]);
        for(const result of [inventoryResult,tripsResult,towResult])if(result.error)throw result.error;
        if(cancelled)return;
        const cloudItems=inventoryResult.data||[],cloudTrips=tripsResult.data||[],cloudTow=towResult.data?.[0];
        const local=JSON.parse(localStorage.getItem(KEY)||'null');
        // Bei vorhandenen Cloud-Daten hat die Cloud Vorrang. Leere Cloud nur einmalig aus
        // echten lokalen Nutzerdaten befüllen (nicht aus den Demo-Beispielen).
        const localItems=Array.isArray(local?.items)?local.items:[];
        const localTrips=Array.isArray(local?.trips)?local.trips:[];
        const migrateItems=cloudItems.length===0&&localItems.some(i=>!['1','2','3'].includes(String(i.id)));
        const migrateTrips=cloudTrips.length===0&&localTrips.length>0;
        const idMap={};
        const mappedItems=migrateItems?localItems.map(i=>{const newId=uuid();idMap[i.id]=newId;return {...i,id:newId}}):cloudItems.map(i=>({id:i.id,name:i.name,category:i.category||'Sonstiges',weight:Number(i.weight_per_unit_kg),owned:i.owned_quantity,loaded:i.loaded_quantity,position:positionFromDb[i.loading_position]||'Mitte',basic:i.equipment_type==='basic'}));
        const mappedTrips=migrateTrips?localTrips.map(t=>({ ...t,id:uuid(),items:Object.fromEntries(Object.entries(t.items||{}).map(([oldId,q])=>[idMap[oldId]||oldId,q]))})):cloudTrips.map(t=>({id:t.id,name:t.name,adults:t.adults_count,children:t.children_count,days:t.days||7,items:t.items||{}}));
        const loadedTow=cloudTow?{name:cloudTow.name,maxWeight:cloudTow.gross_weight_kg??'',brakedLimit:cloudTow.towing_capacity_braked_kg??'',unbrakedLimit:cloudTow.towing_capacity_unbraked_kg??'',noseLimit:cloudTow.nose_weight_limit_kg??'',trailerBraked:true}:local?.tow||initial.tow;
        const loadedLicense={class:cloudTow?.licence_class||local?.license?.class||'B96'};
        const loadedCamper={...initial.camper,mode:record.vehicle_type==='motorhome'?'motorhome':'caravan',name:record.name,manufacturer:record.manufacturer||'',model:record.model||'',modelYear:record.model_year||'',noseWeight:record.max_nose_weight_kg??'',baseWeight:Number(record.base_weight_kg),maxWeight:Number(record.max_weight_kg)};
        cloudItemIds.current=cloudItems.map(i=>i.id);cloudTripIds.current=cloudTrips.map(t=>t.id);cloudTowId.current=cloudTow?.id||null;
        setCamper(loadedCamper);setItems(mappedItems);setTrips(mappedTrips);setTow(loadedTow);setLicense(loadedLicense);
        setCloudCamperId(id);
        setNeedsSetup(!record.manufacturer||!record.model||record.name==='Mein Camper');
        lastCloudSnapshot.current=(migrateItems||migrateTrips)?'':JSON.stringify({camper:loadedCamper,tow:loadedTow,license:loadedLicense,items:mappedItems,trips:mappedTrips});
        setCloudLoaded(true);setCloudChecked(true);
        setCloudStatus(migrateItems||migrateTrips?'Lokale Daten werden übernommen …':'Cloud geladen');
      }catch(err){if(!cancelled){console.error('Cloud laden:',err);setCloudStatus('Cloud-Fehler: Laden fehlgeschlagen');setCloudChecked(true)}}
    })();
    return()=>{cancelled=true};
  },[ready,session?.user?.id]);

  // Alle Änderungen verzögert und nacheinander speichern, damit kein älterer
  // Schreibvorgang einen neueren überschreibt.
  useEffect(()=>{
    if(!cloudLoaded||!cloudCamperId||!session?.user?.id)return;
    const snapshot={camper,tow,license,items,trips};
    const serialized=JSON.stringify(snapshot);
    if(serialized===lastCloudSnapshot.current)return;
    const timer=setTimeout(()=>{
      const userId=session.user.id,camperId=cloudCamperId;
      syncQueue.current=syncQueue.current.catch(()=>{}).then(async()=>{
        setCloudStatus('speichert …');
        const {error:camperError}=await supabase.from('campers').update({vehicle_type:camper.mode==='motorhome'?'motorhome':'caravan',name:camper.name,manufacturer:camper.manufacturer||null,model:camper.model||null,model_year:camper.modelYear?Number(camper.modelYear):null,max_nose_weight_kg:camper.noseWeight?Number(camper.noseWeight):null,base_weight_kg:Number(camper.baseWeight||0),max_weight_kg:Number(camper.maxWeight||1)}).eq('id',camperId).eq('owner_id',userId);
        if(camperError)throw camperError;
        const itemRows=items.map(i=>({id:i.id,owner_id:userId,camper_id:camperId,name:i.name,category:i.category,weight_per_unit_kg:Number(i.weight),owned_quantity:Number(i.owned),loaded_quantity:Number(i.loaded),loading_position:positionToDb[i.position]||'middle',equipment_type:i.basic?'basic':'trip'}));
        if(itemRows.length){const {error}=await supabase.from('inventory_items').upsert(itemRows,{onConflict:'id'});if(error)throw error}
        const removedItems=cloudItemIds.current.filter(id=>!items.some(i=>i.id===id));
        if(removedItems.length){const {error}=await supabase.from('inventory_items').delete().eq('owner_id',userId).eq('camper_id',camperId).in('id',removedItems);if(error)throw error}
        cloudItemIds.current=items.map(i=>i.id);
        const tripRows=trips.map(t=>({id:t.id,owner_id:userId,camper_id:camperId,name:t.name,adults_count:Number(t.adults),children_count:Number(t.children),days:Number(t.days),items:t.items||{}}));
        if(tripRows.length){const {error}=await supabase.from('trips').upsert(tripRows,{onConflict:'id'});if(error)throw error}
        const removedTrips=cloudTripIds.current.filter(id=>!trips.some(t=>t.id===id));
        if(removedTrips.length){const {error}=await supabase.from('trips').delete().eq('owner_id',userId).eq('camper_id',camperId).in('id',removedTrips);if(error)throw error}
        cloudTripIds.current=trips.map(t=>t.id);
        if(tow.name?.trim()){
          const towRow={owner_id:userId,camper_id:camperId,name:tow.name,gross_weight_kg:tow.maxWeight?Number(tow.maxWeight):null,towing_capacity_braked_kg:tow.brakedLimit?Number(tow.brakedLimit):null,towing_capacity_unbraked_kg:tow.unbrakedLimit?Number(tow.unbrakedLimit):null,nose_weight_limit_kg:tow.noseLimit?Number(tow.noseLimit):null,licence_class:license.class};
          const {data,error}=await supabase.from('tow_vehicles').upsert(cloudTowId.current?{...towRow,id:cloudTowId.current}:towRow,{onConflict:'id'}).select('id').single();
          if(error)throw error;cloudTowId.current=data.id;
        }
        lastCloudSnapshot.current=serialized;
        setCloudStatus('gespeichert');
      }).catch(err=>{console.error('Cloud speichern:',err);setCloudStatus('Cloud-Fehler: Speichern fehlgeschlagen')});
    },900);
    return()=>clearTimeout(timer);
  },[cloudLoaded,cloudCamperId,session?.user?.id,camper,tow,license,items,trips]);

  const pack=useMemo(()=>items.reduce((s,i)=>s+Number(i.loaded||0)*Number(i.weight||0),0),[items]);
  const total=Number(camper.baseWeight||0)+pack;
  const reserve=Number(camper.maxWeight||0)-total;
  const basics=items.filter(i=>i.basic),home=items.filter(i=>i.owned-i.loaded>0),loaded=items.filter(i=>i.loaded>0);
  const basicWeight=basics.reduce((s,i)=>s+i.loaded*i.weight,0),travelWeight=pack-basicWeight;
  const rearWeight=loaded.filter(i=>['Hinten','Heckträger'].includes(i.position)).reduce((s,i)=>s+i.loaded*i.weight,0);
  const frontWeight=loaded.filter(i=>['Vorne','Deichselkasten'].includes(i.position)).reduce((s,i)=>s+i.loaded*i.weight,0);
  const activeTrip=trips.find(t=>t.id===activeTripId)||trips[0]||null;
  
const tripPacking = activeTrip
  ? Object.entries(activeTrip.items || {})
      .map(([id, quantity]) => {
        const item = items.find(i => i.id === id);
        if (!item) return null;

        const planned = Math.max(0, Number(quantity) || 0);
        return {
          ...item,
          planned,
          packed: Math.min(planned, Number(item.loaded) || 0),
          missing: Math.max(0, planned - (Number(item.loaded) || 0))
        };
      })
      .filter(item => item && item.planned > 0)
  : [];

const tripPlannedCount = tripPacking.reduce(
  (sum, item) => sum + item.planned, 0
);

const tripPackedCount = tripPacking.reduce(
  (sum, item) => sum + item.packed, 0
);

const tripPackingPercent = tripPlannedCount > 0
  ? Math.round((tripPackedCount / tripPlannedCount) * 100)
  : 0;

  const travelItems=items.filter(i=>!i.basic);
  const plannedTravelWeight=activeTrip?Object.entries(activeTrip.items||{}).reduce((sum,[id,q])=>{const i=items.find(x=>x.id===id);return sum+(i?Number(q||0)*Number(i.weight||0):0)},0):0;
  const plannedTotal=Number(camper.baseWeight||0)+basicWeight+plannedTravelWeight;
  const plannedReserve=Number(camper.maxWeight||0)-plannedTotal;

  const resetForm=()=>{setEditId(null);setForm({name:'',category:'Sonstiges',weight:'',owned:1,position:'Mitte',basic:false})};
  function saveItem(){
    const name=form.name.trim(),weight=Number(form.weight),owned=Math.max(1,Number(form.owned||1));
    if(!name||weight<=0){alert('Bitte Produktname und Gewicht eintragen.');return}
    if(editId)setItems(a=>a.map(i=>i.id===editId?{...i,...form,name,weight,owned,loaded:Math.min(i.loaded,owned)}:i));
    else setItems(a=>[...a,{id:uuid(),...form,name,weight,owned,loaded:form.basic?owned:0}]);
    resetForm();
  }
  function edit(i){setEditId(i.id);setForm({name:i.name,category:i.category,weight:i.weight,owned:i.owned,position:i.position,basic:i.basic});setTab('inventory')}
  function del(id){const i=items.find(x=>x.id===id);if(i&&confirm(`„${i.name}“ löschen?`))setItems(a=>a.filter(x=>x.id!==id))}
  function qty(id,d){setItems(a=>a.map(i=>i.id===id?{...i,loaded:Math.max(0,Math.min(i.owned,i.loaded+d))}:i))}
  function setAll(id,loadedAll){setItems(a=>a.map(i=>i.id===id?{...i,loaded:loadedAll?i.owned:0}:i))}
  function loadEverything(){setItems(a=>a.map(i=>({...i,loaded:i.owned})))}
  function unloadTravel(){setItems(a=>a.map(i=>({...i,loaded:i.basic?Math.min(i.owned,Math.max(1,i.loaded)):0})))}

  const importFields=[
    ['name','Produktname (Pflicht)'],['weight','Gewicht/Stück in kg (Pflicht)'],['owned','Menge / Besitz'],
    ['category','Kategorie'],['position','Position'],['basic','Grundausstattung']
  ];
  function normalizeHeader(v){return String(v??'').trim().toLowerCase().replace(/[ä]/g,'ae').replace(/[ö]/g,'oe').replace(/[ü]/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ')}
  function guessMapping(headers){
    const aliases={
      name:['artikel','artikelname','produkt','produktname','bezeichnung','gegenstand','item','name'],
      weight:['gewicht','gewicht kg','gewicht in kg','gewicht stueck','gewicht pro stueck','einzelgewicht','weight','kg'],
      owned:['menge','anzahl','stueck','stueckzahl','besitz','quantity','qty'],
      category:['kategorie','category','gruppe','warengruppe'],
      position:['position','packposition','lagerort','ort','beladungsort'],
      basic:['grundausstattung','basis','standard','immer dabei','basic']
    };
    const norm=headers.map(h=>normalizeHeader(h));
    const result={name:'',weight:'',owned:'',category:'',position:'',basic:''};
    Object.entries(aliases).forEach(([field,names])=>{
      let idx=norm.findIndex(h=>names.includes(h));
      if(idx<0)idx=norm.findIndex(h=>names.some(a=>h.includes(a)));
      if(idx>=0)result[field]=String(idx);
    });
    return result;
  }
  function loadSheetJS(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-campweight-xlsx]');
      if(existing){existing.addEventListener('load',()=>resolve(window.XLSX),{once:true});existing.addEventListener('error',()=>reject(new Error('Excel-Modul konnte nicht geladen werden.')),{once:true});return}
      const script=document.createElement('script');script.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';script.async=true;script.dataset.campweightXlsx='1';script.onload=()=>resolve(window.XLSX);script.onerror=()=>reject(new Error('Excel-Modul konnte nicht geladen werden.'));document.head.appendChild(script);
    })
  }
  async function handleImportFile(e){
    const file=e.target.files?.[0];if(!file)return;
    setImportData(d=>({...d,fileName:file.name,headers:[],rows:[],error:'',busy:true}));
    try{
      const XLSX=await loadSheetJS();const buffer=await file.arrayBuffer();const wb=XLSX.read(buffer,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];

      const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,blankrows:false});
      if(!matrix.length)throw new Error('Die Datei enthält keine lesbaren Daten.');
      let headerIndex=matrix.findIndex(row=>Array.isArray(row)&&row.filter(v=>String(v).trim()!=='').length>=2);if(headerIndex<0)headerIndex=0;
      const width=Math.max(...matrix.slice(headerIndex,Math.min(matrix.length,headerIndex+20)).map(r=>r.length),0);
      const headers=Array.from({length:width},(_,i)=>String(matrix[headerIndex]?.[i]??'').trim()||`Spalte ${i+1}`);
      const rows=matrix.slice(headerIndex+1).filter(r=>r.some(v=>String(v).trim()!==''));
      if(!rows.length)throw new Error('Unter der erkannten Kopfzeile wurden keine Daten gefunden.');
      setImportData({fileName:file.name,headers,rows,mapping:guessMapping(headers),error:'',busy:false});
    }catch(err){setImportData(d=>({...d,headers:[],rows:[],error:err?.message||'Datei konnte nicht gelesen werden.',busy:false}))}
    e.target.value='';
  }
  function importCell(row,field){const idx=Number(importData.mapping[field]);return importData.mapping[field]===''?'':row[idx]}
  function parseImportNumber(v){if(typeof v==='number')return v;let x=String(v??'').trim().replace(/\s/g,'').replace(/kg$/i,'');if(x.includes(',')&&x.includes('.'))x=x.lastIndexOf(',')>x.lastIndexOf('.')?x.replace(/\./g,'').replace(',','.'):x.replace(/,/g,'');else x=x.replace(',','.');return Number(x)}
  function parseImportBool(v){const x=normalizeHeader(v);return ['ja','j','yes','true','1','x','grundausstattung','standard'].includes(x)}
  function mappedImportRows(){return importData.rows.map((row,index)=>{const name=String(importCell(row,'name')??'').trim();const weight=parseImportNumber(importCell(row,'weight'));const ownedRaw=parseImportNumber(importCell(row,'owned'));const owned=Number.isFinite(ownedRaw)&&ownedRaw>0?Math.max(1,Math.round(ownedRaw)):1;const cat=String(importCell(row,'category')??'').trim();const position=String(importCell(row,'position')??'').trim();const basic=parseImportBool(importCell(row,'basic'));return {index:index+2,name,weight,owned,category:cats.includes(cat)?cat:'Sonstiges',position:pos.includes(position)?position:'Mitte',basic,valid:Boolean(name)&&Number.isFinite(weight)&&weight>0}})}
  function confirmImport(){
    if(importData.mapping.name===''||importData.mapping.weight===''){alert('Bitte mindestens Produktname und Gewicht einer Excel-Spalte zuordnen.');return}
    const parsed=mappedImportRows(),valid=parsed.filter(r=>r.valid);if(!valid.length){alert('Es wurden keine gültigen Artikel mit Name und Gewicht gefunden.');return}
    setItems(a=>[...a,...valid.map((r,i)=>({id:uuid(),...r,loaded:r.basic?r.owned:0}))]);
    const skipped=parsed.length-valid.length;alert(`${valid.length} Artikel importiert${skipped?`. ${skipped} Zeile(n) ohne gültigen Namen/Gewicht wurden übersprungen.`:'.'}`);setImportData({fileName:'',headers:[],rows:[],mapping:{name:'',weight:'',owned:'',category:'',position:'',basic:''},error:'',busy:false});
  }

  function createTrip(){
    const name=tripForm.name.trim();
    if(!name){alert('Bitte einen Reisenamen eintragen.');return}
    const trip={id:uuid(),name,adults:Math.max(0,Number(tripForm.adults||0)),children:Math.max(0,Number(tripForm.children||0)),days:Math.max(1,Number(tripForm.days||1)),items:{}};
    setTrips(a=>[...a,trip]);setActiveTripId(trip.id);setTripForm({name:'',adults:2,children:0,days:7});
  }
  function updateTrip(id,patch){setTrips(a=>a.map(t=>t.id===id?{...t,...patch}:t))}
  function setTripQty(itemId,value){if(!activeTrip)return;const item=items.find(i=>i.id===itemId);if(!item)return;const q=Math.max(0,Math.min(item.owned,Number(value||0)));setTrips(a=>a.map(t=>t.id===activeTrip.id?{...t,items:{...(t.items||{}),[itemId]:q}}:t))}
  function deleteTrip(id){const t=trips.find(x=>x.id===id);if(t&&confirm(`Reise „${t.name}“ wirklich löschen?`)){setTrips(a=>a.filter(x=>x.id!==id));if(activeTripId===id)setActiveTripId('')}}
  function duplicateTrip(id){const t=trips.find(x=>x.id===id);if(!t)return;const copy={...t,id:uuid(),name:`${t.name} – Kopie`,items:{...(t.items||{})}};setTrips(a=>[...a,copy]);setActiveTripId(copy.id)}
  

function loadTrip() {
  if (!activeTrip) {
    alert('Bitte zuerst eine Reise auswählen.');
    return;
  }

  setShowLoadTripDialog(true);
}

function confirmLoadTrip(keepExisting) {
  if (!activeTrip) return;

  const plannedItems = activeTrip.items || {};

  setItems(previous => previous.map(item => {
    if (item.basic) return item;

    const planned = Math.max(
      0,
      Math.min(
        Number(item.owned) || 0,
        Number(plannedItems[item.id]) || 0
      )
    );

    return {
      ...item,
      loaded: keepExisting
        ? Math.max(Number(item.loaded) || 0, planned)
        : planned
    };
  }));

  setShowLoadTripDialog(false);
}


  function unloadTrip(){setItems(a=>a.map(i=>i.basic?i:{...i,loaded:0}))}
  function planFromCamper(){if(!activeTrip)return;const map={};items.filter(i=>!i.basic).forEach(i=>{map[i.id]=i.loaded});updateTrip(activeTrip.id,{items:map})}

  async function completeSetup(data){
    const camperPatch={mode:data.mode,name:data.name,manufacturer:data.manufacturer,model:data.model,modelYear:Number(data.year),baseWeight:Number(data.baseWeight),maxWeight:Number(data.maxWeight),noseWeight:data.mode==='caravan'?Number(data.noseWeight):''};
    const payload={owner_id:session.user.id,vehicle_type:data.mode==='motorhome'?'motorhome':'caravan',name:data.name,manufacturer:data.manufacturer,model:data.model,model_year:Number(data.year),base_weight_kg:Number(data.baseWeight),max_weight_kg:Number(data.maxWeight),max_nose_weight_kg:data.mode==='caravan'?Number(data.noseWeight):null};
    let id=cloudCamperId;
    if(id){const {error}=await supabase.from('campers').update(payload).eq('id',id);if(error)throw error}
    else{const {data:created,error}=await supabase.from('campers').insert(payload).select('id').single();if(error)throw error;id=created.id;setCloudCamperId(id)}
    if(data.mode==='caravan'&&data.addTow&&data.towName.trim()){
      const {data:savedTow,error}=await supabase.from('tow_vehicles').upsert({...(cloudTowId.current?{id:cloudTowId.current}:{}),owner_id:session.user.id,camper_id:id,name:data.towName.trim(),gross_weight_kg:data.towMaxWeight?Number(data.towMaxWeight):null,towing_capacity_braked_kg:data.towBrakedLimit?Number(data.towBrakedLimit):null,nose_weight_limit_kg:data.towNoseLimit?Number(data.towNoseLimit):null},{onConflict:'id'}).select('id').single();
if(error)throw error;
if(savedTow)cloudTowId.current=savedTow.id;
      setTow(t=>({...t,name:data.towName,maxWeight:data.towMaxWeight,brakedLimit:data.towBrakedLimit,noseLimit:data.towNoseLimit}));
    }
    setCamper(c=>({...c,...camperPatch}));setNeedsSetup(false);setCloudStatus('gespeichert');setTab('dashboard');
  }

  const licenseCheck=checkLicense({mode:camper.mode,license:license.class,camperMax:Number(camper.maxWeight||0),towMax:Number(tow.maxWeight||0)});
  const techCheck=checkTechnical({mode:camper.mode,currentTrailerWeight:total,tow,camperMax:Number(camper.maxWeight||0),reserve});

  if(!ready||!cloudChecked)return <main className='loading'>CampWeight wird geladen …</main>;
  if(needsSetup)return <CamperSetupWizard initialCamper={camper} email={session?.user?.email} signOut={signOut} onComplete={completeSetup}/>;

  const nav=[['dashboard','Dashboard'],['camper','Mein Camper'],['inventory','Inventar'],['basic','Grundausstattung'],['trips','Reisen'],['loading','Beladung']];
  if(camper.mode==='caravan')nav.push(['tow','Zugfahrzeug']);
  nav.push(['license','Führerschein-Check']);
                               
function handleMobileTouchStart(e) {
  if (!window.matchMedia('(max-width: 700px)').matches) return;
  if (e.touches.length !== 1) return;

  if (e.target.closest(
    '.loadingItem, .table, input, select, textarea, button, a, [role="slider"], [contenteditable="true"]'
  )) {
    mobileSwipeStart.current = null;
    return;
  }

  mobileSwipeStart.current = {
    x: e.touches[0].clientX,
    y: e.touches[0].clientY
  };
}

function handleMobileTouchEnd(e) {
  const start = mobileSwipeStart.current;
  mobileSwipeStart.current = null;

  if (!start || !window.matchMedia('(max-width: 700px)').matches) return;

  const dx = e.changedTouches[0].clientX - start.x;
  const dy = e.changedTouches[0].clientY - start.y;

  if (Math.abs(dx) < 85 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (start.x < 25 && dx > 0) return;

  const currentIndex = nav.findIndex(([id]) => id === tab);
  const nextIndex = currentIndex + (dx < 0 ? 1 : -1);

  if (nextIndex < 0 || nextIndex >= nav.length) return;

  setTab(nav[nextIndex][0]);
  window.scrollTo({ top: 0, behavior: 'auto' });
}


  return <div className='shell'>
    <aside>
      <div className='brand'><img className='brandLogo' src='/campweight-logo.png' alt='CampWeight – Pack smart. Travel safe.'/></div>
      
<nav ref={mobileNavRef}>
  {nav.map(([id, label]) => (
    <button
      key={id}
      type="button"
      className={tab === id ? 'active' : ''}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  ))}
</nav>

      <small>Cloud-Synchronisierung · {cloudStatus}</small>
    </aside>

    
<main
  className="content"
  onTouchStart={handleMobileTouchStart}
  onTouchEnd={handleMobileTouchEnd}
  onTouchCancel={() => {
    mobileSwipeStart.current = null;
  }}
>

                    
<div className="mobileBrand">
  <img
    src="/campweight-logo.png"
    alt="CampWeight"
    className="mobileBrandLogo"
  />
</div>
      <header><div><p>CampWeight · Version 0.2</p><h1>{nav.find(n=>n[0]===tab)?.[1]||'CampWeight'}</h1></div><strong className={`status ${reserve<0?'bad':reserve<50?'warn':'ok'}`}>{reserve<0?`${kg(Math.abs(reserve))} zu viel`:`${kg(reserve)} Reserve`}</strong></header>

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
        <section className='two'>
          <Card title='Reisen & Packlisten'><p><b>{trips.length}</b> gespeicherte Reise{trips.length===1?'':'n'}.</p>{activeTrip?<><p className='row'><span>Aktiv</span><b>{activeTrip.name}</b></p><p className='row'><span>Geplantes Gesamtgewicht</span><b>{kg(plannedTotal)}</b></p><p className='row'><span>Geplante Reserve</span><b>{kg(plannedReserve)}</b></p></>:<p>Noch keine Reise angelegt.</p>}<button onClick={()=>setTab('trips')}>Reisen planen</button></Card>
          <Card title='Packstatus'><p className='row'><span>Grundausstattung</span><b>{kg(basicWeight)}</b></p><p className='row'><span>Aktuelles Reisegepäck</span><b>{kg(travelWeight)}</b></p><p className='row'><span>Packstücke im Camper</span><b>{loaded.reduce((sum,i)=>sum+i.loaded,0)}</b></p></Card>
        </section>
      </>}

      {tab==='camper'&&<Card title='Mein Camper'>
        <label>Name / Modell<input value={camper.name} onChange={e=>setCamper(c=>({...c,name:e.target.value}))}/></label>
        <label>Fahrzeugtyp<select value={camper.mode} onChange={e=>{const mode=e.target.value;setCamper(c=>({...c,mode}));if(mode==='motorhome'&&tab==='tow')setTab('camper')}}><option value='caravan'>Wohnwagen / Gespann</option><option value='motorhome'>Wohnmobil</option></select></label>
        <label>Basisgewicht (kg)<input type='number' value={camper.baseWeight} onChange={e=>setCamper(c=>({...c,baseWeight:e.target.value}))}/><small>Idealerweise tatsächlich gewogenes Basisgewicht ohne Reisegepäck.</small></label>
        <label>zGG (kg)<input type='number' value={camper.maxWeight} onChange={e=>setCamper(c=>({...c,maxWeight:e.target.value}))}/><small>Fahrzeugschein: Feld F.2</small></label>
        {camper.mode==='caravan'?<div className='hint'>Wohnwagenmodus aktiv: Zugfahrzeug, Anhängelast, Stützlast und Gespann-Führerscheinprüfung werden berücksichtigt.</div>:<div className='hint'>Wohnmobilmodus aktiv: Zugfahrzeug-, Anhängelast- und Stützlastthemen sind ausgeblendet. Der Führerschein-Check bewertet nur das zGG des Wohnmobils.</div>}
      </Card>}

      {tab==='inventory'&&<>
        <Card title='Packliste aus Excel oder CSV importieren'>
          <p className='note'>Du hast deine Packliste bereits in Excel? Lade eine .xlsx-, .xls- oder .csv-Datei hoch. Die Datei wird direkt in deinem Browser gelesen; anschließend kannst du die Spalten CampWeight zuordnen und den Import prüfen.</p>
          <label className='fileUpload'><span>{importData.busy?'Datei wird gelesen …':'Excel-/CSV-Datei auswählen'}</span><input type='file' accept='.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv' onChange={handleImportFile} disabled={importData.busy}/></label>
          {importData.error&&<div className='hint hintDanger'>{importData.error}</div>}
          {importData.rows.length>0&&<>
            <div className='importSummary'><b>{importData.fileName}</b><span>{importData.rows.length} Datenzeilen erkannt · erstes Tabellenblatt</span></div>
            <h3>Spalten zuordnen</h3>
            <div className='importMap'>{importFields.map(([field,label])=><label key={field}>{label}<select value={importData.mapping[field]} onChange={e=>setImportData(d=>({...d,mapping:{...d.mapping,[field]:e.target.value}}))}><option value=''>Nicht importieren</option>{importData.headers.map((h,i)=><option key={i} value={String(i)}>{h}</option>)}</select></label>)}</div>
            {(()=>{const preview=mappedImportRows();const valid=preview.filter(r=>r.valid).length;return <><div className={`hint ${valid===0?'hintDanger':''}`}><b>{valid} von {preview.length}</b> Zeilen können importiert werden. Pflichtfelder sind Produktname und ein Gewicht größer 0. Fehlende Kategorie wird „Sonstiges“, fehlende Position „Mitte“, fehlende Menge 1.</div><div className='table importPreview'><table><thead><tr><th>Status</th><th>Produkt</th><th>Gewicht</th><th>Menge</th><th>Kategorie</th><th>Position</th><th>Grundausstattung</th></tr></thead><tbody>{preview.slice(0,8).map(r=><tr key={r.index}><td>{r.valid?'✓':'⚠'}</td><td>{r.name||'—'}</td><td>{Number.isFinite(r.weight)?kg(r.weight):'ungültig'}</td><td>{r.owned}</td><td>{r.category}</td><td>{r.position}</td><td>{r.basic?'Ja':'Nein'}</td></tr>)}</tbody></table></div>{preview.length>8&&<p className='note'>Vorschau zeigt die ersten 8 von {preview.length} Zeilen.</p>}<div className='buttons'><button onClick={confirmImport} disabled={valid===0}>Gültige Artikel importieren</button><button className='secondary' onClick={()=>setImportData({fileName:'',headers:[],rows:[],mapping:{name:'',weight:'',owned:'',category:'',position:'',basic:''},error:'',busy:false})}>Import verwerfen</button></div></>})()}
          </>}
        </Card>
        <Card title={editId?'Produkt bearbeiten':'Inventar-Produkt manuell hinzufügen'}><div className='form'>{[['Produktname','name'],['Gewicht/Stück (kg)','weight'],['Besitz','owned']].map(([l,k])=><label key={k}>{l}<input type={k==='name'?'text':'number'} step={k==='weight'?'0.01':'1'} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></label>)}<label>Kategorie<select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{cats.map(x=><option key={x}>{x}</option>)}</select></label><label>Position<select value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))}>{pos.map(x=><option key={x}>{x}</option>)}</select></label></div><label className='check'><input type='checkbox' checked={form.basic} onChange={e=>setForm(f=>({...f,basic:e.target.checked}))}/> Grundausstattung</label><div className='buttons'><button onClick={saveItem}>{editId?'Speichern':'Hinzufügen'}</button>{editId&&<button className='secondary' onClick={resetForm}>Abbrechen</button>}</div></Card><Card title='Mein Inventar'><Table items={items} edit={edit} del={del}/></Card>
      </>}

      {tab==='basic'&&<Card title='Camper-Grundausstattung'>{basics.length?<Table items={basics} edit={edit} del={del}/>:<p>Noch keine Grundausstattung markiert.</p>}</Card>}

      {tab==='trips'&&<>
        <Card title='Neue Reise anlegen'>
          <div className='tripForm'>
            <label>Reisename<input value={tripForm.name} onChange={e=>setTripForm(f=>({...f,name:e.target.value}))} placeholder='z. B. Zeeland Sommerurlaub 2027'/></label>
            <label>Erwachsene<input type='number' min='0' value={tripForm.adults} onChange={e=>setTripForm(f=>({...f,adults:e.target.value}))}/></label>
            <label>Kinder<input type='number' min='0' value={tripForm.children} onChange={e=>setTripForm(f=>({...f,children:e.target.value}))}/></label>
            <label>Tage<input type='number' min='1' value={tripForm.days} onChange={e=>setTripForm(f=>({...f,days:e.target.value}))}/></label>
          </div>
          <button onClick={createTrip}>Reise anlegen</button>
        </Card>

        <Card title='Gespeicherte Reisen'>
          {trips.length===0?<p>Noch keine Reise gespeichert.</p>:<div className='tripCards'>{trips.map(t=><button key={t.id} className={`tripCard ${activeTrip?.id===t.id?'selectedTrip':''}`} onClick={()=>setActiveTripId(t.id)}><b>{t.name}</b><span>{t.adults} Erw. · {t.children} Kinder · {t.days} Tage</span></button>)}</div>}
        </Card>

        {activeTrip&&<>
          <Card title={`Reise planen: ${activeTrip.name}`}>
            <div className='tripMeta'>
              <label>Name<input value={activeTrip.name} onChange={e=>updateTrip(activeTrip.id,{name:e.target.value})}/></label>
              <label>Erwachsene<input type='number' min='0' value={activeTrip.adults} onChange={e=>updateTrip(activeTrip.id,{adults:Math.max(0,Number(e.target.value||0))})}/></label>
              <label>Kinder<input type='number' min='0' value={activeTrip.children} onChange={e=>updateTrip(activeTrip.id,{children:Math.max(0,Number(e.target.value||0))})}/></label>
              <label>Tage<input type='number' min='1' value={activeTrip.days} onChange={e=>updateTrip(activeTrip.id,{days:Math.max(1,Number(e.target.value||1))})}/></label>
            </div>
            <div className='buttons tripActions'><button onClick={planFromCamper}>Aktuellen Camper als Plan übernehmen</button><button className='secondary' onClick={()=>duplicateTrip(activeTrip.id)}>Reise kopieren</button><button className='danger' onClick={()=>deleteTrip(activeTrip.id)}>Reise löschen</button></div>
            <div className='hint'>Grundausstattung wird automatisch in der aktuell im Camper vorgesehenen Menge berücksichtigt. Hier planst du nur das variable Reisegepäck.</div>
          </Card>

          <Card title='Reisegepäck planen'>
            {travelItems.length===0?<p>Noch keine variablen Inventar-Produkte vorhanden.</p>:<div className='table tripTable'><table><thead><tr><th>Produkt</th><th>Kategorie</th><th>Gewicht/Stück</th><th>Besitz</th><th>Geplante Menge</th><th>Geplantes Gewicht</th></tr></thead><tbody>{travelItems.map(i=>{const q=Number(activeTrip.items?.[i.id]||0);return <tr key={i.id}><td><b>{i.name}</b></td><td>{i.category}</td><td>{kg(i.weight)}</td><td>{i.owned}</td><td><input className='qtyInput' type='number' min='0' max={i.owned} value={q} onChange={e=>setTripQty(i.id,e.target.value)}/></td><td>{kg(q*i.weight)}</td></tr>})}</tbody></table></div>}
          </Card>

          <section className='stats'><Stat t='Basisgewicht' v={kg(camper.baseWeight)}/><Stat t='Grundausstattung' v={kg(basicWeight)}/><Stat t='Reisegepäck geplant' v={kg(plannedTravelWeight)}/><Stat t='Geplant gesamt' v={kg(plannedTotal)}/></section>
          <Card title='Gewichtsprognose'>
            <Progress total={plannedTotal} max={camper.maxWeight}/>
            <p className='row'><span>zGG</span><b>{kg(camper.maxWeight)}</b></p><p className='row'><span>Geplant</span><b>{kg(plannedTotal)}</b></p><p className='row'><span>Reserve</span><b className={plannedReserve<0?'textBad':''}>{kg(plannedReserve)}</b></p>
            <div className={`hint ${plannedReserve<0?'hintDanger':plannedReserve<50?'hintWarn':''}`}>{plannedReserve<0?`Die geplante Reise überschreitet das zGG um ${kg(Math.abs(plannedReserve))}. Bitte Mengen reduzieren oder Gewicht optimieren.`:plannedReserve<50?`Nur noch ${kg(plannedReserve)} Reserve in der Planung. Ein zusätzlicher Puffer wäre sinnvoll.`:`Die Reiseplanung liegt aktuell mit ${kg(plannedReserve)} Reserve innerhalb des zGG.`}</div>
            <div className='buttons tripActions'><button onClick={loadTrip}>Reise in Camper laden</button><button className='secondary' onClick={unloadTrip}>Reise ausladen</button><button onClick={()=>setTab('loading')}>Beladung prüfen</button></div>
          </Card>
        </>}
      </>}

     
{tab==='loading'&&<>
  
{showLoadTripDialog && activeTrip && (
  <div
    className="loadTripOverlay"
    onClick={() => setShowLoadTripDialog(false)}
  >
    <div
      className="loadTripDialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loadTripDialogTitle"
      onClick={e => e.stopPropagation()}
    >
      <h2 id="loadTripDialogTitle">
        Reisebeladung übernehmen
      </h2>

      <p>
        Du möchtest die Packliste
        <strong> „{activeTrip.name}“ </strong>
        in deinen Camper laden.
      </p>

      <p>Was soll mit der bisherigen Beladung passieren?</p>

      <button
        type="button"
        className="loadTripOption"
        onClick={() => confirmLoadTrip(true)}
      >
        <strong>Beladung behalten</strong>
        <span>
          Vorhandene Gegenstände behalten und fehlende Mengen ergänzen.
        </span>
      </button>

      <button
        type="button"
        className="loadTripOption"
        onClick={() => confirmLoadTrip(false)}
      >
        <strong>Reisegepäck ersetzen</strong>
        <span>
          Bisheriges Reisegepäck entfernen und neue Packliste laden.
          Die Grundausstattung bleibt erhalten.
        </span>
      </button>

      <button
        type="button"
        className="loadTripCancel"
        onClick={() => setShowLoadTripDialog(false)}
      >
        Abbrechen
      </button>
    </div>
  </div>
)}

  <section className="loadingOverview">
    <div>
      <span>Aktuelles Gesamtgewicht</span>
      <strong>{kg(total)}</strong>
      <small>Davon {kg(pack)} Zuladung</small>
    </div>
    <div className={reserve<0?'loadingReserve over':'loadingReserve'}>
      <span>Verbleibende Reserve</span>
      <strong>{kg(reserve)}</strong>
      <small>Maximal {kg(camper.maxWeight)}</small>
    </div>
  </section>

<section className="tripPackingOverview">
  <h3>Packliste für deine Reise</h3>

  {trips.length > 0 ? (
    <>
      <label htmlFor="loadingTripSelect">Reise auswählen</label>
      <select
        id="loadingTripSelect"
        value={activeTrip?.id || ''}
        onChange={e => setActiveTripId(e.target.value)}
      >
        {trips.map(trip => (
          <option key={trip.id} value={trip.id}>
            {trip.name}
          </option>
        ))}
      </select>

      <p>
        <strong>{tripPackedCount} von {tripPlannedCount}</strong> geplanten
        Packstücken eingeladen ({tripPackingPercent} %)
      </p>

      <progress
        value={tripPackedCount}
        max={Math.max(1, tripPlannedCount)}
        style={{width: '100%'}}
      />

      {tripPacking.filter(item => item.missing > 0).length > 0 ? (
        <p>
          Noch {tripPlannedCount - tripPackedCount} Packstücke fehlen.
        </p>
      ) : tripPlannedCount > 0 ? (
        <p>Alles für diese Reise eingepackt!</p>
      ) : (
        <p>Für diese Reise sind noch keine Packstücke geplant.</p>
      )}
    </>
  ) : (
    <p>Lege zuerst im Bereich „Reisen“ eine Reise mit Packliste an.</p>
  )}
</section>

  <div className="loadingActions">
    
<button
  type="button"
  onClick={loadTrip}
  disabled={!activeTrip || tripPlannedCount === 0}
>
  Komplette Reise einladen
</button>

    <button className="secondary" onClick={unloadTravel}>
      Reisegepäck ausladen
    </button>
  </div>

  <Card title="Packstücke verwalten">
    <p className="note">
      Plus oder nach rechts wischen: einladen.
      Minus oder nach links wischen: ausladen.
    </p>


<div className="loadingActions" role="group" aria-label="Packstücke filtern">
  <button
    type="button"
    className={loadingFilter==='all'?'':'secondary'}
    aria-pressed={loadingFilter==='all'}
    onClick={()=>setLoadingFilter('all')}
  >
    Alle ({items.length})
  </button>

  <button
    type="button"
    className={loadingFilter==='loaded'?'':'secondary'}
    aria-pressed={loadingFilter==='loaded'}
    onClick={()=>setLoadingFilter('loaded')}
  >
    Im Camper ({loaded.length})
  </button>

  <button
    type="button"
    className={loadingFilter==='home'?'':'secondary'}
    aria-pressed={loadingFilter==='home'}
    onClick={()=>setLoadingFilter('home')}
  >
    Zuhause ({home.length})
  </button>
</div>

<div className="loadingCards">
  {items
    .filter(i=>
      loadingFilter==='all' ||
      (loadingFilter==='loaded' && i.loaded>0) ||
      (loadingFilter==='home' && i.owned-i.loaded>0)
    )
    .map(i=><LoadingItem
      key={i.id}
      item={i}
      onChange={delta=>qty(i.id,delta)}
    />)}
</div>


    {items.length===0&&
      <p>Noch keine Packstücke vorhanden.</p>}
  </Card>

  <section className="stats">
    <Stat t="Packgewicht" v={kg(pack)}/>
    <Stat t="Gesamtgewicht" v={kg(total)}/>
    <Stat t="Reserve" v={kg(reserve)}/>
    <Stat
      t="Im Camper"
      v={`${loaded.reduce((s,i)=>s+i.loaded,0)} Stück`}
    />
  </section>
</>}


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
        <Card title='Technischer Gespann-Check'>
          <CheckBox result={techCheck}/>
          <p className='note'>Für die Anhängelast vergleichen wir das aktuell berechnete Wohnwagengewicht mit O.1 bzw. O.2. Entscheidend sind im echten Betrieb die tatsächlichen Massen und die Angaben in Fahrzeugpapieren/COC.</p>
        </Card>
      </>}

      {tab==='license'&&<>
        <Card title='Führerschein auswählen'>
          <label>Führerscheinklasse
            <select value={license.class} onChange={e=>setLicense({class:e.target.value})}>
              {licenses.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <div className='hint'>{camper.mode==='caravan'?'Für den Gespann-Check werden die zulässigen Gesamtmassen von Zugfahrzeug und Wohnwagen verwendet – nicht die aktuelle Beladung.':'Für den Wohnmobil-Check wird die zulässige Gesamtmasse des Wohnmobils verwendet.'}</div>
        </Card>
        <Card title='Ergebnis'>
          <CheckBox result={licenseCheck}/>
          {licenseCheck.details?.map((d,i)=><p className='resultLine' key={i}>{d}</p>)}
        </Card>
        {camper.mode==='caravan'&&<Card title='Technische Prüfung'>
          <CheckBox result={techCheck}/>
          {techCheck.details?.map((d,i)=><p className='resultLine' key={i}>{d}</p>)}
        </Card>}
        <Card title='Hinweis zu alten deutschen Führerscheinklassen'>
          <p className='note'>Bei alten Klassen können Besitzstandsrechte, Umtausch, Schlüsselzahlen, Achszahl sowie Alters-/Gesundheitsvorgaben eine Rolle spielen. CampWeight zeigt deshalb bei komplexen Altklassen bewusst einen Prüfhinweis statt einer pauschalen Freigabe.</p>
        </Card>
      </>}

      <section className='accountBar'>
        <span>
          <b>{session?.user?.email}</b>
          <small>Cloud: {cloudStatus}</small>
        </span>
        <button className='secondary' onClick={signOut}>Abmelden</button>
      </section>

      <section className='legal'>
        <b>Rechtlicher Hinweis:</b> Die berechneten Werte und Empfehlungen dienen ausschließlich der Orientierung. Die Verantwortung für ordnungsgemäße Beladung, Fahrerlaubnis, gesetzliche Vorschriften und Verkehrssicherheit liegt beim Fahrzeugführer.
      </section>
    </main>
  </div>;
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
    if(level!=='bad')level='neutral';
    details.push(`Anhängelast ${tow.trailerBraked?'O.1':'O.2'} fehlt.`);
  }
  if(tow.noseLimit)details.push(`Max. eingetragene Stützlast Zugfahrzeug: ${kg(tow.noseLimit)}. Tatsächliche Stützlast muss gemessen werden.`);
  return level==='bad'?bad('Technische Grenze prüfen','Mindestens eine technische Gewichtsgrenze ist kritisch.',details):level==='neutral'?{level:'neutral',title:'Technikdaten unvollständig',text:'Für die vollständige Prüfung fehlen noch Werte aus dem Fahrzeugschein.',details}:ok('Technische Basisprüfung unauffällig','Die eingegebenen Basiswerte ergeben aktuell keinen offensichtlichen Konflikt.',details);
}

function ok(title,text,details=[]){return {level:'ok',title,text,details}}
function warn(title,text,details=[]){return {level:'warn',title,text,details}}
function bad(title,text,details=[]){return {level:'bad',title,text,details}}
function labelLicense(v){return Object.fromEntries(licenses)[v]||v}

function CheckBox({result}){
  return <div className={`checkBox ${result.level||'neutral'}`}>
    <b>{result.title}</b>
    <span>{result.text}</span>
  </div>;
}

function Card({title,children}){
  return <section className='card'><h2>{title}</h2>{children}</section>;
}

function Stat({t,v}){
  return <div className='stat'><span>{t}</span><b>{v}</b></div>;
}

function Progress({total,max}){
  const p=max?Math.min(100,total/max*100):0;
  return <div className='progress'>
    <div className={total>max?'fill red':p>90?'fill yellow':'fill'} style={{width:`${p}%`}}/>
  </div>;
}

function Table({items,edit,del}){
  return <div className='table'>
    <table>
      <thead><tr>
        <th>Produkt</th><th>Kategorie</th><th>Gewicht</th>
        <th>Besitz</th><th>Zuhause</th><th>Im Camper</th>
        <th>Position</th><th>Grundausstattung</th><th>Aktion</th>
      </tr></thead>
      <tbody>
        {items.map(i=><tr key={i.id}>
          <td><b>{i.name}</b></td>
          <td>{i.category}</td>
          <td>{kg(i.weight)}</td>
          <td>{i.owned}</td>
          <td>{i.owned-i.loaded}</td>
          <td>{i.loaded}</td>
          <td>{i.position}</td>
          <td>{i.basic?'Ja':'Nein'}</td>
          <td><div className='mini'>
            <button onClick={()=>edit(i)}>Bearbeiten</button>
            <button className='danger' onClick={()=>del(i.id)}>Löschen</button>
          </div></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

/* Neue Beladungskarten – bewusst außerhalb der Hauptkomponente */

function LoadingItem({item,onChange}){
  const touchStart=useRef(null);

  function handleTouchEnd(e){
    if(!touchStart.current)return;

    const dx=e.changedTouches[0].clientX-touchStart.current.x;
    const dy=e.changedTouches[0].clientY-touchStart.current.y;
    touchStart.current=null;

    if(Math.abs(dx)<70 || Math.abs(dx)<Math.abs(dy)*1.5)return;

    if(dx>0 && item.loaded<item.owned)onChange(1);
    if(dx<0 && item.loaded>0)onChange(-1);
  }

  return <article
    className="loadingItem"
    onTouchStart={e=>{
      touchStart.current={
        x:e.touches[0].clientX,
        y:e.touches[0].clientY
      };
    }}
    onTouchEnd={handleTouchEnd}
    onTouchCancel={()=>{touchStart.current=null}}
  >
    <div className="loadingItemTop">
      <div>
        <strong>{item.name}</strong>
        <small>{item.category} · {item.position}</small>
        <small>{kg(item.weight)} pro Stück</small>
      </div>
      <span className="loadingItemCount">
        {item.loaded} / {item.owned}
      </span>
    </div>

    <div className="loadingItemBottom">
      <span>{kg(item.loaded*item.weight)} eingeladen</span>
      <div className="loadingStepper">
        <button
          type="button"
          className="secondary"
          disabled={item.loaded<=0}
          aria-label={`${item.name} ausladen`}
          onClick={()=>onChange(-1)}
        >−</button>
        <b>{item.loaded}</b>
        <button
          type="button"
          disabled={item.loaded>=item.owned}
          aria-label={`${item.name} einladen`}
          onClick={()=>onChange(1)}
        >+</button>
      </div>
    </div>
  </article>;
}
