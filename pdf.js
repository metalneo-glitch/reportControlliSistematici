/* ========================================================================== */
/* PDF UTILITIES - extracted from app.js                                       */
/* ========================================================================== */


let logoDataUrl = undefined;    // cache logo per PDF

/* 14) PDF                                                                     */
/* ========================================================================== */

async function generatePdf(isBlank) {
  if (!model) return;

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("jsPDF non caricato. Controlla libs/jspdf.umd.min.js e l’ordine degli script.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const centrale = model.meta.centraleNome || "";
  const anno = model.meta.anno || "";
  const preposto = model.meta.preposto || "";
  const operatori = (model.meta.operatori || "").trim();
  const dataInizio = model.meta.dataInizio || "";
  const dataFine = model.meta.dataFine || "";

  // --- HEADER: prima scriviamo SEMPRE testo (così non esce mai vuoto) ---
  doc.setFontSize(14);
  doc.text(`Controlli sistematici - ${centrale} (${anno})`, 14, 16);

  doc.setFontSize(10);
  doc.text(`Preposto: ${preposto}`, 14, 22);
  if (operatori) {
    doc.text(`Operatori: ${operatori}`, 14, 27);
  }
  else {
    doc.text(`Operatori: ${preposto}`, 14, 27);
  }
  doc.text(`Periodo: ${dataInizio}  ${dataFine ? "-> " + dataFine : ""}`, 14, 32);

  doc.setDrawColor(200);
  doc.line(14, 39, 196, 39);


  // --- LOGO ---
  try {
    const dataUrl = await loadLogoDataUrl();
    if (dataUrl) {
      doc.addImage(dataUrl, "JPEG", 175, 10, 25, 18);
    }
  } catch (e) {
    console.warn("Logo non inserito:", e);
  }

  let y = 45;
  const canAutoTable = typeof doc.autoTable === "function";

  for (const section of sortByOrder(model.sezioni)) {
    const items = sortByOrder(section.items || []);
    if (y > 270) { doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.text(section.titolo, 14, y);
    y += 4;

    if (canAutoTable) {
      const rows = items.map(it => {
        const st = isBlank ? "" : (it.stato || "todo");
        const box = stateToBox(st);
        const note = isBlank ? "" : (it.note || "");
        return [box, it.testo, note];
      });

      doc.autoTable({
        startY: y,
        head: [["", "Controllo", "Note"]],
        body: rows,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 110 },
          2: { cellWidth: 60 }
        }

      });

      y = doc.lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(10);
      for (const it of items) {
        if (y > 280) { doc.addPage(); y = 20; }
        const st = isBlank ? "" : (it.stato || "todo"); doc.text(`${stateToBox(st)} ${it.testo}`, 14, y);
        y += 5;
        if (!isBlank && it.note) {
          doc.setFontSize(9);
          doc.text(`Note: ${it.note}`, 18, y);
          y += 5;
          doc.setFontSize(10);
        }
      }
      y += 6;
    }
  }

  const pageCount = doc.getNumberOfPages();
  const gen = new Date().toLocaleString();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generato: ${gen}`, 14, 290);
    doc.text(`Pagina ${i}/${pageCount}`, 180, 290);
    doc.setTextColor(0);
  }

  const safeNome = (centrale || "CENTRALE")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");

  const fileName = isBlank
    ? `${safeNome}_${anno}_modulo_vuoto.pdf`
    : `${safeNome}_${anno}_stato.pdf`;

  doc.save(fileName);
}

function stateToBox(state) {
  // simboli semplici, stampabili
  // todo -> vuoto
  if (state === "ok") return "[x]";
  if (state === "ko") return "[!]";
  if (state === "na") return "[-]";
  return "[ ]";
}

function loadLogoDataUrl() {
  return new Promise((resolve) => {
    if (logoDataUrl !== undefined) return resolve(logoDataUrl);

    // NOTE: se cambi logo.jpg, rigenera assets/logo.inline.js con:
    // ./assets/update-logo-base64dataurl.sh
    if (window.LOGO_DATA_URL) {
      logoDataUrl = window.LOGO_DATA_URL;
      return resolve(logoDataUrl);
    }

    logoDataUrl = null;
    resolve(null);
  });
}

/* ========================================================================== */
