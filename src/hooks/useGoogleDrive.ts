import { useState, useCallback } from "react";

const FOLDER_NAME  = "MercadoApp";
const MAX_BACKUPS  = 10;
const SCOPE        = "https://www.googleapis.com/auth/drive";
const TOKEN_KEY    = "mkt3_google_access_token";
const TOKEN_EXPIRY = "mkt3_google_token_expiry";
const TOKEN_SCOPE  = "mkt3_google_token_scope";

export type DriveStatus =
  | { type: "idle" }
  | { type: "loading"; msg: string }
  | { type: "success"; msg: string }
  | { type: "error";   msg: string }
  | { type: "confirm"; msg: string; fileName: string; date: string; onConfirm: () => void };

function saveToken(token: string, expiresIn: number) {
  try {
    localStorage.setItem(TOKEN_KEY,    token);
    localStorage.setItem(TOKEN_EXPIRY, String(Date.now() + expiresIn * 1000));
    localStorage.setItem(TOKEN_SCOPE,  SCOPE);
  } catch {}
}

function loadToken(): string | null {
  try {
    const token  = localStorage.getItem(TOKEN_KEY);
    const expiry = Number(localStorage.getItem(TOKEN_EXPIRY) || "0");
    const scope  = localStorage.getItem(TOKEN_SCOPE);
    if (token && scope === SCOPE && Date.now() < expiry - 60_000) return token;
    return null;
  } catch { return null; }
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY);
    localStorage.removeItem(TOKEN_SCOPE);
  } catch {}
}

type BackupFile  = { id: string; name: string; createdTime: string };
type DriveFolder = { id: string; name: string; createdTime?: string; modifiedTime?: string; shared?: boolean; ownedByMe?: boolean };

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function useGoogleDrive(clientId: string) {
  const [status,      setStatus]      = useState<DriveStatus>({ type: "idle" });
  const [accessToken, setAccessToken] = useState<string | null>(() => loadToken());
  const isLoggedIn = Boolean(accessToken);

  const signIn = useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      const existing = loadToken();
      if (existing) { setAccessToken(existing); resolve(existing); return; }
      const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          saveToken(resp.access_token, resp.expires_in);
          setAccessToken(resp.access_token);
          resolve(resp.access_token);
        },
      });
      if (!client) { reject(new Error("Google Identity Services não carregado.")); return; }
      client.requestAccessToken();
    });
  }, [clientId]);

  const signOut = useCallback(() => {
    if (accessToken) {
      try { (window as any).google?.accounts?.oauth2?.revoke(accessToken); } catch {}
    }
    clearToken();
    setAccessToken(null);
    setStatus({ type: "idle" });
  }, [accessToken]);

  async function driveRequest(url: string, options: RequestInit, token: string) {
    const res = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...((options.headers as object) || {}) },
    });
    if (res.status === 401) { clearToken(); setAccessToken(null); throw new Error("Sessão expirada. Faça login novamente."); }
    if (!res.ok) { const t = await res.text(); throw new Error(`Erro Drive API: ${res.status} ${t}`); }
    return res;
  }

  async function getOrCreateFolder(token: string): Promise<string> {
    const q   = encodeURIComponent(`name='${escapeDriveQueryValue(FOLDER_NAME)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const res = await driveRequest(
      `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name,createdTime,modifiedTime,shared,ownedByMe)`,
      {}, token
    );
    const data    = await res.json();
    const folders = (data.files || []) as DriveFolder[];

    if (folders.length === 1) return folders[0].id;

    if (folders.length > 1) {
      const withBackups = await Promise.all(
        folders.map(async folder => {
          try { return { folder, backups: await listBackups(token, folder.id) }; }
          catch { return { folder, backups: [] as BackupFile[] }; }
        })
      );
      const byLatest = (a: { backups: BackupFile[] }, b: { backups: BackupFile[] }) =>
        new Date(b.backups[0]?.createdTime || 0).getTime() - new Date(a.backups[0]?.createdTime || 0).getTime();
      const sharedWithBkp = withBackups.filter(({ folder, backups }) => folder.shared && !folder.ownedByMe && backups.length > 0).sort(byLatest)[0];
      if (sharedWithBkp) return sharedWithBkp.folder.id;
      const sharedF = folders.find(f => f.shared && !f.ownedByMe);
      if (sharedF) return sharedF.id;
      const withBkp = withBackups.filter(({ backups }) => backups.length > 0).sort(byLatest)[0];
      if (withBkp) return withBkp.folder.id;
      return folders[0].id;
    }

    const createRes = await driveRequest(
      "https://www.googleapis.com/drive/v3/files?fields=id",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }) },
      token
    );
    const folder = await createRes.json();
    return folder.id;
  }

  async function listBackups(token: string, folderId: string) {
    const q   = encodeURIComponent(`'${folderId}' in parents and name contains 'mercadoapp-backup' and trashed=false`);
    const res = await driveRequest(
      `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name,createdTime)&orderBy=createdTime desc`,
      {}, token
    );
    const data = await res.json();
    return (data.files || []) as BackupFile[];
  }

  async function pruneOldBackups(token: string, files: BackupFile[]) {
    for (const f of files.slice(MAX_BACKUPS)) {
      try { await driveRequest(`https://www.googleapis.com/drive/v3/files/${f.id}?supportsAllDrives=true`, { method: "DELETE" }, token); }
      catch {}
    }
  }

  const backupToDrive = useCallback(async (backupData: object) => {
    setStatus({ type: "loading", msg: "Conectando ao Google Drive..." });
    try {
      const token    = await signIn();
      setStatus({ type: "loading", msg: "Salvando backup..." });
      const folderId = await getOrCreateFolder(token);
      const now      = new Date();
      const fileName = `mercadoapp-backup-${now.toISOString().slice(0, 10)}.json`;
      const blob     = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const boundary = "foo_bar_baz";
      const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
      const body     = [
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${await blob.text()}\r\n`,
        `--${boundary}--`,
      ].join("");
      await driveRequest(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
        { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body },
        token
      );
      const files = await listBackups(token, folderId);
      await pruneOldBackups(token, files);
      setStatus({ type: "success", msg: `Backup salvo: ${fileName}` });
      setTimeout(() => setStatus({ type: "idle" }), 4000);
    } catch (e) {
      setStatus({ type: "error", msg: e instanceof Error ? e.message : "Erro desconhecido" });
      setTimeout(() => setStatus({ type: "idle" }), 5000);
    }
  }, [signIn]);

  const syncFromDrive = useCallback(async (onImport: (data: object) => void) => {
    setStatus({ type: "loading", msg: "Conectando ao Google Drive..." });
    try {
      const token    = await signIn();
      setStatus({ type: "loading", msg: "Buscando backups..." });
      const folderId = await getOrCreateFolder(token);
      const files    = await listBackups(token, folderId);
      if (files.length === 0) {
        setStatus({ type: "error", msg: "Nenhum backup encontrado na pasta MercadoApp." });
        setTimeout(() => setStatus({ type: "idle" }), 4000);
        return;
      }
      const latest    = files[0];
      const dateLabel = new Date(latest.createdTime).toLocaleString("pt-BR");
      setStatus({
        type: "confirm",
        msg: "Sincronizar com o backup mais recente?",
        fileName: latest.name,
        date: dateLabel,
        onConfirm: async () => {
          setStatus({ type: "loading", msg: "Importando dados..." });
          try {
            const res  = await driveRequest(`https://www.googleapis.com/drive/v3/files/${latest.id}?alt=media&supportsAllDrives=true`, {}, token);
            const data = await res.json();
            onImport(data);
            setStatus({ type: "success", msg: `Dados sincronizados (${dateLabel})` });
            setTimeout(() => setStatus({ type: "idle" }), 4000);
          } catch (e) {
            setStatus({ type: "error", msg: e instanceof Error ? e.message : "Erro ao importar" });
            setTimeout(() => setStatus({ type: "idle" }), 5000);
          }
        },
      });
    } catch (e) {
      setStatus({ type: "error", msg: e instanceof Error ? e.message : "Erro desconhecido" });
      setTimeout(() => setStatus({ type: "idle" }), 5000);
    }
  }, [signIn]);

  return { isLoggedIn, status, setStatus, signIn, signOut, backupToDrive, syncFromDrive };
}
