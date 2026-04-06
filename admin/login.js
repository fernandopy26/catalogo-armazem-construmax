import { auth } from "../config/firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const btnEntrar = document.getElementById("btnEntrar");
const erroLogin = document.getElementById("erroLogin");

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "admin.html";
  }
});

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
    window.location.href = "admin.html";
  } catch (error) {
    console.error(error);
    erroLogin.textContent = "E-mail ou senha inválidos.";
  } finally {
    btnEntrar.disabled = false;
    btnEntrar.textContent = "Entrar";
  }
});