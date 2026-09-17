export type ToastTone = "success" | "error";

export interface ConflictFile {
  name: string;
  size: number;
  type: string;
}

export interface ConflictResponse {
  error?: string;
  incoming: ConflictFile;
  existing: ConflictFile;
}

export function clearCredentialQuery(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.has("username") || params.has("password")) {
    window.history.replaceState(
      null,
      document.title,
      `${window.location.pathname}${window.location.hash}`,
    );
  }
}

export function toast(
  element: HTMLElement | null,
  message: string,
  tone: ToastTone = "error",
): void {
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
  element.classList.add("is-visible");
  window.setTimeout(() => element.classList.remove("is-visible"), 2600);
}

export function setConflictContent(
  dialog: HTMLDialogElement,
  data: ConflictResponse,
): void {
  dialog.querySelector<HTMLElement>("[data-incoming-name]")!.textContent =
    data.incoming.name;
  dialog.querySelector<HTMLElement>("[data-incoming-meta]")!.textContent =
    `${data.incoming.size} B · ${data.incoming.type}`;
  dialog.querySelector<HTMLElement>("[data-existing-name]")!.textContent =
    data.existing.name;
  dialog.querySelector<HTMLElement>("[data-existing-meta]")!.textContent =
    `${data.existing.size} B · ${data.existing.type}`;
}

export async function readResponse(
  response: Response,
): Promise<Record<string, any>> {
  const data = await response.json().catch(() => ({}));
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, any>)
    : {};
}
