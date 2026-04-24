import { db, auth } from "../config/firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Portão de sessão — executado imediatamente, de forma síncrona.
// Se não há flag de sessionStorage (nova aba, novo navegador, aba fechada),
// derruba qualquer sessão Firebase residual e manda para o login.
if (!sessionStorage.getItem("admin_ok")) {
  signOut(auth).catch(() => {});
  window.location.href = "login.html";
}

const API_KEY = "0d595582b34951b197134203135f6e32";

let categoriaAbertaId = null;
let categoriasCache = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  await carregarCategorias();
  await carregarSelect();
  await carregarConfiguracaoLoja();

  mostrarPreview("imagem", "previewCategoria");
  mostrarPreview("imagemItem", "previewItem");
  mostrarPreview("capaLoja", "previewCapaLoja");

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
  const senha = document.getElementById("modalSenha").value;

  if (document.getElementById("modalSenha").style.display === "block") {
    if (senha !== "1234") {
      mostrarMensagem("Senha incorreta!", "erro");
      return;
    }
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

  const reader = new FileReader();

  reader.onloadend = async function () {
    try {
      const base64 = reader.result.split(",")[1];

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
        method: "POST",
        body: new URLSearchParams({ image: base64 })
      });

      const data = await response.json();
      const url = data.data.url;

      await addDoc(collection(db, "categorias"), {
        nome,
        imagem: url,
        ordem: categoriasCache.length
      });

      mostrarMensagem("Categoria salva com sucesso!", "sucesso");
      document.getElementById("nome").value = "";
      document.getElementById("imagem").value = "";

      limparPreview("previewCategoria");

      await carregarCategorias();
      await carregarSelect();
      destravar();
    } catch (erro) {
      console.error("Erro ao salvar categoria:", erro);
      mostrarMensagem("Erro ao salvar categoria!", "erro");
      destravar();
    }
  };

  reader.readAsDataURL(file);
});

// LISTAR CATEGORIAS
async function carregarCategorias() {
  const querySnapshot = await getDocs(collection(db, "categorias"));
  categoriasCache = [];

  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();

    const itensSnapshot = await getDocs(collection(db, "categorias", docSnap.id, "itens"));
    const itens = itensSnapshot.docs.map((itemDoc) => ({
      id: itemDoc.id,
      ...itemDoc.data()
    }));

    categoriasCache.push({
      id: docSnap.id,
      ...data,
      itens
    });
  }

  renderizarCategorias();
}

function renderizarCategorias(filtro = "") {
  const container = document.getElementById("listaCategorias");
  container.innerHTML = "";

  const textoBusca = filtro.trim().toLowerCase();

  const categoriasFiltradas = categoriasCache.filter((categoria) => {
    const nomeCategoria = String(categoria.nome || "").toLowerCase();

    const categoriaCombina = nomeCategoria.includes(textoBusca);

    const itemCombina = categoria.itens.some((item) =>
      String(item.nome || "").toLowerCase().includes(textoBusca)
    );

    return !textoBusca || categoriaCombina || itemCombina;
  });

  if (categoriasFiltradas.length === 0) {
    container.innerHTML = "<p>Nenhuma categoria ou item encontrado.</p>";
    return;
  }

  // Ordenar por campo 'ordem' antes de renderizar
  categoriasFiltradas.sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
  const totalCats = categoriasFiltradas.length;

  categoriasFiltradas.forEach((categoria, idx) => {
    const nomeCategoria = String(categoria.nome || "").toLowerCase();
    const categoriaCombina = nomeCategoria.includes(textoBusca);

    const temItemEncontrado = categoria.itens.some((item) =>
      String(item.nome || "").toLowerCase().includes(textoBusca)
    );

    const abrirAutomaticamente = textoBusca && temItemEncontrado && !categoriaCombina;
    const semFiltro = !textoBusca;

    const div = document.createElement("div");
    div.className = "categoria-admin";
    div.innerHTML = `
      <div class="cat-card-header">
        <img src="${categoria.imagem}" class="cat-thumb" alt="${categoria.nome || ""}">
        <div class="cat-card-body">
          <input type="text" id="categoria-nome-${categoria.id}" value="${categoria.nome || ""}" placeholder="Nome da categoria" maxlength="40">
        </div>
        <div class="botoes-categoria">
          <button class="btn-sm btn-primary" onclick="salvarEdicaoCategoria('${categoria.id}')">Salvar</button>
          <button class="btn-sm btn-outline" onclick="trocarImagemCategoria('${categoria.id}')">Imagem</button>
          <button class="btn-sm btn-outline" onclick="toggleItens('${categoria.id}', '${escapeAspas(textoBusca)}')">Itens</button>
          ${semFiltro && idx > 0 ? `<button class="btn-sm btn-outline" onclick="moverCategoria('${categoria.id}','cima')" title="Mover para cima">↑</button>` : ""}
          ${semFiltro && idx < totalCats - 1 ? `<button class="btn-sm btn-outline" onclick="moverCategoria('${categoria.id}','baixo')" title="Mover para baixo">↓</button>` : ""}
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

  itensOrdenados.forEach((item, idx) => {
    const nomeItem  = String(item.nome || "").toLowerCase();
    const encontrou = textoBusca && nomeItem.includes(textoBusca);
    const disponivel = item.disponivel !== false;

    html += `
      <div class="item-admin ${encontrou ? "item-destaque" : ""}${!disponivel ? " item-admin-indisponivel" : ""}">
        <img src="${item.imagem}" class="item-thumb" alt="${item.nome || ""}">
        <div class="item-fields">
          <input type="text" id="nome-${item.id}" value="${item.nome || ""}" placeholder="Nome do item" maxlength="50">
          <input type="text" id="preco-${item.id}" value="${item.preco || ""}" placeholder="0,00" maxlength="15">
        </div>
        <div class="botoes-item">
          <button class="btn-sm btn-primary" onclick="salvarEdicaoItem('${categoriaId}', '${item.id}')">Salvar</button>
          <button class="btn-sm btn-outline" onclick="trocarImagemItem('${categoriaId}', '${item.id}')">Imagem</button>
          <button class="btn-sm btn-outline" onclick="duplicarItem('${categoriaId}', '${item.id}')">Duplicar</button>
          ${semFiltro && idx > 0 ? `<button class="btn-sm btn-outline" onclick="moverItem('${categoriaId}','${item.id}','cima')" title="Mover para cima">↑</button>` : ""}
          ${semFiltro && idx < totalItens - 1 ? `<button class="btn-sm btn-outline" onclick="moverItem('${categoriaId}','${item.id}','baixo')" title="Mover para baixo">↓</button>` : ""}
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
    await carregarCategorias();
    await carregarSelect();
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

      const reader = new FileReader();

      reader.onloadend = async function () {
        try {
          const base64 = reader.result.split(",")[1];

          const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
            method: "POST",
            body: new URLSearchParams({ image: base64 })
          });

          const data = await response.json();
          const url = data.data.url;

          await updateDoc(doc(db, "categorias", categoriaId), {
            imagem: url
          });

          mostrarMensagem("Imagem da categoria atualizada!", "sucesso");
          await carregarCategorias();
        } catch (erro) {
          console.error("Erro ao trocar imagem da categoria:", erro);
          mostrarMensagem("Erro ao trocar imagem da categoria!", "erro");
        }
      };

      reader.readAsDataURL(file);
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
      preco: novoPreco
    });

    mostrarMensagem("Item atualizado!", "sucesso");
    await toggleItensRecarregar(categoriaId);
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

      const reader = new FileReader();

      reader.onloadend = async function () {
        try {
          const base64 = reader.result.split(",")[1];

          const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
            method: "POST",
            body: new URLSearchParams({ image: base64 })
          });

          const data = await response.json();
          const url = data.data.url;

          await updateDoc(doc(db, "categorias", categoriaId, "itens", itemId), {
            imagem: url
          });

          mostrarMensagem("Imagem atualizada!", "sucesso");
          await toggleItensRecarregar(categoriaId);
        } catch (erro) {
          console.error("Erro ao trocar imagem do item:", erro);
          mostrarMensagem("Erro ao trocar imagem do item!", "erro");
        }
      };

      reader.readAsDataURL(file);
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

  const querySnapshot = await getDocs(collection(db, "categorias"));

  querySnapshot.forEach((docSnap) => {
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = docSnap.data().nome;
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

  const reader = new FileReader();

  reader.onloadend = async function () {
    try {
      const base64 = reader.result.split(",")[1];

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
        method: "POST",
        body: new URLSearchParams({ image: base64 })
      });

      const data = await response.json();
      const url = data.data.url;

      const itensSnap = await getDocs(collection(db, "categorias", categoriaId, "itens"));
      await addDoc(collection(db, "categorias", categoriaId, "itens"), {
        nome,
        preco,
        imagem: url,
        disponivel: true,
        ordem: itensSnap.size
      });

      mostrarMensagem("Item adicionado com sucesso!", "sucesso");

      document.getElementById("nomeItem").value = "";
      document.getElementById("precoItem").value = "";
      document.getElementById("imagemItem").value = "";

      limparPreview("previewItem");

      if (categoriaAbertaId === categoriaId) {
        await toggleItensRecarregar(categoriaId);
      }

      destravar();
    } catch (erro) {
      console.error("Erro ao adicionar item:", erro);
      mostrarMensagem("Erro ao adicionar item!", "erro");
      destravar();
    }
  };

  reader.readAsDataURL(file);
});

document.getElementById("buscaAdmin").addEventListener("input", (e) => {
  renderizarCategorias(e.target.value);
});

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
  await carregarCategorias();
  await carregarSelect();
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
    imagem:    item.imagem,
    disponivel: item.disponivel !== false,
    ordem:     maxOrdem + 1
  });
  mostrarMensagem("Item duplicado!", "sucesso");
  await toggleItensRecarregar(categoriaId);
};

// ── Toggle disponibilidade ────────────────────────────────────
window.toggleDisponibilidade = async function (categoriaId, itemId, disponivel) {
  try {
    await updateDoc(doc(db, "categorias", categoriaId, "itens", itemId), {
      disponivel: !disponivel
    });
    mostrarMensagem(`Item marcado como ${!disponivel ? "disponível" : "indisponível"}!`, "sucesso");
    await toggleItensRecarregar(categoriaId);
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

    const configRef = doc(db, "config", "loja");
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      urlCapa = configSnap.data().capa || "";
    }

    if (file) {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = () => {
          try {
            resolve(reader.result.split(",")[1]);
          } catch (erro) {
            reject(erro);
          }
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
        method: "POST",
        body: new URLSearchParams({ image: base64 })
      });

      const data = await response.json();
      urlCapa = data.data.url;
    }

    await setDoc(doc(db, "config", "loja"), {
      nome,
      whatsapp,
      instagram,
      endereco,
      descricao,
      capa: urlCapa
    });

    mostrarMensagem("Configuração da loja salva!", "sucesso");

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