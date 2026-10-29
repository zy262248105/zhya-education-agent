const DEMO_ACCOUNT = "reviewer";
const DEMO_PASSWORD = "Zhiya@2026";
const AUTH_KEY = "zhya-demo-auth";

const form = document.querySelector("#loginForm");
const accountInput = document.querySelector("#account");
const passwordInput = document.querySelector("#password");
const formError = document.querySelector("#formError");
const togglePassword = document.querySelector("#togglePassword");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

document.querySelectorAll("[data-copy]").forEach(button => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      showToast("已复制");
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      showToast("已复制");
    }
  });
});

togglePassword.addEventListener("click", () => {
  const reveal = passwordInput.type === "password";
  passwordInput.type = reveal ? "text" : "password";
  togglePassword.setAttribute("aria-label", reveal ? "隐藏密码" : "显示密码");
});

form.addEventListener("submit", event => {
  event.preventDefault();
  formError.textContent = "";
  const account = accountInput.value.trim();
  const password = passwordInput.value;
  if (!account || !password) {
    formError.textContent = "请填写账号和密码。";
    return;
  }
  if (account !== DEMO_ACCOUNT || password !== DEMO_PASSWORD) {
    formError.textContent = "账号或密码不正确，请使用页面展示的演示凭据。";
    passwordInput.select();
    return;
  }
  sessionStorage.setItem(AUTH_KEY, "granted");
  window.location.href = "index.html";
});
