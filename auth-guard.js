if (sessionStorage.getItem("zhya-demo-auth") !== "granted") {
  window.location.replace("login.html");
}
