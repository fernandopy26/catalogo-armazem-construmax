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
    const btnWhatsTopo = document.getElementById("btnWhatsTopo");
    const btnWhatsSobre = document.getElementById("btnWhatsSobre");
    const sobreLoja = document.getElementById("sobreLoja");
    const descricaoLojaTexto = document.getElementById("descricaoLojaTexto");
    const enderecoBox = document.getElementById("enderecoBox");
    const enderecoLojaTexto = document.getElementById("enderecoLojaTexto");
    const mapaLojaLink = document.getElementById("mapaLojaLink");
    const mapaLojaFrame = document.getElementById("mapaLojaFrame");
    const instagramLojaLink = document.getElementById("instagramLojaLink");

    nomeLoja.textContent = data.nome || "Minha Loja";
    capaLojaImg.src = data.capa || "";
    whatsappLoja = (data.whatsapp || "").replace(/\D/g, "");

    document.title = data.nome || "Catálogo da Loja";

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        `Confira os produtos da ${data.nome || "loja"}. Veja nosso catálogo completo!`
      );
    }

    if (whatsappLoja) {
      const linkWhats = gerarLinkWhatsAppLoja();



      btnWhatsSobre.href = linkWhats;
      btnWhatsSobre.style.display = "inline-block";
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
        enderecoLojaTexto.innerHTML = `📍 <strong>Endereço:</strong> ${data.endereco}`;

        mapaLojaLink.href = linkMaps;
        mapaLojaLink.style.display = "block";

        mapaLojaFrame.src = `https://maps.google.com/maps?q=${encodeURIComponent(data.endereco)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
      } else {
        enderecoBox.style.display = "none";
        enderecoLojaTexto.innerHTML = "";
        mapaLojaLink.href = "#";
        mapaLojaLink.style.display = "none";
        mapaLojaFrame.src = "";
      }

      if (data.instagram) {
        instagramLojaLink.href = gerarLinkInstagram(data.instagram);
        instagramLojaLink.style.display = "inline-block";
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

      // 🔥 tira o destaque do "Todas"
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

  return `
    <div class="item-card ${encontrou ? "item-card-destaque" : ""}">
      <img src="${item.imagem}" alt="${item.nome}">
      <p class="item-nome">${item.nome}</p>
      <p class="item-preco">${formatarPreco(item.preco)}</p>
      <a 
        class="btn-whatsapp" 
        href="${linkWhatsApp}" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        Falar no WhatsApp
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

    categoriaHTML.innerHTML = `
      <div class="categoria-topo">
        <div class="categoria-titulo-box">
          <span class="categoria-bolinha"></span>
          <h2>${categoria.nome}</h2>
        </div>

        <div class="setas-carrossel">
          <button class="btn-seta" data-direcao="esquerda" data-alvo="${scrollId}">‹</button>
          <button class="btn-seta" data-direcao="direita" data-alvo="${scrollId}">›</button>
        </div>
      </div>

      <div class="categoria-capa">
        <img src="${categoria.imagem}" alt="${categoria.nome}">
      </div>

      <div class="carrossel-wrapper">
        <div class="itens-scroll" id="${scrollId}">
          ${itensHTML}
        </div>
      </div>
    `;

    container.appendChild(categoriaHTML);
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

campoBusca.addEventListener("input", (e) => {
  renderizarCatalogo(e.target.value);
});

document.getElementById("btnTodas").onclick = () => {
  categoriaSelecionada = null;
  renderizarCatalogo(campoBusca.value);
  renderizarFiltroCategorias();

  document.getElementById("btnTodas").classList.add("ativo");
};

async function iniciar() {
  await carregarConfigLoja();
  await carregarDados();
  renderizarCatalogo();
  renderizarFiltroCategorias();
  ativarSetasFiltro();
}

document.getElementById("btnCompartilhar").addEventListener("click", async (e) => {
  e.preventDefault();

  const url = window.location.href;
  const titulo = document.title;

  // 🔥 Se o navegador suportar compartilhamento nativo
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
    // fallback → WhatsApp
    const link = `https://wa.me/?text=${encodeURIComponent(titulo + " " + url)}`;
    window.open(link, "_blank");
  }
});

iniciar();