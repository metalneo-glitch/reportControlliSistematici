# Report Controlli Sistematici

Questo progetto nasce per gestire i **controlli sistematici annuali** delle centrali idroelettriche.

L’obiettivo è sostituire:
- file Excel unici che crescono all’infinito
- mail lunghe e poco strutturate
- appunti sparsi tra carta e PC

con uno strumento **semplice, locale e robusto**, utilizzabile anche da personale non tecnico.

Non richiede installazioni, server o connessione internet.

---

## Caratteristiche principali

- Tutto **offline**, funziona anche con doppio click
- Un file **HTML + JS**
- Salvataggio dati in **JSON**
- Struttura per **sezioni e checklist**
- Stati chiari per ogni controllo (OK / KO / NA / TODO)
- Note obbligatorie in caso di KO
- Generazione PDF:
  - modulo vuoto (per stampa e compilazione a mano)
  - stato attuale (per report finale)
- Pensato per uso **collaborativo su NAS**
- Codice leggibile, niente framework

---

## Filosofia del progetto

- Un file JSON = **una centrale + un anno**
- Il preposto lavora su un file unico
- Gli operatori compilano sul campo anche su carta
- I dati vengono poi integrati nella pagina
- Nessun tracciamento inutile “per controllo”
- Gli operatori sono **globali** per l’intervento, non per singolo check

---

## Struttura del progetto

