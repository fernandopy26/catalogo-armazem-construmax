import { db } from "./config/firebase.js";
import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  trackVisita,
  trackCategoria,
  trackWhatsApp,
  trackCarrinho,
  trackBusca
} from "./analytics.js";

/* =========================================================
   Estado global
   ========================================================= */

const container = document.getElementById("categorias");
const campoBusca = document.getElementById("campoBusca");

let dadosCatalogo = [];
let whatsappLoja = "";
let categoriaSelecionada = null;
let revealObserver = null;

// Mapa global de itens para lookups rápidos no carrinho
// chave: cartKey = `${categoriaId}_${itemId}`
const itemsMap = new Map();

/* =========================================================
   Carrinho — estado e persistência
   ========================================================= */

const CART_KEY   = "construmax_carrinho_v1";
const CART_MAX   = 30;

let carrinho = []; // [{ cartKey, nome, precoRaw, precoFormatado, imagem, quantidade }]

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) carrinho = JSON.parse(raw);
    if (!Array.isArray(carrinho)) carrinho = [];
  } catch {
    carrinho = [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(carrinho));
  } catch {
    // localStorage cheio ou indisponível — continua sem persistir
  }
  atualizarBadge();
}

function addToCart(item) {
  const existing = carrinho.find(c => c.cartKey === item.cartKey);

  if (existing) {
    existing.quantidade += 1;
    saveCart();
    return;
  }

  if (carrinho.length >= CART_MAX) {
    mostrarToast(`Limite de ${CART_MAX} itens diferentes atingido`);
    return;
  }

  carrinho.push({
    cartKey:       item.cartKey,
    nome:          item.nome,
    precoRaw:      item.preco,
    precoFormatado: formatarPreco(item.preco),
    imagem:        item.imagem || "",
    quantidade:    1
  });

  saveCart();
  trackCarrinho();
  mostrarToast(`${item.nome} adicionado`);
}

function removeFromCart(cartKey) {
  carrinho = carrinho.filter(c => c.cartKey !== cartKey);
  saveCart();
  renderCarrinho();
}

function atualizarQuantidade(cartKey, delta) {
  const entry = carrinho.find(c => c.cartKey === cartKey);
  if (!entry) return;
  const nova = entry.quantidade + delta;
  if (nova < 1) {
    removeFromCart(cartKey);
    return;
  }
  entry.quantidade = nova;
  saveCart();
  renderCarrinho();
}

function calcularTotal() {
  return carrinho.reduce((acc, entry) => {
    const num = Number(
      String(entry.precoRaw)
        .replace("R$", "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    );
    return acc + (isNaN(num) ? 0 : num * entry.quantidade);
  }, 0);
}

/* =========================================================
   Carrinho — UI
   ========================================================= */

function atualizarBadge() {
  const total = carrinho.reduce((s, c) => s + c.quantidade, 0);
  const badge  = document.getElementById("carrinhoContador");
  const header = document.getElementById("carrinhoHeaderCount");

  if (badge) {
    badge.textContent = total;
    badge.classList.toggle("visivel", total > 0);
  }

  if (header) {
    header.textContent = total > 0 ? `(${total} ${total === 1 ? "item" : "itens"})` : "";
  }
}

function renderCarrinho() {
  const lista    = document.getElementById("carrinhoLista");
  const vazio    = document.getElementById("carrinhoVazio");
  const rodape   = document.getElementById("carrinhoRodape");
  const totalEl  = document.getElementById("carrinhoTotal");
  const avisoEl  = document.getElementById("carrinhoAvisoLimite");

  if (!lista) return;

  const isEmpty = carrinho.length === 0;

  lista.style.display  = isEmpty ? "none" : "flex";
  vazio.style.display  = isEmpty ? "flex" : "none";
  rodape.style.display = isEmpty ? "none" : "flex";

  if (isEmpty) return;

  lista.innerHTML = carrinho.map(entry => `
    <div class="carrinho-item" data-cart-key="${escaparAttr(entry.cartKey)}">
      <img
        src="${escaparAttr(entry.imagem)}"
        alt="${escaparAttr(entry.nome)}"
        class="carrinho-item-img"
        loading="lazy"
      >
      <div class="carrinho-item-info">
        <p class="carrinho-item-nome">${escaparHTML(entry.nome)}</p>
        <p class="carrinho-item-preco">${escaparHTML(entry.precoFormatado)}</p>
      </div>
      <div class="carrinho-item-controles">
        <button class="btn-qtd" data-cart-key="${escaparAttr(entry.cartKey)}" data-delta="-1" aria-label="Diminuir quantidade">−</button>
        <span class="carrinho-qtd">${entry.quantidade}</span>
        <button class="btn-qtd" data-cart-key="${escaparAttr(entry.cartKey)}" data-delta="1" aria-label="Aumentar quantidade">+</button>
      </div>
      <button class="btn-remover" data-cart-key="${escaparAttr(entry.cartKey)}" aria-label="Remover item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  `).join("");

  // Total
  const total = calcularTotal();
  if (totalEl) {
    totalEl.textContent = total.toLocaleString("pt-BR", {
      style: "currency", currency: "BRL"
    });
  }

  // Aviso de limite
  if (avisoEl) {
    avisoEl.textContent = carrinho.length >= CART_MAX
      ? `Limite de ${CART_MAX} tipos de itens atingido`
      : "";
  }

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

function gerarMensagemPedido() {
  const pagamento = document.getElementById("formaPagamento")?.value || "Pix";
  const total = calcularTotal().toLocaleString("pt-BR", {
    style: "currency", currency: "BRL"
  });

  const linhas = carrinho.map(entry => {
    const precoUnitario = Number(
      String(entry.precoRaw)
        .replace("R$", "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    );

    const subtotalTxt = (!isNaN(precoUnitario) && entry.quantidade > 1)
      ? ` — subtotal: ${(precoUnitario * entry.quantidade).toLocaleString("pt-BR", {
          style: "currency", currency: "BRL"
        })}`
      : "";

    return `  - ${entry.quantidade}x ${entry.nome} (${entry.precoFormatado} cada)${subtotalTxt}`;
  });

  return [
    "Ola! Vim pelo catalogo e gostaria de fazer um pedido.",
    "",
    "*Itens do pedido:*",
    ...linhas,
    "",
    `*Total estimado:* ${total}`,
    `*Pagamento:* ${pagamento}`,
    "",
    "Aguardo confirmacao, obrigado!"
  ].join("\n");
}

/* =========================================================
   Toast de confirmação
   ========================================================= */

let toastTimer = null;

function mostrarToast(texto) {
  const el = document.getElementById("toastCarrinho");
  if (!el) return;
  el.textContent = texto;
  el.classList.add("visivel");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visivel"), 2400);
}

/* =========================================================
   Helpers de segurança
   ========================================================= */

function escaparHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escaparAttr(texto) {
  return String(texto ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/* =========================================================
   Formatação de preço
   ========================================================= */

function formatarPreco(valor) {
  if (!valor) return "Preço não informado";

  const numero = Number(
    String(valor)
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  );

  if (isNaN(numero)) return `R$ ${valor}`;

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

/* =========================================================
   Firebase — config da loja
   ========================================================= */

async function carregarConfigLoja() {
  const configSnap = await getDoc(doc(db, "config", "loja"));

  if (configSnap.exists()) {
    const data = configSnap.data();

    const nomeLoja          = document.getElementById("nomeLoja");
    const capaLojaImg       = document.getElementById("capaLojaImg");
    const btnWhatsSobre     = document.getElementById("btnWhatsSobre");
    const sobreLoja         = document.getElementById("sobreLoja");
    const descricaoLojaTexto= document.getElementById("descricaoLojaTexto");
    const enderecoBox       = document.getElementById("enderecoBox");
    const enderecoLojaTexto = document.getElementById("enderecoLojaTexto");
    const mapaLojaLink      = document.getElementById("mapaLojaLink");
    const mapaLojaFrame     = document.getElementById("mapaLojaFrame");
    const instagramLojaLink = document.getElementById("instagramLojaLink");
    const splashNome        = document.getElementById("splashNome");
    const nomeLojaRodape    = document.getElementById("nomeLojaRodape");

    const nomeFinal = data.nome || "Minha Loja";

    nomeLoja.textContent = nomeFinal;
    capaLojaImg.src = data.capa || "";
    whatsappLoja = (data.whatsapp || "").replace(/\D/g, "");

    document.title = nomeFinal;
    if (splashNome) splashNome.textContent = nomeFinal;
    if (nomeLojaRodape) nomeLojaRodape.textContent = nomeFinal;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        `Confira os produtos da ${nomeFinal}. Veja nosso catálogo completo!`
      );
    }

    if (whatsappLoja) {
      btnWhatsSobre.href = gerarLinkWhatsAppLoja();
      btnWhatsSobre.style.display = "inline-flex";
    }

    const temDescricao = !!data.descricao;
    const temEndereco  = !!data.endereco;
    const temInstagram = !!data.instagram;

    if (temDescricao || temEndereco || temInstagram) {
      sobreLoja.style.display = "block";
      descricaoLojaTexto.textContent = data.descricao || "";

      if (data.endereco) {
        const linkMaps = gerarLinkMaps(data.endereco);
        enderecoBox.style.display = "block";
        enderecoLojaTexto.innerHTML =
          `📍 <strong>Endereço:</strong> ${escaparHTML(data.endereco)}`;
        mapaLojaLink.href = linkMaps;
        mapaLojaLink.style.display = "block";
        mapaLojaFrame.src =
          `https://maps.google.com/maps?q=${encodeURIComponent(data.endereco)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
      } else {
        enderecoBox.style.display = "none";
        enderecoLojaTexto.innerHTML = "";
        mapaLojaLink.href = "#";
        mapaLojaLink.style.display = "none";
        mapaLojaFrame.src = "";
      }

      if (data.instagram) {
        instagramLojaLink.href = gerarLinkInstagram(data.instagram);
        instagramLojaLink.style.display = "inline-flex";
      } else {
        instagramLojaLink.style.display = "none";
        instagramLojaLink.href = "#";
      }
    }
  } else {
    document.title = "Catálogo da Loja";
  }
}

/* =========================================================
   Firebase — produtos
   ========================================================= */

async function carregarDados() {
  dadosCatalogo = [];
  itemsMap.clear();

  const categoriasSnapshot = await getDocs(collection(db, "categorias"));

  for (const categoriaDoc of categoriasSnapshot.docs) {
    const categoria = categoriaDoc.data();
    const itensSnapshot = await getDocs(
      collection(db, "categorias", categoriaDoc.id, "itens")
    );

    const itens = [];

    itensSnapshot.forEach((itemDoc) => {
      const cartKey = `${categoriaDoc.id}_${itemDoc.id}`;
      const item = {
        id: itemDoc.id,
        cartKey,
        ...itemDoc.data()
      };
      itens.push(item);
      itemsMap.set(cartKey, item);
    });

    dadosCatalogo.push({
      id: categoriaDoc.id,
      ...categoria,
      itens
    });
  }
}

/* =========================================================
   Renderização do catálogo
   ========================================================= */

function renderizarFiltroCategorias() {
  const filtroEl = document.getElementById("filtroCategorias");
  filtroEl.innerHTML = "";

  dadosCatalogo.forEach((categoria) => {
    const btn = document.createElement("button");
    btn.textContent = categoria.nome;
    btn.className = `filtro-btn ${
      categoriaSelecionada === categoria.id ? "ativo" : ""
    }`;
    btn.onclick = () => {
      categoriaSelecionada = categoria.id;
      renderizarCatalogo(campoBusca.value);
      renderizarFiltroCategorias();
      document.getElementById("btnTodas").classList.remove("ativo");
    };
    filtroEl.appendChild(btn);
  });
}

function ativarSetasFiltro() {
  const filtroEl = document.getElementById("filtroCategorias");
  const btnEsq   = document.getElementById("btnFiltroEsq");
  const btnDir   = document.getElementById("btnFiltroDir");
  if (!filtroEl || !btnEsq || !btnDir) return;
  btnEsq.onclick = () => filtroEl.scrollBy({ left: -200, behavior: "smooth" });
  btnDir.onclick = () => filtroEl.scrollBy({ left:  200, behavior: "smooth" });
}

const ICON_WHATS = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="13" height="13">
    <path d="M20.52 3.48A12 12 0 0 0 3.48 20.52L2 22l1.58-1.44A12 12 0 1 0 20.52 3.48zm-8.5 17.3a9.34 9.34 0 0 1-4.77-1.3l-.34-.2-2.82.74.76-2.75-.22-.35a9.36 9.36 0 1 1 7.39 3.86zm5.4-6.98c-.3-.15-1.74-.86-2.01-.96s-.47-.15-.67.15-.77.96-.94 1.16-.35.22-.65.07a7.65 7.65 0 0 1-2.25-1.39 8.46 8.46 0 0 1-1.56-1.94c-.16-.3 0-.45.13-.6.13-.13.3-.35.44-.52s.17-.3.27-.5.05-.37 0-.52-.67-1.62-.93-2.22c-.24-.58-.49-.5-.67-.5h-.57a1.1 1.1 0 0 0-.8.37 3.37 3.37 0 0 0-1.05 2.5c0 1.48 1.08 2.9 1.23 3.1s2.12 3.24 5.13 4.55a17 17 0 0 0 1.7.63 4.1 4.1 0 0 0 1.88.12 3.08 3.08 0 0 0 2.02-1.43 2.5 2.5 0 0 0 .18-1.43c-.07-.12-.27-.2-.57-.34z"/>
  </svg>
`;

const ICON_CART = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
`;

function criarCardItem(item, textoBusca = "") {
  const linkWhatsApp  = gerarLinkWhatsApp(item);
  const nomeItem      = String(item.nome || "").toLowerCase();
  const encontrou     = textoBusca && nomeItem.includes(textoBusca.toLowerCase());
  const nomeSafe      = escaparHTML(item.nome);
  const imagemSafe    = escaparAttr(item.imagem || "");
  const cartKeySafe   = escaparAttr(item.cartKey);

  return `
    <div class="item-card ${encontrou ? "item-card-destaque" : ""}">
      <img src="${imagemSafe}" alt="${nomeSafe}" loading="lazy">
      <p class="item-nome">${nomeSafe}</p>
      <p class="item-preco">${formatarPreco(item.preco)}</p>
      <div class="item-card-acoes">
        <button
          class="btn-add-carrinho"
          data-cart-key="${cartKeySafe}"
          aria-label="Adicionar ao carrinho"
          title="Adicionar ao carrinho"
        >${ICON_CART}</button>
        <a
          class="btn-whatsapp-card"
          href="${linkWhatsApp}"
          target="_blank"
          rel="noopener noreferrer"
        >${ICON_WHATS} WhatsApp</a>
      </div>
    </div>
  `;
}

function gerarLinkWhatsApp(item) {
  if (!whatsappLoja) return "#";
  const mensagem = `Ola! Vim pelo catalogo e tenho interesse no produto *${item.nome}* (${formatarPreco(item.preco)}). Pode me passar mais informacoes?`;
  return `https://wa.me/55${whatsappLoja}?text=${encodeURIComponent(mensagem)}`;
}

function gerarLinkWhatsAppLoja() {
  if (!whatsappLoja) return "#";
  const mensagem = "Olá! Vim pelo catálogo e gostaria de mais informações.";
  return `https://wa.me/55${whatsappLoja}?text=${encodeURIComponent(mensagem)}`;
}

function gerarLinkInstagram(usuario) {
  if (!usuario) return "#";
  const usuarioLimpo = String(usuario)
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/\/$/, "");
  return `https://www.instagram.com/${usuarioLimpo}/`;
}

function gerarLinkMaps(endereco) {
  if (!endereco) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}

function renderizarCatalogo(filtro = "") {
  container.innerHTML = "";
  const texto = filtro.trim().toLowerCase();

  const categoriasFiltradas = dadosCatalogo
    .filter(cat => !categoriaSelecionada || cat.id === categoriaSelecionada)
    .map(cat => {
      const nomeCategoria = (cat.nome || "").toLowerCase();
      const itensFiltrados = cat.itens.filter(item =>
        (item.nome || "").toLowerCase().includes(texto) || nomeCategoria.includes(texto)
      );

      if (!texto) return cat;
      if (nomeCategoria.includes(texto) || itensFiltrados.length > 0) {
        return { ...cat, itens: itensFiltrados.length > 0 ? itensFiltrados : cat.itens };
      }
      return null;
    })
    .filter(Boolean);

  if (categoriasFiltradas.length === 0) {
    container.innerHTML = `
      <div class="sem-resultado">
        <h3>Nada encontrado</h3>
        <p>Tente buscar por outro nome de item ou categoria.</p>
      </div>
    `;
    return;
  }

  categoriasFiltradas.forEach((cat, index) => {
    const el = document.createElement("section");
    el.className = "categoria";
    const scrollId = `scroll-${index}`;
    const itensHTML = cat.itens.length
      ? cat.itens.map(item => criarCardItem(item, texto)).join("")
      : "<p>Nenhum item cadastrado.</p>";

    const nomeSafe   = escaparHTML(cat.nome);
    const imagemSafe = escaparAttr(cat.imagem || "");

    el.innerHTML = `
      <div class="categoria-topo">
        <div class="categoria-titulo-box">
          <span class="categoria-bolinha"></span>
          <h2>${nomeSafe}</h2>
        </div>
        <div class="setas-carrossel">
          <button class="btn-seta" data-direcao="esquerda" data-alvo="${scrollId}" aria-label="Rolar para esquerda">‹</button>
          <button class="btn-seta" data-direcao="direita" data-alvo="${scrollId}" aria-label="Rolar para direita">›</button>
        </div>
      </div>
      <div class="categoria-capa">
        <img src="${imagemSafe}" alt="${nomeSafe}" loading="lazy">
      </div>
      <div class="carrossel-wrapper">
        <div class="itens-scroll" id="${scrollId}">${itensHTML}</div>
      </div>
    `;

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
      area.scrollBy({
        left: botao.dataset.direcao === "direita" ? 260 : -260,
        behavior: "smooth"
      });
    });
  });
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
  if (!revealObserver) {
    elemento.classList.add("revelada");
    if (nomeCategoria) trackCategoria(nomeCategoria);
    return;
  }
  revealObserver.observe(elemento);
}

function configurarScrollProgress() {
  const barra  = document.getElementById("scrollProgress");
  const btnTopo = document.getElementById("btnVoltarTopo");
  if (!barra && !btnTopo) return;

  let ticking = false;
  const atualizar = () => {
    const scroll = window.scrollY;
    const altura = document.documentElement.scrollHeight - window.innerHeight;
    const pct = altura > 0 ? (scroll / altura) * 100 : 0;
    if (barra) barra.style.width = `${pct}%`;
    if (btnTopo) btnTopo.classList.toggle("visivel", scroll > 480);
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) { window.requestAnimationFrame(atualizar); ticking = true; }
  }, { passive: true });

  atualizar();
}

function configurarVoltarTopo() {
  const btn = document.getElementById("btnVoltarTopo");
  if (btn) btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
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
  // Abrir painel
  document.getElementById("btnAbrirCarrinho")
    ?.addEventListener("click", abrirCarrinho);

  // Fechar pelo botão X
  document.getElementById("btnFecharCarrinho")
    ?.addEventListener("click", fecharCarrinho);

  // Fechar clicando fora do painel (no overlay)
  document.getElementById("carrinhoOverlay")
    ?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) fecharCarrinho();
    });

  // Fechar com Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharCarrinho();
  });

  // Ações dentro da lista (quantidade e remover) — delegação
  document.getElementById("carrinhoLista")
    ?.addEventListener("click", (e) => {
      const btnQtd    = e.target.closest(".btn-qtd");
      const btnRemove = e.target.closest(".btn-remover");

      if (btnQtd) {
        const key   = btnQtd.dataset.cartKey;
        const delta = parseInt(btnQtd.dataset.delta, 10);
        atualizarQuantidade(key, delta);
      }

      if (btnRemove) {
        removeFromCart(btnRemove.dataset.cartKey);
      }
    });

  // Botão "Comprar via WhatsApp"
  document.getElementById("btnComprar")
    ?.addEventListener("click", () => {
      if (!whatsappLoja) {
        mostrarToast("WhatsApp da loja não configurado");
        return;
      }
      if (carrinho.length === 0) {
        mostrarToast("Adicione itens ao carrinho primeiro");
        return;
      }
      const msg  = gerarMensagemPedido();
      const link = `https://wa.me/55${whatsappLoja}?text=${encodeURIComponent(msg)}`;
      window.open(link, "_blank", "noopener,noreferrer");
    });
}

// Delegação para ações nos cards (adicionados dinamicamente)
container.addEventListener("click", (e) => {
  // Adicionar ao carrinho
  const btnCart = e.target.closest(".btn-add-carrinho");
  if (btnCart) {
    const cartKey = btnCart.dataset.cartKey;
    const item    = itemsMap.get(cartKey);
    if (!item) return;
    addToCart(item);
    btnCart.classList.add("adicionado");
    setTimeout(() => btnCart.classList.remove("adicionado"), 600);
    return;
  }

  // Clique no WhatsApp do card
  if (e.target.closest(".btn-whatsapp-card")) {
    trackWhatsApp("item");
  }
});

/* =========================================================
   Inputs de busca e filtros
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
  const url    = window.location.href;
  const titulo = document.title;

  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: "Confira esse catálogo!", url });
    } catch { /* cancelado */ }
  } else {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(titulo + " " + url)}`,
      "_blank"
    );
  }
});

/* =========================================================
   Bootstrap
   ========================================================= */

async function iniciar() {
  loadCart();
  atualizarBadge();
  configurarObserverRevelar();
  configurarScrollProgress();
  configurarVoltarTopo();
  configurarCarrinho();
  preencherAno();

  // Rastrear WhatsApp da seção "Sobre" (disponível após DOM carregar)
  document.getElementById("btnWhatsSobre")
    ?.addEventListener("click", () => trackWhatsApp("loja"));

  // Visita — fire-and-forget, não bloqueia o boot
  trackVisita();

  try {
    await carregarConfigLoja();
    await carregarDados();
    renderizarCatalogo();
    renderizarFiltroCategorias();
    ativarSetasFiltro();
  } catch (err) {
    console.error("Erro ao carregar o catálogo:", err);
    container.innerHTML = `
      <div class="sem-resultado">
        <h3>Não foi possível carregar o catálogo</h3>
        <p>Verifique sua conexão e tente novamente em instantes.</p>
      </div>
    `;
  } finally {
    ocultarSplash();
  }
}

iniciar();
