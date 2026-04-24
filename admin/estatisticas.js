import { db, auth } from "../config/firebase.js";
import {
  collection, getDocs, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================================================
   Autenticação
   ========================================================= */

// Mesmo portão de sessão do admin.js
if (!sessionStorage.getItem("admin_ok")) {
  signOut(auth).catch(() => {});
  window.location.href = "login.html";
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    configurarModalLimpar();
    await carregar();
  });
}

/* =========================================================
   Paleta de cores dos gráficos
   ========================================================= */

const COR = {
  amber:    "rgba(212,160,69,0.85)",
  amberL:   "rgba(235,196,120,0.85)",
  green:    "rgba(34,197,94,0.80)",
  blue:     "rgba(99,140,255,0.80)",
  purple:   "rgba(168,85,247,0.80)",
  pink:     "rgba(225,48,108,0.80)",
  orange:   "rgba(249,115,22,0.80)",
  gray:     "rgba(150,130,100,0.65)",
  red:      "rgba(239,68,68,0.80)",
};

const DISPOSITIVO_COR  = { mobile: COR.amber, desktop: COR.blue, tablet: COR.green };
const DISPOSITIVO_NOME = { mobile: "Celular", desktop: "Desktop", tablet: "Tablet" };

const ORIGEM_COR  = {
  instagram: COR.pink,
  whatsapp:  COR.green,
  google:    COR.blue,
  direto:    COR.amber,
  facebook:  "rgba(66,133,244,0.80)",
  outro:     COR.gray,
};
const ORIGEM_NOME = {
  instagram: "Instagram",
  whatsapp:  "WhatsApp",
  google:    "Google",
  direto:    "Acesso direto",
  facebook:  "Facebook",
  outro:     "Outro",
};

const NAVEGADOR_NOME = {
  chrome: "Chrome", safari: "Safari", firefox: "Firefox",
  edge: "Edge", opera: "Opera", outro: "Outro",
};

/* =========================================================
   Carregamento de dados
   ========================================================= */

async function carregarDados() {
  const snap = await getDocs(collection(db, "analytics"));

  const limite = new Date();
  limite.setDate(limite.getDate() - 30);
  // Data local (não UTC) para evitar que o corte seja um dia errado no Brasil
  const mm = String(limite.getMonth() + 1).padStart(2, "0");
  const dd = String(limite.getDate()).padStart(2, "0");
  const minData = `${limite.getFullYear()}-${mm}-${dd}`;

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.id) && d.id >= minData)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function agregar(docs) {
  const a = {
    visitas_unicas: 0, sessoes: 0,
    dispositivos: {}, navegadores: {}, origens: {},
    eventos: { whatsapp_item: 0, whatsapp_loja: 0, carrinho: 0, buscas: 0 },
    categorias: {}, buscas: {}
  };

  for (const d of docs) {
    a.visitas_unicas += d.visitas_unicas || 0;
    a.sessoes        += d.sessoes        || 0;
    juntarObjeto(a.dispositivos, d.dispositivos || {});
    juntarObjeto(a.navegadores,  d.navegadores  || {});
    juntarObjeto(a.origens,      d.origens      || {});
    juntarObjeto(a.eventos,      d.eventos      || {});
    juntarObjeto(a.categorias,   d.categorias   || {});
    juntarObjeto(a.buscas,       d.buscas       || {});
  }

  return a;
}

function juntarObjeto(alvo, fonte) {
  for (const [k, v] of Object.entries(fonte)) {
    alvo[k] = (alvo[k] || 0) + (Number(v) || 0);
  }
}

/* =========================================================
   Renderização
   ========================================================= */

function mostrarEstado(html) {
  document.getElementById("estadoPagina").innerHTML = html;
  document.getElementById("estadoPagina").style.display = "flex";
  document.getElementById("conteudo").style.display = "none";
}

function mostrarConteudo() {
  document.getElementById("estadoPagina").style.display = "none";
  document.getElementById("conteudo").style.display = "block";
}

/* ---- Cards de resumo ---- */

function renderCards(agg) {
  const cards = [
    {
      label: "Visitas únicas",
      valor: fmt(agg.visitas_unicas),
      sub: "visitantes distintos por dia",
      cor: COR.amber,
      svg: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
    },
    {
      label: "Sessões",
      valor: fmt(agg.sessoes),
      sub: "aberturas de aba",
      cor: COR.blue,
      svg: `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`,
    },
    {
      label: "Cliques WhatsApp",
      valor: fmt((agg.eventos.whatsapp_item || 0) + (agg.eventos.whatsapp_loja || 0)),
      sub: `${agg.eventos.whatsapp_item || 0} em produtos · ${agg.eventos.whatsapp_loja || 0} na loja`,
      cor: COR.green,
      svg: `<path d="M20.52 3.48A12 12 0 0 0 3.48 20.52L2 22l1.58-1.44A12 12 0 1 0 20.52 3.48z" fill="currentColor"/>`,
      fill: true,
    },
    {
      label: "Adicionados ao carrinho",
      valor: fmt(agg.eventos.carrinho || 0),
      sub: "cliques em 'adicionar'",
      cor: COR.amber,
      svg: `<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>`,
    },
  ];

  document.getElementById("cardsGrid").innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-icon" style="background:${c.cor}1a;color:${c.cor}">
        <svg viewBox="0 0 24 24" fill="${c.fill ? 'currentColor' : 'none'}" stroke="${c.fill ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${c.svg}
        </svg>
      </div>
      <div class="stat-valor">${c.valor}</div>
      <div class="stat-label">${c.label}</div>
      <div class="stat-sub">${c.sub}</div>
    </div>
  `).join("");
}

/* ---- Gráfico de linha: visitas por dia ---- */

function graficoLinha(docs) {
  const labels  = docs.map(d => formatarData(d.id));
  const visitas = docs.map(d => d.visitas_unicas || 0);
  const sessoes = docs.map(d => d.sessoes || 0);

  criarGrafico("graficoLinha", "line", {
    labels,
    datasets: [
      {
        label: "Visitas únicas",
        data: visitas,
        borderColor: COR.amber,
        backgroundColor: "rgba(212,160,69,0.10)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: "Sessões",
        data: sessoes,
        borderColor: COR.blue,
        backgroundColor: "rgba(99,140,255,0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderDash: [4, 3],
      },
    ],
  }, {
    scales: {
      x: {
        ticks: { color: "#7d6f5a", maxTicksLimit: 10, font: { size: 11 } },
        grid: { color: "rgba(212,160,69,0.07)" },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#7d6f5a", font: { size: 11 }, precision: 0 },
        grid: { color: "rgba(212,160,69,0.07)" },
      },
    },
    plugins: {
      legend: {
        labels: { color: "#c2b5a0", font: { size: 12 }, boxWidth: 12 },
      },
    },
  });
}

/* ---- Doughnut genérico ---- */

function graficoDoughnut(canvasId, dadosObj, nomesMap, coresMap) {
  const entradas = Object.entries(dadosObj)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (entradas.length === 0) {
    document.getElementById(canvasId)
      .closest(".card-grafico")
      .querySelector(".chart-container-sm")
      .innerHTML = "<p class='vazio-msg'>Sem dados.</p>";
    return;
  }

  const labels = entradas.map(([k]) => nomesMap[k] || k);
  const data   = entradas.map(([, v]) => v);
  const bg     = entradas.map(([k]) => coresMap[k] || COR.gray);

  criarGrafico(canvasId, "doughnut", {
    labels,
    datasets: [{ data, backgroundColor: bg, borderWidth: 1, borderColor: "rgba(255,255,255,.05)" }],
  }, {
    cutout: "62%",
    plugins: {
      legend: {
        position: "right",
        labels: { color: "#c2b5a0", font: { size: 12 }, boxWidth: 12, padding: 12 },
      },
    },
  });
}

/* ---- Bar: categorias mais vistas ---- */

function graficoCategorias(agg) {
  const top = Object.entries(agg.categorias)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (top.length === 0) {
    document.getElementById("graficoCategorias")
      .parentElement
      .innerHTML = "<p class='vazio-msg'>Nenhuma categoria rastreada ainda.</p>";
    return;
  }

  criarGrafico("graficoCategorias", "bar", {
    labels: top.map(([k]) => k),
    datasets: [{
      label: "Visualizações",
      data: top.map(([, v]) => v),
      backgroundColor: COR.amber,
      borderRadius: 5,
      borderSkipped: false,
    }],
  }, {
    indexAxis: "y",
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { color: "#7d6f5a", font: { size: 11 }, precision: 0 },
        grid: { color: "rgba(212,160,69,0.07)" },
      },
      y: {
        ticks: { color: "#c2b5a0", font: { size: 12 } },
        grid: { display: false },
      },
    },
  });
}

/* ---- Listas ranqueadas ---- */

function renderLista(idEl, dadosObj, nomesMap = {}) {
  const el      = document.getElementById(idEl);
  const top     = Object.entries(dadosObj)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (top.length === 0) {
    el.innerHTML = "<li><p class='vazio-msg'>Sem dados registrados ainda.</p></li>";
    return;
  }

  const max = top[0][1] || 1;

  el.innerHTML = top.map(([k, v], i) => `
    <li>
      <span class="rank-num">${i + 1}</span>
      <span class="rank-nome">${nomesMap[k] || k}</span>
      <span class="rank-barra-wrap">
        <span class="rank-barra" style="width:${Math.round((v / max) * 100)}%"></span>
      </span>
      <span class="rank-val">${fmt(v)}</span>
    </li>
  `).join("");
}

/* ---- Tabela diária ---- */

function renderTabela(docs) {
  const tbody = document.getElementById("tabelaCorpo");
  const linhas = [...docs].reverse().slice(0, 14);

  if (linhas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="vazio-msg">Sem dados.</td></tr>`;
    return;
  }

  tbody.innerHTML = linhas.map(d => {
    const ev      = d.eventos || {};
    const wa      = (ev.whatsapp_item || 0) + (ev.whatsapp_loja || 0);
    const cart    = ev.carrinho || 0;
    const buscas  = ev.buscas   || 0;

    return `
      <tr>
        <td class="data-col">${formatarData(d.id)}</td>
        <td class="num-col">${fmt(d.visitas_unicas || 0)}</td>
        <td class="num-col">${fmt(d.sessoes || 0)}</td>
        <td class="num-col ${wa   > 0 ? 'dest-col' : ''}">${fmt(wa)}</td>
        <td class="num-col ${cart > 0 ? 'dest-col' : ''}">${fmt(cart)}</td>
        <td class="num-col">${fmt(buscas)}</td>
      </tr>
    `;
  }).join("");
}

/* =========================================================
   Helpers de formato
   ========================================================= */

function fmt(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

function formatarData(iso) {
  // "2026-04-23" → "23 abr"
  const [, m, d] = iso.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]}`;
}

/* =========================================================
   Chart.js wrapper
   ========================================================= */

const charts = {};

function criarGrafico(id, tipo, data, opcoesExtra = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;

  if (charts[id]) { charts[id].destroy(); }

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      tooltip: {
        backgroundColor: "rgba(31,24,17,.95)",
        borderColor: "rgba(212,160,69,.30)",
        borderWidth: 1,
        titleColor: "#f5eee0",
        bodyColor: "#c2b5a0",
        padding: 10,
      },
    },
    animation: { duration: 600 },
  };

  charts[id] = new Chart(canvas, {
    type: tipo,
    data,
    options: deepMerge(baseOpts, opcoesExtra),
  });
}

function deepMerge(a, b) {
  const result = { ...a };
  for (const [k, v] of Object.entries(b)) {
    result[k] = (v && typeof v === "object" && !Array.isArray(v) && a[k])
      ? deepMerge(a[k], v)
      : v;
  }
  return result;
}

/* =========================================================
   Modal — Limpar estatísticas
   ========================================================= */

const SENHA_CONFIRMACAO = "1234";

function abrirModalLimpar() {
  const modal = document.getElementById("modalLimpar");
  document.getElementById("senhaLimpar").value = "";
  document.getElementById("erroSenhaLimpar").textContent = "";
  modal.classList.add("aberto");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => document.getElementById("senhaLimpar").focus(), 80);
}

function fecharModalLimpar() {
  const modal = document.getElementById("modalLimpar");
  modal.classList.remove("aberto");
  modal.setAttribute("aria-hidden", "true");
}

async function executarLimpeza() {
  const btn = document.getElementById("btnConfirmarLimpar");
  btn.disabled = true;
  btn.textContent = "Apagando…";

  try {
    const snap = await getDocs(collection(db, "analytics"));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "analytics", d.id))));

    fecharModalLimpar();

    // Mostra estado vazio sem recarregar a página
    mostrarEstado(`
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.35">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      </svg>
      <strong style="color:#c2b5a0">Dados apagados com sucesso</strong>
      <span style="max-width:300px;line-height:1.6;color:#7d6f5a">
        Novos registros aparecerão aqui conforme os visitantes acessarem o catálogo.
      </span>
    `);

    document.getElementById("periodoLabel").textContent = "Últimos 30 dias";

  } catch (err) {
    console.error("Erro ao limpar estatísticas:", err);
    document.getElementById("erroSenhaLimpar").textContent = "Erro ao apagar os dados. Tente novamente.";
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="14" height="14">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      </svg>
      Apagar tudo
    `;
  }
}

function configurarModalLimpar() {
  document.getElementById("btnLimparDados")
    ?.addEventListener("click", abrirModalLimpar);

  document.getElementById("btnCancelarLimpar")
    ?.addEventListener("click", fecharModalLimpar);

  // Fechar clicando fora do card
  document.getElementById("modalLimpar")
    ?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) fecharModalLimpar();
    });

  // Fechar com Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharModalLimpar();
  });

  document.getElementById("btnConfirmarLimpar")
    ?.addEventListener("click", () => {
      const senha = document.getElementById("senhaLimpar").value;
      const erroEl = document.getElementById("erroSenhaLimpar");

      if (!senha) {
        erroEl.textContent = "Digite a senha para continuar.";
        return;
      }

      if (senha !== SENHA_CONFIRMACAO) {
        erroEl.textContent = "Senha incorreta.";
        document.getElementById("senhaLimpar").value = "";
        document.getElementById("senhaLimpar").focus();
        return;
      }

      erroEl.textContent = "";
      executarLimpeza();
    });

  // Enter no campo de senha confirma
  document.getElementById("senhaLimpar")
    ?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("btnConfirmarLimpar").click();
    });
}

/* =========================================================
   Bootstrap
   ========================================================= */

async function carregar() {
  try {
    const docs = await carregarDados();

    if (docs.length === 0) {
      mostrarEstado(`
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.35">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6"  y1="20" x2="6"  y2="14"/>
        </svg>
        <strong style="color:#c2b5a0">Nenhum dado registrado ainda</strong>
        <span style="max-width:320px;line-height:1.6">
          Assim que visitantes acessarem o catálogo, as estatísticas aparecerão aqui automaticamente.
        </span>
      `);
      return;
    }

    // Atualiza período no header
    if (docs.length > 0) {
      const ini = formatarData(docs[0].id);
      const fim = formatarData(docs[docs.length - 1].id);
      const el  = document.getElementById("periodoLabel");
      if (el) el.textContent = `${ini} → ${fim}`;
    }

    const agg = agregar(docs);

    mostrarConteudo();

    renderCards(agg);
    graficoLinha(docs);
    graficoDoughnut("graficoDispositivos", agg.dispositivos, DISPOSITIVO_NOME, DISPOSITIVO_COR);
    graficoDoughnut("graficoOrigens",      agg.origens,      ORIGEM_NOME,      ORIGEM_COR);
    graficoCategorias(agg);
    renderLista("listaBuscas",    agg.buscas,    {});
    renderLista("listaNavegadores", agg.navegadores, NAVEGADOR_NOME);
    renderTabela(docs);

  } catch (err) {
    console.error("Erro ao carregar estatísticas:", err);
    mostrarEstado(`
      <span style="color:#ef4444;font-size:15px">Erro ao carregar os dados.</span>
      <span style="color:#7d6f5a">Verifique as regras do Firestore e tente novamente.</span>
    `);
  }
}
