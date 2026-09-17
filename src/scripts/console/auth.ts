import { readResponse, toast } from "./common";

interface AuthElements {
  root: HTMLElement;
  status: HTMLElement | null;
}

export function initializeAuth({ root, status }: AuthElements): () => void {
  const login = root.querySelector<HTMLFormElement>("[data-login-form]");
  const uploadCards = [
    ...root.querySelectorAll<HTMLElement>("[data-upload-card]"),
  ];
  const loginCard = root.querySelector<HTMLElement>(
    '[data-console-card="login"]',
  );
  let authenticated = false;
  let authRequestVersion = 0;
  let active = true;

  const authProbe = fetch("/api/auth", { credentials: "same-origin" })
    .then((response) => readResponse(response))
    .then((data) => {
      if (!active) return;
      authenticated = data.authenticated === true;
      if (root.dataset.uploadPage && !authenticated)
        window.location.replace("/console/");
    })
    .catch(() => {
      authenticated = false;
    });

  const onUploadCardClick = (event: Event) => {
    if (!authenticated) {
      event.preventDefault();
      toast(status, "未登录", "error");
    }
  };
  uploadCards.forEach((card) =>
    card.addEventListener("click", onUploadCardClick),
  );

  const onLoginCardClick = async (event: Event) => {
    if (window.location.pathname !== "/console/") return;
    await authProbe;
    if (active && authenticated) {
      event.preventDefault();
      toast(status, "已登录", "success");
    }
  };
  loginCard?.addEventListener("click", onLoginCardClick);

  const onLoginSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!login) return;
    const requestVersion = ++authRequestVersion;
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(Object.fromEntries(new FormData(login))),
    });
    const data = await readResponse(response);
    if (!active || requestVersion !== authRequestVersion) return;
    if (response.ok) {
      authenticated = true;
      window.location.replace("/console/");
    } else {
      toast(status, data.error || "登录失败", "error");
    }
  };
  login?.addEventListener("submit", onLoginSubmit);

  return () => {
    active = false;
    uploadCards.forEach((card) =>
      card.removeEventListener("click", onUploadCardClick),
    );
    loginCard?.removeEventListener("click", onLoginCardClick);
    login?.removeEventListener("submit", onLoginSubmit);
  };
}
