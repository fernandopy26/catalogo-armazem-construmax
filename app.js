import { db } from "./config/firebase.js";
import {
  collection, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  trackVisita, trackCategoria, trackWhatsApp, trackCarrinho, trackBusca
} from "./analytics.js";

/* =========================================================
   Estado global
   ========================================================= */

const container = document.getElementById("categorias");
const campoBusca = document.getElementById("campoBusca");

let dadosCatalogo = [];
let whatsappLoja  = "";
let categoriaSelecionada = null;
let revealObserver = null;

const itemsMap = new Map();

/* =========================================================
   Helpers de texto
   ========================================================= */

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function escaparHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escaparAttr(texto) {
  return String(texto ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatarPreco(valor) {
  if (!valor) return "Preço não informado";
  const numero = Number(
    String(valor).replace("R$","").replace(/\s/g,"").replace(/\./g,"").replace(",",".")
  );
  if (isNaN(numero)) return `R$ ${valor}`;
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* =========================================================
   Carrinho — estado e persistência
   ========================================================= */

const CART_KEY  = "construmax_carrinho_v1";
const CART_MAX  = 30;
let carrinho    = [];

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) carrinho = JSON.parse(raw);
    if (!Array.isArray(carrinho)) carrinho = [];
  } catch { carrinho = []; }
}

function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(carrinho)); } catch {}
  atualizarBadge();
}

function addToCart(item) {
  const existing = carrinho.find(c => c.cartKey === item.cartKey);
  if (existing) { existing.quantidade += 1; saveCart(); return; }
  if (carrinho.length >= CART_MAX) { mostrarToast(`Limite de ${CART_MAX} itens diferentes atingido`); return; }
  carrinho.push({
    cartKey: item.cartKey, nome: item.nome,
    precoRaw: item.preco, precoFormatado: formatarPreco(item.preco),
    imagem: item.imagem || "", quantidade: 1
  });
  saveCart();
  trackCarrinho();
  mostrarToast(`${item.nome} adicionado`);
}

function removeFromCart(cartKey) {
  carrinho = carrinho.filter(c => c.cartKey !== cartKey);
  saveCart(); renderCarrinho();
}

function atualizarQuantidade(cartKey, delta) {
  const entry = carrinho.find(c => c.cartKey === cartKey);
  if (!entry) return;
  const nova = entry.quantidade + delta;
  if (nova < 1) { removeFromCart(cartKey); return; }
  entry.quantidade = nova;
  saveCart(); renderCarrinho();
}

function calcularTotal() {
  return carrinho.reduce((acc, e) => {
    const n = Number(String(e.precoRaw).replace("R$","").replace(/\s/g,"").replace(/\./g,"").replace(",","."));
    return acc + (isNaN(n) ? 0 : n * e.quantidade);
  }, 0);
}

/* =========================================================
   Carrinho — UI
   ========================================================= */

function atualizarBadge() {
  const total  = carrinho.reduce((s, c) => s + c.quantidade, 0);
  const badge  = document.getElementById("carrinhoContador");
  const header = document.getElementById("carrinhoHeaderCount");
  if (badge)  { badge.textContent = total; badge.classList.toggle("visivel", total > 0); }
  if (header) { header.textContent = total > 0 ? `(${total} ${total === 1 ? "item" : "itens"})` : ""; }
}

function renderCarrinho() {
  const lista   = document.getElementById("carrinhoLista");
  const vazio   = document.getElementById("carrinhoVazio");
  const rodape  = document.getElementById("carrinhoRodape");
  const totalEl = document.getElementById("carrinhoTotal");
  const avisoEl = document.getElementById("carrinhoAvisoLimite");
  const sucesso = document.getElementById("carrinhoSucesso");
  const btnComp = document.getElementById("btnComprar");
  if (!lista) return;

  const isEmpty = carrinho.length === 0;
  lista.style.display  = isEmpty ? "none" : "flex";
  vazio.style.display  = isEmpty ? "flex" : "none";
  rodape.style.display = isEmpty ? "none" : "flex";

  // Ocultar estado de sucesso ao re-renderizar
  if (sucesso) sucesso.style.display = "none";
  if (btnComp) btnComp.style.display = "";

  if (isEmpty) return;

  lista.innerHTML = carrinho.map(e => `
    <div class="carrinho-item" data-cart-key="${escaparAttr(e.cartKey)}">
      <img src="${escaparAttr(e.imagem)}" alt="${escaparAttr(e.nome)}" class="carrinho-item-img" loading="lazy">
      <div class="carrinho-item-info">
        <p class="carrinho-item-nome">${escaparHTML(e.nome)}</p>
        <p class="carrinho-item-preco">${escaparHTML(e.precoFormatado)}</p>
      </div>
      <div class="carrinho-item-controles">
        <button class="btn-qtd" data-cart-key="${escaparAttr(e.cartKey)}" data-delta="-1" aria-label="Diminuir">−</button>
        <span class="carrinho-qtd">${e.quantidade}</span>
        <button class="btn-qtd" data-cart-key="${escaparAttr(e.cartKey)}" data-delta="1" aria-label="Aumentar">+</button>
      </div>
      <button class="btn-remover" data-cart-key="${escaparAttr(e.cartKey)}" aria-label="Remover">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  `).join("");

  const total = calcularTotal();
  if (totalEl) totalEl.textContent = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (avisoEl) avisoEl.textContent = carrinho.length >= CART_MAX ? `Limite de ${CART_MAX} tipos de itens atingido` : "";
  atualizarBadge();
}

function abrirCarrinho() {
  const overlay = document.getElementById("carrinhoOverlay");
  if (!overlay) return;
  renderCarrinho();
  overlay.classList.add("aberto");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function fecharCarrinho() {
  const overlay = document.getElementById("carrinhoOverlay");
  if (!overlay) return;
  overlay.classList.remove("aberto");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function mostrarSucesso() {
  const btnComp = document.getElementById("btnComprar");
  const sucesso = document.getElementById("carrinhoSucesso");
  if (btnComp) btnComp.style.display = "none";
  if (sucesso) sucesso.style.display = "block";
}

function gerarMensagemPedido() {
  const pagamento = document.getElementById("formaPagamento")?.value || "Pix";
  const total = calcularTotal().toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const linhas = carrinho.map(e => {
    const n = Number(String(e.precoRaw).replace("R$","").replace(/\s/g,"").replace(/\./g,"").replace(",","."));
    const sub = (!isNaN(n) && e.quantidade > 1)
      ? ` — subtotal: ${(n * e.quantidade).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
      : "";
    return `  - ${e.quantidade}x ${e.nome} (${e.precoFormatado} cada)${sub}`;
  });
  return [
    "Ola! Vim pelo catalogo e gostaria de fazer um pedido.",
    "", "*Itens do pedido:*", ...linhas, "",
    `*Total estimado:* ${total}`, `*Pagamento:* ${pagamento}`,
    "", "Aguardo confirmacao, obrigado!"
  ].join("\n");
}

/* =========================================================
   Histórico de pedidos
   ========================================================= */

const HIST_KEY  = "construmax_historico_v1";
const HIST_MAX  = 20;

function loadHistorico() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch { return []; }
}

function saveHistorico(hist) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(hist)); } catch {}
}

function addToHistorico() {
  if (!carrinho.length) return;
  const pagamento = document.getElementById("formaPagamento")?.value || "Pix";
  const total = calcularTotal().toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const now   = new Date();
  const entrada = {
    id: now.getTime(),
    data: now.toLocaleDateString("pt-BR"),
    hora: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    itens: carrinho.map(e => ({ ...e })),
    total,
    pagamento
  };
  const hist = [entrada, ...loadHistorico()].slice(0, HIST_MAX);
  saveHistorico(hist);
}

function renderHistorico() {
  const conteudo = document.getElementById("historicoConteudo");
  const rodape   = document.getElementById("historicoRodape");
  if (!conteudo) return;

  const hist = loadHistorico();

  if (hist.length === 0) {
    conteudo.innerHTML = `
      <div class="historico-vazio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <strong>Nenhum pedido ainda</strong>
        <span>Seus pedidos enviados pelo WhatsApp aparecerão aqui.</span>
      </div>`;
    if (rodape) rodape.style.display = "none";
    return;
  }

  if (rodape) rodape.style.display = "flex";

  conteudo.innerHTML = hist.map(p => {
    const resumo = p.itens.slice(0, 3).map(i => `${i.quantidade}x ${i.nome}`).join(", ");
    const extra  = p.itens.length > 3 ? ` +${p.itens.length - 3} mais` : "";
    return `
      <div class="historico-item">
        <div class="historico-meta">
          <span class="historico-data">${p.data} às ${p.hora}</span>
          <span class="historico-total">${p.total}</span>
        </div>
        <p class="historico-resumo">${escaparHTML(resumo + extra)}</p>
        <div class="historico-tags">
          <span class="tag-pagamento">${escaparHTML(p.pagamento)}</span>
          <span class="tag-pagamento">${p.itens.length} ${p.itens.length === 1 ? "item" : "itens"}</span>
        </div>
        <button class="btn-repedir" data-hist-id="${p.id}">Re-pedir</button>
      </div>`;
  }).join("");
}

function abrirHistorico() {
  const overlay = document.getElementById("historicoOverlay");
  if (!overlay) return;
  renderHistorico();
  overlay.classList.add("aberto");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function fecharHistorico() {
  const overlay = document.getElementById("historicoOverlay");
  if (!overlay) return;
  overlay.classList.remove("aberto");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function repedir(histId) {
  const hist  = loadHistorico();
  const pedido = hist.find(p => p.id === histId);
  if (!pedido) return;

  pedido.itens.forEach(item => {
    if (carrinho.length >= CART_MAX) return;
    const existing = carrinho.find(c => c.cartKey === item.cartKey);
    if (existing) existing.quantidade += item.quantidade;
    else carrinho.push({ ...item });
  });

  saveCart();
  fecharHistorico();
  abrirCarrinho();
  mostrarToast("Itens adicionados ao carrinho");
}

function configurarHistorico() {
  document.getElementById("btnHistorico")
    ?.addEventListener("click", abrirHistorico);

  document.getElementById("btnFecharHistorico")
    ?.addEventListener("click", fecharHistorico);

  document.getElementById("historicoOverlay")
    ?.addEventListener("click", (e) => { if (e.target === e.currentTarget) fecharHistorico(); });

  document.getElementById("btnLimparHistorico")
    ?.addEventListener("click", () => {
      saveHistorico([]);
      renderHistorico();
    });

  document.getElementById("historicoConteudo")
    ?.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-repedir");
      if (btn) repedir(Number(btn.dataset.histId));
    });
}

/* =========================================================
   Toast de confirmação
   ========================================================= */

let _toastTimer = null;
function mostrarToast(texto) {
  const el = document.getElementById("toastCarrinho");
  if (!el) return;
  el.textContent = texto;
  el.classList.add("visivel");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("visivel"), 2400);
}

/* =========================================================
   Firebase — config da loja
   ========================================================= */

async function carregarConfigLoja() {
  const configSnap = await getDoc(doc(db, "config", "loja"));
  if (!configSnap.exists()) { document.title = "Catálogo da Loja"; return; }

  const data = configSnap.data();
  const nomeFinal = data.nome || "Minha Loja";

  document.getElementById("nomeLoja").textContent = nomeFinal;
  document.getElementById("capaLojaImg").src = data.capa || "";
  whatsappLoja = (data.whatsapp || "").replace(/\D/g, "");
  document.title = nomeFinal;

  const splashNome = document.getElementById("splashNome");
  const nomeRodape = document.getElementById("nomeLojaRodape");
  if (splashNome) splashNome.textContent = nomeFinal;
  if (nomeRodape) nomeRodape.textContent = nomeFinal;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", `Confira os produtos da ${nomeFinal}.`);

  // Botões flutuantes (WhatsApp e Instagram)
  const floatWhats = document.getElementById("floatWhatsapp");
  const floatInsta = document.getElementById("floatInstagram");

  if (floatWhats && whatsappLoja) {
    floatWhats.href = gerarLinkWhatsAppLoja();
    floatWhats.style.display = "flex";
    setTimeout(() => floatWhats.classList.add("visivel"), 1000);
    floatWhats.addEventListener("click", () => trackWhatsApp("loja"), { once: false });
  }

  if (floatInsta && data.instagram) {
    floatInsta.href = gerarLinkInstagram(data.instagram);
    floatInsta.style.display = "flex";
    setTimeout(() => floatInsta.classList.add("visivel"), 1500);
  }

  // Seção "Sobre" — mostra somente se tem descrição ou endereço
  const temDesc    = !!data.descricao;
  const temEndereco = !!data.endereco;

  if (temDesc || temEndereco) {
    document.getElementById("sobreLoja").style.display = "block";
    document.getElementById("descricaoLojaTexto").textContent = data.descricao || "";

    if (data.endereco) {
      const linkMaps = gerarLinkMaps(data.endereco);
      document.getElementById("enderecoBox").style.display = "block";
      document.getElementById("enderecoLojaTexto").innerHTML =
        `📍 <strong>Endereço:</strong> ${escaparHTML(data.endereco)}`;
      document.getElementById("mapaLojaLink").href = linkMaps;
      document.getElementById("mapaLojaLink").style.display = "block";
      document.getElementById("mapaLojaFrame").src =
        `https://maps.google.com/maps?q=${encodeURIComponent(data.endereco)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }
  }
}

/* =========================================================
   Firebase — produtos
   ========================================================= */

async function carregarDados() {
  dadosCatalogo = [];
  itemsMap.clear();

  const snap = await getDocs(collection(db, "categorias"));
  for (const catDoc of snap.docs) {
    const itensSnap = await getDocs(collection(db, "categorias", catDoc.id, "itens"));
    const itens = [];
    itensSnap.forEach((itemDoc) => {
      const cartKey = `${catDoc.id}_${itemDoc.id}`;
      const item = { id: itemDoc.id, cartKey, ...itemDoc.data() };
      itens.push(item);
      itemsMap.set(cartKey, item);
    });
    // Ordenar por campo 'ordem' se existir
    itens.sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
    dadosCatalogo.push({ id: catDoc.id, ...catDoc.data(), itens });
  }
  // Ordenar categorias por campo 'ordem'
  dadosCatalogo.sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
}

/* =========================================================
   Renderização do catálogo
   ========================================================= */

function renderizarFiltroCategorias() {
  const el = document.getElementById("filtroCategorias");
  el.innerHTML = "";
  dadosCatalogo.forEach((cat) => {
    const btn = document.createElement("button");
    btn.textContent = cat.nome;
    btn.className = `filtro-btn ${categoriaSelecionada === cat.id ? "ativo" : ""}`;
    btn.onclick = () => {
      categoriaSelecionada = cat.id;
      renderizarCatalogo(campoBusca.value);
      renderizarFiltroCategorias();
      document.getElementById("btnTodas").classList.remove("ativo");
    };
    el.appendChild(btn);
  });
}

function ativarSetasFiltro() {
  const el  = document.getElementById("filtroCategorias");
  const esq = document.getElementById("btnFiltroEsq");
  const dir = document.getElementById("btnFiltroDir");
  if (!el || !esq || !dir) return;
  esq.onclick = () => el.scrollBy({ left: -200, behavior: "smooth" });
  dir.onclick = () => el.scrollBy({ left:  200, behavior: "smooth" });
}

const ICON_WHATS = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="13" height="13">
    <path d="M20.52 3.48A12 12 0 0 0 3.48 20.52L2 22l1.58-1.44A12 12 0 1 0 20.52 3.48zm-8.5 17.3a9.34 9.34 0 0 1-4.77-1.3l-.34-.2-2.82.74.76-2.75-.22-.35a9.36 9.36 0 1 1 7.39 3.86zm5.4-6.98c-.3-.15-1.74-.86-2.01-.96s-.47-.15-.67.15-.77.96-.94 1.16-.35.22-.65.07a7.65 7.65 0 0 1-2.25-1.39 8.46 8.46 0 0 1-1.56-1.94c-.16-.3 0-.45.13-.6.13-.13.3-.35.44-.52s.17-.3.27-.5.05-.37 0-.52-.67-1.62-.93-2.22c-.24-.58-.49-.5-.67-.5h-.57a1.1 1.1 0 0 0-.8.37 3.37 3.37 0 0 0-1.05 2.5c0 1.48 1.08 2.9 1.23 3.1s2.12 3.24 5.13 4.55a17 17 0 0 0 1.7.63 4.1 4.1 0 0 0 1.88.12 3.08 3.08 0 0 0 2.02-1.43 2.5 2.5 0 0 0 .18-1.43c-.07-.12-.27-.2-.57-.34z"/>
  </svg>`;

const ICON_CART = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>`;

const ICON_SHARE = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="13" height="13">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>`;

function criarCardItem(item, textoBusca = "") {
  const disponivel   = item.disponivel !== false;
  const textoNorm    = normalizar(textoBusca);
  const encontrou    = textoNorm && normalizar(item.nome || "").includes(textoNorm);
  const nomeSafe     = escaparHTML(item.nome);
  const imagemSafe   = escaparAttr(item.imagem || "");
  const cartKeySafe  = escaparAttr(item.cartKey);

  if (!disponivel) {
    return `
      <div class="item-card item-card-indisponivel">
        <img src="${imagemSafe}" alt="${nomeSafe}" loading="lazy">
        <p class="item-nome">${nomeSafe}</p>
        <p class="item-preco">${formatarPreco(item.preco)}</p>
        <span class="badge-indisponivel">Indisponível</span>
      </div>`;
  }

  const linkWhatsApp = gerarLinkWhatsApp(item);
  return `
    <div class="item-card ${encontrou ? "item-card-destaque" : ""}">
      <button class="btn-share-card" data-cart-key="${cartKeySafe}" aria-label="Copiar link do produto" title="Copiar link">${ICON_SHARE}</button>
      <img src="${imagemSafe}" alt="${nomeSafe}" loading="lazy">
      <p class="item-nome">${nomeSafe}</p>
      <p class="item-preco">${formatarPreco(item.preco)}</p>
      <div class="item-card-acoes">
        <button class="btn-add-carrinho" data-cart-key="${cartKeySafe}" aria-label="Adicionar ao carrinho" title="Adicionar ao carrinho">${ICON_CART}</button>
        <a class="btn-whatsapp-card" href="${linkWhatsApp}" target="_blank" rel="noopener noreferrer">${ICON_WHATS} WhatsApp</a>
      </div>
    </div>`;
}

function gerarLinkWhatsApp(item) {
  if (!whatsappLoja) return "#";
  const msg = `Ola! Vim pelo catalogo e tenho interesse no produto *${item.nome}* (${formatarPreco(item.preco)}). Pode me passar mais informacoes?`;
  return `https://wa.me/55${whatsappLoja}?text=${encodeURIComponent(msg)}`;
}

function gerarLinkWhatsAppLoja() {
  if (!whatsappLoja) return "#";
  const msg = "Ola! Vim pelo catalogo e gostaria de mais informacoes.";
  return `https://wa.me/55${whatsappLoja}?text=${encodeURIComponent(msg)}`;
}

function gerarLinkInstagram(usuario) {
  if (!usuario) return "#";
  const limpo = String(usuario).trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/\/$/, "");
  return `https://www.instagram.com/${limpo}/`;
}

function gerarLinkMaps(endereco) {
  if (!endereco) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}

function renderizarCatalogo(filtro = "") {
  container.innerHTML = "";
  const texto = normalizar(filtro); // busca sem acento

  const filtradas = dadosCatalogo
    .filter(cat => !categoriaSelecionada || cat.id === categoriaSelecionada)
    .map(cat => {
      const nomeCat = normalizar(cat.nome || "");
      const itensFilt = cat.itens.filter(item =>
        normalizar(item.nome || "").includes(texto) || nomeCat.includes(texto)
      );
      if (!texto) return cat;
      if (nomeCat.includes(texto) || itensFilt.length > 0)
        return { ...cat, itens: itensFilt.length > 0 ? itensFilt : cat.itens };
      return null;
    })
    .filter(Boolean);

  if (filtradas.length === 0) {
    container.innerHTML = `
      <div class="sem-resultado">
        <h3>Nada encontrado</h3>
        <p>Tente buscar por outro nome de item ou categoria.</p>
      </div>`;
    return;
  }

  filtradas.forEach((cat, idx) => {
    const el = document.createElement("section");
    el.className = "categoria";
    const scrollId = `scroll-${idx}`;
    const itensHTML = cat.itens.length
      ? cat.itens.map(item => criarCardItem(item, filtro)).join("")
      : "<p>Nenhum item cadastrado.</p>";

    el.innerHTML = `
      <div class="categoria-topo">
        <div class="categoria-titulo-box">
          <span class="categoria-bolinha"></span>
          <h2>${escaparHTML(cat.nome)}</h2>
        </div>
        <div class="setas-carrossel">
          <button class="btn-seta" data-direcao="esquerda" data-alvo="${scrollId}" aria-label="Rolar para esquerda">‹</button>
          <button class="btn-seta" data-direcao="direita" data-alvo="${scrollId}" aria-label="Rolar para direita">›</button>
        </div>
      </div>
      <div class="categoria-capa">
        <img src="${escaparAttr(cat.imagem || "")}" alt="${escaparHTML(cat.nome)}" loading="lazy">
      </div>
      <div class="carrossel-wrapper">
        <div class="itens-scroll" id="${scrollId}">${itensHTML}</div>
      </div>`;

    container.appendChild(el);
    observarParaRevelar(el, cat.nome);
  });

  ativarSetas();
}

function ativarSetas() {
  document.querySelectorAll(".btn-seta").forEach(botao => {
    botao.addEventListener("click", () => {
      const area = document.getElementById(botao.dataset.alvo);
      if (!area) return;
      area.scrollBy({ left: botao.dataset.direcao === "direita" ? 260 : -260, behavior: "smooth" });
    });
  });
}

/* =========================================================
   Compartilhar produto específico
   ========================================================= */

function compartilharItem(cartKey) {
  const item = itemsMap.get(cartKey);
  if (!item) return;
  const url = `${location.origin}${location.pathname}?busca=${encodeURIComponent(item.nome)}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(() => mostrarToast("Link copiado!"))
      .catch(() => mostrarToast("Não foi possível copiar"));
  } else {
    mostrarToast("Link: " + url);
  }
}

function carregarURLParams() {
  const params = new URLSearchParams(location.search);
  const busca  = params.get("busca");
  if (busca) {
    campoBusca.value = busca;
  }
}

/* =========================================================
   Animações e UX
   ========================================================= */

function configurarObserverRevelar() {
  if (!("IntersectionObserver" in window)) return;
  revealObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revelada");
          const nome = entry.target.dataset.catNome;
          if (nome) trackCategoria(nome);
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
}

function observarParaRevelar(elemento, nomeCategoria = "") {
  if (nomeCategoria) elemento.dataset.catNome = nomeCategoria;
  if (!revealObserver) { elemento.classList.add("revelada"); if (nomeCategoria) trackCategoria(nomeCategoria); return; }
  revealObserver.observe(elemento);
}

function configurarScrollProgress() {
  const barra   = document.getElementById("scrollProgress");
  const btnTopo = document.getElementById("btnVoltarTopo");
  if (!barra && !btnTopo) return;
  let ticking = false;
  const atualizar = () => {
    const scroll = window.scrollY;
    const altura = document.documentElement.scrollHeight - window.innerHeight;
    if (barra) barra.style.width = `${altura > 0 ? (scroll / altura) * 100 : 0}%`;
    if (btnTopo) btnTopo.classList.toggle("visivel", scroll > 480);
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { window.requestAnimationFrame(atualizar); ticking = true; }
  }, { passive: true });
  atualizar();
}

function configurarVoltarTopo() {
  document.getElementById("btnVoltarTopo")
    ?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function ocultarSplash() {
  const splash = document.getElementById("splashScreen");
  if (!splash) return;
  splash.classList.add("fade-out");
  setTimeout(() => splash.remove(), 900);
}

function preencherAno() {
  const el = document.getElementById("anoAtual");
  if (el) el.textContent = new Date().getFullYear();
}

/* =========================================================
   Event listeners — carrinho
   ========================================================= */

function configurarCarrinho() {
  document.getElementById("btnAbrirCarrinho")?.addEventListener("click", abrirCarrinho);
  document.getElementById("btnFecharCarrinho")?.addEventListener("click", fecharCarrinho);
  document.getElementById("carrinhoOverlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) fecharCarrinho();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { fecharCarrinho(); fecharHistorico(); }
  });

  document.getElementById("carrinhoLista")?.addEventListener("click", (e) => {
    const btnQtd    = e.target.closest(".btn-qtd");
    const btnRemove = e.target.closest(".btn-remover");
    if (btnQtd)    atualizarQuantidade(btnQtd.dataset.cartKey, parseInt(btnQtd.dataset.delta, 10));
    if (btnRemove) removeFromCart(btnRemove.dataset.cartKey);
  });

  document.getElementById("btnComprar")?.addEventListener("click", () => {
    if (!whatsappLoja) { mostrarToast("WhatsApp da loja não configurado"); return; }
    if (!carrinho.length) { mostrarToast("Adicione itens ao carrinho primeiro"); return; }
    const msg  = gerarMensagemPedido();
    const link = `https://wa.me/55${whatsappLoja}?text=${encodeURIComponent(msg)}`;
    window.open(link, "_blank", "noopener,noreferrer");
    addToHistorico();
    mostrarSucesso();
  });

  // Botões do estado de sucesso
  document.getElementById("btnManterItens")?.addEventListener("click", () => {
    const sucesso = document.getElementById("carrinhoSucesso");
    const btnComp = document.getElementById("btnComprar");
    if (sucesso) sucesso.style.display = "none";
    if (btnComp) btnComp.style.display = "";
    fecharCarrinho();
  });

  document.getElementById("btnLimparCarrinho")?.addEventListener("click", () => {
    carrinho = [];
    saveCart();
    renderCarrinho();
    fecharCarrinho();
    mostrarToast("Carrinho limpo");
  });
}

// Event delegation no container para ações dos cards
container.addEventListener("click", (e) => {
  // Adicionar ao carrinho
  const btnCart = e.target.closest(".btn-add-carrinho");
  if (btnCart) {
    const item = itemsMap.get(btnCart.dataset.cartKey);
    if (!item) return;
    addToCart(item);
    btnCart.classList.add("adicionado");
    setTimeout(() => btnCart.classList.remove("adicionado"), 600);
    return;
  }
  // Compartilhar produto
  const btnShare = e.target.closest(".btn-share-card");
  if (btnShare) { compartilharItem(btnShare.dataset.cartKey); return; }
  // WhatsApp no card
  if (e.target.closest(".btn-whatsapp-card")) trackWhatsApp("item");
});

/* =========================================================
   Inputs
   ========================================================= */

let _buscaTimer = null;
campoBusca.addEventListener("input", (e) => {
  renderizarCatalogo(e.target.value);
  clearTimeout(_buscaTimer);
  _buscaTimer = setTimeout(() => trackBusca(e.target.value), 1400);
});

document.getElementById("btnTodas").onclick = () => {
  categoriaSelecionada = null;
  renderizarCatalogo(campoBusca.value);
  renderizarFiltroCategorias();
  document.getElementById("btnTodas").classList.add("ativo");
};

document.getElementById("btnCompartilhar").addEventListener("click", async (e) => {
  e.preventDefault();
  const url = location.href, titulo = document.title;
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: "Confira esse catálogo!", url }); } catch {}
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(titulo + " " + url)}`, "_blank");
  }
});

/* =========================================================
   Bootstrap
   ========================================================= */

async function iniciar() {
  loadCart();
  atualizarBadge();
  carregarURLParams();
  configurarObserverRevelar();
  configurarScrollProgress();
  configurarVoltarTopo();
  configurarCarrinho();
  configurarHistorico();
  preencherAno();
  trackVisita();

  try {
    await carregarConfigLoja();
    await carregarDados();
    renderizarCatalogo(campoBusca.value); // usa valor do URL param se houver
    renderizarFiltroCategorias();
    ativarSetasFiltro();
  } catch (err) {
    console.error("Erro ao carregar o catálogo:", err);
    container.innerHTML = `
      <div class="sem-resultado">
        <h3>Não foi possível carregar o catálogo</h3>
        <p>Verifique sua conexão e tente novamente.</p>
      </div>`;
  } finally {
    ocultarSplash();
  }
}

iniciar();
