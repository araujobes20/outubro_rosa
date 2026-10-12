(() => {
'use strict';

/* ------------------------------------------------------------------ *
 *  Configuração e utilitários
 * ------------------------------------------------------------------ */
const CFG = Object.assign(
  { SHEETS_URL: '', TOKEN: '', EVENT_ID: 'outubro-rosa', APP_VERSION: '1.0.0' },
  window.APP_CONFIG || {}
);
const EVENT_ID = new URLSearchParams(location.search).get('evento') || CFG.EVENT_ID;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const val = n => { const e = document.querySelector(`input[name="${n}"]:checked`); return e ? e.value : null; };
const num = id => {
  const e = $('#' + id);
  if (!e || e.disabled || e.value === '') return null;
  const v = parseFloat(e.value);
  return Number.isFinite(v) ? v : null;
};
const chk = id => $('#' + id).checked;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const fmt = x => String(x).replace('.', ',');

const form = $('#form');
const steps = $$('.step');
const TITLES = ['', 'Sobre você', 'Família e mamas', 'Gestações e hormônios', 'Hábitos'];
let current = 0;

/* ------------------------------------------------------------------ *
 *  Navegação e validação
 * ------------------------------------------------------------------ */
function go(n) {
  current = n;
  form.hidden = false;
  $('#result').hidden = true;
  $('#excluded').hidden = true;
  steps.forEach((s, i) => { s.hidden = i !== n; });
  const p = $('#progress');
  p.hidden = n === 0;
  if (n > 0) {
    $('#progress-label').textContent = `Etapa ${n} de 4: ${TITLES[n]}`;
    $('#progress-bar').style.width = (n / 4 * 100) + '%';
    $('#progress-aria').setAttribute('aria-valuenow', n);
  }
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  const h = steps[n].querySelector('h1, h2');
  if (h) h.focus({ preventScroll: true });
}

function valid(n) {
  const fields = $$('input', steps[n]).filter(i => !i.disabled);
  for (const f of fields) {
    if (!f.checkValidity()) { f.reportValidity(); return false; }
  }
  return true;
}

function toggle(id, on) {
  const g = $('#' + id);
  if (!g || g.hidden === !on) return;
  g.hidden = !on;
  $$('input', g).forEach(i => {
    i.disabled = !on;
    if (!on) { if (i.type === 'radio' || i.type === 'checkbox') i.checked = false; else i.value = ''; }
  });
}

function syncConditionals() {
  const pos = val('meno') === 'pos';
  toggle('g-menoAge', pos);
  toggle('g-hrt', pos);
  const b = num('births');
  toggle('g-parity', b !== null && b > 0);
}

form.addEventListener('input', syncConditionals);
form.addEventListener('change', syncConditionals);

form.addEventListener('click', e => {
  const b = e.target.closest('[data-next],[data-prev]');
  if (!b) return;
  if (b.hasAttribute('data-prev')) { go(current - 1); return; }
  if (!valid(current)) return;
  if (current === 1 && val('personalCA') === 'sim') { showExcluded(); return; }
  go(current + 1);
});

form.addEventListener('submit', e => {
  e.preventDefault();
  if (!valid(current)) return;
  finish();
});

function showExcluded() {
  form.hidden = true;
  $('#progress').hidden = true;
  $('#excluded').hidden = false;
  window.scrollTo({ top: 0, behavior: 'auto' });
  $('#excluded h2').focus({ preventScroll: true });
}

function restart() {
  form.reset();
  syncConditionals();
  go(0);
}
$('#btn-restart').addEventListener('click', restart);
$('#btn-restart2').addEventListener('click', restart);
$('#btn-print').addEventListener('click', () => window.print());

/* ------------------------------------------------------------------ *
 *  Leitura das respostas
 * ------------------------------------------------------------------ */
function read() {
  return {
    age: num('age'), weight: num('weight'), height: num('height'),
    meno: val('meno'), menoAge: num('menoAge'), menarche: num('menarche'),
    famCount: val('famCount'),
    famYoung: chk('famYoung'), famBilateral: chk('famBilateral'), famOvary: chk('famOvary'),
    famMale: chk('famMale'), famOtherCA: chk('famOtherCA'),
    geneMut: val('geneMut'), chestRT: val('chestRT') === 'sim',
    biopsy: val('biopsy'), density: val('density'), lastMamo: val('lastMamo'),
    sNodule: chk('sNodule'), sDischarge: chk('sDischarge'), sSkin: chk('sSkin'), sNipple: chk('sNipple'),
    births: num('births'), firstBirth: num('firstBirth'), breastMonths: num('breastMonths'),
    oc: val('oc'), hrt: val('hrt'),
    alcohol: num('alcohol'), activity: num('activity'), smoke: val('smoke')
  };
}

/* ------------------------------------------------------------------ *
 *  Cálculo do risco
 *  Riscos relativos (RR) multiplicados; valores arredondados a partir
 *  das fontes listadas no README e na tela de resultado.
 * ------------------------------------------------------------------ */
const FLAG_TEXT = {
  famCount: '2 ou mais parentes de 1º grau com câncer de mama',
  gene: 'Mutação genética conhecida',
  rt: 'Radioterapia no tórax antes dos 30 anos',
  atypia: 'Hiperplasia atípica ou CLIS',
  famSigns: 'Sinais de síndrome hereditária na família'
};

function compute(a) {
  const f = [];
  const major = [];
  const refer = [];
  const add = (label, rr) => { if (Math.abs(Math.log(rr)) >= 0.01) f.push({ label, rr: r2(rr) }); };
  const bmi = a.weight / Math.pow(a.height / 100, 2);
  const post = a.meno === 'pos';

  // Família e mamas
  if (a.famCount === '1') add('1 parente de 1º grau com câncer de mama', 1.8);
  if (a.famCount === '2') { add('2 ou mais parentes de 1º grau com câncer de mama', 2.9); major.push('famCount'); }
  if (a.famYoung || a.famBilateral || a.famOvary || a.famMale || a.famOtherCA) refer.push('famSigns');
  if (a.geneMut === 'positivo') { major.push('gene'); f.push({ label: 'Mutação genética conhecida', rr: null }); }
  if (a.chestRT) { major.push('rt'); f.push({ label: 'Radioterapia no tórax antes dos 30 anos', rr: null }); }
  if (a.biopsy === 'benigna') add('Biópsia de mama benigna prévia', 1.3);
  if (a.biopsy === 'atipia') { add('Hiperplasia atípica ou CLIS na biópsia', 4.2); major.push('atypia'); }
  const dens = { A: 0.8, B: 1, C: 1.3, D: 1.6 }[a.density];
  if (dens) add(`Mamas com densidade ${a.density}`, dens);

  // Vida reprodutiva
  if (a.menarche !== null) add(`Primeira menstruação aos ${a.menarche} anos`, Math.pow(1.05, 13 - clamp(a.menarche, 9, 17)));
  if (post && a.menoAge !== null) add(`Menopausa aos ${a.menoAge} anos`, Math.pow(1.029, clamp(a.menoAge, 40, 58) - 50));
  if (a.births === 0) {
    add('Nunca ter tido filhos', 1.25);
  } else if (a.births > 0) {
    if (a.firstBirth !== null) {
      const m = a.firstBirth < 20 ? 0.9 : a.firstBirth < 30 ? 1 : a.firstBirth < 35 ? 1.15 : 1.3;
      add(`Primeiro filho aos ${a.firstBirth} anos`, m);
    }
    if (a.births > 1) add(`${a.births} filhos`, Math.pow(0.93, Math.min(a.births, 5) - 1));
    if (a.breastMonths) add(`Amamentação por ${a.breastMonths} meses`, Math.pow(0.957, Math.min(a.breastMonths, 60) / 12));
  }

  // Hormônios
  const oc = { '5_9': 1.07, '1_4': 1.16, atual: 1.24 }[a.oc];
  if (oc) add('Anticoncepcional hormonal (uso atual ou recente)', oc);
  if (post) {
    const h = { comb_lt5: 1.6, comb_ge5: 2.1, est_lt5: 1.2, est_ge5: 1.3, nao_sei: 1.4 }[a.hrt];
    if (h) add('Terapia hormonal da menopausa (uso atual ou recente)', h);
  }

  // Hábitos e peso
  if (a.alcohol > 0) add(`Álcool: ${a.alcohol} doses por semana`, Math.pow(1.071, Math.min(a.alcohol * 2, 60) / 10));
  if (post && bmi > 25) add(`IMC ${fmt(r1(bmi))} após a menopausa`, Math.pow(1.12, (Math.min(bmi, 45) - 25) / 5));
  if (a.activity >= 150) add('Atividade física regular (150 min ou mais por semana)', 0.88);
  if (a.smoke === 'atual') add('Tabagismo atual', 1.1);

  let rr = f.reduce((p, x) => (x.rr ? p * x.rr : p), 1);
  rr = r2(clamp(rr, 0.3, 8));

  const order = ['baixo', 'moderado', 'aumentado', 'alto'];
  // Pontos de corte pragmáticos (o perfil de referência é mais baixo que o da mulher média); calibrar em validação futura.
  let cat = rr < 1.5 ? 'baixo' : rr < 2.5 ? 'moderado' : rr < 4 ? 'aumentado' : 'alto';
  if (major.length) cat = 'alto';
  else if (refer.length && order.indexOf(cat) < 2) cat = 'aumentado';

  let score = Math.round(clamp(Math.log(Math.max(rr, 1)) / Math.log(5), 0, 1) * 100);
  score = Math.max(score, { baixo: 0, moderado: 25, aumentado: 57, alto: 86 }[cat]);
  if (major.length) score = Math.max(score, 90);

  const symptoms = [];
  if (a.sNodule) symptoms.push('nódulo');
  if (a.sDischarge) symptoms.push('secreção');
  if (a.sSkin) symptoms.push('pele');
  if (a.sNipple) symptoms.push('mamilo');

  return { rr, score, cat, major, refer, factors: f, bmi, post, symptoms };
}

/* ------------------------------------------------------------------ *
 *  Ícones e componentes visuais
 * ------------------------------------------------------------------ */
const ICONS = {
  scan: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/>',
  dna: '<path d="M7 3c0 6 10 6 10 12s-10 6-10 6"/><path d="M17 3c0 6-10 6-10 12s10 6 10 6"/><path d="M9 8h6M9 16h6"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 10a4 4 0 0 1 8 0"/><path d="M12 10l2-2"/>',
  glass: '<path d="M7 3h10l-1 7a4 4 0 0 1-8 0z"/><path d="M12 14v7M8 21h8"/>',
  pill: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-40 12 12)"/><path d="M9.2 9.2l5.6 5.6"/>',
  smoke: '<path d="M3 16h14v4H3z"/><path d="M20 16v4M17 8c0-2 3-2 3-5"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

function timeline(age, start, startLabel) {
  const min = 20, max = 80;
  const pos = x => clamp((x - min) / (max - min) * 100, 0, 100);
  const ticks = [20, 40, 50, 74, 80].map(t => `<span style="left:${pos(t)}%">${t}</span>`).join('');
  return `
    <div class="tl" role="img" aria-label="Linha do tempo por idade: você está com ${age} anos">
      <div class="tl-track">
        <span class="tl-band tl-sus" style="left:${pos(40)}%;width:${pos(50) - pos(40)}%"></span>
        <span class="tl-band tl-org" style="left:${pos(50)}%;width:${pos(74) - pos(50)}%"></span>
        ${start !== null ? `<span class="tl-pin tl-start" style="left:${pos(start)}%"><i>${startLabel}</i></span>` : ''}
        <span class="tl-pin tl-you" style="left:${pos(age)}%"><i>Você</i></span>
      </div>
      <div class="tl-scale">${ticks}</div>
    </div>
    <div class="legend">
      <span><i style="background:repeating-linear-gradient(135deg,#F0A6C0 0 4px,#F6C9DA 4px 8px)"></i>40 a 49 anos: mamografia a pedido (SUS)</span>
      <span><i style="background:#E5527C"></i>50 a 74 anos: rastreamento organizado</span>
    </div>`;
}

/* ------------------------------------------------------------------ *
 *  Plano personalizado (cartões)
 * ------------------------------------------------------------------ */
function mamoCard(a, r) {
  const age = a.age, L = a.lastMamo;
  const high = r.cat === 'alto', up = r.cat === 'aumentado';
  let s, chip, head, short, start = null, startLabel = '';
  const body = [];

  if (high) {
    s = 'action'; chip = 'Prioridade';
    head = 'Consulta com mastologista antes de qualquer rotina';
    short = 'Marcar consulta com mastologista (risco alto)';
    start = age < 30 ? 30 : age; startLabel = age < 30 ? 'Início' : 'Agora';
    body.push('No risco alto, o rastreamento costuma ser anual, começar mais cedo e, muitas vezes, combinar mamografia com ressonância magnética. O especialista define o esquema.');
    if (a.geneMut === 'positivo') body.push('Em portadoras de mutação BRCA, a vigilância costuma começar entre 25 e 30 anos.');
    if (a.chestRT) body.push('Após radioterapia no tórax, o acompanhamento costuma começar 8 anos depois do tratamento ou aos 25 anos, o que vier por último.');
    if (r.refer.length || a.famCount === '2') body.push('Em casos familiares, uma regra comum é começar 10 anos antes da idade do diagnóstico do parente mais jovem.');
    if (age >= 40) {
      body.push(L === 'lt12'
        ? 'Sua última mamografia foi há menos de 1 ano: a próxima deve ser feita em até 12 meses da última.'
        : 'No seu perfil o intervalo é anual e já passou desse prazo: não espere a consulta para agendar a mamografia.');
    }
  } else if (age >= 75) {
    s = 'info'; chip = 'Decisão individual';
    head = 'Converse com seu médico';
    short = 'Decidir com seu médico se mantém a mamografia';
    body.push('Depois dos 74 anos, manter a mamografia depende da sua saúde geral e da expectativa de vida.');
  } else if (age < 40) {
    start = 40; startLabel = '40';
    if (up) {
      s = 'talk'; chip = 'Conversar com o médico';
      head = 'Pergunte quando começar: costuma ser antes dos 40';
      short = 'Perguntar ao médico se deve começar a mamografia antes dos 40';
      body.push('Seu perfil tem fatores que elevam o risco. Leve este plano à consulta e combine a idade de início e o tipo de exame.');
    } else {
      s = 'info'; chip = 'Ainda não';
      head = 'Mamografia de rotina a partir dos 40 anos';
      short = 'Fazer consulta ginecológica anual até os 40 anos';
      body.push('Até lá, faça consulta ginecológica anual com exame clínico das mamas e fique atenta a qualquer mudança. Mamografia antes dos 40 só por indicação médica.');
    }
  } else {
    const annual = up || age < 50;
    start = 40; startLabel = '40';
    if (L === 'lt12') {
      s = 'ok'; chip = 'Em dia';
      head = 'Você está em dia com a mamografia';
      short = 'Manter a mamografia em dia';
      body.push(annual
        ? 'Próxima mamografia em até 12 meses da última.'
        : 'Próxima mamografia em 12 a 24 meses da última (anual pelas sociedades médicas; no máximo a cada 2 anos pelo Ministério da Saúde).');
    } else if (L === '12_24') {
      if (annual) {
        s = 'action'; chip = 'Agendar agora';
        head = 'Agende agora: já passou 1 ano da última';
        short = 'Agendar a mamografia (já passou 1 ano da última)';
        body.push('No seu perfil, o intervalo recomendado é anual.');
      } else {
        s = 'talk'; chip = 'Agendar em breve';
        head = 'Agende nos próximos meses';
        short = 'Agendar a mamografia nos próximos meses';
        body.push('O intervalo máximo é de 2 anos entre os exames; as sociedades médicas recomendam anual.');
      }
    } else {
      s = 'action'; chip = 'Agendar agora';
      head = L === 'nunca' ? 'Faça sua primeira mamografia agora' : 'Sua mamografia está atrasada: agende agora';
      short = L === 'nunca' ? 'Agendar sua primeira mamografia' : 'Agendar a mamografia (a última foi há mais de 2 anos)';
      body.push(annual ? 'No seu perfil, o intervalo recomendado é anual.' : 'Depois deste exame, repita em 1 a 2 anos.');
    }
    body.push(age < 50
      ? 'Pelo SUS, procure a Unidade Básica de Saúde: desde setembro de 2025 o Ministério da Saúde garante a mamografia a partir dos 40 anos, por decisão conjunta com o profissional. Sociedades médicas (SBM, CBR, FEBRASGO) recomendam anual a partir dos 40.'
      : 'Pelo SUS, procure a Unidade Básica de Saúde: o rastreamento organizado vai de 50 a 74 anos.');
  }
  if (a.density === 'C' || a.density === 'D') {
    body.push('Mamas densas reduzem a sensibilidade da mamografia: pergunte ao seu médico sobre exame complementar (ultrassom ou ressonância).');
  }

  return {
    id: 'mamo', icon: 'scan', title: 'Mamografia', s, chip, head, short,
    html: `${timeline(age, start, startLabel)}${body.map(t => `<p>${t}</p>`).join('')}`
  };
}

function geneCard(a) {
  const crit = [
    { t: '2 ou mais parentes de 1º grau com câncer de mama', m: a.famCount === '2' },
    { t: 'Câncer de mama antes dos 50 anos na família', m: a.famYoung },
    { t: 'Câncer de mama nos dois seios na mesma pessoa', m: a.famBilateral },
    { t: 'Câncer de ovário na família', m: a.famOvary },
    { t: 'Câncer de mama em homem na família', m: a.famMale },
    { t: 'Câncer de pâncreas ou próstata metastático na família', m: a.famOtherCA }
  ];
  const n = crit.filter(c => c.m).length;
  const list = `<ul class="crit">${crit.map(c => `<li class="${c.m ? 'yes' : 'no'}"><b>${c.m ? '✓' : '–'}</b><span>${c.t}</span></li>`).join('')}</ul>`;
  let s, chip, head, short, txt;

  if (a.geneMut === 'positivo') {
    s = 'action'; chip = 'Já identificada';
    head = 'Você já tem uma mutação: busque aconselhamento genético';
    short = 'Buscar aconselhamento genético para montar o plano de vigilância';
    txt = 'Um oncogeneticista ou mastologista deve montar seu plano de vigilância e orientar o teste de parentes. Em portadoras de BRCA1 ou BRCA2, o risco de câncer de mama até os 80 anos é de cerca de 70%.';
  } else if (a.geneMut === 'negativo') {
    s = n > 0 ? 'talk' : 'ok'; chip = n > 0 ? 'Revisar com especialista' : 'Já testada';
    head = 'Você já fez teste genético';
    short = 'Revisar com especialista o resultado do seu teste genético';
    txt = 'Um resultado negativo em quem nunca teve câncer só é conclusivo se a mutação da família já é conhecida. Leve o laudo a um especialista, principalmente se há casos na família.';
  } else if (n > 0) {
    const strong = a.famCount === '2' || a.famOvary || a.famMale || (a.famYoung && a.famCount !== '0');
    s = strong ? 'action' : 'talk'; chip = strong ? 'Recomendado' : 'Vale conversar';
    head = 'Faz sentido conversar sobre teste genético';
    short = 'Pedir encaminhamento para aconselhamento genético (BRCA1, BRCA2 e outros genes)';
    txt = 'Peça ao seu médico o encaminhamento para aconselhamento genético. O ideal é testar primeiro a parente que teve câncer, se ela puder: o resultado dela torna o seu teste mais informativo. O exame costuma avaliar BRCA1, BRCA2 e outros genes (como PALB2, TP53, CHEK2 e ATM). O acesso varia entre SUS, planos de saúde e rede particular.';
  } else {
    s = 'ok'; chip = 'Não indicado agora';
    head = 'Em geral, não é necessário';
    short = '';
    txt = (a.famCount === '1' ? 'Um único caso de câncer de mama em parente de 1º grau, sem outros sinais, em geral não indica teste. ' : '') +
      'Pelo que você informou, não há sinais de síndrome hereditária. Reavalie se surgirem novos casos de câncer de mama, ovário, pâncreas ou próstata na família.';
  }
  return { id: 'gene', icon: 'dna', title: 'Teste genético', s, chip, head, short, html: `${list}<p>${txt}</p>` };
}

function activityCard(a) {
  const m = a.activity;
  const pct = clamp(m, 0, 300) / 300 * 100;
  let s, chip, head, short, txt;
  if (m >= 150) {
    s = 'ok'; chip = m >= 300 ? 'Ótimo' : 'Meta atingida';
    head = 'Mantenha: você já está na meta';
    short = '';
    txt = 'Entre 150 e 300 minutos por semana é a faixa recomendada pela OMS e está associada a cerca de 12% menos risco de câncer de mama. Inclua exercícios de força 2 vezes por semana.';
  } else {
    s = 'action'; chip = 'Aumentar';
    head = m > 0 ? `Faltam ${150 - m} minutos por semana para a meta` : 'Comece: a meta é de 150 minutos por semana';
    short = m > 0 ? `Aumentar a atividade física em ${150 - m} minutos por semana` : 'Começar a atividade física (meta de 150 minutos por semana)';
    txt = 'Aumente aos poucos: acrescente 10 a 15 minutos por dia de caminhada rápida até chegar a cerca de 30 minutos, 5 dias por semana. Quem atinge a meta tem cerca de 12% menos risco de câncer de mama. Se você tem alguma doença ou está parada há muito tempo, converse com seu médico antes de começar.';
  }
  const vis = `
    <div class="meter">
      <div class="fill-wrap"><div class="fill" style="width:${pct}%"></div></div>
      <span class="meter-goal" style="left:50%"></span>
      <div class="meter-labels"><span>0</span><span>meta: 150</span><span>300 min/sem</span></div>
    </div>
    <p><strong>Você: ${m} min por semana.</strong></p>`;
  return { id: 'activity', icon: 'pulse', title: 'Atividade física', s, chip, head, short, html: `${vis}<p>${txt}</p>` };
}

function weightCard(a, r) {
  const bmi = r.bmi, w = a.weight;
  const pin = (clamp(bmi, 15, 40) - 15) / 25 * 100;
  let s, chip, head, short, txt;
  if (bmi < 18.5) {
    s = 'talk'; chip = 'Conversar com profissional';
    head = 'Peso abaixo do ideal';
    short = 'Conversar com um profissional de saúde sobre o peso (abaixo do ideal)';
    txt = 'Neste caso não é indicado emagrecer. Converse com um médico ou nutricionista sobre sua alimentação.';
  } else if (bmi < 25) {
    s = 'ok'; chip = 'Peso saudável';
    head = 'Mantenha seu peso';
    short = '';
    txt = 'Evitar ganho de peso ao longo da vida adulta e depois da menopausa ajuda a reduzir o risco.';
  } else {
    const lo = Math.round(w * 0.05), hi = Math.round(w * 0.10);
    s = r.post ? 'action' : 'talk'; chip = 'Emagrecer';
    head = `Perder 5 a 10% do peso (${lo} a ${hi} kg)`;
    short = `Perder ${lo} a ${hi} kg (5 a 10% do peso) com acompanhamento`;
    txt = (r.post
      ? 'Após a menopausa, o excesso de peso aumenta o risco de câncer de mama em cerca de 12% a cada 5 pontos de IMC. '
      : 'O excesso de peso pesa na saúde geral e no risco de câncer de mama após a menopausa. ') +
      'Perder 5 a 10% já traz benefício. Priorize vegetais, frutas, grãos integrais e menos ultraprocessados, junto com a atividade física. Um nutricionista (UBS ou particular) orienta de forma segura.';
  }
  const vis = `
    <div class="meter">
      <div class="meter-bar">
        <span style="width:14%;background:#F6C9DA"></span>
        <span style="width:26%;background:#BFE0CF"></span>
        <span style="width:20%;background:#F29DBB"></span>
        <span style="width:40%;background:#D6457A"></span>
      </div>
      <div class="meter-pin" style="left:${pin}%"><i>IMC ${fmt(r1(bmi))}</i></div>
      <div class="meter-labels"><span>abaixo</span><span>saudável (18,5 a 24,9)</span><span>sobrepeso</span><span>obesidade</span></div>
    </div>`;
  return { id: 'weight', icon: 'scale', title: 'Peso', s, chip, head, short, html: `${vis}<p>${txt}</p>` };
}

function alcoholCard(a) {
  const d = a.alcohol, g = d * 2;
  const dots = Array.from({ length: 14 }, (_, i) => `<span class="${i < d ? 'on' : ''}"></span>`).join('');
  let s, chip, head, short, txt;
  if (d === 0) {
    s = 'ok'; chip = 'Ótimo';
    head = 'Não beber é o melhor para o risco';
    short = '';
    txt = 'Sem álcool, você evita um fator de risco que pode ser modificado.';
  } else {
    s = d > 7 ? 'action' : 'talk'; chip = 'Reduzir';
    head = d > 7 ? 'Reduzir o álcool é uma das mudanças com maior efeito' : 'Quanto menos, melhor';
    short = 'Reduzir ou parar o álcool (não há quantidade totalmente segura)';
    txt = `Para câncer de mama não existe quantidade totalmente segura: o risco sobe cerca de 7% a cada 10 g de álcool por dia, menos de uma dose diária. Você bebe cerca de ${g} g por dia, em média. Se puder, reduza ou pare.`;
  }
  const vis = `<div class="dots" role="img" aria-label="${d} doses por semana">${dots}</div><p><strong>Você: ${d} doses por semana</strong>${d > 14 ? ' (mostramos as 14 primeiras)' : ''}</p>`;
  return { id: 'alcohol', icon: 'glass', title: 'Álcool', s, chip, head, short, html: `${vis}<p>${txt}</p>` };
}

function smokeCard(a) {
  if (a.smoke !== 'atual') return null;
  return {
    id: 'smoke', icon: 'smoke', title: 'Cigarro', s: 'action', chip: 'Parar de fumar',
    head: 'Parar de fumar',
    short: 'Procurar a UBS para tratamento gratuito para parar de fumar',
    html: '<p>O tabagismo aumenta cerca de 10% o risco de câncer de mama e, principalmente, o de pulmão, coração e outros cânceres. A UBS oferece tratamento gratuito para parar de fumar pelo SUS.</p>'
  };
}

function hormoneCard(a, r) {
  const hrt = r.post && a.hrt && a.hrt !== 'nunca';
  const oc = a.oc === 'atual' || a.oc === '1_4';
  if (!hrt && !oc) return null;
  const t = [];
  if (hrt) t.push('A terapia hormonal combinada (estrogênio com progestagênio) por 5 anos ou mais é a que mais aumenta o risco. Peça ao seu médico para reavaliar a necessidade, a dose e o tempo de uso.');
  if (oc) t.push('O risco extra da pílula é pequeno e volta ao normal cerca de 10 anos depois de parar. Decida com seu ginecologista, pesando também os benefícios.');
  t.push('Não interrompa nenhum hormônio por conta própria.');
  return {
    id: 'hormone', icon: 'pill', title: 'Hormônios', s: 'talk', chip: 'Conversar com o médico',
    head: 'Reavalie o uso de hormônios com seu médico',
    short: 'Reavaliar o uso de hormônios com seu médico',
    html: t.map(x => `<p>${x}</p>`).join('')
  };
}

/* ------------------------------------------------------------------ *
 *  Renderização
 * ------------------------------------------------------------------ */
const CAT_LABEL = { baixo: 'Risco baixo', moderado: 'Risco moderado', aumentado: 'Risco aumentado', alto: 'Risco alto' };
const CAT_SUM = {
  baixo: 'Seu perfil tem poucos fatores associados ao câncer de mama. Isso não zera o risco: a idade é o principal fator e muitas mulheres que desenvolvem a doença não têm fator marcante. Siga o rastreamento na idade indicada.',
  moderado: 'Seu perfil tem alguns fatores que elevam um pouco o risco. Siga o rastreamento na idade indicada e cuide dos fatores que você pode mudar.',
  aumentado: 'Seu perfil tem fatores que elevam o risco de forma importante. Converse com um profissional sobre começar o rastreamento mais cedo ou com mais frequência.',
  alto: 'Seu perfil tem fator de risco importante. Procure um mastologista ou serviço de referência para uma avaliação individual.'
};
const CAT_COLOR = { baixo: '#F29DBB', moderado: '#E5527C', aumentado: '#B3205F', alto: '#8A1548' };

function drivers(r) {
  const mag = f => (f.rr === null ? 99 : Math.abs(Math.log(f.rr)));
  const items = r.factors.slice().sort((x, y) => mag(y) - mag(x)).slice(0, 8);
  if (!items.length) return '<p>Nenhum fator relevante foi identificado nas suas respostas.</p>';
  const rows = items.map(f => {
    const up = f.rr === null || f.rr > 1;
    const w = f.rr === null ? 50 : Math.min(50, Math.abs(Math.log(f.rr)) / Math.log(3) * 50);
    const tag = f.rr === null ? 'alto impacto' : `×${fmt(f.rr.toFixed(2))}`;
    return `<div class="drv"><div class="drv-t"><span>${f.label}</span><span>${tag}</span></div><div class="drv-bar"><b class="${up ? 'up' : 'down'}" style="width:${w}%"></b></div></div>`;
  }).join('');
  return `${rows}<div class="axis"><span>reduz o risco</span><span>aumenta o risco</span></div>`;
}

function render(a, r) {
  form.hidden = true;
  $('#progress').hidden = true;
  $('#excluded').hidden = true;
  $('#result').hidden = false;

  $('#r-cat').textContent = CAT_LABEL[r.cat];
  $('#r-cat').dataset.c = r.cat;
  $('#r-title').textContent = 'Seu plano de cuidado';
  $('#r-sum').textContent = CAT_SUM[r.cat];
  $('#r-rr').textContent = `Risco estimado de cerca de ${fmt(r.rr.toFixed(1))} vez(es) o de uma mulher com perfil de referência.` +
    (r.major.length || r.refer.length ? ' O número não captura todo o impacto de mutações ou histórico familiar forte.' : '');

  // Medidor
  const fg = $('#g-fg');
  fg.style.stroke = CAT_COLOR[r.cat];
  $('#g-num').textContent = r.score;
  requestAnimationFrame(() => { fg.style.strokeDashoffset = 251.33 * (1 - r.score / 100); });

  // Alerta de sintomas
  $('#r-alert').innerHTML = r.symptoms.length
    ? `<div class="alert" role="alert">${icon('alert')}<p><strong>Você marcou uma mudança nas mamas.</strong> Procure uma Unidade Básica de Saúde ou um mastologista para avaliação clínica o quanto antes. Não espere a data do rastreamento nem o resultado desta ferramenta.</p></div>`
    : '';

  // Cartões
  const cards = [mamoCard(a, r), geneCard(a), activityCard(a), weightCard(a, r), alcoholCard(a), smokeCard(a), hormoneCard(a, r)].filter(Boolean);
  $('#r-cards').innerHTML = cards.map(c => `
    <article class="pcard" data-s="${c.s}">
      <div class="phead">${icon(c.icon)}<h4>${c.title}</h4><span class="chip" data-s="${c.s}">${c.chip}</span></div>
      <p class="big">${c.head}</p>
      ${c.html}
    </article>`).join('');

  // Próximos passos
  const stepsList = [];
  if (r.symptoms.length) stepsList.push('Procurar avaliação clínica das mamas o quanto antes');
  cards.filter(c => (c.s === 'action' || c.s === 'talk') && c.short).forEach(c => stepsList.push(c.short));
  const top = stepsList.slice(0, 4);
  $('#r-next').innerHTML = (top.length ? top : ['Manter os hábitos e a rotina de exames. Reavalie se algo mudar na sua saúde ou na família.'])
    .map(t => `<li><span>${t}</span></li>`).join('');

  // Fatores
  $('#r-drivers').innerHTML = drivers(r);
  const prot = r.factors.filter(f => f.rr !== null && f.rr < 1);
  $('#r-protect').innerHTML = prot.length
    ? `<p style="margin-top:1rem"><strong>O que já protege você</strong></p><div class="protect">${prot.map(f => `<span>${f.label}</span>`).join('')}</div>`
    : '';

  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  $('#r-title').focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ *
 *  Registro dos dados (Google Sheets via Apps Script)
 *  - envio anônimo, só com consentimento
 *  - fila local: se a internet cair, reenvia depois
 *  - id único por resposta: o servidor ignora duplicatas
 * ------------------------------------------------------------------ */
const QKEY = 'orq_pendentes_v1';
const qRead = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; } };
const qWrite = q => { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch { /* sem armazenamento */ } };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

function buildPayload(a, r) {
  const mag = f => (f.rr === null ? 99 : Math.abs(Math.log(f.rr)));
  const top = r.factors.slice().sort((x, y) => mag(y) - mag(x)).slice(0, 5)
    .map(f => `${f.label} (${f.rr === null ? 'alto impacto' : f.rr})`).join('; ');
  return {
    id: uuid(), token: CFG.TOKEN, eventId: EVENT_ID, appVersion: CFG.APP_VERSION,
    age: a.age, bmi: r1(r.bmi),
    menopause: a.meno, menopauseAge: a.menoAge, menarcheAge: a.menarche,
    famCount: a.famCount, famYoung: a.famYoung, famBilateral: a.famBilateral, famOvary: a.famOvary,
    famMale: a.famMale, famOtherCA: a.famOtherCA,
    geneMut: a.geneMut, chestRT: a.chestRT, biopsy: a.biopsy, density: a.density, lastMamo: a.lastMamo,
    births: a.births, firstBirthAge: a.firstBirth, breastfeedMonths: a.breastMonths,
    oc: a.oc, hrt: a.hrt,
    alcoholDosesWeek: a.alcohol, activityMinWeek: a.activity, smoking: a.smoke,
    hasSymptoms: r.symptoms.length > 0, symptoms: r.symptoms.join(', '),
    rr: r.rr, score: r.score, category: r.cat,
    flags: r.major.concat(r.refer).map(k => FLAG_TEXT[k]).join('; '),
    topFactors: top
  };
}

async function flush() {
  if (!CFG.SHEETS_URL) return 'teste';
  const q = qRead();
  if (!q.length) return 'ok';
  const rest = [];
  for (const p of q) {
    try {
      // text/plain evita o pré-voo CORS; "no-cors" porque o Apps Script não envia cabeçalhos CORS.
      await fetch(CFG.SHEETS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(p) });
    } catch { rest.push(p); }
  }
  qWrite(rest);
  return rest.length ? 'pendente' : 'ok';
}

function setStatus(kind) {
  const t = {
    ok: 'Respostas anônimas enviadas. Obrigada por contribuir com a pesquisa.',
    pendente: 'Sem conexão no momento: suas respostas serão enviadas quando a internet voltar.',
    teste: 'Modo de teste: nenhum dado foi enviado.',
    recusou: 'Suas respostas não foram enviadas, conforme sua escolha.'
  };
  $('#send-status').textContent = t[kind] || '';
}

function finish() {
  const a = read();
  const r = compute(a);
  render(a, r);
  if (!chk('consent')) { setStatus('recusou'); return; }
  const q = qRead(); q.push(buildPayload(a, r)); qWrite(q);
  flush().then(setStatus);
}

window.addEventListener('online', () => { flush(); });
flush();

syncConditionals();
go(0);

})();
