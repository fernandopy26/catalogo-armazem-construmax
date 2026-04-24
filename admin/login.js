import { auth } from "../config/firebase.js";
import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const btnEntrar  = document.getElementById("btnEntrar");
const erroLogin  = document.getElementById("erroLogin");

// Garante que qualquer sessão Firebase anterior seja encerrada ao abrir o login.
// Isso evita que uma sessão salva em localStorage dê acesso direto ao admin.
signOut(auth).catch(() => {});

btnEntrar.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  erroLogin.textContent = "";

  if (!email || !senha) {
    erroLogin.textContent = "Preencha e-mail e senha.";
    return;
  }

  btnEntrar.disabled = true;
  btnEntrar.textContent = "Entrando...";

  try {
    await signInWithEmailAndPassword(auth, email, senha);

    // Flag de sessão: garante que o admin só seja acessível
    // durante a aba/sessão atual do navegador.
    sessionStorage.setItem("admin_ok", "1");

    window.location.href = "admin.html";
  } catch (error) {
    console.error(error);
    erroLogin.textContent = "E-mail ou senha inválidos.";
    btnEntrar.disabled = false;
    btnEntrar.textContent = "Entrar";
  }
});