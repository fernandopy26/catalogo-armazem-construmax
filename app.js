import { db } from "./config/firebase.js";
import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container = document.getElementById("categorias");
const campoBusca = document.getElementById("campoBusca");

let dadosCatalogo = [];
let whatsappLoja = "";
let categoriaSelecionada = null;
let revealObserver = null;

const ICON_WHATS = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.52 3.48A12 12 0 0 0 3.48 20.52L2 22l1.58-1.44A12 12 0 1 0 20.52 3.48zm-8.5 17.3a9.34 9.34 0 0 1-4.77-1.3l-.34-.2-2.82.74.76-2.75-.22-.35a9.36 9.36 0 1 1 7.39 3.86zm5.4-6.98c-.3-.15-1.74-.86-2.01-.96s-.47-.15-.67.15-.77.96-.94 1.16-.35.22-.65.07a7.65 7.65 0 0 1-2.25-1.39 8.46 8.46 0 0 1-1.56-1.94c-.16-.3 0-.45.13-.6.13-.13.3-.35.44-.52s.17-.3.27-.5.05-.37 0-.52-.67-1.62-.93-2.22c-.24-.58-.49-.5-.67-.5h-.57a1.1 1.1 0 0 0-.8.37 3.37 3.37 0 0 0-1.05 2.5c0 1.48 1.08 2.9 1.23 3.1s2.12 3.24 5.13 4.55a17 17 0 0 0 1.7.63 4.1 4.1 0 0 0 1.88.12 3.08 3.08 0 0 0 2.02-1.43 2.5 2.5 0 0 0 .18-1.43c-.07-.12-.27-.2-.57-.34z"/>
  </svg>
`;

function escaparHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

async function carregarConfigLoja() {
  const configSnap = await getDoc(doc(db, "config", "loja"));

  if (configSnap.exists()) {
    const data = configSnap.data();

    const nomeLoja = document.getElementById("nomeLoja");
    const capaLojaImg = document.getElementById("capaLojaImg");
    const btnWhatsSobre = document.getElementById("btnWhatsSobre");
    const sobreLoja = document.getElementById("sobreLoja");
    const descricaoLojaTexto = document.getElementById("descricaoLojaTexto");
    const enderecoBox = document.getElementById("enderecoBox");
    const enderecoLojaTexto = document.getElementById("enderecoLojaTexto");
    const mapaLojaLink = document.getElementById("mapaLojaLink");
    const mapaLojaFrame = document.getElementById("mapaLojaFrame");
    const instagramLojaLink = document.getElementById("instagramLojaLink");
    const splashNome = document.getElementById("splashNome");
    const nomeLojaRodape = document.getElementById("nomeLojaRodape");

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
      const linkWhats = gerarLinkWhatsAppLoja();
      btnWhatsSobre.href = linkWhats;
      btnWhatsSobre.style.display = "inline-flex";
    }

    const temDescricao = !!data.descricao;
    const temEndereco = !!data.endereco;
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

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        "Confira nossos produtos organizados por categoria."
      );
    }
  }
}

async function carregarDados() {
  dadosCatalogo = [];

  const categoriasSnapshot = await getDocs(collection(db, "categorias"));

  for (const categoriaDoc of categoriasSnapshot.docs) {
    const categoria = categoriaDoc.data();

    const itensSnapshot = await getDocs(
      collection(db, "categorias", categoriaDoc.id, "itens")
    );

    const itens = [];

    itensSnapshot.forEach((itemDoc) => {
      itens.push({
        id: itemDoc.id,
        ...itemDoc.data()
      });
    });

    dadosCatalogo.push({
      id: categoriaDoc.id,
      ...categoria,
      itens
    });
  }
}

function renderizarFiltroCategorias() {
  const container = document.getElementById("filtroCategorias");
  container.innerHTML = "";

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

    container.appendChild(btn);
  });
}

function ativarSetasFiltro() {
  const container = document.getElementById("filtroCategorias");
  const btnEsq = document.getElementById("btnFiltroEsq");
  const btnDir = document.getElementById("btnFiltroDir");

  if (!container || !btnEsq || !btnDir) return;

  btnEsq.onclick = () => {
    container.scrollBy({ left: -200, behavior: "smooth" });
  };

  btnDir.onclick = () => {
    container.scrollBy({ left: 200, behavior: "smooth" });
  };
}

function criarCardItem(item, textoBusca = "") {
  const linkWhatsApp = gerarLinkWhatsApp(item);
  const nomeItem = String(item.nome || "").toLowerCase();
  const encontrou = textoBusca && nomeItem.includes(textoBusca.toLowerCase());

  const nomeSafe = escaparHTML(item.nome);
  const imagemSafe = escaparHTML(item.imagem);

  return `
    <div class="item-card ${encontrou ? "item-card-destaque" : ""}">
      <img src="${imagemSafe}" alt="${nomeSafe}" loading="lazy">
      <p class="item-nome">${nomeSafe}</p>
      <p class="item-preco">${formatarPreco(item.preco)}</p>
      <a
        class="btn-whatsapp"
        href="${linkWhatsApp}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${ICON_WHATS}
        WhatsApp
      </a>
    </div>
  `;
}

function gerarLinkWhatsApp(item) {
  if (!whatsappLoja) return "#";

  const mensagem = `Olá! Tenho interesse no item ${item.nome}, no valor de ${formatarPreco(item.preco)}.`;
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
    .filter((categoria) => {
      if (!categoriaSelecionada) return true;
      return categoria.id === categoriaSelecionada;
    })
    .map((categoria) => {
      const nomeCategoria = (categoria.nome || "").toLowerCase();

      const itensFiltrados = categoria.itens.filter((item) => {
        const nomeItem = (item.nome || "").toLowerCase();
        return nomeItem.includes(texto) || nomeCategoria.includes(texto);
      });

      if (!texto) {
        return categoria;
      }

      if (nomeCategoria.includes(texto) || itensFiltrados.length > 0) {
        return {
          ...categoria,
          itens: itensFiltrados.length > 0 ? itensFiltrados : categoria.itens
        };
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

  categoriasFiltradas.forEach((categoria, index) => {
    const categoriaHTML = document.createElement("section");
    categoriaHTML.className = "categoria";

    const scrollId = `scroll-${index}`;

    const itensHTML = categoria.itens.length
      ? categoria.itens.map((item) => criarCardItem(item, texto)).join("")
      : "<p>Nenhum item cadastrado.</p>";

    const nomeCategoriaSafe = escaparHTML(categoria.nome);
    const imagemCategoriaSafe = escaparHTML(categoria.imagem);

    categoriaHTML.innerHTML = `
      <div class="categoria-topo">
        <div class="categoria-titulo-box">
          <span class="categoria-bolinha"></span>
          <h2>${nomeCategoriaSafe}</h2>
        </div>

        <div class="setas-carrossel">
          <button class="btn-seta" data-direcao="esquerda" data-alvo="${scrollId}" aria-label="Rolar para esquerda">‹</button>
          <button class="btn-seta" data-direcao="direita" data-alvo="${scrollId}" aria-label="Rolar para direita">›</button>
        </div>
      </div>

      <div class="categoria-capa">
        <img src="${imagemCategoriaSafe}" alt="${nomeCategoriaSafe}" loading="lazy">
      </div>

      <div class="carrossel-wrapper">
        <div class="itens-scroll" id="${scrollId}">
          ${itensHTML}
        </div>
      </div>
    `;

    container.appendChild(categoriaHTML);
    observarParaRevelar(categoriaHTML);
  });

  ativarSetas();
}

function ativarSetas() {
  const botoes = document.querySelectorAll(".btn-seta");

  botoes.forEach((botao) => {
    botao.addEventListener("click", () => {
      const alvoId = botao.dataset.alvo;
      const direcao = botao.dataset.direcao;
      const area = document.getElementById(alvoId);

      if (!area) return;

      const distancia = 260;

      area.scrollBy({
        left: direcao === "direita" ? distancia : -distancia,
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
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revelada");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
}

function observarParaRevelar(elemento) {
  if (!revealObserver) {
    elemento.classList.add("revelada");
    return;
  }
  revealObserver.observe(elemento);
}

function configurarScrollProgress() {
  const barra = document.getElementById("scrollProgress");
  const btnTopo = document.getElementById("btnVoltarTopo");
  if (!barra && !btnTopo) return;

  let ticking = false;

  const atualizar = () => {
    const scroll = window.scrollY;
    const altura = document.documentElement.scrollHeight - window.innerHeight;
    const pct = altura > 0 ? (scroll / altura) * 100 : 0;

    if (barra) barra.style.width = `${pct}%`;

    if (btnTopo) {
      if (scroll > 480) btnTopo.classList.add("visivel");
      else btnTopo.classList.remove("visivel");
    }

    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(atualizar);
        ticking = true;
      }
    },
    { passive: true }
  );

  atualizar();
}

function configurarVoltarTopo() {
  const btn = document.getElementById("btnVoltarTopo");
  if (!btn) return;

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
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
   Inputs principais
   ========================================================= */

campoBusca.addEventListener("input", (e) => {
  renderizarCatalogo(e.target.value);
});

document.getElementById("btnTodas").onclick = () => {
  categoriaSelecionada = null;
  renderizarCatalogo(campoBusca.value);
  renderizarFiltroCategorias();

  document.getElementById("btnTodas").classList.add("ativo");
};

document.getElementById("btnCompartilhar").addEventListener("click", async (e) => {
  e.preventDefault();

  const url = window.location.href;
  const titulo = document.title;

  if (navigator.share) {
    try {
      await navigator.share({
        title: titulo,
        text: "Confira esse catálogo!",
        url: url
      });
    } catch (err) {
      console.log("Compartilhamento cancelado");
    }
  } else {
    const link = `https://wa.me/?text=${encodeURIComponent(titulo + " " + url)}`;
    window.open(link, "_blank");
  }
});

/* =========================================================
   Bootstrap
   ========================================================= */

async function iniciar() {
  configurarObserverRevelar();
  configurarScrollProgress();
  configurarVoltarTopo();
  preencherAno();

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
