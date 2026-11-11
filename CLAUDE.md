# Joints – Regeln für Claude Code

## Rollen
- Onur entscheidet fachlich. Claude (Chat) plant und prüft. Claude Code setzt um.
- Keine fachliche Vorgabe, Konvention oder Bedienlogik ohne Rückfrage ändern.
  Bei Unklarheit: anhalten und fragen, nicht raten.

## Technik
- Statische Seite, kein Build, kein Framework, kein Server. Ausgabeordner: app/
- Vanilla JS als ES-Module, JSDoc-Typen, // @ts-check in jeder Datei.
- Rechenkern in app/core/ ohne DOM-Zugriff, reine Funktionen.
- Grafik als eigenes SVG. Keine Plot-Bibliothek, keine externen Abhängigkeiten zur Laufzeit.
- Tests mit node --test im Ordner tests/, Aufruf über npm test.
- Git: Arbeit auf Branch dev. Kein Push und kein Remote ohne Auftrag.

## Vertraulich
- Dateien *.gh, *.3dm, *.3dmbak und Ordner legacy/ und References/ nie versionieren
  (.gitignore). Projektnamen aus solchen Dateien nirgends nennen.
- Keine kommerziellen Programme namentlich in App oder Repo erwähnen.

## Fachliche Konventionen (verbindlich)
- Alle Winkel in Grad. Azimut im Uhrzeigersinn ab Nord, 0…360.
- Koordinaten: x = Ost, y = Nord, z = oben.
- Kluft: Fallrichtung (0…360) und Fallen (0…90). Abstand in m, senkrecht zur Kluftfläche.
- Netz: flächentreu (Schmidt), untere Halbkugel, Nord oben.
  Linie mit Richtung t und Eintauchen p: r = R·√2·sin((90°−p)/2), x = r·sin t, y = r·cos t.
  Pol der Kluft: Richtung = Fallrichtung + 180°, Eintauchen = 90° − Fallen.
- Tunnel: horizontal, Tunnelrichtung A = Vortriebsrichtung.
- Querschnitt: senkrecht zur Tunnelachse, Blick in Tunnelrichtung.
  Bildachse nach rechts = Azimut A + 90°, Bildachse nach oben = z.
- Scheinbares Fallen im Querschnitt: tan β = tan α · sin(Fallrichtung − A).
  β > 0 bedeutet: Spur fällt nach rechts. Ausgabe: Betrag und Seite (links/rechts).
- Scheinbarer Abstand im Querschnitt: s' = s / sin θ, θ = Winkel zwischen Kluftnormale
  und Tunnelachse. Bei sin θ < 0.02 liegt die Kluft praktisch parallel zum Schnitt:
  keine Spuren, stattdessen ein Hinweis.
- Hufeisenprofil: Breite B, Höhe H, flache Sohle bei z = 0, senkrechte Ulmen bis
  H − B/2, Halbkreis-Kalotte mit Radius B/2. Bedingung H ≥ B/2. Standard B = 10 m, H = 8 m.
- Spurenschar: parallele Geraden im Abstand s', eine davon durch die Profilmitte (0, H/2).

## Oberfläche
- Sprache der Oberfläche: Englisch. Der Rechenkern liefert side 'rechts'/'links'/null;
  die Oberfläche übersetzt in «right» / «left» / «horizontal» / «vertical».
- Anzeige: scheinbares Fallen auf ganze Grad, Abstände auf 0.01 m.
- Maximal 5 Klüfte. Farben in dieser Reihenfolge: grün, rot, blau, orange, türkis.
  Tunnel: violett.
- Beschriftung einer Kluft: Name, dann Fallrichtung/Fallen, z. B. «Kl 1b 295/85».
- Umschalter System / Light / Dark. Alle Farben über CSS-Variablen, auch im SVG.
- Browser-Check: einmal je Auftrag, am Ende nach der letzten Änderung.
  Schlägt er fehl: korrigieren und genau einen weiteren Lauf machen. Keine Serien.
- Kluftbeschriftung dreistellig/zweistellig (Fallrichtung/Fallen), z. B. «007/05».
- Export immer im hellen Farbschema auf weissem Grund, unabhängig vom Theme.
