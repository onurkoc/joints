# Deployment auf Cloudflare Pages

Die App ist statisch: Der Ordner `app/` wird so ausgeliefert, wie er im
Repo liegt. Es gibt keinen Build-Schritt und keinen Server.

| | |
| --- | --- |
| Hosting | Cloudflare Pages, eigenes Projekt nur für diese App |
| Projektname | `joints` |
| Repo | `github.com/onurkoc/joints` (öffentlich) |
| Produktions-Branch | `main` |
| Vorschau-Branch | `dev` |
| Build-Befehl | keiner |
| Ausgabeordner | `app` |
| Adresse (Ziel) | `https://joints.onurkoc.net/` |
| pages.dev-Adresse | `https://<projekt>.pages.dev/` |

`<projekt>` steht für den Namen, den Cloudflare dem Projekt gibt. Er ist
`joints`, kann aber ein Suffix bekommen (`joints-xyz`); er steht nach dem
Anlegen im Dashboard.

Die App liegt im Stamm der Subdomain, nicht in einem Unterpfad. Alle
Pfade in `app/` sind relativ, die App läuft deshalb auch unter jeder
Vorschau-Adresse.

`apps.onurkoc.net` ist eine separate Startseite in einem eigenen Repo
(`onurkoc/apps-landing`) und gehört nicht zu diesem Projekt.

## Stand

Noch nichts angelegt: Es gibt lokal nur den Branch `dev`, kein Remote und
kein Pages-Projekt. Die Schritte unten sind die Reihenfolge für später;
jeder einzelne braucht einen ausdrücklichen Auftrag.

## Reihenfolge

1. **Vor dem ersten Push prüfen, dass nichts Vertrauliches im öffentlichen
   Repo landet** (Abschnitt «Vertraulichkeit»). Das Repo ist öffentlich:
   Was einmal gepusht ist, bleibt in der Historie.
2. Repo `onurkoc/joints` auf GitHub anlegen (öffentlich, leer, ohne
   README und ohne Lizenzdatei, damit der erste Push ohne Konflikt geht).
3. Lokal Remote setzen, `main` aus `dev` anlegen, beide Branches pushen.
4. Cloudflare-Projekt anlegen (Abschnitt 1) und Branches einstellen
   (Abschnitt 2).
5. Vorschau auf `<projekt>.pages.dev` prüfen (Prüfliste unten).
6. Eigene Domain `joints.onurkoc.net` eintragen (Abschnitt 3).
7. Cache-Regel der Zone ergänzen (Abschnitt 4), Prüfliste auf der
   eigenen Domain wiederholen.

Die eigene Domain zeigt immer auf den Produktions-Branch. Sie wird
deshalb erst eingetragen, wenn `main` die geprüfte App enthält.

## Vertraulichkeit

Vor dem ersten Push, und danach vor jedem Merge nach `main`:

```sh
git ls-files
git log --all --name-only --format= | sort -u
```

Die erste Zeile zeigt, was versioniert ist, die zweite, was je
versioniert war (Historie). Beides darf keine Datei und keinen Ordner
enthalten, die in `.gitignore` unter «Vertraulich» stehen. In
Dateien und Commit-Texten kommen keine Projektnamen aus vertraulichen
Unterlagen und keine Namen kommerzieller Ingenieurprogramme vor:

```sh
git grep -n -i -E "<Name 1>|<Name 2>" $(git rev-list --all)
```

(die Namen aus den vertraulichen Unterlagen einsetzen; nicht in dieser
Datei aufschreiben). Die Muster stehen in `.gitignore`.

`CLAUDE.md` (Arbeitsregeln für die lokale Arbeit) ist in `.gitignore` und
nicht im Repo; sie bleibt nur lokal. Sie steht nicht in `git ls-files`.
Die frühere Historie wird nicht umgeschrieben: Frühere Commits enthalten
eine Fassung der Datei (nur Arbeitsregeln, keine vertraulichen Angaben).

## 1 Projekt anlegen (Cloudflare-Dashboard)

1. **Workers & Pages** öffnen, neues **Pages**-Projekt anlegen, Variante
   «mit Git verbinden» (Connect to Git).
2. GitHub-Konto verbinden und der Cloudflare-App den Zugriff auf das
   Repo `onurkoc/joints` geben (nur dieses Repo genügt).
3. Einstellungen des Projekts:

   | Feld | Wert |
   | --- | --- |
   | Projektname | `joints` |
   | Produktions-Branch | `main` |
   | Framework-Vorgabe | keine (None) |
   | Build-Befehl | leer lassen |
   | Build-Ausgabeordner | `app` |
   | Stammverzeichnis | leer lassen (Stamm des Repos) |
   | Umgebungsvariablen | keine |

4. Speichern und deployen.

## 2 Produktions- und Vorschau-Branch

1. Im Projekt: **Settings**, Abschnitt **Builds**, **Branch control**.
2. Production branch: `main`, automatische Deployments ein.
3. Preview branch: «Custom», Include `dev`.

Danach entsteht bei jedem Push auf `dev` ein Vorschau-Deployment, bei
jedem Push oder Merge auf `main` ein Produktions-Deployment.

Adressen eines Vorschau-Deployments:

- `https://<hash>.<projekt>.pages.dev/` – genau dieser Stand, bleibt.
- `https://dev.<projekt>.pages.dev/` – immer der neuste Stand von `dev`.

Vorschau-Adressen sendet Cloudflare mit `X-Robots-Tag: noindex`; sie
erscheinen nicht in Suchmaschinen.

Auf GitHub den Standard-Branch auf `main` stellen (Settings → General →
Default branch).

## 3 Eigene Domain (erst nach geprüfter Vorschau)

Voraussetzung: `onurkoc.net` liegt als Zone im selben Cloudflare-Konto.

1. Im Projekt: **Custom domains**, Domain einrichten.
2. `joints.onurkoc.net` eintragen und bestätigen.
3. Cloudflare legt den DNS-Eintrag (CNAME auf `<projekt>.pages.dev`)
   selbst an und stellt das Zertifikat aus. Warten, bis der Status
   «aktiv» ist.
4. `https://joints.onurkoc.net/` öffnen und die Prüfliste noch einmal
   durchgehen.

Den CNAME nicht von Hand im DNS anlegen, ohne die Domain im
Pages-Projekt einzutragen: Die Adresse antwortet dann mit einem Fehler.

## 4 Cache-Regel der Zone

Der Hostname `joints.onurkoc.net` wird in die bestehende Cache-Regel
«Pages-Apps: Header der Quelle» der Zone `onurkoc.net` aufgenommen.
Danach Punkt 2 der Prüfliste auf der eigenen Domain wiederholen.

## Cache-Regeln der App (`app/_headers`)

Cloudflare Pages liest die Datei `_headers` im Ausgabeordner.

| Dateien | Cache-Control | Wirkung |
| --- | --- | --- |
| `/`, `index.html`, `*.js`, `*.css`, `core/*.js`, `plots/*.js`, `ui/*.js` | `no-cache` | Der Browser fragt bei jedem Aufruf nach, ob die Datei neu ist. Eine neue Version erscheint beim normalen Neuladen. |

Es gibt keine Bibliotheken und keinen Ordner `vendor/`; alles ist
eigener Code, deshalb gilt überall dieselbe Regel.

Zwei Dinge, die beim Ändern zu beachten sind:

- **Die Regeln dürfen sich nicht überlappen.** Trifft mehr als eine
  Regel mit demselben Kopf auf eine Datei zu, hängt Cloudflare die Werte
  aneinander. Darum steht dort `/:file.js` (ein Name ohne `/`) und nicht
  `/*.js`. Ein neuer Unterordner in `app/` braucht eine eigene Regel.
  `tests/headers.test.js` prüft, dass jede Datei von genau einer Regel
  getroffen wird (`npm test` schlägt sonst fehl).
- **Die Datei `_headers` gilt nur auf Cloudflare Pages.** Lokal sendet
  `serve.mjs` für alle Dateien `Cache-Control: no-store`.

## Prüfliste nach dem Deployment

Zuerst auf der Vorschau, später noch einmal auf der eigenen Domain.
Vorher lokal: `npm test` und `node tests/browser/check.mjs` grün.

1. **Seite lädt.** Eingaben, Schmidtsches Netz, Querschnitt und
   Ergebnistabelle sind da, keine Meldung «The app could not be started».
2. **Köpfe.** In den Entwicklerwerkzeugen (F12, Netzwerk) oder mit
   `curl -I`:
   - die Seite selbst, `…/app.js`, `…/style.css`, `…/core/section.js`,
     `…/plots/stereonet.js`, `…/ui/inputs.js`: `Cache-Control: no-cache`,
     genau ein Wert.
   - `.js` kommt mit einem JavaScript-Typ (`Content-Type:
     text/javascript` oder `application/javascript`).
3. **Cache ohne Ctrl+F5.** Eine sichtbare Kleinigkeit ändern (z. B. den
   Text der Konventionszeile unter der Ergebnistabelle in
   `app/index.html`), committen, pushen, das neue Deployment abwarten. Die
   Seite **normal** neu laden (F5, nicht Ctrl+F5): Die neue Version
   erscheint. Danach die Änderung zurücknehmen.
4. **Standardwerte.** Tunnelrichtung 118°, B = 10 m, H = 8 m, drei Klüfte.
   Ergebnistabelle:

   | Joint | Dip dir / Dip | Apparent dip | Falls to | Apparent spacing [m] |
   | --- | --- | --- | --- | --- |
   | Kl 1b | 295/85 | 31° | right | 9.85 |
   | Kl 2b | 207/86 | 86° | right | 1.00 |
   | SS | 317/50 | 21° | left | 1.45 |

   Titel des Querschnitts: «… looking in tunnel direction (118°)»; links
   «left (028°)», rechts «right (208°)».
5. **Beschriftungen im Netz.** Keine Beschriftung überdeckt eine andere
   oder ragt über den Netzrand; Linien streichen keinen Text durch.
6. **Desktop.** Eingaben links, Netz und Querschnitt nebeneinander,
   Ergebnistabelle darunter.
7. **Phone.** Auf einem echten Handy öffnen: Eingaben oben, kein
   seitliches Scrollen, Netz vollständig sichtbar, Zahlentastatur in den
   Zahlenfeldern.
8. **Farbschema.** Umschalter oben rechts: «System» folgt dem
   Betriebssystem, «Light» und «Dark» erzwingen das Schema. Seite und
   Grafiken wechseln sofort. Nach dem Neuladen bleibt die Wahl erhalten
   (im Browser gespeichert, nicht im Link).
9. **Eingaben prüfen.** Einen Wert ungültig machen (z. B. Fallen 120):
   Fehlermeldung am Feld, nur das betroffene Element fehlt in den
   Grafiken, «Copy link» und Export sind gesperrt.
10. **Copy link.** Eingaben ändern, «Copy link», Link in einem neuen Fenster
    öffnen: dieselben Eingaben und Ergebnisse. «Reset to defaults» leert
    den Teil nach `#` in der Adresse.
11. **Export.** «SVG» und «PNG» je Grafik und «Export both (PNG)»: Dateien
    `joints_stereonet`, `joints_section`, `joints_both`. Immer hell auf
    weissem Grund, auch bei eingestelltem Dark. Das SVG lässt sich ohne die
    Seite in einem anderen Programm öffnen und sieht gleich aus.
12. **Konsole** (F12): keine Fehler, keine Anfrage an fremde Adressen
    (alles kommt von der eigenen Adresse, kein CDN).

## Später

- Neue Version veröffentlichen: Merge oder Push auf `main`, Cloudflare
  deployt selbst. Zurück auf einen alten Stand: im Dashboard beim
  gewünschten Deployment «Rollback».
- Die Startseite `apps.onurkoc.net` bekommt eine Karte für diese App
  (eigenes Repo, eigener Schritt).
