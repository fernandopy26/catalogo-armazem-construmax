/**
 * changelog.js
 * Painel de notas de atualização do sistema.
 * Exibe notificação + fogos apenas uma vez por versão.
 */

const CURRENT_VERSION = "2.3";
const LS_KEY          = "construmax_changelog_visto";

/* =========================================================
   Histórico de versões
   ========================================================= */

const VERSOES = [
  {
    versao: "2.3",
    data: "Junho 2026",
    titulo: "Registro de atualizações",
    atual: true,
    itens: [
      "Painel de notas de atualização com histórico completo do sistema",
      "Notificação visual com animação de fogos ao detectar nova versão",
      "Ponto pulsante no botão flutuante indica novidade não visualizada",
      "Notificação aparece somente uma vez por versão — nunca incomoda"
    ]
  },
  {
    versao: "2.2",
    data: "Maio 2026",
    titulo: "Funcionalidades avançadas",
    itens: [
      "Botões flutuantes de WhatsApp e Instagram com animação de pulso contínuo",
      "Busca sem acento — 'cimento' encontra 'cimentô', 'tinta' encontra 'tínta'",
      "Histórico dos últimos 20 pedidos enviados com opção de re-pedir",
      "Compartilhar produto específico via link direto copiado para a área de transferência",
      "Marcar item como Indisponível sem excluí-lo do catálogo",
      "Ordenar categorias e produtos com botões ↑↓ no painel admin",
      "Duplicar produto com um clique — ideal para variações",
      "PWA: catálogo instalável como app no celular via Chrome ou Safari",
      "Exportar relatório de estatísticas completo em arquivo CSV",
      "Carrinho exibe confirmação após envio ao WhatsApp com opção de limpar"
    ]
  },
  {
    versao: "2.1",
    data: "Maio 2026",
    titulo: "Correções e ajustes",
    itens: [
      "Ícones de e-mail e senha posicionados corretamente na tela de login",
      "Fuso horário corrigido no sistema de analytics — dados não são mais registrados no dia seguinte após 21h",
      "Mensagens do WhatsApp reformatadas: sem emojis quebrados, layout mais limpo e profissional",
      "Correção crítica no registro de analytics — dispositivos, origens e eventos agora salvos corretamente no Firestore",
      "Segurança reforçada: login obrigatório a cada nova aba ou reinício do navegador",
      "Botão 'Limpar estatísticas' protegido por senha no painel de análise"
    ]
  },
  {
    versao: "2.0",
    data: "Maio 2026",
    titulo: "Painel administrativo reformulado",
    itens: [
      "Interface do admin totalmente repaginada com tema nogueira e detalhes em latão",
      "Página de login com novo visual profissional — orb âmbar e grain de madeira",
      "Formulários reorganizados em seções com ícones, labels e layout em grade",
      "Preview de imagem integrado — veja a foto antes de salvar",
      "Painel de Estatísticas com gráficos interativos (Chart.js)",
      "Rastreamento de visitas únicas, dispositivos, origens de acesso, cliques no WhatsApp e buscas",
      "Dashboard com gráfico de linha (30 dias), doughnuts de dispositivos e origens, ranking de categorias",
      "Botão 'Limpar dados' com proteção por senha"
    ]
  },
  {
    versao: "1.4",
    data: "Abril 2026",
    titulo: "Tema amadeirado",
    itens: [
      "Fundo em madeira nogueira com grão direcional gerado via SVG fractal",
      "Iluminação quente de galpão vinda do canto superior — sem imagem externa",
      "Detalhes em latão: rebites nas categorias, régua luminosa no hero, moldura na capa",
      "Paleta creme quente no texto principal em vez do branco frio",
      "Grain de madeira nas superfícies do admin e do painel de estatísticas"
    ]
  },
  {
    versao: "1.3",
    data: "Abril 2026",
    titulo: "Otimizações para celular",
    itens: [
      "Pinch-zoom fluido — remoção do mix-blend-mode que causava travamento no zoom",
      "Correção do force-dark do Opera Mobile — título não ficava mais escuro",
      "color-scheme: only dark declarado — navegadores não invertem as cores do site",
      "touch-action: manipulation elimina o delay de 300ms nos botões",
      "Input de busca com 16px evita zoom automático do iOS Safari ao tocar",
      "content-visibility: auto nas categorias — renderização progressiva e mais rápida"
    ]
  },
  {
    versao: "1.2",
    data: "Abril 2026",
    titulo: "Carrinho de compras",
    itens: [
      "Botão de adicionar ao carrinho em cada produto ao lado do WhatsApp",
      "Painel deslizante com lista de itens, controle de quantidade e total em tempo real",
      "Seleção de forma de pagamento: Pix, Dinheiro, Débito ou Crédito",
      "Mensagem automática e formatada enviada diretamente ao WhatsApp",
      "Persistência via localStorage — carrinho salvo mesmo ao fechar e reabrir a aba",
      "Limite de 30 tipos de itens com aviso visual ao atingir"
    ]
  },
  {
    versao: "1.1",
    data: "Março 2026",
    titulo: "Repaginação visual completa",
    itens: [
      "Paleta profissional com slate profundo e âmbar quente, tipografia Inter",
      "Splash de abertura com orb animado e nome da loja carregado do Firebase",
      "Scroll reveal nas categorias, barra de progresso de scroll no topo",
      "Botão 'Voltar ao topo' flutuante com aparição suave",
      "Ícones SVG inline substituindo emojis em todos os botões",
      "Skeleton shimmer durante o carregamento dos produtos",
      "Micro-interações: hover refinado, glow âmbar, zoom suave nas imagens"
    ]
  },
  {
    versao: "1.0",
    data: "Março 2026",
    titulo: "Lançamento do catálogo",
    itens: [
      "Catálogo digital com categorias e produtos organizados",
      "Integração completa com Firebase Firestore para dados em tempo real",
      "Painel administrativo com CRUD completo de categorias e produtos",
      "Upload de imagens via ImgBB sem necessidade de servidor próprio",
      "Botão de contato via WhatsApp em cada produto com mensagem pré-formatada",
      "Busca por nome de item ou categoria",
      "Filtro por categoria com carrossel horizontal",
      "Layout totalmente responsivo para celular e desktop"
    ]
  }
];

/* =========================================================
   Estado e controle
   ========================================================= */

let _painelAberto = false;

function jaViu() {
  return localStorage.getItem(LS_KEY) === CURRENT_VERSION;
}

function marcarVisto() {
  localStorage.setItem(LS_KEY, CURRENT_VERSION);
  const dot = document.getElementById("changelogDot");
  if (dot) dot.style.display = "none";
}

/* =========================================================
   Injeção de HTML
   ========================================================= */

function injetarHTML() {
  const grainy = "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300'%3E%3Cfilter id='cl'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.013 0.40' numOctaves='3' seed='8' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.28  0 0 0 0 0.14  0 0 0 0.50 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23cl)'/%3E%3C/svg%3E\")";

  document.body.insertAdjacentHTML("beforeend", `

    <!-- Botão flutuante changelog -->
    <button id="btnChangelog" class="float-changelog" aria-label="Ver histórico de atualizações">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <span class="cl-label">Atualizações</span>
      <span class="cl-version">v${CURRENT_VERSION}</span>
      <span id="changelogDot" class="changelog-dot" style="display:none" aria-hidden="true"></span>
    </button>

    <!-- Painel de histórico -->
    <div id="changelogOverlay" class="changelog-overlay" aria-hidden="true">
      <div class="changelog-panel" role="dialog" aria-modal="true" aria-label="Histórico de atualizações">

        <div class="changelog-header">
          <div class="changelog-header-left">
            <div class="changelog-header-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div>
              <h2 class="changelog-titulo">Registro de Atualizações</h2>
              <span class="changelog-version-badge">v${CURRENT_VERSION} — versão atual</span>
            </div>
          </div>
          <button id="btnFecharChangelog" class="cl-btn-fechar" aria-label="Fechar painel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div id="changelogConteudo" class="changelog-conteudo"></div>

      </div>
    </div>

    <!-- Notificação de nova versão (centro da tela) -->
    <div id="changelogNotif" class="cl-notif-overlay" style="display:none" aria-hidden="true">
      <div class="cl-notif-card">
        <div class="cl-notif-sparkle" aria-hidden="true">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="rgba(212,160,69,.2)" stroke="#ebc478"/>
          </svg>
        </div>
        <p class="cl-notif-titulo">Nova Atualização!</p>
        <span class="cl-notif-versao">v${CURRENT_VERSION}</span>
        <p class="cl-notif-sub">O sistema foi atualizado com novas funcionalidades.</p>
        <p class="cl-notif-cta">Confira o que há de novo</p>
        <button id="btnVerNovidades" class="cl-notif-btn">
          Ver novidades
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
        <button id="btnDismissNotif" class="cl-notif-dismiss">Fechar</button>
      </div>
    </div>

  `);
}

/* =========================================================
   Renderização do conteúdo
   ========================================================= */

function renderConteudo() {
  const el = document.getElementById("changelogConteudo");
  if (!el || el.innerHTML) return; // já renderizado

  el.innerHTML = VERSOES.map((v, i) => `
    <div class="changelog-entry${v.atual ? " changelog-entry-atual" : ""}">
      <div class="changelog-entry-header">
        <span class="cl-v-badge${v.atual ? " cl-v-atual" : ""}">v${v.versao}</span>
        <div class="changelog-entry-info">
          <span class="changelog-entry-titulo">${v.titulo}</span>
          <span class="changelog-entry-data">${v.data}</span>
        </div>
      </div>
      <ul class="changelog-entry-lista">
        ${v.itens.map(item => `<li>${item}</li>`).join("")}
      </ul>
      ${i < VERSOES.length - 1 ? '<hr class="changelog-divider">' : ""}
    </div>
  `).join("");
}

/* =========================================================
   Painel — abrir / fechar
   ========================================================= */

function abrirPainel() {
  const overlay = document.getElementById("changelogOverlay");
  if (!overlay) return;
  renderConteudo();
  overlay.classList.add("aberto");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  _painelAberto = true;
  marcarVisto();
  // Fecha a notificação se ainda estiver aberta
  fecharNotificacao();
}

function fecharPainel() {
  const overlay = document.getElementById("changelogOverlay");
  if (!overlay) return;
  overlay.classList.remove("aberto");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  _painelAberto = false;
}

/* =========================================================
   Notificação central
   ========================================================= */

function mostrarNotificacao() {
  const notif = document.getElementById("changelogNotif");
  if (!notif) return;
  notif.style.display = "flex";
  notif.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => notif.classList.add("visivel"));
  });

  // Auto-fechar em 10s
  setTimeout(fecharNotificacao, 10000);
}

function fecharNotificacao() {
  const notif = document.getElementById("changelogNotif");
  if (!notif) return;
  notif.classList.remove("visivel");
  setTimeout(() => {
    notif.style.display = "none";
    notif.setAttribute("aria-hidden", "true");
  }, 400);
}

/* =========================================================
   Animação de fogos
   ========================================================= */

function lancarFogos() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;z-index:7999;pointer-events:none;";
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const W   = canvas.width;
  const H   = canvas.height;

  const CORES = [
    "#d4a045", "#ebc478", "#ffffff", "#f97316",
    "#22c55e", "#3b82f6", "#a855f7", "#ef4444",
    "#fbbf24", "#f0abfc"
  ];

  class Particula {
    constructor(x, y) {
      const cor      = CORES[Math.floor(Math.random() * CORES.length)];
      const angulo   = Math.random() * Math.PI * 2;
      const vel      = 2.5 + Math.random() * 5.5;
      this.x         = x;
      this.y         = y;
      this.cor       = cor;
      this.vx        = Math.cos(angulo) * vel;
      this.vy        = Math.sin(angulo) * vel - 1;
      this.vida      = 1;
      this.decaimento= 0.014 + Math.random() * 0.018;
      this.r         = 1.8 + Math.random() * 2.4;
      this.trilha    = [];
    }

    atualizar() {
      this.trilha.push({ x: this.x, y: this.y, vida: this.vida });
      if (this.trilha.length > 5) this.trilha.shift();
      this.x   += this.vx;
      this.y   += this.vy;
      this.vy  += 0.09;
      this.vx  *= 0.97;
      this.vida -= this.decaimento;
    }

    desenhar() {
      // Trilha
      this.trilha.forEach((p, i) => {
        ctx.save();
        ctx.globalAlpha = p.vida * (i / this.trilha.length) * 0.4;
        ctx.fillStyle   = this.cor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      // Partícula
      ctx.save();
      ctx.globalAlpha  = Math.max(0, this.vida);
      ctx.fillStyle    = this.cor;
      ctx.shadowColor  = this.cor;
      ctx.shadowBlur   = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function explodir(x, y) {
    const qtd = 38 + Math.floor(Math.random() * 18);
    for (let i = 0; i < qtd; i++) {
      particulas.push(new Particula(x, y));
    }
  }

  const particulas = [];
  let frame = 0;

  // Cronograma de explosões
  const explosoes = [
    { em: 8,  x: 0.22, y: 0.30 }, { em: 18, x: 0.78, y: 0.25 },
    { em: 30, x: 0.50, y: 0.20 }, { em: 44, x: 0.18, y: 0.40 },
    { em: 56, x: 0.82, y: 0.35 }, { em: 68, x: 0.40, y: 0.28 },
    { em: 80, x: 0.65, y: 0.22 }, { em: 94, x: 0.30, y: 0.32 },
    { em:108, x: 0.72, y: 0.38 }, { em:120, x: 0.55, y: 0.18 },
    { em:132, x: 0.25, y: 0.42 }, { em:144, x: 0.85, y: 0.28 },
  ];

  function animar() {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, W, H);

    // Disparar explosões agendadas
    for (let i = explosoes.length - 1; i >= 0; i--) {
      if (frame >= explosoes[i].em) {
        explodir(W * explosoes[i].x, H * explosoes[i].y);
        explosoes.splice(i, 1);
      }
    }

    // Atualizar e desenhar partículas
    for (let i = particulas.length - 1; i >= 0; i--) {
      particulas[i].atualizar();
      particulas[i].desenhar();
      if (particulas[i].vida <= 0) particulas.splice(i, 1);
    }

    frame++;

    if (frame < 160 || particulas.length > 0) {
      requestAnimationFrame(animar);
    } else {
      // Fade out canvas
      let op = 1;
      const fade = setInterval(() => {
        op -= 0.06;
        canvas.style.opacity = Math.max(0, op);
        if (op <= 0) { clearInterval(fade); canvas.remove(); }
      }, 20);
    }
  }

  animar();
}

/* =========================================================
   Eventos
   ========================================================= */

function registrarEventos() {
  document.getElementById("btnChangelog")
    ?.addEventListener("click", () => {
      if (_painelAberto) fecharPainel(); else abrirPainel();
    });

  document.getElementById("btnFecharChangelog")
    ?.addEventListener("click", fecharPainel);

  document.getElementById("changelogOverlay")
    ?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) fecharPainel();
    });

  document.getElementById("btnVerNovidades")
    ?.addEventListener("click", abrirPainel);

  document.getElementById("btnDismissNotif")
    ?.addEventListener("click", () => {
      fecharNotificacao();
      marcarVisto();
    });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && _painelAberto) fecharPainel();
  });
}

/* =========================================================
   Ponto pulsante
   ========================================================= */

function ativarPonto() {
  const dot = document.getElementById("changelogDot");
  if (dot) dot.style.display = "flex";
}

/* =========================================================
   Bootstrap público
   ========================================================= */

export function iniciarChangelog() {
  injetarHTML();
  registrarEventos();

  if (!jaViu()) {
    ativarPonto();
    // Pequeno delay para não competir com o carregamento do admin
    setTimeout(() => {
      lancarFogos();
      setTimeout(mostrarNotificacao, 900);
    }, 700);
  }
}
