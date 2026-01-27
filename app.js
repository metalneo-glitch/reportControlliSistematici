/* ==========================================================================
   CONTROLLI SISTEMATICI - app.js
   Offline, file-based, zero framework.

   Funzioni principali:
   - Import JSON / Export JSON
   - Render sezioni + controlli (dinamico da JSON)
   - Stati: todo / ok / ko / na (KO => note obbligatorie)
   - CRUD: aggiungi/rinomina/sposta/elimina controlli e sezioni
   - PDF: modulo vuoto / stato attuale
   ========================================================================== */

/* ========================================================================== */
/* 01) STATE                                                                  */
/* ========================================================================== */

let model = null;          // JSON in memoria
let openedFileName = "";   // per suggerire il nome in export


/* ========================================================================== */
/* 02) DATE & IDS                                                              */
/* ========================================================================== */

function collectAllIds(m) {
  const set = new Set();
  for (const s of m.sezioni || []) {
    set.add(s.id);
    for (const it of s.items || []) set.add(it.id);
  }
  return set;
}

function makeId(prefix) {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  const rnd = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${y}${m}${day}_${hh}${mm}${ss}_${rnd}`;
}

function makeUniqueId(prefix, existingSet) {
  let id = makeId(prefix);
  while (existingSet.has(id)) id = makeId(prefix);
  existingSet.add(id);
  return id;
}

function nowIso() {
  return new Date().toISOString();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function sortByOrder(arr) {
  return [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/* ========================================================================== */
/* 03) UI ENABLE / SUBTITLE                                                    */
/* ========================================================================== */

function enableUi(enabled) {
  const ids = [
    "btnSave", "btnClose", "btnResetStates", "btnPdfBlank", "btnPdfState",
    "btnExpandAll", "btnCollapseAll", "btnAddSection",
    "metaCentraleNome", "metaAnno", "metaPreposto",
    "metaDataInizio", "metaDataFine", "metaNoteGenerali",
    "metaOperatori"
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.tagName === "BUTTON") el.disabled = !enabled;
    else el.disabled = !enabled;
  }
}

function updateSubtitle() {
  const sub = document.getElementById("subtitle");
  const nome = model.meta.centraleNome || "(centrale non impostata)";
  const anno = model.meta.anno || "";
  sub.textContent = `${nome} | ${anno} | File: ${openedFileName || "non salvato"}`;
}

function setSubtitleEmpty() {
  const sub = document.getElementById("subtitle");
  if (sub) sub.textContent = "Apri un file JSON per iniziare.";
}

/* ========================================================================== */
/* 04) MODEL VALIDATION / NORMALIZATION                                        */
/* ========================================================================== */

function normalizeModel(m) {
  // Normalizzazione minima per evitare undefined e per garantire funzioni UI (riordino, ecc.)
  m.app = m.app || { schemaVersion: 1 };
  m.meta = m.meta || {};
  m.sezioni = Array.isArray(m.sezioni) ? m.sezioni : [];
  m.audit = m.audit || {};

  // Se mancano order (file vecchi), li assegniamo in base all'ordine corrente dell'array
  let secOrder = 10;

  for (const s of m.sezioni) {
    // id/titolo/order
    if (!s.id) s.id = makeUniqueId("sec", collectAllIds(m)); // fallback raro
    if (s.titolo === undefined) s.titolo = "";
    if (s.order === undefined || s.order === null || Number.isNaN(Number(s.order))) {
      s.order = secOrder;
    } else {
      s.order = Number(s.order);
    }
    secOrder = Math.max(secOrder, s.order) + 10;

    // items
    s.items = Array.isArray(s.items) ? s.items : [];
    let itemOrder = 10;
    const itemOrders = [];
    let needsReorder = false;

    for (const it of s.items) {
      if (!it.id) it.id = makeUniqueId("itm", collectAllIds(m));
      if (it.testo === undefined) it.testo = "";

      if (!it.stato) it.stato = "todo";
      if (it.note === undefined) it.note = "";
      if (it.photoDataUrl === undefined) it.photoDataUrl = "";
      if (it.photoName === undefined) it.photoName = "";
      if (it.timestamp === undefined) it.timestamp = "";

      if (it.order === undefined || it.order === null || Number.isNaN(Number(it.order))) {
        it.order = itemOrder;
        needsReorder = true;
      } else {
        it.order = Number(it.order);
      }
      itemOrders.push(it.order);
      itemOrder = Math.max(itemOrder, it.order) + 10;
    }

    if (!needsReorder) {
      const uniq = new Set(itemOrders);
      if (uniq.size !== itemOrders.length) needsReorder = true;
    }

    if (needsReorder && s.items.length) {
      let order = 10;
      for (const it of s.items) {
        it.order = order;
        order += 10;
      }
    }
  }

  return m;
}

function validateModel(m) {
  if (!m || typeof m !== "object") return "JSON non valido.";
  if (!m.meta || !m.sezioni) return "Mancano meta o sezioni.";
  if (!Array.isArray(m.sezioni)) return "sezioni deve essere un array.";
  return "";
}

/* ========================================================================== */
/* 05) AUDIT                                                                   */
/* ========================================================================== */

function touchAudit() {
  if (!model.audit) model.audit = {};
  model.audit.lastModified = nowIso();
  model.audit.lastModifiedBy = (model.meta.operatori || model.meta.preposto || "").trim();
}

/* ========================================================================== */
/* 06) META BINDING                                                            */
/* ========================================================================== */

function bindMeta() {
  const fields = [
    ["metaCentraleNome", "centraleNome"],
    ["metaAnno", "anno"],
    ["metaPreposto", "preposto"],
    ["metaOperatori", "operatori"],
    ["metaDataInizio", "dataInizio"],
    ["metaDataFine", "dataFine"],
    ["metaNoteGenerali", "noteGenerali"]
  ];
  for (const [id, key] of fields) {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      if (!model) return;
      model.meta[key] = (key === "anno") ? Number(el.value) : el.value;
      touchAudit();
      updateSubtitle();
    });
  }
}


function renderMeta() {
  document.getElementById("metaCentraleNome").value = model.meta.centraleNome ?? "";
  document.getElementById("metaAnno").value = model.meta.anno ?? "";
  document.getElementById("metaPreposto").value = model.meta.preposto ?? "";
  document.getElementById("metaOperatori").value = model.meta.operatori || "";
  document.getElementById("metaDataInizio").value = model.meta.dataInizio ?? "";
  document.getElementById("metaDataFine").value = model.meta.dataFine ?? "";
  document.getElementById("metaNoteGenerali").value = model.meta.noteGenerali ?? "";
}

function clearMetaInputs() {
  document.getElementById("metaCentraleNome").value = "";
  document.getElementById("metaAnno").value = "";
  document.getElementById("metaPreposto").value = "";
  document.getElementById("metaOperatori").value = "";
  document.getElementById("metaDataInizio").value = "";
  document.getElementById("metaDataFine").value = "";
  document.getElementById("metaNoteGenerali").value = "";
}

/* ========================================================================== */
/* 07) SECTION STATS / PROGRESS                                                */
/* ========================================================================== */

function computeSectionBadges(section) {
  const counts = { todo: 0, ok: 0, ko: 0, na: 0 };
  for (const it of section.items || []) {
    const st = it.stato || "todo";
    if (counts[st] === undefined) counts.todo++;
    else counts[st]++;
  }
  return counts;
}

function computeSectionProgress(section) {
  const total = (section.items || []).length;
  if (total === 0) return { total: 0, done: 0, pct: 0 };

  let done = 0;
  for (const it of section.items) {
    const st = it.stato || "todo";
    if (st !== "todo") done++;
  }
  const pct = Math.round((done / total) * 100);
  return { total, done, pct };
}

function makeBadge(kind, text) {
  const span = document.createElement("span");
  span.className = `badge ${kind}`;
  span.textContent = text;
  return span;
}

function makeProgressNode(pct) {
  const wrap = document.createElement("div");
  wrap.className = "progress";

  const bar = document.createElement("div");
  bar.style.width = `${pct}%`;

  wrap.appendChild(bar);
  return wrap;
}

function computeGlobalProgress() {
  if (!model || !Array.isArray(model.sezioni)) {
    return { done: 0, total: 0, pct: 0, ok: 0, ko: 0, todo: 0, na: 0 };
  }

  let ok = 0, ko = 0, todo = 0, na = 0;

  for (const s of model.sezioni) {
    for (const it of (s.items || [])) {
      const st = (it.stato || "todo");
      if (st === "ok") ok++;
      else if (st === "ko") ko++;
      else if (st === "na") na++;
      else todo++;
    }
  }

  // escludo NA dal totale "applicabile"
  const total = ok + ko + todo;
  const done = ok + ko;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return { done, total, pct, ok, ko, todo, na };
}

function renderGlobalProgress() {
  const fill = document.getElementById("globalProgressFill");
  const txt = document.getElementById("globalProgressText");
  const counts = document.getElementById("globalProgressCounts");

  if (!fill || !txt || !counts) return;

  const p = computeGlobalProgress();
  fill.style.width = `${p.pct}%`;
  txt.textContent = `${p.pct}%`;
  counts.textContent = p.total > 0
    ? `(${p.done}/${p.total} completati, NA: ${p.na})`
    : `(nessun controllo)`;
}


/* ========================================================================== */
/* 08) FINDERS                                                                 */
/* ========================================================================== */

function findItem(sectionId, itemId) {
  const s = findSection(sectionId);
  if (!s) return null;
  return (s.items || []).find(it => it.id === itemId);
}

function findSection(sectionId) {
  return model.sezioni.find(s => s.id === sectionId);
}

/* ========================================================================== */
/* 09) RENDER CORE                                                             */
/* ========================================================================== */

function getOpenSectionIds() {
  return Array.from(document.querySelectorAll("details.section"))
    .filter(d => d.open)
    .map(d => d.dataset.sectionId);
}

function makeStateButton(kind, label, isActive, onClick) {
  const b = document.createElement("button");
  b.className = `state-btn kind-${kind}` + (isActive ? " active" : "");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function openSection(sectionId) {
  const el = document.querySelector(`details.section[data-section-id="${sectionId}"]`);
  if (el) el.open = true;
}

function renderItem(sectionId, itemId) {
  const item = findItem(sectionId, itemId);

  const wrap = document.createElement("div");
  wrap.className = "item";
  wrap.dataset.itemId = item.id;

  const grid = document.createElement("div");
  grid.className = "item-grid";

  // --- Riga titolo + strumenti (a destra del titolo) ---
  const titleRow = document.createElement("div");
  titleRow.className = "item-title-row";

  const titleLeft = document.createElement("div");
  titleLeft.className = "item-title-left";

  const text = document.createElement("div");
  text.className = "item-text";
  text.textContent = item.testo;

  titleLeft.appendChild(text);

  const tools = document.createElement("div");
  tools.className = "item-tools";

  const btnUp = document.createElement("button");
  btnUp.className = "icon-btn";
  btnUp.type = "button";
  btnUp.title = "Sposta su";
  btnUp.textContent = "⬆️";
  btnUp.disabled = !canMove(sectionId, itemId, "up");
  btnUp.addEventListener("click", () => moveItem(sectionId, itemId, "up"));

  const btnDown = document.createElement("button");
  btnDown.className = "icon-btn";
  btnDown.type = "button";
  btnDown.title = "Sposta giù";
  btnDown.textContent = "⬇️";
  btnDown.disabled = !canMove(sectionId, itemId, "down");
  btnDown.addEventListener("click", () => moveItem(sectionId, itemId, "down"));

  const btnEdit = document.createElement("button");
  btnEdit.className = "icon-btn";
  btnEdit.type = "button";
  btnEdit.title = "Rinomina";
  btnEdit.textContent = "✏️";
  btnEdit.addEventListener("click", () => renameItem(sectionId, itemId));

  const btnDel = document.createElement("button");
  btnDel.className = "icon-btn danger";
  btnDel.type = "button";
  btnDel.title = "Elimina";
  btnDel.textContent = "🗑️";
  btnDel.addEventListener("click", () => deleteItem(sectionId, itemId));

  tools.appendChild(btnEdit);
  tools.appendChild(btnUp);
  tools.appendChild(btnDown);
  tools.appendChild(btnDel);

  titleRow.appendChild(titleLeft);
  titleRow.appendChild(tools);

  // --- Note ---
  const note = document.createElement("textarea");
  note.className = "note";
  note.rows = 2;
  note.placeholder = "Note (obbligatorie se KO)";
  note.value = item.note ?? "";
  if ((item.stato || "todo") === "ko" && !note.value.trim()) {
    note.classList.add("required");
  }

  note.addEventListener("input", () => {
    const it = findItem(sectionId, itemId);
    it.note = note.value;

    if (it.stato === "ko") {
      if (!it.note.trim()) note.classList.add("required");
      else note.classList.remove("required");
    }

    it.timestamp = nowIso();
    touchAudit();
  });

  // --- Stati: in fondo a destra ---
  const footer = document.createElement("div");
  footer.className = "item-footer";

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const st = item.stato || "todo";
  actions.appendChild(makeStateButton("todo", "Da fare", st === "todo", () => setState(sectionId, itemId, "todo")));
  actions.appendChild(makeStateButton("ok", "OK", st === "ok", () => setState(sectionId, itemId, "ok")));
  actions.appendChild(makeStateButton("ko", "KO", st === "ko", () => setState(sectionId, itemId, "ko")));
  actions.appendChild(makeStateButton("na", "N.A.", st === "na", () => setState(sectionId, itemId, "na")));

  footer.appendChild(actions);

  // --- Allegato foto (1 per controllo) ---
  const attachment = document.createElement("div");
  attachment.className = "item-attachment";

  const photoInput = document.createElement("input");
  photoInput.type = "file";
  photoInput.accept = "image/*";
  photoInput.className = "item-photo-input";
  photoInput.title = "Allega una foto";
  photoInput.hidden = true;

  const photoBox = document.createElement("button");
  photoBox.type = "button";
  photoBox.className = "item-photo-box";
  photoBox.title = "Aggiungi foto";
  photoBox.innerHTML = "<span class=\"item-photo-icon\">📷</span><span class=\"item-photo-text\">Aggiungi foto</span>";
  photoBox.addEventListener("click", () => photoInput.click());

  const photoLabel = document.createElement("span");
  photoLabel.className = "item-photo-label";
  photoLabel.textContent = item.photoName ? `Foto: ${item.photoName}` : "Nessuna foto allegata";

  const photoPreview = document.createElement("img");
  photoPreview.className = "item-photo-preview";
  photoPreview.alt = "Anteprima foto";
  if (item.photoDataUrl) {
    photoPreview.src = item.photoDataUrl;
    photoPreview.style.display = "block";
    photoBox.innerHTML = "";
    photoBox.appendChild(photoPreview);
    photoBox.classList.add("has-photo");
  } else {
    photoPreview.style.display = "none";
  }

  const btnClearPhoto = document.createElement("button");
  btnClearPhoto.type = "button";
  btnClearPhoto.className = "item-photo-clear";
  btnClearPhoto.textContent = "×";
  btnClearPhoto.title = "Rimuovi foto";
  btnClearPhoto.style.display = item.photoDataUrl ? "inline-flex" : "none";
  btnClearPhoto.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  btnClearPhoto.addEventListener("click", () => {
    const it = findItem(sectionId, itemId);
    it.photoDataUrl = "";
    it.photoName = "";
    photoPreview.src = "";
    photoPreview.style.display = "none";
    photoBox.innerHTML = "<span class=\"item-photo-icon\">📷</span><span class=\"item-photo-text\">Aggiungi foto</span>";
    photoBox.appendChild(btnClearPhoto);
    photoBox.classList.remove("has-photo");
    photoLabel.textContent = "Nessuna foto allegata";
    btnClearPhoto.style.display = "none";
    touchAudit();
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const it = findItem(sectionId, itemId);
      it.photoDataUrl = String(reader.result || "");
      it.photoName = file.name || "foto";
      photoPreview.src = it.photoDataUrl;
      photoPreview.style.display = "block";
      photoBox.innerHTML = "";
      photoBox.appendChild(photoPreview);
      photoBox.appendChild(btnClearPhoto);
      photoBox.classList.add("has-photo");
      photoLabel.textContent = `Foto: ${it.photoName}`;
      btnClearPhoto.style.display = "inline-flex";
      touchAudit();
    };
    reader.readAsDataURL(file);
    photoInput.value = "";
  });

  attachment.appendChild(photoInput);
  photoBox.appendChild(btnClearPhoto);
  attachment.appendChild(photoBox);
  attachment.appendChild(photoLabel);

  grid.appendChild(titleRow);
  grid.appendChild(note);
  grid.appendChild(attachment);
  grid.appendChild(footer);

  wrap.appendChild(grid);
  return wrap;
}

function renderSections(openSet = new Set()) {
  const container = document.getElementById("sections");
  container.innerHTML = "";

  const sectionsSorted = sortByOrder(model.sezioni);

  if (sectionsSorted.length === 0) {
    container.innerHTML = `<div class="empty-hint">Nessuna sezione presente.</div>`;
    return;
  }

  for (const section of sectionsSorted) {
    // --- wrapper sezione ---
    const details = document.createElement("details");
    details.className = "section";
    details.dataset.sectionId = section.id;
    details.open = openSet.has(section.id);

    // --- summary ---
    const summary = document.createElement("summary");

    // ====== LEFT: titolo + tools sezione ======
    const left = document.createElement("div");
    left.className = "section-title";

    const titleText = document.createElement("div");
    titleText.className = "section-title-text";
    titleText.textContent = section.titolo;

    const secTools = document.createElement("div");
    secTools.className = "section-tools";

    const sEdit = document.createElement("button");
    sEdit.className = "icon-btn";
    sEdit.type = "button";
    sEdit.title = "Rinomina sezione";
    sEdit.textContent = "✏️";
    sEdit.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      renameSection(section.id);
    });

    const sUp = document.createElement("button");
    sUp.className = "icon-btn";
    sUp.type = "button";
    sUp.title = "Sposta sezione su";
    sUp.textContent = "⬆️";
    sUp.disabled = !canMoveSection(section.id, "up");
    sUp.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveSection(section.id, "up");
    });

    const sDown = document.createElement("button");
    sDown.className = "icon-btn";
    sDown.type = "button";
    sDown.title = "Sposta sezione giù";
    sDown.textContent = "⬇️";
    sDown.disabled = !canMoveSection(section.id, "down");
    sDown.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveSection(section.id, "down");
    });

    const sDel = document.createElement("button");
    sDel.className = "icon-btn danger";
    sDel.type = "button";
    sDel.title = "Elimina sezione (perde i controlli figli)";
    sDel.textContent = "🗑️";
    sDel.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteSectionDangerous(section.id);
    });

    secTools.appendChild(sEdit);
    secTools.appendChild(sUp);
    secTools.appendChild(sDown);
    secTools.appendChild(sDel);

    left.appendChild(titleText);
    left.appendChild(secTools);
    // ====== /LEFT ======

    // --- RIGHT: progress ---
    const prog = computeSectionProgress(section);
    const right = document.createElement("div");
    right.className = "summary-right";

    const progLabel = document.createElement("div");
    progLabel.className = "progress-label";
    progLabel.textContent = `${prog.done}/${prog.total} (${prog.pct}%)`;

    const progBar = makeProgressNode(prog.pct);

    right.appendChild(progLabel);
    right.appendChild(progBar);

    // --- badges ---
    const badges = document.createElement("div");
    badges.className = "badges";
    const c = computeSectionBadges(section);
    badges.appendChild(makeBadge("todo", `Da fare ${c.todo}`));
    badges.appendChild(makeBadge("ok", `OK ${c.ok}`));
    badges.appendChild(makeBadge("ko", `KO ${c.ko}`));
    badges.appendChild(makeBadge("na", `N.A. ${c.na}`));

    summary.appendChild(left);
    summary.appendChild(right);
    summary.appendChild(badges);

    // --- body ---
    const body = document.createElement("div");
    body.className = "section-body";

    // azioni sezione nel body
    const rowActions = document.createElement("div");
    rowActions.className = "row-actions";

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-small";
    addBtn.textContent = "+ Aggiungi controllo";
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addControl(section.id);
      openSection(section.id);
    });

    const small = document.createElement("div");
    small.className = "small-muted";
    small.textContent = "KO richiede note obbligatorie.";

    rowActions.appendChild(addBtn);
    rowActions.appendChild(small);
    body.appendChild(rowActions);

    // items
    const itemsSorted = sortByOrder(section.items || []);
    for (const item of itemsSorted) {
      body.appendChild(renderItem(section.id, item.id));
    }

    details.appendChild(summary);
    details.appendChild(body);
    container.appendChild(details);
  }
}

function rerenderAll() {
  // salva quali sezioni sono aperte (prima che la UI venga ricreata)
  const openIds = getOpenSectionIds();
  const openSet = new Set(openIds);

  updateSubtitle();
  renderMeta();
  renderGlobalProgress();
  renderSections(openSet);
}

/* ========================================================================== */
/* 10) ADD / EDIT ITEMS & SECTIONS                                             */
/* ========================================================================== */

function addControl(sectionId) {
  const section = findSection(sectionId);
  if (!section) return;

  const testo = prompt(`Nuovo controllo in "${section.titolo}":`);
  if (!testo || !testo.trim()) return;

  const existing = collectAllIds(model);
  const newId = makeUniqueId("itm", existing);

  const maxOrder = Math.max(0, ...(section.items || []).map(it => it.order ?? 0));
  section.items = section.items || [];
  section.items.push({
    id: newId,
    testo: testo.trim(),
    order: maxOrder + 10,
    stato: "todo",
    note: "", timestamp: ""
  });

  touchAudit();
  rerenderAll();
  openSection(sectionId);
}

function addSection() {
  const titolo = prompt("Titolo nuova sezione:");
  if (!titolo || !titolo.trim()) return;

  const existing = collectAllIds(model);
  const newId = makeUniqueId("sec", existing);

  const maxOrder = Math.max(0, ...model.sezioni.map(s => s.order ?? 0));
  model.sezioni.push({
    id: newId,
    titolo: titolo.trim(),
    order: maxOrder + 10,
    items: []
  });

  touchAudit();
  rerenderAll();
  openSection(newId);
}

function canMove(sectionId, itemId, direction) {
  const s = findSection(sectionId);
  if (!s || !Array.isArray(s.items)) return false;

  const itemsSorted = sortByOrder(s.items);
  const idx = itemsSorted.findIndex(x => x.id === itemId);
  if (idx < 0) return false;

  if (direction === "up") return idx > 0;
  return idx < itemsSorted.length - 1;
}

function deleteItem(sectionId, itemId) {
  const s = findSection(sectionId);
  if (!s || !Array.isArray(s.items)) return;

  const it = findItem(sectionId, itemId);
  if (!it) return;

  const ok = confirm(`Eliminare questo controllo?\n\n- ${it.testo}`);
  if (!ok) return;

  s.items = s.items.filter(x => x.id !== itemId);

  touchAudit();
  rerenderAll();
}

function moveItem(sectionId, itemId, direction) {
  const s = findSection(sectionId);
  if (!s || !Array.isArray(s.items)) return;

  const itemsSorted = sortByOrder(s.items);
  const idx = itemsSorted.findIndex(x => x.id === itemId);
  if (idx < 0) return;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= itemsSorted.length) return;

  const a = itemsSorted[idx];
  const b = itemsSorted[swapIdx];

  // scambio order (semplice, stabile)
  const ao = a.order ?? 0;
  const bo = b.order ?? 0;
  a.order = bo;
  b.order = ao;

  touchAudit();
  rerenderAll();
}

function renameItem(sectionId, itemId) {
  const it = findItem(sectionId, itemId);
  if (!it) return;

  const nuovo = prompt("Rinomina controllo:", it.testo || "");
  if (nuovo === null) return; // annullato
  const txt = nuovo.trim();
  if (!txt) return;

  it.testo = txt;
  it.timestamp = nowIso();
  touchAudit();
  rerenderAll();
}

/* ========================================================================== */
/* 11) SECTION ACTIONS                                                         */
/* ========================================================================== */

function canMoveSection(sectionId, direction) {
  const sectionsSorted = sortByOrder(model.sezioni);
  const idx = sectionsSorted.findIndex(x => x.id === sectionId);
  if (idx < 0) return false;
  if (direction === "up") return idx > 0;
  return idx < sectionsSorted.length - 1;
}

function deleteSectionDangerous(sectionId) {
  const s = findSection(sectionId);
  if (!s) return;

  const count = (s.items || []).length;

  const msg =
    `ATTENZIONE: eliminerai la sezione "${s.titolo}"\n` +
    `e perderai anche ${count} controlli figli.\n\n` +
    `Per confermare, scrivi esattamente: elimina`;

  const typed = prompt(msg, "");
  if (typed === null) return;

  if (typed.trim().toLowerCase() !== "elimina") {
    alert("Conferma non valida. Nessuna modifica effettuata.");
    return;
  }

  model.sezioni = model.sezioni.filter(x => x.id !== sectionId);

  touchAudit();
  rerenderAll();
}

function moveSection(sectionId, direction) {
  const sectionsSorted = sortByOrder(model.sezioni);
  const idx = sectionsSorted.findIndex(x => x.id === sectionId);
  if (idx < 0) return;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sectionsSorted.length) return;

  const a = sectionsSorted[idx];
  const b = sectionsSorted[swapIdx];

  const ao = a.order ?? 0;
  const bo = b.order ?? 0;
  a.order = bo;
  b.order = ao;

  touchAudit();
  rerenderAll();
}

function renameSection(sectionId) {
  const s = findSection(sectionId);
  if (!s) return;

  const nuovo = prompt("Rinomina sezione:", s.titolo || "");
  if (nuovo === null) return;
  const txt = nuovo.trim();
  if (!txt) return;

  s.titolo = txt;
  touchAudit();
  rerenderAll();
}

/* ========================================================================== */
/* 12) STATE LOGIC                                                             */
/* ========================================================================== */

function setState(sectionId, itemId, state) {
  const it = findItem(sectionId, itemId);
  if (!it) return;

  // Se KO, prima controlla note (se esistono già ok, altrimenti obbliga)
  if (state === "ko") {
    if (!String(it.note ?? "").trim()) {
      // settiamo lo stato, ma evidenziamo subito e lasciamo l’utente scrivere note
      it.stato = "ko";
      it.timestamp = nowIso();
      touchAudit();
      rerenderAll();
      alert("Stato KO: inserire le note (obbligatorie).");
      return;
    }
  }

  it.stato = state;
  it.timestamp = nowIso();
  // Se stai uscendo da KO e le note erano marcate required, ok.
  touchAudit();
  rerenderAll();
}

/* ========================================================================== */
/* 13) IMPORT / EXPORT                                                         */
/* ========================================================================== */

function downloadTextFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  if (!model) return;

  // Validazione KO -> note obbligatorie
  const problems = [];
  for (const s of model.sezioni) {
    for (const it of s.items || []) {
      if ((it.stato || "todo") === "ko" && !String(it.note || "").trim()) {
        problems.push(`KO senza note: [${s.titolo}] ${it.testo}`);
      }
    }
  }
  if (problems.length) {
    alert("Impossibile esportare:\n\n" + problems.slice(0, 10).join("\n") + (problems.length > 10 ? "\n..." : ""));
    return;
  }

  model.app.lastSavedWith = "1.0.0";
  touchAudit();

  const suggested = makeSuggestedFileName();
  if (!suggested) return;

  downloadTextFile(
    JSON.stringify(model, null, 2),
    suggested,
    "application/json"
  );
}

function makeSuggestedFileName() {
  const nome = (model.meta.centraleNome || "").trim();
  const anno = String(model.meta.anno || "").trim();

  if (!nome || !anno) {
    alert("Impossibile esportare:\nCompilare almeno Centrale e Anno.");
    return null;
  }

  // Normalizzazione nome file:
  // - spazi → _
  // - niente caratteri strani
  const safeNome = nome
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");

  return `${safeNome}_${anno}.json`;
}


function openJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const err = validateModel(parsed);
      if (err) {
        alert(err);
        return;
      }
      model = normalizeModel(parsed);
      openedFileName = file?.name || "";
      enableUi(true);
      bindAfterLoad();
      rerenderAll();
    } catch (e) {
      alert("Errore nel parsing JSON: " + e.message);
    }
  };
  reader.readAsText(file);
}

function createNewFile() {
  if (model) {
    const ok = confirm("Creare un nuovo file? Le modifiche non salvate andranno perse.");
    if (!ok) return;
  }

  const sections = [
    "Servizi Ausiliari Corrente Alternata",
    "Servizi Ausiliari Corrente Continua",
    "Blindati M.T.",
    "S.O.D.",
    "Sgrigliatore"
  ];

  const existing = new Set();
  const base = {
    app: { schemaVersion: 1 },
    meta: {},
    sezioni: sections.map((titolo, i) => ({
      id: makeUniqueId("sec", existing),
      titolo,
      order: (i + 1) * 10,
      items: [
        {
          id: makeUniqueId("itm", existing),
          testo: "Ispezione e pulizia",
          order: 10,
          stato: "todo",
          note: "",
          photoDataUrl: "",
          photoName: "",
          timestamp: ""
        }
      ]
    })),
    audit: {}
  };

  model = normalizeModel(base);
  openedFileName = "";
  enableUi(true);
  bindAfterLoad();
  rerenderAll();
}

/* ========================================================================== */
/* 15) EXPAND / COLLAPSE                                                       */
/* ========================================================================== */

function expandCollapseAll(open) {
  document.querySelectorAll("details.section").forEach(d => d.open = open);
}

function resetAllStates() {
  if (!model) return;

  const ok = confirm("Confermi il reset completo?\n\n- Stati: tutti su \"Da fare\"\n- Note e dati generali: cancellati");
  if (!ok) return;

  for (const s of model.sezioni || []) {
    for (const it of s.items || []) {
      it.stato = "todo";
      it.note = "";
      it.timestamp = "";
    }
  }

  if (!model.meta) model.meta = {};
  model.meta.centraleNome = "";
  model.meta.anno = "";
  model.meta.preposto = "";
  model.meta.operatori = "";
  model.meta.dataInizio = "";
  model.meta.dataFine = "";
  model.meta.noteGenerali = "";

  model.audit = {};

  touchAudit();
  rerenderAll();
}

function closeFile() {
  if (!model) return;

  const ok = confirm("Chiudere il file corrente? Le modifiche non salvate andranno perse.");
  if (!ok) return;

  model = null;
  openedFileName = "";
  enableUi(false);
  clearMetaInputs();
  setSubtitleEmpty();
  renderGlobalProgress();

  const sections = document.getElementById("sections");
  if (sections) {
    sections.innerHTML = '<div class="empty-hint">Nessun file caricato.</div>';
  }
}

/* ========================================================================== */
/* 16) INIT                                                                    */
/* ========================================================================== */

function bindAfterLoad() {
  // campi meta (una sola volta)
  // se già bindati, non crea problemi gravi, ma meglio evitare in futuro
}

function init() {
  enableUi(false);

  const fileInput = document.getElementById("fileInput");
  document.getElementById("btnNew").addEventListener("click", createNewFile);
  document.getElementById("btnOpen").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) openJsonFile(file);
    fileInput.value = "";
  });

  document.getElementById("btnSave").addEventListener("click", exportJson);
  document.getElementById("btnClose").addEventListener("click", closeFile);
  document.getElementById("btnResetStates").addEventListener("click", resetAllStates);
  document.getElementById("btnPdfBlank").addEventListener("click", () => generatePdf(true));
  document.getElementById("btnPdfState").addEventListener("click", () => generatePdf(false));

  document.getElementById("btnExpandAll").addEventListener("click", () => expandCollapseAll(true));
  document.getElementById("btnCollapseAll").addEventListener("click", () => expandCollapseAll(false));

  document.getElementById("btnAddSection").addEventListener("click", addSection);

  bindMeta();
}

/* ========================================================================== */
/* 17) BOOT                                                                   */
/* ========================================================================== */

init();
