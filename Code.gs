/**
 * Registro das respostas do app "Seu risco de câncer de mama" no Google Sheets.
 *
 * Como usar (resumo; passo a passo completo no README):
 *  1. Crie uma planilha, abra Extensões > Apps Script e cole este arquivo.
 *  2. Troque o TOKEN abaixo (o mesmo valor vai em config.js).
 *  3. Execute a função setup() uma vez e autorize.
 *  4. Implantar > Nova implantação > App da Web
 *     (Executar como: Eu | Quem pode acessar: Qualquer pessoa).
 *  5. Copie a URL terminada em /exec para SHEETS_URL em config.js.
 *
 * Importante: depois de editar este código, use Implantar > Gerenciar implantações >
 * editar > Nova versão. Sem isso, a URL continua rodando a versão antiga.
 */

const TOKEN = 'TROQUE-ESTE-TOKEN';
const SHEET_NAME = 'Respostas';
const SUMMARY_NAME = 'Resumo';

// Ordem das colunas. Os nomes devem ser iguais às chaves enviadas pelo app (app.js, buildPayload).
const COLUMNS = [
  'receivedAt', 'id', 'eventId', 'appVersion',
  'age', 'bmi', 'menopause', 'menopauseAge', 'menarcheAge',
  'famCount', 'famYoung', 'famBilateral', 'famOvary', 'famMale', 'famOtherCA',
  'geneMut', 'chestRT', 'biopsy', 'density', 'lastMamo',
  'births', 'firstBirthAge', 'breastfeedMonths', 'oc', 'hrt',
  'alcoholDosesWeek', 'activityMinWeek', 'smoking',
  'hasSymptoms', 'symptoms',
  'rr', 'score', 'category', 'flags', 'topFactors'
];

const CATEGORIES = ['baixo', 'moderado', 'aumentado', 'alto'];

/** Recebe as respostas enviadas pelo app. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(25000);
    locked = true;

    const data = JSON.parse(e.postData.contents);
    if (data.token !== TOKEN) return json_({ ok: false, error: 'token' });

    const problem = validate_(data);
    if (problem) return json_({ ok: false, error: problem });

    const sheet = getSheet_();
    if (isDuplicate_(sheet, data.id)) return json_({ ok: true, duplicate: true });

    const row = COLUMNS.map(k => (k === 'receivedAt' ? new Date() : clean_(data[k])));
    sheet.appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    if (locked) lock.releaseLock();
  }
}

/** Teste rápido: abrir a URL /exec no navegador deve mostrar {"ok":true,...}. */
function doGet() {
  return json_({ ok: true, service: 'risco-mama', total: Math.max(getSheet_().getLastRow() - 1, 0) });
}

/** Rode uma vez: cria as abas "Respostas" e "Resumo". */
function setup() {
  getSheet_();
  buildSummary_();
}

/* ------------------------------ auxiliares ------------------------------ */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS])
      .setBackground('#B3205F').setFontColor('#FFFFFF').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function isDuplicate_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return false;
  const col = COLUMNS.indexOf('id') + 1;
  return sh.getRange(2, col, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext() !== null;
}

/** Barra dados fora do esperado (o front é público, qualquer um pode chamar a URL). */
function validate_(d) {
  if (typeof d.id !== 'string' || d.id.length < 8 || d.id.length > 64) return 'id';
  if (typeof d.age !== 'number' || d.age < 18 || d.age > 100) return 'age';
  if (typeof d.score !== 'number' || d.score < 0 || d.score > 100) return 'score';
  if (CATEGORIES.indexOf(d.category) === -1) return 'category';
  for (const k of COLUMNS) {
    const v = d[k];
    if (typeof v === 'string' && v.length > 400) return 'campo longo: ' + k;
  }
  return null;
}

/** Evita injeção de fórmulas (=, +, -, @) em células de texto. */
function clean_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function col_(key) {
  let n = COLUMNS.indexOf(key) + 1, s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** Aba "Resumo" com fórmulas: atualiza sozinha a cada resposta nova. */
function buildSummary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SUMMARY_NAME);
  if (!sh) sh = ss.insertSheet(SUMMARY_NAME);
  sh.clear();
  const R = k => `${SHEET_NAME}!${col_(k)}2:${col_(k)}`;
  const rows = [
    ['Indicador', 'Valor'],
    ['Total de participantes', `=COUNTA(${R('id')})`],
    ['Idade média (anos)', `=IFERROR(ROUND(AVERAGE(${R('age')}),1),"")`],
    ['Pontuação média (0 a 100)', `=IFERROR(ROUND(AVERAGE(${R('score')}),1),"")`],
    ['', ''],
    ['Risco baixo', `=COUNTIF(${R('category')},"baixo")`],
    ['Risco moderado', `=COUNTIF(${R('category')},"moderado")`],
    ['Risco aumentado', `=COUNTIF(${R('category')},"aumentado")`],
    ['Risco alto', `=COUNTIF(${R('category')},"alto")`],
    ['', ''],
    ['Com mudança nas mamas (sintoma)', `=COUNTIF(${R('hasSymptoms')},TRUE)`],
    ['Nunca fizeram mamografia', `=COUNTIF(${R('lastMamo')},"nunca")`],
    ['Mamografia há mais de 2 anos', `=COUNTIF(${R('lastMamo')},"gt24")`],
    ['Com sinais para aconselhamento genético', `=COUNTIFS(${R('flags')},"<>",${R('id')},"<>")`],
    ['Menos de 150 min/semana de atividade física', `=COUNTIFS(${R('activityMinWeek')},"<150",${R('id')},"<>")`],
    ['IMC de 25 ou mais', `=COUNTIFS(${R('bmi')},">=25",${R('id')},"<>")`],
    ['Consomem álcool (1 dose ou mais por semana)', `=COUNTIFS(${R('alcoholDosesWeek')},">=1",${R('id')},"<>")`],
    ['', ''],
    ['Faixa etária', 'Participantes'],
    ['18 a 39 anos', `=COUNTIFS(${R('age')},">=18",${R('age')},"<40")`],
    ['40 a 49 anos', `=COUNTIFS(${R('age')},">=40",${R('age')},"<50")`],
    ['50 a 74 anos', `=COUNTIFS(${R('age')},">=50",${R('age')},"<75")`],
    ['75 anos ou mais', `=COUNTIFS(${R('age')},">=75")`]
  ];
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1, 1, 2).setBackground('#B3205F').setFontColor('#FFFFFF').setFontWeight('bold');
  sh.getRange(19, 1, 1, 2).setBackground('#F6C9DA').setFontWeight('bold');
  sh.setColumnWidth(1, 330);
  sh.setColumnWidth(2, 120);
}
