const IMGBB_API_KEY = "0d595582b34951b197134203135f6e32";
const IMAGE_PROVIDER = "imgbb";

const PERFIS = {
  capaLoja: {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.86,
    nome: "capa"
  },
  categoria: {
    maxWidth: 1600,
    maxHeight: 900,
    quality: 0.86,
    nome: "categoria"
  },
  item: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.86,
    nome: "produto"
  }
};

const TIPOS_SEM_CANVAS = new Set(["image/gif", "image/svg+xml"]);
let suportaWebPCache = null;

function validarArquivo(file) {
  if (!file) throw new Error("Nenhuma imagem selecionada.");

  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }
}

function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Formato de imagem não suportado pelo navegador."));
    };

    img.src = url;
  });
}

function suportaWebP() {
  if (suportaWebPCache !== null) return suportaWebPCache;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    suportaWebPCache = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    suportaWebPCache = false;
  }

  return suportaWebPCache;
}

function dataUrlParaBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

function canvasParaBlob(canvas, mime, quality) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => resolve(blob), mime, quality);
      return;
    }

    try {
      resolve(dataUrlParaBlob(canvas.toDataURL(mime, quality)));
    } catch {
      resolve(null);
    }
  });
}

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1];
      if (!base64) reject(new Error("Não foi possível preparar a imagem."));
      else resolve(base64);
    };

    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(blob);
  });
}

function escolherDimensoes(origW, origH, perfil) {
  const escala = Math.min(
    perfil.maxWidth / origW,
    perfil.maxHeight / origH,
    1
  );

  return {
    width: Math.max(1, Math.round(origW * escala)),
    height: Math.max(1, Math.round(origH * escala)),
    redimensionada: escala < 1
  };
}

function montarMeta({ file, perfilNome, perfil, original, final, blob, mimeFinal, otimizada }) {
  return {
    provider: IMAGE_PROVIDER,
    perfil: perfilNome,
    largura: final.width,
    altura: final.height,
    larguraOriginal: original.width,
    alturaOriginal: original.height,
    tamanhoOriginal: file.size,
    tamanhoFinal: blob.size,
    mimeOriginal: file.type || "image/unknown",
    mimeFinal,
    formato: mimeFinal.replace("image/", ""),
    qualidade: perfil.quality,
    redimensionada: final.redimensionada,
    otimizada,
    otimizadaEm: new Date().toISOString()
  };
}

async function otimizarImagem(file, perfilNome) {
  validarArquivo(file);

  const perfil = PERFIS[perfilNome] || PERFIS.item;
  const { img, url } = await carregarImagem(file);

  try {
    const original = {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height
    };

    if (!original.width || !original.height || TIPOS_SEM_CANVAS.has(file.type)) {
      const meta = montarMeta({
        file,
        perfilNome,
        perfil,
        original,
        final: { ...original, redimensionada: false },
        blob: file,
        mimeFinal: file.type || "image/unknown",
        otimizada: false
      });

      return { blob: file, meta };
    }

    const final = escolherDimensoes(original.width, original.height, perfil);
    const mimeFinal = suportaWebP() ? "image/webp" : "image/jpeg";
    const canvas = document.createElement("canvas");
    canvas.width = final.width;
    canvas.height = final.height;

    const ctx = canvas.getContext("2d", { alpha: mimeFinal !== "image/jpeg" });
    if (!ctx) throw new Error("Canvas indisponível para otimizar a imagem.");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (mimeFinal === "image/jpeg") {
      ctx.fillStyle = "#f7f3ea";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0, final.width, final.height);

    let blob = await canvasParaBlob(canvas, mimeFinal, perfil.quality);

    if (!blob && mimeFinal !== "image/jpeg") {
      blob = await canvasParaBlob(canvas, "image/jpeg", perfil.quality);
    }

    if (!blob) {
      const meta = montarMeta({
        file,
        perfilNome,
        perfil,
        original,
        final: { ...original, redimensionada: false },
        blob: file,
        mimeFinal: file.type || "image/unknown",
        otimizada: false
      });

      return { blob: file, meta };
    }

    const deveManterOriginal =
      !final.redimensionada &&
      blob.size >= file.size &&
      /image\/(jpeg|jpg|png|webp)/i.test(file.type || "");

    const blobFinal = deveManterOriginal ? file : blob;
    const mimeFinalReal = deveManterOriginal ? (file.type || "image/unknown") : blobFinal.type;
    const finalReal = deveManterOriginal
      ? { ...original, redimensionada: false }
      : final;

    return {
      blob: blobFinal,
      meta: montarMeta({
        file,
        perfilNome,
        perfil,
        original,
        final: finalReal,
        blob: blobFinal,
        mimeFinal: mimeFinalReal,
        otimizada: !deveManterOriginal
      })
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadImagem(file, perfilNome = "item") {
  const otimizada = await otimizarImagem(file, perfilNome);
  const base64 = await blobParaBase64(otimizada.blob);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: "POST",
    body: new URLSearchParams({ image: base64 })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success || !data?.data?.url) {
    throw new Error(data?.error?.message || "Erro ao enviar imagem para o ImgBB.");
  }

  const imagem = data.data;

  return {
    url: imagem.display_url || imagem.url,
    thumb: imagem.thumb?.url || "",
    medium: imagem.medium?.url || "",
    meta: otimizada.meta
  };
}

export function camposImagem(upload) {
  return {
    imagem: upload.url,
    imagemThumb: upload.thumb || upload.medium || upload.url,
    imagemMedium: upload.medium || upload.url,
    imagemMeta: upload.meta
  };
}

export function camposCapa(upload) {
  return {
    capa: upload.url,
    capaThumb: upload.thumb || upload.medium || upload.url,
    capaMedium: upload.medium || upload.url,
    capaMeta: upload.meta
  };
}

export function formatarBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

  const unidades = ["B", "KB", "MB", "GB"];
  let valor = bytes;
  let unidade = 0;

  while (valor >= 1024 && unidade < unidades.length - 1) {
    valor /= 1024;
    unidade++;
  }

  const casas = unidade === 0 || valor >= 10 ? 0 : 1;
  return `${valor.toFixed(casas).replace(".", ",")} ${unidades[unidade]}`;
}

export function resumoOtimizacao(upload) {
  const meta = upload?.meta;
  if (!meta) return "";

  if (!meta.otimizada) {
    return `Imagem enviada (${formatarBytes(meta.tamanhoFinal)}).`;
  }

  return `Imagem otimizada: ${formatarBytes(meta.tamanhoOriginal)} -> ${formatarBytes(meta.tamanhoFinal)}.`;
}
