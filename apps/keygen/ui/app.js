/* The key generator's window. Everything that touches files or keys is done by the main process (window.keygen). */

const api = window.keygen;
let state = null;
let page = 'new';
/** The form of the "new key" page, kept while the user looks at other pages. */
const form = { machine: '', owner: '', vehicles: [], note: '', vehicleText: '', result: null, error: '' };
let search = '';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function normalizeMachineCode(text) {
  const raw = String(text).toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  if (raw.length !== 20 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return raw.match(/.{5}/g).join('-');
}

/** h('div', { class: 'x', onclick }, child, 'text') - elements without ever parsing text as HTML. */
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

let toastTimer = null;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

const date = (ms) => new Date(ms).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
const ERRORS = {
  'no-signing-key': 'Немає ключа підпису. Відкрийте «Налаштування».',
  'bad-machine-code': 'Код ПК має бути з 20 символів, як його показує програма.',
  'bad-key-file': 'Це не файл ключа підпису STOHID.',
  'bad-sheet-url': 'Вкажіть посилання на таблицю Google.',
  'sheet-not-shared': 'Таблицю не видно без входу. Відкрийте доступ «усім, хто має посилання» (перегляд).',
  'sheet-no-serials': 'У таблиці не знайдено стовпця «Серійний номер».',
  'sheet-unreachable': 'Не вдалося дістатися таблиці. Перевірте інтернет.',
};

const PAGES = [
  ['new', 'Новий ключ'],
  ['list', 'Видані ключі'],
  ['vehicles', 'Борти'],
  ['settings', 'Налаштування'],
];

function render() {
  const nav = document.getElementById('nav');
  nav.replaceChildren(...PAGES.map(([id, label]) => h('button', { class: page === id ? 'on' : '', onclick: () => { page = id; render(); } },
    id === 'list' ? `${label} (${state.registry.length})` : label)));
  const badge = document.getElementById('keyBadge');
  badge.className = `badge${state.hasKey ? '' : ' bad'}`;
  badge.replaceChildren(h('b', {}, state.hasKey ? 'Ключ підпису є' : 'Немає ключа підпису'), state.hasKey ? `відбиток ${state.fingerprint}` : 'ключі видавати не можна');
  const target = document.getElementById('page');
  target.replaceChildren(...{ new: pageNew, list: pageList, vehicles: pageVehicles, settings: pageSettings }[page]());
}

// ---- New key -------------------------------------------------------------------------

function addVehicle(serial) {
  const s = String(serial).trim();
  if (s && !form.vehicles.includes(s)) form.vehicles.push(s);
  form.vehicleText = '';
}

function pageNew() {
  const code = normalizeMachineCode(form.machine);
  const earlier = code ? state.registry.filter((r) => r.machine === code && r.id !== form.result?.id) : [];
  const known = state.settings.vehicles;
  const typed = form.vehicleText.trim().toLowerCase();
  const suggestions = typed
    ? known.filter((v) => !form.vehicles.includes(v.serial) && (v.serial.toLowerCase().includes(typed) || v.customer.toLowerCase().includes(typed))).slice(0, 12)
    : [];
  // A vehicle already given to another PC is worth a second look, not a refusal.
  const taken = form.vehicles.map((serial) => ({ serial, by: state.registry.filter((r) => !r.revoked && r.vehicles.includes(serial) && r.machine !== code) })).filter((x) => x.by.length);

  const issue = async () => {
    form.error = '';
    const res = await api.issue({ machine: form.machine, owner: form.owner, vehicles: form.vehicles, note: form.note });
    if (!res.ok) { form.error = ERRORS[res.error] ?? res.error; render(); return; }
    state = res.state;
    form.result = res.record;
    form.machine = res.record.machine;
    render();
  };

  const out = [
    h('h1', {}, 'Новий ключ'),
    h('p', { class: 'lead' }, 'Користувач відкриває «Тунель» на своєму комп’ютері й надсилає вам «Код комп’ютера». Вставте його сюди, вкажіть, кому й з якими бортами видається копія, і надішліть йому ключ. Ключ працює лише на тому комп’ютері й не має терміну дії.'),
    h('div', { class: 'card' },
      h('label', { class: 'field' }, 'Код комп’ютера',
        h('input', {
          class: `mono ${form.machine ? (code ? 'ok' : 'bad') : ''}`, value: form.machine, placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX', spellcheck: 'false',
          oninput: (e) => { form.machine = e.target.value; form.result = null; render(); focusField('machine', e.target.selectionStart); },
          'data-focus': 'machine',
        })),
      earlier.length ? h('p', { class: 'warn' }, `Для цього комп’ютера вже видано: ${earlier.map((r) => `${r.id} (${r.owner || 'без імені'}, ${date(r.issued)})`).join('; ')}. Новий ключ теж працюватиме.`) : null,
      h('label', { class: 'field' }, 'Кому видано (замовник, підрозділ)',
        h('input', { value: form.owner, maxlength: '80', oninput: (e) => { form.owner = e.target.value; } })),
      h('div', { class: 'field' }, 'Борти (серійні номери)'),
      h('div', { class: 'chips' }, form.vehicles.map((s) => h('span', { class: 'chip mono' }, s,
        h('button', { title: 'Прибрати', onclick: () => { form.vehicles = form.vehicles.filter((x) => x !== s); render(); } }, '×')))),
      h('div', { class: 'suggest' },
        h('input', {
          value: form.vehicleText, placeholder: known.length ? 'Почніть вводити серійний номер або ім’я замовника' : 'Введіть серійний номер і натисніть Enter', 'data-focus': 'vehicle',
          oninput: (e) => { form.vehicleText = e.target.value; render(); focusField('vehicle', e.target.selectionStart); },
          onkeydown: (e) => { if (e.key === 'Enter' && form.vehicleText.trim()) { addVehicle(suggestions.length === 1 ? suggestions[0].serial : form.vehicleText); render(); focusField('vehicle', 0); } },
        }),
        suggestions.length ? h('ul', {}, suggestions.map((v) => h('li', { onclick: () => { addVehicle(v.serial); if (!form.owner && v.customer) form.owner = v.customer; render(); focusField('vehicle', 0); } },
          h('span', { class: 'mono' }, v.serial), h('small', {}, [v.customer, v.status].filter(Boolean).join(' · '))))) : null),
      taken.map((x) => h('p', { class: 'warn' }, `Борт ${x.serial} уже записано за іншим комп’ютером: ${x.by.map((r) => `${r.id} (${r.owner || r.machine})`).join('; ')}.`)),
      h('label', { class: 'field', style: 'margin-top:12px' }, 'Примітка (лише для вашого списку)',
        h('input', { value: form.note, maxlength: '300', oninput: (e) => { form.note = e.target.value; } })),
      form.error ? h('p', { class: 'err' }, form.error) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', disabled: !code || !state.hasKey, onclick: issue }, 'Згенерувати ключ'),
        !state.hasKey ? h('span', { class: 'err' }, ERRORS['no-signing-key']) : null)),
  ];

  if (form.result) {
    const r = form.result;
    out.push(h('div', { class: 'card' },
      h('h2', {}, `Ключ ${r.id} готовий`),
      h('textarea', { class: 'mono', readonly: true, rows: '4' }, r.key),
      h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', { class: 'btn primary', onclick: async () => { await api.copy(r.key); toast('Ключ скопійовано'); } }, 'Копіювати'),
        h('button', { class: 'btn', onclick: async () => { if (await api.saveKeyFile(r.id)) toast('Файл збережено'); } }, 'Зберегти у файл .key'),
        h('button', { class: 'btn', onclick: () => { Object.assign(form, { machine: '', owner: '', vehicles: [], note: '', vehicleText: '', result: null, error: '' }); render(); } }, 'Ще один ключ')),
      h('p', { class: 'hint', style: 'margin:10px 0 0' }, 'Надішліть ключ користувачеві: він вставляє його на екрані активації або відкриває файл кнопкою «З файлу».')));
  }
  return out;
}

/** Re-rendering replaces the inputs; put the caret back where the user was typing. */
function focusField(name, caret) {
  const el = document.querySelector(`[data-focus="${name}"]`);
  if (!el) return;
  el.focus();
  if (typeof caret === 'number') el.setSelectionRange(caret, caret);
}

// ---- Issued keys ---------------------------------------------------------------------

function pageList() {
  const q = search.trim().toLowerCase();
  const rows = state.registry.filter((r) => !q || [r.id, r.owner, r.machine, r.note, ...r.vehicles].some((x) => String(x).toLowerCase().includes(q)));
  return [
    h('h1', {}, 'Видані ключі'),
    h('p', { class: 'lead' }, 'Кожен зроблений ключ: кому, для якого комп’ютера і з якими бортами. Позначка «відкликано» — лише для вашого обліку: уже виданий ключ на тому комп’ютері продовжує працювати.'),
    h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('input', { class: 'grow', value: search, placeholder: 'Пошук: власник, код ПК, борт, номер ключа', 'data-focus': 'search',
        oninput: (e) => { search = e.target.value; render(); focusField('search', e.target.selectionStart); } }),
      h('button', { class: 'btn', disabled: !state.registry.length, onclick: async () => { if (await api.exportRegistry()) toast('Список збережено'); } }, 'Експорт у CSV')),
    h('div', { class: 'card', style: 'padding:6px 10px' },
      rows.length === 0
        ? h('div', { class: 'empty' }, state.registry.length ? 'Нічого не знайдено' : 'Ще не видано жодного ключа')
        : h('table', {},
          h('thead', {}, h('tr', {}, ['№', 'Дата', 'Власник', 'Код ПК', 'Борти', ''].map((t) => h('th', {}, t)))),
          h('tbody', {}, rows.map((r) => h('tr', { class: r.revoked ? 'revoked' : '' },
            h('td', { class: 'mono' }, r.id),
            h('td', {}, date(r.issued)),
            h('td', {}, r.owner || '—', r.note ? h('span', { class: 'sub' }, r.note) : null),
            h('td', { class: 'mono' }, r.machine),
            h('td', { class: 'mono' }, r.vehicles.join(', ') || '—'),
            h('td', { class: 'actions' },
              h('button', { class: 'btn small', onclick: async () => { await api.copy(r.key); toast(`Ключ ${r.id} скопійовано`); } }, 'Ключ'),
              ' ',
              h('button', { class: 'btn small', onclick: async () => { if (await api.saveKeyFile(r.id)) toast('Файл збережено'); } }, 'Файл'),
              ' ',
              h('button', { class: 'btn small', onclick: async () => { state = await api.updateRecord(r.id, { revoked: !r.revoked }); render(); } }, r.revoked ? 'Повернути' : 'Відкликано'),
              ' ',
              h('button', { class: 'btn small danger', onclick: async () => { if (confirm(`Видалити запис ${r.id} зі списку? Сам ключ у користувача працюватиме й далі.`)) { state = await api.deleteRecord(r.id); render(); } } }, '×'))))))),
  ];
}

// ---- Vehicles ------------------------------------------------------------------------

let sheetMessage = null;
async function loadSheet() {
  sheetMessage = { text: 'Завантаження…', cls: 'hint' };
  render();
  const res = await api.loadSheet();
  state = res.state;
  sheetMessage = res.ok ? { text: `Завантажено бортів: ${state.settings.vehicles.length}`, cls: 'good' } : { text: ERRORS[res.error] ?? res.error, cls: 'err' };
  render();
}

function pageVehicles() {
  const s = state.settings;
  const keysOf = (serial) => state.registry.filter((r) => !r.revoked && r.vehicles.includes(serial));
  // Vehicles written into keys by hand that the sheet does not list.
  const extra = [...new Set(state.registry.flatMap((r) => r.vehicles))].filter((serial) => !s.vehicles.some((v) => v.serial === serial));
  const all = [...s.vehicles, ...extra.map((serial) => ({ serial, status: '', customer: '', date: '' }))];
  return [
    h('h1', {}, 'Борти'),
    h('p', { class: 'lead' }, 'Список бортів із вашої таблиці та до якого комп’ютера кожен прив’язано. З таблиці беруться лише серійний номер, статус, ім’я замовника й дата передачі.'),
    h('div', { class: 'card' },
      h('label', { class: 'field' }, 'Посилання на таблицю Google',
        h('input', { value: s.sheetUrl, placeholder: 'https://docs.google.com/spreadsheets/d/…', onchange: async (e) => { state = await api.setSettings({ sheetUrl: e.target.value }); render(); } })),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', disabled: !s.sheetUrl, onclick: loadSheet }, 'Оновити з таблиці'),
        sheetMessage ? h('span', { class: sheetMessage.cls }, sheetMessage.text) : (s.vehiclesLoadedAt ? h('span', { class: 'hint' }, `Оновлено ${date(s.vehiclesLoadedAt)}, бортів: ${s.vehicles.length}`) : null))),
    h('div', { class: 'card', style: 'padding:6px 10px' },
      all.length === 0
        ? h('div', { class: 'empty' }, 'Список порожній. Вкажіть таблицю й натисніть «Оновити з таблиці», або вписуйте серійні номери вручну під час видачі ключа.')
        : h('table', {},
          h('thead', {}, h('tr', {}, ['Серійний номер', 'Статус', 'Замовник', 'Передано', 'Прив’язано до'].map((t) => h('th', {}, t)))),
          h('tbody', {}, all.map((v) => {
            const keys = keysOf(v.serial);
            return h('tr', {},
              h('td', { class: 'mono' }, v.serial),
              h('td', {}, v.status || '—'),
              h('td', {}, v.customer || '—'),
              h('td', {}, v.date || '—'),
              h('td', {}, keys.length ? keys.map((r) => h('span', { class: 'sub', style: 'color:var(--text);font-size:13px' }, `${r.id} · ${r.owner || r.machine}`)) : h('span', { class: 'hint' }, 'не прив’язано')));
          })))),
  ];
}

// ---- Settings ------------------------------------------------------------------------

function pageSettings() {
  return [
    h('h1', {}, 'Налаштування'),
    h('div', { class: 'card' },
      h('h2', {}, 'Ключ підпису'),
      state.hasKey
        ? h('p', { class: 'good' }, `Ключ підпису на місці. Відбиток: ${state.fingerprint}`)
        : h('p', { class: 'err' }, 'Ключа підпису немає: імпортуйте файл із резервної копії. Новий ключ створюйте лише якщо старий утрачено назавжди.'),
      h('p', { class: 'hint' }, 'Це головний секрет: хто має цей файл, може видавати ключі до вашої програми. Збережіть резервну копію в надійному місці (флешка в сейфі) і нікому не надсилайте. Якщо файл утратити, ключі для вже випущених версій програми видавати буде неможливо.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', disabled: !state.hasKey, onclick: async () => { if (await api.exportSigningKey()) toast('Резервну копію збережено'); } }, 'Зберегти резервну копію'),
        h('button', { class: 'btn', onclick: async () => {
          if (state.hasKey && !confirm('Замінити ключ підпису іншим із файлу? Поточний буде збережено поруч як .bak.')) return;
          const res = await api.importSigningKey();
          state = res.state;
          if (res.error) toast(ERRORS[res.error] ?? res.error); else if (res.ok) toast('Ключ підпису імпортовано');
          render();
        } }, 'Імпортувати з файлу'),
        !state.hasKey ? h('button', { class: 'btn danger', onclick: async () => {
          if (!confirm('Створити НОВИЙ ключ підпису? Програму доведеться перезібрати з новим відкритим ключем; раніше видані ключі до нової збірки не підійдуть.')) return;
          state = await api.createSigningKey();
          render();
        } }, 'Створити новий') : null)),
    state.hasKey ? h('div', { class: 'card' },
      h('h2', {}, 'Відкритий ключ (вбудований у програму)'),
      h('textarea', { class: 'mono', readonly: true, rows: '3' }, state.publicKey),
      h('p', { class: 'hint', style: 'margin:8px 0 0' }, 'Він не секретний: ним програма лише перевіряє ключі. Має збігатися з apps/desktop/src/main/license/public-key.ts.')) : null,
    h('div', { class: 'card' },
      h('h2', {}, 'Дані'),
      h('p', { class: 'hint' }, `Ключ підпису, список виданих ключів і налаштування лежать тут: ${state.dataDir}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => api.openDataDir() }, 'Відкрити теку'),
        h('span', { class: 'hint' }, `Версія генератора ${state.version}`))),
  ];
}

api.state().then((s) => { state = s; render(); });
