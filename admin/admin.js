import { db, auth } from "../config/firebase.js";
import { iniciarChangelog } from "./changelog.js";
import {
  camposCapa,
  camposImagem,
  resumoOtimizacao,
  uploadImagem
} from "./upload-imagem.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Portão de sessão — executado imediatamente, de forma síncrona.
// Se não há flag de sessionStorage (nova aba, novo navegador, aba fechada),
// derruba qualquer sessão Firebase residual e manda para o login.
if (!sessionStorage.getItem("admin_ok")) {
  signOut(auth).catch(() => {});
  window.location.href = "login.html";
}

let categoriaAbertaId = null;
let categoriasCache = [];
let categoriasCacheCarregado = false;
let dragOrdenacao = null;
let dragListenersConfigurados = false;

const CATALOGO_CACHE_COLLECTION = "catalogo";
const CATALOGO_CACHE_DOC = "publico";
const CATALOGO_CACHE_VERSION = 1;

function ordemDe(registro) {
  return Number.isFinite(Number(registro?.ordem)) ? Number(registro.ordem) : 9999;
}

function ordenarPorOrdem(a, b) {
  return ordemDe(a) - ordemDe(b);
}

function montarCatalogoPublico() {
  const categorias = [...categoriasCache]
    .sort(ordenarPorOrdem)
    .map((categoria) => {
      const itens = Array.isArray(categoria.itens) ? categoria.itens : [];

      return {
        ...categoria,
        itens: [...itens]
          .sort(ordenarPorOrdem)
          .map((item) => ({
            ...item,
            cartKey: item.cartKey || `${categoria.id}_${item.id}`
          }))
      };
    });

  return {
    versao: CATALOGO_CACHE_VERSION,
    atualizadoEm: serverTimestamp(),
    totalCategorias: categorias.length,
    totalItens: categorias.reduce((total, categoria) => total + categoria.itens.length, 0),
    categorias
  };
}

async function publicarCatalogoPublico() {
  try {
    await setDoc(
      doc(db, CATALOGO_CACHE_COLLECTION, CATALOGO_CACHE_DOC),
      montarCatalogoPublico()
    );
  } catch (erro) {
    console.error("Erro ao atualizar cache público do catálogo:", erro);

    // Evita que o site público use um cache antigo caso a publicação falhe
    // por limite de tamanho do documento ou regra de escrita.
    try {
      await deleteDoc(doc(db, CATALOGO_CACHE_COLLECTION, CATALOGO_CACHE_DOC));
    } catch {}

    mostrarMensagem(
      "Alteração salva, mas o cache rápido não atualizou. O catálogo usará leitura direta.",
      "aviso"
    );
  }
}

async function garantirCatalogoPublico() {
  try {
    const cacheSnap = await getDoc(doc(db, CATALOGO_CACHE_COLLECTION, CATALOGO_CACHE_DOC));
    const cache = cacheSnap.exists() ? cacheSnap.data() : null;
    if (!cache || cache.versao !== CATALOGO_CACHE_VERSION) {
      await publicarCatalogoPublico();
    }
  } catch (erro) {
    console.info("Cache público indisponível; o catálogo público usará fallback.", erro);
  }
}

async function atualizarListasEPublicarCatalogo() {
  await carregarCategorias();
  await carregarSelect();
  await publicarCatalogoPublico();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  await carregarCategorias();
  await carregarSelect();
  await garantirCatalogoPublico();
  await carregarConfiguracaoLoja();
  iniciarChangelog();

  mostrarPreview("imagem", "previewCategoria");
  mostrarPreview("imagemItem", "previewItem");
  mostrarPreview("capaLoja", "previewCapaLoja");
  configurarDragOrdenacao();

  aplicarMascaraPrecoNoCampo(document.getElementById("precoItem"));
});


function travarBotao(botao, textoCarregando = "Salvando...") {
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoCarregando;

  return function destravar() {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  };
}

function normalizarTexto(texto) {
  return String(texto).trim().toLowerCase();
}

function escaparHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escaparAttr(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function carregarConfiguracaoLoja() {
  try {
    const configRef = doc(db, "config", "loja");
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      const data = configSnap.data();

      document.getElementById("nomeLoja").value = data.nome || "";
      document.getElementById("whatsLoja").value = data.whatsapp || "";
      document.getElementById("instagramLoja").value = data.instagram || "";
      document.getElementById("enderecoLoja").value = data.endereco || "";
      document.getElementById("descricaoLoja").value = data.descricao || "";

      const preview = document.getElementById("previewCapaLoja");
      if (data.capa) {
        preview.src = data.capa;
        preview.style.display = "block";
      }
    }
  } catch (erro) {
    console.error("Erro ao carregar configuração da loja:", erro);
  }
}

function mostrarPreview(inputId, imgId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(imgId);

  if (!input || !preview) return;

  input.addEventListener("change", () => {
    const file = input.files[0];

    if (!file) {
      preview.src = "";
      preview.style.display = "none";
      return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.style.display = "block";
    };

    reader.readAsDataURL(file);
  });
}

function limparPreview(imgId) {
  const preview = document.getElementById(imgId);
  if (!preview) return;

  preview.src = "";
  preview.style.display = "none";
}

function formatarPrecoInput(valor) {
  const numeros = String(valor).replace(/\D/g, "");

  if (!numeros) return "";

  const numero = Number(numeros) / 100;

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function aplicarMascaraPrecoNoCampo(input) {
  if (!input) return;

  input.addEventListener("input", () => {
    input.value = formatarPrecoInput(input.value);
  });
}

let timeoutMensagem = null;

function mostrarMensagem(texto, tipo = "sucesso") {
  const caixa = document.getElementById("mensagemAdmin");
  if (!caixa) return;

  caixa.textContent = texto;
  caixa.className = `mensagem-admin ${tipo} mostrar`;

  clearTimeout(timeoutMensagem);

  timeoutMensagem = setTimeout(() => {
    caixa.className = "mensagem-admin";
  }, 3000);
}

function mensagemErroReautenticacao(erro) {
  const code = erro?.code || "";

  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Senha do login incorreta.";
  }

  if (code.includes("too-many-requests")) {
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  }

  if (code.includes("network-request-failed")) {
    return "Sem conexão para confirmar a senha.";
  }

  return "Não foi possível confirmar sua senha. Faça login novamente.";
}

async function reautenticarAdmin(senha) {
  const user = auth.currentUser;

  if (!user || !user.email) {
    throw new Error("admin-sem-sessao");
  }

  const credencial = EmailAuthProvider.credential(user.email, senha);
  await reauthenticateWithCredential(user, credencial);
}

let acaoConfirmada = null;

function abrirModal({ titulo, texto, precisaSenha = false, onConfirm }) {
  document.getElementById("modalConfirm").style.display = "flex";
  document.getElementById("modalTitulo").textContent = titulo;
  document.getElementById("modalTexto").textContent = texto;

  const campoSenha = document.getElementById("modalSenha");
  campoSenha.style.display = precisaSenha ? "block" : "none";
  campoSenha.value = "";

  acaoConfirmada = onConfirm;
}

function fecharModal() {
  document.getElementById("modalConfirm").style.display = "none";
}

document.getElementById("btnCancelarModal").onclick = fecharModal;

document.getElementById("btnConfirmarModal").onclick = async () => {
  const botao = document.getElementById("btnConfirmarModal");
  const campoSenha = document.getElementById("modalSenha");
  const senha = campoSenha.value;
  const precisaReautenticar = campoSenha.style.display === "block";

  if (precisaReautenticar) {
    if (!senha) {
      mostrarMensagem("Digite a senha do seu login.", "aviso");
      campoSenha.focus();
      return;
    }

    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Confirmando...";

    try {
      await reautenticarAdmin(senha);
    } catch (erro) {
      mostrarMensagem(mensagemErroReautenticacao(erro), "erro");
      campoSenha.value = "";
      campoSenha.focus();
      botao.disabled = false;
      botao.textContent = textoOriginal;
      return;
    }

    botao.disabled = false;
    botao.textContent = textoOriginal;
  }

  fecharModal();

  if (acaoConfirmada) {
    await acaoConfirmada();
  }
};

// SALVAR CATEGORIA
document.getElementById("btnSalvar").addEventListener("click", async (e) => {
  const botao = e.currentTarget;
  if (botao.disabled) return;

  const destravar = travarBotao(botao, "Salvando...");

  const nome = document.getElementById("nome").value.trim();
  const file = document.getElementById("imagem").files[0];

  if (!nome || !file) {
    mostrarMensagem("Preencha tudo!", "aviso");
    destravar();
    return;
  }

  const nomeNormalizado = normalizarTexto(nome);
  const categoriasSnapshot = await getDocs(collection(db, "categorias"));

  const categoriaExistente = categoriasSnapshot.docs.find((docSnap) => {
    const data = docSnap.data();
    return normalizarTexto(data.nome) === nomeNormalizado;
  });

  if (categoriaExistente) {
    mostrarMensagem("Já existe uma categoria com esse nome.", "aviso");
    destravar();
    return;
  }

  try {
    botao.textContent = "Otimizando imagem...";
    const upload = await uploadImagem(file, "categoria");

    await addDoc(collection(db, "categorias"), {
      nome,
      ...camposImagem(upload),
      ordem: categoriasCache.length
    });

    mostrarMensagem(`Categoria salva! ${resumoOtimizacao(upload)}`, "sucesso");
    document.getElementById("nome").value = "";
    document.getElementById("imagem").value = "";

    limparPreview("previewCategoria");

    await atualizarListasEPublicarCatalogo();
    destravar();
  } catch (erro) {
    console.error("Erro ao salvar categoria:", erro);
    mostrarMensagem(erro.message || "Erro ao salvar categoria!", "erro");
    destravar();
  }
});

// LISTAR CATEGORIAS
async function carregarCategorias() {
  const querySnapshot = await getDocs(collection(db, "categorias"));
  categoriasCache = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
    const data = docSnap.data();

    const itensSnapshot = await getDocs(collection(db, "categorias", docSnap.id, "itens"));
    const itens = itensSnapshot.docs.map((itemDoc) => ({
      id: itemDoc.id,
      ...itemDoc.data()
    }));

    return {
      id: docSnap.id,
      ...data,
      itens
    };
  }));

  categoriasCacheCarregado = true;

  renderizarCategorias();
}

function renderizarCategorias(filtro = "") {
  const container = document.getElementById("listaCategorias");
  container.innerHTML = "";

  const textoBusca = filtro.trim().toLowerCase();

  const categoriasFiltradas = categoriasCache.filter((categoria) => {
    const nomeCategoria = String(categoria.nome || "").toLowerCase();

    const categoriaCombina = nomeCategoria.includes(textoBusca);

    const itemCombina = categoria.itens.some((item) => {
      const nomeItem = String(item.nome || "").toLowerCase();
      const descricaoItem = String(item.descricao || "").toLowerCase();
      return nomeItem.includes(textoBusca) || descricaoItem.includes(textoBusca);
    });

    return !textoBusca || categoriaCombina || itemCombina;
  });

  if (categoriasFiltradas.length === 0) {
    container.innerHTML = "<p>Nenhuma categoria ou item encontrado.</p>";
    return;
  }

  // Ordenar por campo 'ordem' antes de renderizar
  categoriasFiltradas.sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));

  categoriasFiltradas.forEach((categoria) => {
    const nomeCategoria = String(categoria.nome || "").toLowerCase();
    const categoriaCombina = nomeCategoria.includes(textoBusca);

    const temItemEncontrado = categoria.itens.some((item) =>
      String(item.nome || "").toLowerCase().includes(textoBusca) ||
      String(item.descricao || "").toLowerCase().includes(textoBusca)
    );

    const abrirAutomaticamente = textoBusca && temItemEncontrado && !categoriaCombina;
    const semFiltro = !textoBusca;

    const div = document.createElement("div");
    div.className = "categoria-admin";
    div.dataset.categoriaId = categoria.id;
    div.innerHTML = `
      <div class="cat-card-header">
        ${semFiltro ? `
          <button class="drag-handle drag-categoria" type="button" draggable="true" data-drag-tipo="categoria" data-categoria-id="${escaparAttr(categoria.id)}" title="Arrastar categoria" aria-label="Arrastar categoria">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
              <circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/>
              <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
              <circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>
            </svg>
          </button>
        ` : ""}
        <img src="${escaparAttr(categoria.imagem)}" class="cat-thumb" alt="${escaparAttr(categoria.nome || "")}">
        <div class="cat-card-body">
          <input type="text" id="categoria-nome-${categoria.id}" value="${escaparAttr(categoria.nome || "")}" placeholder="Nome da categoria" maxlength="40">
        </div>
        <div class="botoes-categoria">
          <button class="btn-sm btn-primary" onclick="salvarEdicaoCategoria('${categoria.id}')">Salvar</button>
          <button class="btn-sm btn-outline" onclick="trocarImagemCategoria('${categoria.id}')">Imagem</button>
          <button class="btn-sm btn-outline" onclick="toggleItens('${categoria.id}', '${escapeAspas(textoBusca)}')">Itens</button>
          <button class="btn-sm btn-danger" onclick="excluirCategoria('${categoria.id}')">Excluir</button>
        </div>
      </div>
      <div id="itens-${categoria.id}" class="area-itens" style="display:${abrirAutomaticamente ? "block" : "none"};"></div>
    `;

    container.appendChild(div);

    if (abrirAutomaticamente) {
      renderizarItensDaCategoria(categoria.id, textoBusca);
      categoriaAbertaId = categoria.id;
    }
  });
}

function renderizarItensDaCategoria(categoriaId, textoBusca = "") {
  const areaAtual = document.getElementById(`itens-${categoriaId}`);
  if (!areaAtual) return;

  const categoria = categoriasCache.find((cat) => cat.id === categoriaId);
  if (!categoria) {
    areaAtual.innerHTML = "<p>Categoria não encontrada.</p>";
    return;
  }

  if (!categoria.itens || categoria.itens.length === 0) {
    areaAtual.innerHTML = "<p>Nenhum item cadastrado.</p>";
    return;
  }

  // Ordenar itens por 'ordem'
  const itensOrdenados = [...categoria.itens].sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
  const totalItens = itensOrdenados.length;
  const semFiltro  = !textoBusca;

  let html = `<p class="area-itens-titulo">${totalItens} ${totalItens === 1 ? "item" : "itens"}</p>`;

  itensOrdenados.forEach((item) => {
    const nomeItem  = String(item.nome || "").toLowerCase();
    const descricaoItem = String(item.descricao || "").toLowerCase();
    const encontrou = textoBusca && (nomeItem.includes(textoBusca) || descricaoItem.includes(textoBusca));
    const disponivel = item.disponivel !== false;

    html += `
      <div class="item-admin ${encontrou ? "item-destaque" : ""}${!disponivel ? " item-admin-indisponivel" : ""}" data-categoria-id="${escaparAttr(categoriaId)}" data-item-id="${escaparAttr(item.id)}">
        ${semFiltro ? `
          <button class="drag-handle drag-item" type="button" draggable="true" data-drag-tipo="item" data-categoria-id="${escaparAttr(categoriaId)}" data-item-id="${escaparAttr(item.id)}" title="Arrastar produto" aria-label="Arrastar produto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
              <circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/>
              <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
              <circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>
            </svg>
          </button>
        ` : ""}
        <img src="${escaparAttr(item.imagem)}" class="item-thumb" alt="${escaparAttr(item.nome || "")}">
        <div class="item-fields">
          <input type="text" id="nome-${item.id}" value="${escaparAttr(item.nome || "")}" placeholder="Nome do item" maxlength="50">
          <input type="text" id="preco-${item.id}" value="${escaparAttr(item.preco || "")}" placeholder="0,00" maxlength="15">
          <textarea id="descricao-${item.id}" placeholder="Descrição do produto" maxlength="300" rows="2">${escaparHTML(item.descricao || "")}</textarea>
        </div>
        <div class="botoes-item">
          <button class="btn-sm btn-primary" onclick="salvarEdicaoItem('${categoriaId}', '${item.id}')">Salvar</button>
          <button class="btn-sm btn-outline" onclick="trocarImagemItem('${categoriaId}', '${item.id}')">Imagem</button>
          <button class="btn-sm btn-outline" onclick="duplicarItem('${categoriaId}', '${item.id}')">Duplicar</button>
          <button class="btn-sm ${disponivel ? "btn-outline" : "btn-danger"}" onclick="toggleDisponibilidade('${categoriaId}','${item.id}',${disponivel})">
            ${disponivel ? "Disponível" : "Indisponível"}
          </button>
          <button class="btn-sm btn-danger" onclick="excluirItem('${categoriaId}', '${item.id}')">Excluir</button>
        </div>
      </div>
    `;
  });

  areaAtual.innerHTML = html;

  categoria.itens.forEach((item) => {
    aplicarMascaraPrecoNoCampo(document.getElementById(`preco-${item.id}`));
  });
}

function escapeAspas(texto) {
  return texto.replace(/'/g, "\\'");
}

window.salvarEdicaoCategoria = async function (categoriaId) {
  const novoNome = document.getElementById(`categoria-nome-${categoriaId}`).value;

  if (!novoNome) {
    mostrarMensagem("Preencha o nome da categoria.", "aviso");
    return;
  }

  try {
    const nomeNormalizado = normalizarTexto(novoNome);
    const categoriasSnapshot = await getDocs(collection(db, "categorias"));

    const categoriaExistente = categoriasSnapshot.docs.find((docSnap) => {
      if (docSnap.id === categoriaId) return false;
      const data = docSnap.data();
      return normalizarTexto(data.nome) === nomeNormalizado;
    });

    if (categoriaExistente) {
      mostrarMensagem("Já existe outra categoria com esse nome.", "aviso");
      return;
    }

    await updateDoc(doc(db, "categorias", categoriaId), {
      nome: novoNome
    });

    mostrarMensagem("Categoria atualizada!", "sucesso");
    await atualizarListasEPublicarCatalogo();
  } catch (erro) {
    console.error("Erro ao salvar categoria:", erro);
    mostrarMensagem("Erro ao salvar categoria!", "erro");
  }
};

window.trocarImagemCategoria = async function (categoriaId) {
  try {
    const inputFile = document.createElement("input");
    inputFile.type = "file";
    inputFile.accept = "image/*";

    inputFile.onchange = async function () {
      const file = inputFile.files[0];

      if (!file) {
        mostrarMensagem("Nenhuma imagem selecionada.", "aviso");
        return;
      }

      try {
        mostrarMensagem("Otimizando e enviando imagem...", "aviso");
        const upload = await uploadImagem(file, "categoria");

        await updateDoc(doc(db, "categorias", categoriaId), camposImagem(upload));

        mostrarMensagem(`Imagem atualizada! ${resumoOtimizacao(upload)}`, "sucesso");
        await carregarCategorias();
        await publicarCatalogoPublico();
      } catch (erro) {
        console.error("Erro ao trocar imagem da categoria:", erro);
        mostrarMensagem(erro.message || "Erro ao trocar imagem da categoria!", "erro");
      }
    };

    inputFile.click();
  } catch (erro) {
    console.error("Erro ao iniciar troca de imagem da categoria:", erro);
    mostrarMensagem("Erro ao trocar imagem da categoria!", "erro");
  }
};

// EXCLUIR CATEGORIA
window.excluirCategoria = async function (id) {
  abrirModal({
    titulo: "Excluir categoria",
    texto: "Tem certeza que deseja excluir esta categoria?",
    precisaSenha: true,
    onConfirm: async () => {
      try {
        const itensRef = collection(db, "categorias", id, "itens");
        const itensSnapshot = await getDocs(itensRef);

        for (const itemDoc of itensSnapshot.docs) {
          await deleteDoc(doc(db, "categorias", id, "itens", itemDoc.id));
        }

        await deleteDoc(doc(db, "categorias", id));

        mostrarMensagem("Categoria excluída com sucesso!", "sucesso");
        await carregarCategorias();
        await carregarSelect();

        if (categoriaAbertaId === id) {
          categoriaAbertaId = null;
        }

        await publicarCatalogoPublico();
      } catch (erro) {
        console.error("Erro ao excluir categoria:", erro);
        mostrarMensagem("Erro ao excluir categoria!", "erro");
      }
    }
  });
};

// ABRIR/FECHAR ITENS
window.toggleItens = async function (categoriaId, textoBusca = "") {
  const areaAtual = document.getElementById(`itens-${categoriaId}`);
  if (!areaAtual) return;

  if (categoriaAbertaId && categoriaAbertaId !== categoriaId) {
    const areaAnterior = document.getElementById(`itens-${categoriaAbertaId}`);
    if (areaAnterior) {
      areaAnterior.style.display = "none";
      areaAnterior.innerHTML = "";
    }
  }

  if (categoriaAbertaId === categoriaId && areaAtual.style.display === "block") {
    areaAtual.style.display = "none";
    areaAtual.innerHTML = "";
    categoriaAbertaId = null;
    return;
  }

  categoriaAbertaId = categoriaId;
  areaAtual.style.display = "block";
  areaAtual.innerHTML = "<p>Carregando itens...</p>";

  try {
    renderizarItensDaCategoria(categoriaId, textoBusca);
  } catch (erro) {
    console.error("Erro ao carregar itens:", erro);
    areaAtual.innerHTML = "<p>Erro ao carregar itens.</p>";
  }
};

// EXCLUIR ITEM
window.excluirItem = async function (categoriaId, itemId) {
  abrirModal({
    titulo: "Excluir item",
    texto: "Tem certeza que deseja excluir este item?",
    precisaSenha: true,
    onConfirm: async () => {
      try {
        await deleteDoc(doc(db, "categorias", categoriaId, "itens", itemId));
        mostrarMensagem("Item excluído com sucesso!", "sucesso");
        await toggleItensRecarregar(categoriaId);
        await publicarCatalogoPublico();
      } catch (erro) {
        console.error("Erro ao excluir item:", erro);
        mostrarMensagem("Erro ao excluir item!", "erro");
      }
    }
  });
};

async function toggleItensRecarregar(categoriaId) {
  await carregarCategorias();
  categoriaAbertaId = null;
  await toggleItens(categoriaId);
}

window.salvarEdicaoItem = async function (categoriaId, itemId) {
  const novoNome = document.getElementById(`nome-${itemId}`).value;
  const novoPreco = document.getElementById(`preco-${itemId}`).value;
  const novaDescricao = document.getElementById(`descricao-${itemId}`)?.value.trim() || "";

  if (!novoNome || !novoPreco) {
    mostrarMensagem("Preencha nome e preço.", "aviso");
    return;
  }

  try {
    const nomeNormalizado = normalizarTexto(novoNome);
    const itensSnapshot = await getDocs(collection(db, "categorias", categoriaId, "itens"));

    const itemExistente = itensSnapshot.docs.find((docSnap) => {
      if (docSnap.id === itemId) return false;
      const data = docSnap.data();
      return normalizarTexto(data.nome) === nomeNormalizado;
    });

    if (itemExistente) {
      mostrarMensagem("Já existe outro item com esse nome nessa categoria.", "aviso");
      return;
    }

    await updateDoc(doc(db, "categorias", categoriaId, "itens", itemId), {
      nome: novoNome,
      preco: novoPreco,
      descricao: novaDescricao
    });

    mostrarMensagem("Item atualizado!", "sucesso");
    await toggleItensRecarregar(categoriaId);
    await publicarCatalogoPublico();
  } catch (erro) {
    console.error("Erro ao salvar edição do item:", erro);
    mostrarMensagem("Erro ao salvar edição do item!", "erro");
  }
};

window.trocarImagemItem = async function (categoriaId, itemId) {
  try {
    const inputFile = document.createElement("input");
    inputFile.type = "file";
    inputFile.accept = "image/*";

    inputFile.onchange = async function () {
      const file = inputFile.files[0];

      if (!file) {
        mostrarMensagem("Nenhuma imagem selecionada.", "aviso");
        return;
      }

      try {
        mostrarMensagem("Otimizando e enviando imagem...", "aviso");
        const upload = await uploadImagem(file, "item");

        await updateDoc(doc(db, "categorias", categoriaId, "itens", itemId), camposImagem(upload));

        mostrarMensagem(`Imagem atualizada! ${resumoOtimizacao(upload)}`, "sucesso");
        await toggleItensRecarregar(categoriaId);
        await publicarCatalogoPublico();
      } catch (erro) {
        console.error("Erro ao trocar imagem do item:", erro);
        mostrarMensagem(erro.message || "Erro ao trocar imagem do item!", "erro");
      }
    };

    inputFile.click();
  } catch (erro) {
    console.error("Erro ao iniciar troca de imagem:", erro);
    mostrarMensagem("Erro ao trocar imagem!", "erro");
  }
};

// CARREGAR SELECT
async function carregarSelect() {
  const select = document.getElementById("categoriaSelect");
  select.innerHTML = "";

  const categorias = categoriasCacheCarregado
    ? [...categoriasCache].sort(ordenarPorOrdem)
    : (await getDocs(collection(db, "categorias"))).docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })).sort(ordenarPorOrdem);

  categorias.forEach((categoria) => {
    const option = document.createElement("option");
    option.value = categoria.id;
    option.textContent = categoria.nome;
    select.appendChild(option);
  });
}

// ADICIONAR ITEM
document.getElementById("btnAddItem").addEventListener("click", async (e) => {
  const botao = e.currentTarget;
  if (botao.disabled) return;

  const destravar = travarBotao(botao, "Adicionando...");

  const nome = document.getElementById("nomeItem").value.trim();
  const preco = document.getElementById("precoItem").value;
  const descricao = document.getElementById("descricaoItem").value.trim();
  const file = document.getElementById("imagemItem").files[0];
  const categoriaId = document.getElementById("categoriaSelect").value;

  if (!nome || !preco || !file || !categoriaId) {
    mostrarMensagem("Preencha tudo!", "aviso");
    destravar();
    return;
  }

  const nomeNormalizado = normalizarTexto(nome);
  const itensSnapshot = await getDocs(collection(db, "categorias", categoriaId, "itens"));

  const itemExistente = itensSnapshot.docs.find((docSnap) => {
    const data = docSnap.data();
    return normalizarTexto(data.nome) === nomeNormalizado;
  });

  if (itemExistente) {
    mostrarMensagem("Já existe um item com esse nome nessa categoria.", "aviso");
    destravar();
    return;
  }

  try {
    botao.textContent = "Otimizando imagem...";
    const upload = await uploadImagem(file, "item");

    const itensSnap = await getDocs(collection(db, "categorias", categoriaId, "itens"));
    await addDoc(collection(db, "categorias", categoriaId, "itens"), {
      nome,
      preco,
      descricao,
      ...camposImagem(upload),
      disponivel: true,
      ordem: itensSnap.size
    });

    mostrarMensagem(`Item adicionado! ${resumoOtimizacao(upload)}`, "sucesso");

    document.getElementById("nomeItem").value = "";
    document.getElementById("precoItem").value = "";
    document.getElementById("descricaoItem").value = "";
    document.getElementById("imagemItem").value = "";

    limparPreview("previewItem");

    if (categoriaAbertaId === categoriaId) {
      await toggleItensRecarregar(categoriaId);
    } else {
      await carregarCategorias();
    }

    await publicarCatalogoPublico();
    destravar();
  } catch (erro) {
    console.error("Erro ao adicionar item:", erro);
    mostrarMensagem(erro.message || "Erro ao adicionar item!", "erro");
    destravar();
  }
});

document.getElementById("buscaAdmin").addEventListener("input", (e) => {
  renderizarCategorias(e.target.value);
});

function moverRegistro(lista, origemId, destinoId) {
  const novaLista = [...lista];
  const origemIndex = novaLista.findIndex((item) => item.id === origemId);
  const destinoIndex = novaLista.findIndex((item) => item.id === destinoId);

  if (origemIndex < 0 || destinoIndex < 0 || origemIndex === destinoIndex) {
    return null;
  }

  const [movido] = novaLista.splice(origemIndex, 1);
  novaLista.splice(destinoIndex, 0, movido);
  return novaLista;
}

function limparMarcadoresDrag() {
  document.querySelectorAll(".arrastando, .drag-over").forEach((el) => {
    el.classList.remove("arrastando", "drag-over");
  });
}

function configurarDragOrdenacao() {
  if (dragListenersConfigurados) return;

  const lista = document.getElementById("listaCategorias");
  if (!lista) return;

  dragListenersConfigurados = true;

  lista.addEventListener("dragstart", (e) => {
    const handle = e.target.closest(".drag-handle");
    if (!handle) return;

    dragOrdenacao = {
      tipo: handle.dataset.dragTipo,
      categoriaId: handle.dataset.categoriaId || "",
      itemId: handle.dataset.itemId || ""
    };

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(dragOrdenacao));
    handle.closest(".categoria-admin, .item-admin")?.classList.add("arrastando");
  });

  lista.addEventListener("dragover", (e) => {
    if (!dragOrdenacao) return;

    const alvo = dragOrdenacao.tipo === "categoria"
      ? e.target.closest(".categoria-admin")
      : e.target.closest(".item-admin");

    if (!alvo) return;
    if (dragOrdenacao.tipo === "item" && alvo.dataset.categoriaId !== dragOrdenacao.categoriaId) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    document.querySelectorAll(".drag-over").forEach((el) => {
      if (el !== alvo) el.classList.remove("drag-over");
    });
    alvo.classList.add("drag-over");
  });

  lista.addEventListener("dragleave", (e) => {
    const alvo = e.target.closest(".categoria-admin, .item-admin");
    if (alvo && !alvo.contains(e.relatedTarget)) {
      alvo.classList.remove("drag-over");
    }
  });

  lista.addEventListener("drop", async (e) => {
    if (!dragOrdenacao) return;
    e.preventDefault();

    try {
      if (dragOrdenacao.tipo === "categoria") {
        const alvo = e.target.closest(".categoria-admin");
        await reordenarCategoriasPorDrag(dragOrdenacao.categoriaId, alvo?.dataset.categoriaId);
      }

      if (dragOrdenacao.tipo === "item") {
        const alvo = e.target.closest(".item-admin");
        if (alvo?.dataset.categoriaId === dragOrdenacao.categoriaId) {
          await reordenarItensPorDrag(dragOrdenacao.categoriaId, dragOrdenacao.itemId, alvo.dataset.itemId);
        }
      }
    } catch (erro) {
      console.error("Erro ao reordenar:", erro);
      mostrarMensagem("Erro ao reordenar. Tente novamente.", "erro");
    } finally {
      dragOrdenacao = null;
      limparMarcadoresDrag();
    }
  });

  lista.addEventListener("dragend", () => {
    dragOrdenacao = null;
    limparMarcadoresDrag();
  });
}

async function reordenarCategoriasPorDrag(origemId, destinoId) {
  if (!origemId || !destinoId || origemId === destinoId) return;

  const ordenadas = [...categoriasCache].sort(ordenarPorOrdem);
  const novaOrdem = moverRegistro(ordenadas, origemId, destinoId);
  if (!novaOrdem) return;

  await Promise.all(novaOrdem.map((categoria, index) =>
    updateDoc(doc(db, "categorias", categoria.id), { ordem: index })
  ));

  mostrarMensagem("Categorias reordenadas!", "sucesso");
  await atualizarListasEPublicarCatalogo();
}

async function reordenarItensPorDrag(categoriaId, origemId, destinoId) {
  if (!categoriaId || !origemId || !destinoId || origemId === destinoId) return;

  const categoria = categoriasCache.find((cat) => cat.id === categoriaId);
  if (!categoria) return;

  const ordenados = [...categoria.itens].sort(ordenarPorOrdem);
  const novaOrdem = moverRegistro(ordenados, origemId, destinoId);
  if (!novaOrdem) return;

  await Promise.all(novaOrdem.map((item, index) =>
    updateDoc(doc(db, "categorias", categoriaId, "itens", item.id), { ordem: index })
  ));

  mostrarMensagem("Produtos reordenados!", "sucesso");
  await toggleItensRecarregar(categoriaId);
  await publicarCatalogoPublico();
}

// ── Mover categoria ──────────────────────────────────────────
window.moverCategoria = async function (categoriaId, direcao) {
  const sorted = [...categoriasCache].sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
  const idx     = sorted.findIndex(c => c.id === categoriaId);
  if (idx < 0) return;
  const swapIdx = direcao === "cima" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return;

  const catA = sorted[idx];
  const catB = sorted[swapIdx];
  await Promise.all([
    updateDoc(doc(db, "categorias", catA.id), { ordem: swapIdx }),
    updateDoc(doc(db, "categorias", catB.id), { ordem: idx })
  ]);
  await atualizarListasEPublicarCatalogo();
};

// ── Mover item ────────────────────────────────────────────────
window.moverItem = async function (categoriaId, itemId, direcao) {
  const categoria = categoriasCache.find(c => c.id === categoriaId);
  if (!categoria) return;

  const sorted = [...categoria.itens].sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
  const idx     = sorted.findIndex(i => i.id === itemId);
  if (idx < 0) return;
  const swapIdx = direcao === "cima" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return;

  const itemA = sorted[idx];
  const itemB = sorted[swapIdx];
  await Promise.all([
    updateDoc(doc(db, "categorias", categoriaId, "itens", itemA.id), { ordem: swapIdx }),
    updateDoc(doc(db, "categorias", categoriaId, "itens", itemB.id), { ordem: idx })
  ]);
  await toggleItensRecarregar(categoriaId);
  await publicarCatalogoPublico();
};

// ── Duplicar item ─────────────────────────────────────────────
window.duplicarItem = async function (categoriaId, itemId) {
  const categoria = categoriasCache.find(c => c.id === categoriaId);
  if (!categoria) return;
  const item = categoria.itens.find(i => i.id === itemId);
  if (!item) return;

  const maxOrdem = Math.max(...categoria.itens.map(i => i.ordem ?? 0), 0);
  await addDoc(collection(db, "categorias", categoriaId, "itens"), {
    nome:      `${item.nome} (cópia)`,
    preco:     item.preco,
    descricao: item.descricao || "",
    imagem:    item.imagem,
    imagemThumb: item.imagemThumb || item.imagemMedium || item.imagem,
    imagemMedium: item.imagemMedium || item.imagem,
    imagemMeta: item.imagemMeta || null,
    disponivel: item.disponivel !== false,
    ordem:     maxOrdem + 1
  });
  mostrarMensagem("Item duplicado!", "sucesso");
  await toggleItensRecarregar(categoriaId);
  await publicarCatalogoPublico();
};

// ── Toggle disponibilidade ────────────────────────────────────
window.toggleDisponibilidade = async function (categoriaId, itemId, disponivel) {
  try {
    await updateDoc(doc(db, "categorias", categoriaId, "itens", itemId), {
      disponivel: !disponivel
    });
    mostrarMensagem(`Item marcado como ${!disponivel ? "disponível" : "indisponível"}!`, "sucesso");
    await toggleItensRecarregar(categoriaId);
    await publicarCatalogoPublico();
  } catch (erro) {
    console.error(erro);
    mostrarMensagem("Erro ao atualizar disponibilidade!", "erro");
  }
};

window.logout = async function () {
  try {
    sessionStorage.removeItem("admin_ok");
    await signOut(auth);
    window.location.href = "login.html";
  } catch (erro) {
    console.error("Erro ao sair:", erro);
  }
};

// 🔥 SALVAR CONFIGURAÇÃO DA LOJA
document.getElementById("btnSalvarLoja").addEventListener("click", async (e) => {
  const botao = e.currentTarget;
  if (botao.disabled) return;

  const destravar = travarBotao(botao, "Salvando...");

  const nome = document.getElementById("nomeLoja").value.trim();
  const whatsapp = document.getElementById("whatsLoja").value.replace(/\D/g, "");
  const instagram = document.getElementById("instagramLoja").value.trim();
  const endereco = document.getElementById("enderecoLoja").value.trim();
  const descricao = document.getElementById("descricaoLoja").value.trim();
  const file = document.getElementById("capaLoja").files[0];

  if (!nome) {
    mostrarMensagem("Preencha o nome da loja.", "aviso");
    destravar();
    return;
  }

  if (!whatsapp) {
    mostrarMensagem("Preencha o WhatsApp da loja.", "aviso");
    destravar();
    return;
  }

  try {
    let urlCapa = "";
    let capaMeta = null;
    let uploadCapa = null;

    const configRef = doc(db, "config", "loja");
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      const configAtual = configSnap.data();
      urlCapa = configAtual.capa || "";
      capaMeta = configAtual.capaMeta || null;
    }

    if (file) {
      botao.textContent = "Otimizando capa...";
      uploadCapa = await uploadImagem(file, "capaLoja");
      urlCapa = uploadCapa.url;
      capaMeta = uploadCapa.meta;
    }

    await setDoc(doc(db, "config", "loja"), {
      nome,
      whatsapp,
      instagram,
      endereco,
      descricao,
      ...(uploadCapa ? camposCapa(uploadCapa) : { capa: urlCapa, capaMeta })
    });

    mostrarMensagem(
      uploadCapa
        ? `Configuração salva! ${resumoOtimizacao(uploadCapa)}`
        : "Configuração da loja salva!",
      "sucesso"
    );

    document.getElementById("capaLoja").value = "";

    const preview = document.getElementById("previewCapaLoja");
    if (urlCapa) {
      preview.src = urlCapa;
      preview.style.display = "block";
    }

    destravar();
  } catch (erro) {
    console.error("Erro ao salvar configuração da loja:", erro);
    mostrarMensagem("Erro ao salvar configuração!", "erro");
    destravar();
  }
});
