'use client';

import { useMemo, useState } from 'react';

const starterItems = [
  { id: 1, name: 'Campingstuhl', weight: 3.2, owned: 4, loaded: 2, position: 'Mitte', basic: true },
  { id: 2, name: 'Gasflasche 11 kg voll', weight: 22, owned: 2, loaded: 1, position: 'Deichselkasten', basic: true },
  { id: 3, name: 'Cadac Grill', weight: 8.4, owned: 1, loaded: 1, position: 'Hinten', basic: false },
];

export default function Home() {
  const [mode, setMode] = useState('caravan');
  const [baseWeight, setBaseWeight] = useState(1320);
  const [maxWeight, setMaxWeight] = useState(1700);
  const [items, setItems] = useState(starterItems);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [owned, setOwned] = useState(1);
  const [position, setPosition] = useState('Mitte');
  const [basic, setBasic] = useState(false);

  const packWeight = useMemo(
    () => items.reduce((sum, item) => sum + item.loaded * item.weight, 0),
    [items]
  );

  const total = Number(baseWeight || 0) + packWeight;
  const reserve = Number(maxWeight || 0) - total;

  function updateLoaded(id, delta) {
    setItems(current => current.map(item =>
      item.id === id
        ? { ...item, loaded: Math.max(0, Math.min(item.owned, item.loaded + delta)) }
        : item
    ));
  }

  function addItem() {
    if (!name || !weight) return;
    setItems(current => [...current, {
      id: Date.now(),
      name,
      weight: Number(weight),
      owned: Math.max(1, Number(owned)),
      loaded: 0,
      position,
      basic,
    }]);
    setName('');
    setWeight('');
    setOwned(1);
    setPosition('Mitte');
    setBasic(false);
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">CampWeight Sprint 1</p>
          <h1>Pack smart. Travel safe.</h1>
          <p>Erste echte Codebasis für Camper, Inventar, Grundausstattung und Beladung.</p>
        </div>
        <div className={`status ${reserve < 0 ? 'bad' : reserve < 50 ? 'warn' : 'ok'}`}>
          {reserve < 0 ? `${Math.abs(reserve).toFixed(1)} kg zu viel` : `${reserve.toFixed(1)} kg Reserve`}
        </div>
      </header>

      <section className="grid2">
        <article className="card">
          <h2>Mein Camper</h2>
          <label>Fahrzeugtyp</label>
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="caravan">Wohnwagen / Gespann</option>
            <option value="motorhome">Wohnmobil</option>
          </select>

          <label>Basisgewicht (kg)</label>
          <input type="number" value={baseWeight} onChange={e => setBaseWeight(e.target.value)} />

          <label>Zulässige Gesamtmasse zGG (kg)</label>
          <input type="number" value={maxWeight} onChange={e => setMaxWeight(e.target.value)} />

          {mode === 'caravan' && <div className="hint">Zugfahrzeug und Führerschein-Check folgen im nächsten Sprint.</div>}
        </article>

        <article className="card">
          <h2>Gewichtsübersicht</h2>
          <div className="stats">
            <div><span>Basisgewicht</span><strong>{Number(baseWeight || 0).toFixed(1)} kg</strong></div>
            <div><span>Packgewicht</span><strong>{packWeight.toFixed(1)} kg</strong></div>
            <div><span>Gesamtgewicht</span><strong>{total.toFixed(1)} kg</strong></div>
            <div><span>Reserve</span><strong>{reserve.toFixed(1)} kg</strong></div>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="sectionHead">
          <div>
            <h2>Inventar & Grundausstattung</h2>
            <p>Besitz, Zuhause und Im Camper werden getrennt verwaltet.</p>
          </div>
          <div className="bulkButtons">
            <button onClick={() => setItems(i => i.map(x => ({...x, loaded: x.owned})))}>Alle einladen</button>
            <button className="secondary" onClick={() => setItems(i => i.map(x => ({...x, loaded: 0})))}>Alle ausladen</button>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead><tr>
              <th>Produkt</th><th>Gewicht</th><th>Besitz</th><th>Zuhause</th><th>Im Camper</th><th>Position</th><th>Grundausstattung</th><th>Aktion</th>
            </tr></thead>
            <tbody>
              {items.map(item => <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.weight.toFixed(1)} kg</td>
                <td>{item.owned}</td>
                <td>{item.owned - item.loaded}</td>
                <td>{item.loaded}</td>
                <td>{item.position}</td>
                <td>{item.basic ? 'Ja' : 'Nein'}</td>
                <td className="actions">
                  <button onClick={() => updateLoaded(item.id, 1)}>+1</button>
                  <button className="secondary" onClick={() => updateLoaded(item.id, -1)}>-1</button>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Neues Inventar-Produkt</h2>
        <div className="formGrid">
          <input placeholder="Produktname" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="Gewicht pro Stück" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} />
          <input placeholder="Besitz" type="number" min="1" value={owned} onChange={e => setOwned(e.target.value)} />
          <select value={position} onChange={e => setPosition(e.target.value)}>
            <option>Vorne</option><option>Mitte</option><option>Hinten</option><option>Deichselkasten</option><option>Heckträger</option>
          </select>
          <label className="checkRow"><input type="checkbox" checked={basic} onChange={e => setBasic(e.target.checked)} /> Grundausstattung</label>
          <button onClick={addItem}>Produkt hinzufügen</button>
        </div>
      </section>

      <section className="card">
        <h2>Rechtlicher Hinweis</h2>
        <p className="legal">
          Die von CampWeight berechneten Werte und Empfehlungen dienen ausschließlich der Orientierung.
          Die Verantwortung für ordnungsgemäße Beladung, gesetzliche Vorschriften und Verkehrssicherheit liegt beim Fahrzeugführer.
        </p>
      </section>
    </main>
  );
}
