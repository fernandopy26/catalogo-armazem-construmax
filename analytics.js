import { db } from "./config/firebase.js";
import {
  doc, setDoc, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================================
   Helpers de detecção
   ========================================================= */

function hoje() {
  return new Date().toISOString().slice(0, 10); // "2026-04-23"
}

function detectarDispositivo() {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

function detectarNavegador() {
  const ua = navigator.userAgent;
  if (/edg\//i.test(ua))               return "edge";
  if (/opr\/|opera/i.test(ua))         return "opera";
  if (/chrome/i.test(ua))              return "chrome";
  if (/firefox/i.test(ua))             return "firefox";
  if (/safari/i.test(ua))              return "safari";
  return "outro";
}

function detectarOrigem() {
  const params = new URLSearchParams(window.location.search);
  const utm = (params.get("utm_source") || "").toLowerCase();

  if (utm) {
    if (utm.includes("instagram"))            return "instagram";
    if (utm.includes("whatsapp"))             return "whatsapp";
    if (utm.includes("google"))               return "google";
    if (utm.includes("facebook") || utm.includes("fb")) return "facebook";
    return utm.slice(0, 20);
  }

  const ref = (document.referrer || "").toLowerCase();
  if (!ref)                                   return "direto";
  if (ref.includes("instagram.com"))          return "instagram";
  if (ref.includes("wa.me") || ref.includes("whatsapp")) return "whatsapp";
  if (ref.includes("google."))               return "google";
  if (ref.includes("facebook.") || ref.includes("fb.")) return "facebook";
  return "outro";
}

// Sanitiza nome para uso como chave Firestore (sem . # $ / [ ])
function sanitizarChave(str) {
  return String(str)
    .slice(0, 40)
    .replace(/[.#$\/\[\]]/g, "_")
    .trim() || "desconhecido";
}

/* =========================================================
   Escrita atômica no Firestore (fire-and-forget)
   ========================================================= */

async function escrever(campos) {
  try {
    const ref = doc(db, "analytics", hoje());
    await setDoc(ref, { ...campos, atualizado: serverTimestamp() }, { merge: true });
  } catch {
    // Silencioso — analytics nunca deve quebrar o catálogo
  }
}

/* =========================================================
   Rastreamento público
   ========================================================= */

/**
 * Registra visita única por dia (localStorage) e sessão (sessionStorage).
 * Deve ser chamado uma vez ao iniciar o catálogo.
 */
export async function trackVisita() {
  const dia = hoje();
  const keyVisita  = `cmax_v_${dia}`;
  const keySessao  = `cmax_s_${dia}`;

  const campos = {};

  if (!localStorage.getItem(keyVisita)) {
    localStorage.setItem(keyVisita, "1");
    campos["visitas_unicas"]                            = increment(1);
    campos[`dispositivos.${detectarDispositivo()}`]     = increment(1);
    campos[`navegadores.${detectarNavegador()}`]        = increment(1);
    campos[`origens.${detectarOrigem()}`]               = increment(1);
  }

  if (!sessionStorage.getItem(keySessao)) {
    sessionStorage.setItem(keySessao, "1");
    campos["sessoes"] = increment(1);
  }

  if (Object.keys(campos).length > 1) { // ao menos um campo além de atualizado
    await escrever(campos);
  }
}

/**
 * Registra visualização de categoria (uma vez por sessão por categoria).
 */
const _catsVistas = new Set(
  JSON.parse(sessionStorage.getItem("cmax_cats") || "[]")
);

export async function trackCategoria(nome) {
  if (!nome || _catsVistas.has(nome)) return;
  _catsVistas.add(nome);
  sessionStorage.setItem("cmax_cats", JSON.stringify([..._catsVistas]));

  const chave = sanitizarChave(nome);
  await escrever({ [`categorias.${chave}`]: increment(1) });
}

/**
 * Registra clique no botão WhatsApp.
 * @param {"item"|"loja"} tipo
 */
export async function trackWhatsApp(tipo = "item") {
  await escrever({ [`eventos.whatsapp_${tipo}`]: increment(1) });
}

/**
 * Registra adição ao carrinho.
 */
export async function trackCarrinho() {
  await escrever({ "eventos.carrinho": increment(1) });
}

/**
 * Registra busca (após debounce, com mínimo 2 chars).
 */
export async function trackBusca(termo) {
  if (!termo || termo.trim().length < 2) return;
  const chave = sanitizarChave(termo.trim().toLowerCase());
  await escrever({
    "eventos.buscas": increment(1),
    [`buscas.${chave}`]: increment(1)
  });
}
