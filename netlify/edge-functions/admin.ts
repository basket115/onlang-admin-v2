// ONLANG Admin Panel V1.1 – Schritt 2
// Abgesicherter Admin-Proxy fuer Verein & Branding.
//
// KERNPRINZIP DER ABSICHERUNG:
// Der Browser schickt NUR das Session-Token (+ bei saveBranding die neuen
// Werte). Er schickt NIEMALS eine Kunden-ID. Dieser Proxy fragt Modul 02
// (Access) mit dem Token nach der Session und nimmt die Kunden-ID
// ausschliesslich aus der Antwort von Modul 02. Erst mit dieser
// serverseitig ermittelten Kunden-ID wird Modul 01 (Registration)
// aufgerufen. Dadurch kann durch Manipulation im Browser kein fremder
// Kunde (HU001, V006, ...) gelesen oder geaendert werden.
//
// Es wird KEIN bestehendes Modul umgebaut. Der Proxy vermittelt nur.
//
// Endpunkt: POST /api/admin  (JSON-Body)
//   { action: "loadBranding", token: "..." }
//   { action: "saveBranding", token: "...", vereinsname, logoUrl,
//     primaerfarbe, sekundaerfarbe, sprache }

import type { Context } from "https://edge.netlify.com";

// Modul 02 – Access (Session pruefen).
const ACCESS_URL =
  "https://script.google.com/macros/s/AKfycbxvxZlmxj2GRcOFNmow4DGDcLwev6Cy5emcKPwoR2USitkdy2_Q0dNvowxhmqz81BcT/exec";

// Modul 01 – Registration (customer / updateCustomer).
const REGISTRATION_URL =
  "https://script.google.com/macros/s/AKfycby2XcAJHFA70x3LFBRUqYRB9kYDber6jUC9YOCUfZzcPU4Mi7eg3mGyQnvOXuaPpIFI/exec";

function jsonOut(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

// Session bei Modul 02 pruefen. Liefert die geprueften User-Daten
// (inkl. echter kundenId) oder null.
async function resolveSession(token: string): Promise<any | null> {
  if (!token) return null;
  try {
    const url =
      ACCESS_URL + "?action=session&token=" + encodeURIComponent(token);
    const res = await fetch(url, {
      method: "get",
      headers: { "User-Agent": "ONLANG-Admin-Proxy/1.1" },
      redirect: "follow",
    });
    const data = await res.json();
    if (data && data.success === true && data.data && data.data.user) {
      return data.data.user; // enthaelt kundenId, role, email, name
    }
    return null;
  } catch {
    return null;
  }
}

// Modul 01: einen Kunden lesen.
async function loadCustomer(kundenId: string): Promise<any> {
  const url =
    REGISTRATION_URL +
    "?action=customer&kundenId=" +
    encodeURIComponent(kundenId);
  const res = await fetch(url, {
    method: "get",
    headers: { "User-Agent": "ONLANG-Admin-Proxy/1.1" },
    redirect: "follow",
  });
  return await res.json();
}

// Modul 01: einen Kunden aktualisieren (POST updateCustomer).
async function saveCustomer(payload: Record<string, string>): Promise<any> {
  const res = await fetch(REGISTRATION_URL, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "ONLANG-Admin-Proxy/1.1",
    },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  return await res.json();
}

export default async (request: Request, _context: Context) => {
  if (request.method !== "POST") {
    return jsonOut({
      success: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Nur POST erlaubt." },
    });
  }

  let body: any;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return jsonOut({
      success: false,
      error: { code: "INVALID_JSON", message: "Ungültiger Request-Body." },
    });
  }

  const action = String(body.action || "");
  const token = String(body.token || "");

  // 1) Session serverseitig pruefen – IMMER zuerst.
  const user = await resolveSession(token);
  if (!user || !user.kundenId) {
    return jsonOut({
      success: false,
      error: { code: "SESSION_INVALID", message: "Sitzung ungültig oder abgelaufen." },
    });
  }

  // 2) Kunden-ID kommt AUSSCHLIESSLICH aus der geprueften Session.
  const kundenId = String(user.kundenId).toUpperCase();

  try {
    if (action === "loadBranding") {
      const result = await loadCustomer(kundenId);
      if (!result || result.success !== true || !result.data || !result.data.customer) {
        return jsonOut({
          success: false,
          error: { code: "LOAD_FAILED", message: "Vereinsdaten konnten nicht geladen werden." },
        });
      }
      const c = result.data.customer;
      // Nur die fuer Schritt 2 relevanten Felder zurueckgeben.
      return jsonOut({
        success: true,
        data: {
          kundenId: c.kundenId || kundenId,
          vereinsname: c.vereinsname || "",
          sprache: c.sprache || "",
          logoUrl: c.logoUrl || "",
          primaerfarbe: c.primaerfarbe || "",
          sekundaerfarbe: c.sekundaerfarbe || "",
        },
      });
    }

    if (action === "saveBranding") {
      // Werte aus dem Body – ABER die kundenId setzt der Proxy selbst.
      const payload: Record<string, string> = {
        action: "updateCustomer",
        kundenId: kundenId, // serverseitig, nicht aus Browser-Angabe
      };

      // Nur uebergebene Felder weiterreichen (Modul 01 aktualisiert selektiv).
      if (body.vereinsname !== undefined) payload.vereinsname = String(body.vereinsname);
      if (body.logoUrl !== undefined) payload.logoUrl = String(body.logoUrl);
      if (body.primaerfarbe !== undefined) payload.primaerfarbe = String(body.primaerfarbe);
      if (body.sekundaerfarbe !== undefined) payload.sekundaerfarbe = String(body.sekundaerfarbe);
      if (body.sprache !== undefined) payload.sprache = String(body.sprache);

      const result = await saveCustomer(payload);
      if (!result || result.success !== true) {
        const msg =
          result && result.error && result.error.message
            ? result.error.message
            : "Speichern fehlgeschlagen.";
        return jsonOut({
          success: false,
          error: { code: "SAVE_FAILED", message: msg },
        });
      }
      return jsonOut({ success: true, data: { saved: true } });
    }

    return jsonOut({
      success: false,
      error: { code: "UNKNOWN_ACTION", message: "Unbekannte Admin-Aktion." },
    });
  } catch (error) {
    return jsonOut({
      success: false,
      error: { code: "PROXY_ERROR", message: String(error) },
    });
  }
};

export const config = { path: "/api/admin" };
