# CampWeight

Next.js-Web-App mit Supabase-Anmeldung und erster Cloud-Synchronisation des Campers.

## Einrichtung

1. Node.js 20 oder neuer installieren.
2. `.env.example` nach `.env.local` kopieren.
3. In `.env.local` den Supabase-Publishable-Key einsetzen.
4. Abhängigkeiten installieren und starten:

```bash
npm install
npm run dev
```

Die App ist dann unter `http://localhost:3000` erreichbar.

## Supabase

Benötigt das CampWeight-Schema v1 mit aktivem Row Level Security. Beim ersten Login wird der lokale Standard-Camper in `campers` angelegt; spätere Änderungen an Name, Fahrzeugtyp, Basisgewicht und zGG werden automatisch gespeichert.

Für E-Mail-Bestätigungen muss in Supabase unter **Authentication → URL Configuration** mindestens `http://localhost:3000` als Site URL beziehungsweise Redirect URL erlaubt sein. Vor der Veröffentlichung ist dort zusätzlich die Produktionsdomain einzutragen.
