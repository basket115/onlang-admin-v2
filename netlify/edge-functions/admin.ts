// ONLANG Admin Panel V1.1 – Schritt 3 (Transport-Update)
// Abgesicherter Admin-Proxy fuer Verein & Branding (Schritt 2) UND
// Beitraege (Schritt 3).
//
// KERNPRINZIP DER ABSICHERUNG (unveraendert):
// Der Browser schickt NUR das Session-Token (+ Nutzdaten). Er schickt
// NIEMALS eine Kunden-ID. Dieser Proxy prueft die Session bei Modul 02
// (Access) und nimmt die Kunden-ID ausschliesslich aus der Antwort von
// Modul 02. Erst mit dieser serverseitig ermittelten Kunden-ID werden
// Modul 01 (Registration) bzw. Modul 05 (Studio) aufgerufen.
//
// Mandantenschutz beim Schreiben von Beitraegen (unveraendert):
// Vor jedem updatePost / publishPost / deletePost laedt der Proxy zuerst
// getPost(postId) und prueft post.kundenId === Session-Kunden-ID. Nur bei
// Uebereinstimmung wird die Aktion ausgefuehrt, sonst FORBIDDEN.
//
// TRANSPORT (dieses Update):
// - Leseaktionen laufen weiter ueber GET (kurze Parameter):
//     getPostCategories, getPosts, getPost (auch innerhalb der
//     Eigentuemer-Pruefung).
// - Schreibaktionen laufen jetzt ueber POST mit JSON-Body an Modul 05
//     (doPost -> handleStudioAction_), damit lange Beitragsinhalte nicht
//     mehr in der URL stehen:
//     createPost, updatePost, publishPost, deletePost.
//
// Es wird KEIN bestehendes Modul umgebaut. Der Proxy vermittelt nur.

import type { Context } from "https://edge.netlify.com";

// Modul 02 – Access (Session pruefen).
const ACCESS_URL =
  "https://script.google.com/macros/s/AKfycbxvxZlmxj2GRcOFNmow4DGDcLwev6Cy5emcKPwoR2USitkdy2_Q0dNvowxhmqz81BcT/exec";

// Modul 01 – Registration (customer / updateCustomer).
const REGISTRATION_URL =
  "https://script.google.com/macros/s/AKfycby2XcAJHFA70x3LFBRUqYRB9kYDber6jUC9YOCUfZzcPU4Mi7eg3mGyQnvOXuaPpIFI/exec";

// Modul 05 – Studio (Beitraege). Version 2 mit doGet + doPost.
const STUDIO_URL =
  "https://script.google.com/macros/s/AKfycbzxVnBKGbziJqYP0TZ3BHmk39TbyS5NmsxlZ2bDb0cgncfPsukRkvLsZSEmxzemZhAZCQ/exec";

// Modul 04 – Media (Medien-Metadaten). Eigene Bereitstellung, eigene URL.
const MEDIA_URL =
  "https://script.google.com/macros/s/AKfycbxnmMiqoSNyJj2cFsEsr1lURhkQ1ECaN2otCXmRUGypfKk6skM0wt39AopI6BVPYCjP/exec";

const POST_STATUS_DRAFT = "DRAFT";
const POST_STATUS_PUBLISHED = "PUBLISHED";
const TEASER_LENGTH = 150;

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

// Session bei Modul 02 pruefen. Liefert User (inkl. kundenId) oder null.
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
      return data.data.user;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Modul 01: Kunde lesen / schreiben (Schritt 2) ──────────────
async function loadCustomer(kundenId: string): Promise<any> {
  const url =
    REGISTRATION_URL + "?action=customer&kundenId=" + encodeURIComponent(kundenId);
  const res = await fetch(url, {
    method: "get",
    headers: { "User-Agent": "ONLANG-Admin-Proxy/1.1" },
    redirect: "follow",
  });
  return await res.json();
}
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

// ── Modul 05: Studio LESEN ueber GET ───────────────────────────
// Nur kurze Parameter (kundenId, postId). Bleibt bewusst GET.
async function studioGet(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const url = STUDIO_URL + "?" + qs;
  const res = await fetch(url, {
    method: "get",
    headers: { "User-Agent": "ONLANG-Admin-Proxy/1.1" },
    redirect: "follow",
  });
  return await res.json();
}

// ── Modul 05: Studio SCHREIBEN ueber POST (JSON-Body) ──────────
// Fuer Aktionen mit potenziell langem Inhalt bzw. alle Schreibaktionen.
// Nutzt dieselbe STUDIO_URL (Modul 05 doPost -> handleStudioAction_).
async function studioPost(payload: Record<string, string>): Promise<any> {
  const res = await fetch(STUDIO_URL, {
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

// ── Modul 04: Media LESEN ueber GET ─────────────────────────────
// Eigener Helper gegen MEDIA_URL, damit studioGet (Studio) unangetastet
// bleibt. Nur kurze Parameter (kundenId) -> GET ausreichend.
async function mediaGet(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const url = MEDIA_URL + "?" + qs;
  const res = await fetch(url, {
    method: "get",
    headers: { "User-Agent": "ONLANG-Admin-Proxy/1.1" },
    redirect: "follow",
  });
  return await res.json();
}

// Teaser automatisch aus dem Inhalt (Plan A, ca. erste 150 Zeichen).
function makeTeaser(inhalt: string): string {
  const clean = String(inhalt || "").replace(/\s+/g, " ").trim();
  if (clean.length <= TEASER_LENGTH) return clean;
  return clean.slice(0, TEASER_LENGTH).trim() + "…";
}

// Prueft, ob ein Beitrag zum Session-Kunden gehoert.
// Nutzt getPost ueber GET (kurze Parameter) – unveraendert.
// Liefert { ok:true, post } oder { ok:false, response }.
async function assertPostOwnership(
  postId: string,
  kundenId: string
): Promise<{ ok: true; post: any } | { ok: false; response: Response }> {
  if (!postId) {
    return {
      ok: false,
      response: jsonOut({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Post_ID fehlt." },
      }),
    };
  }
  const result = await studioGet({ action: "getPost", postId: postId });
  if (!result || result.success !== true || !result.post) {
    return {
      ok: false,
      response: jsonOut({
        success: false,
        error: { code: "POST_NOT_FOUND", message: "Beitrag nicht gefunden." },
      }),
    };
  }
  const ownerId = String(result.post.kundenId || "").toUpperCase();
  if (ownerId !== kundenId) {
    return {
      ok: false,
      response: jsonOut({
        success: false,
        error: { code: "FORBIDDEN", message: "Kein Zugriff auf diesen Beitrag." },
      }),
    };
  }
  return { ok: true, post: result.post };
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
  const benutzer = String(user.email || user.name || "ADMIN");

  try {
    // ══════════════ Schritt 2: Branding ══════════════
    if (action === "loadBranding") {
      const result = await loadCustomer(kundenId);
      if (!result || result.success !== true || !result.data || !result.data.customer) {
        return jsonOut({
          success: false,
          error: { code: "LOAD_FAILED", message: "Vereinsdaten konnten nicht geladen werden." },
        });
      }
      const c = result.data.customer;
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
      const payload: Record<string, string> = {
        action: "updateCustomer",
        kundenId: kundenId,
      };
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
        return jsonOut({ success: false, error: { code: "SAVE_FAILED", message: msg } });
      }
      return jsonOut({ success: true, data: { saved: true } });
    }

    // ══════════════ Schritt 3: Beitraege ══════════════

    // ── LESEN (GET) ──
    // Feste Kategorienliste aus Modul 05.
    if (action === "loadPostCategories") {
      const result = await studioGet({ action: "getPostCategories" });
      const categories =
        result && result.success === true && Array.isArray(result.categories)
          ? result.categories
          : [];
      return jsonOut({ success: true, data: { categories: categories } });
    }

    // Beitragsliste – NUR fuer den Session-Kunden.
    if (action === "loadPosts") {
      const result = await studioGet({ action: "getPosts", kundenId: kundenId });
      if (!result || result.success !== true) {
        return jsonOut({
          success: false,
          error: { code: "LOAD_FAILED", message: "Beiträge konnten nicht geladen werden." },
        });
      }
      return jsonOut({
        success: true,
        data: { posts: Array.isArray(result.posts) ? result.posts : [] },
      });
    }

    // Einzelnen Beitrag laden – mit Eigentuemer-Pruefung (getPost via GET).
    if (action === "loadPost") {
      const postId = String(body.postId || "");
      const check = await assertPostOwnership(postId, kundenId);
      if (!check.ok) return check.response;
      return jsonOut({ success: true, data: { post: check.post } });
    }

    // ── SCHREIBEN (POST) ──
    // Neuen Beitrag erstellen – kundenId serverseitig, Status DRAFT.
    if (action === "createPost") {
      const inhalt = String(body.inhalt || "");
      const payload: Record<string, string> = {
        action: "createPost",
        kundenId: kundenId, // serverseitig, nicht aus Browser-Angabe
        titel: String(body.titel || ""),
        inhalt: inhalt,
        teaser: makeTeaser(inhalt),
        kategorie: String(body.kategorie || ""),
        status: POST_STATUS_DRAFT,
        bildUrl: String(body.bildUrl || ""),
        videoUrl: String(body.videoUrl || ""),
        benutzer: benutzer,
      };
      const result = await studioPost(payload);
      if (!result || result.success !== true) {
        const msg =
          result && result.message ? result.message : "Beitrag konnte nicht erstellt werden.";
        return jsonOut({ success: false, error: { code: "CREATE_FAILED", message: msg } });
      }
      return jsonOut({ success: true, data: { postId: result.postId } });
    }

    // Beitrag bearbeiten – zuerst Eigentuemer pruefen (GET), dann POST.
    if (action === "updatePost") {
      const postId = String(body.postId || "");
      const check = await assertPostOwnership(postId, kundenId);
      if (!check.ok) return check.response;

      const inhalt = String(body.inhalt || "");
      const payload: Record<string, string> = {
        action: "updatePost",
        postId: postId,
        titel: String(body.titel || ""),
        inhalt: inhalt,
        teaser: makeTeaser(inhalt),
        kategorie: String(body.kategorie || ""),
        bildUrl: String(body.bildUrl || ""),
        videoUrl: String(body.videoUrl || ""),
        benutzer: benutzer,
      };
      const result = await studioPost(payload);
      if (!result || result.success !== true) {
        const msg =
          result && result.message ? result.message : "Beitrag konnte nicht gespeichert werden.";
        return jsonOut({ success: false, error: { code: "UPDATE_FAILED", message: msg } });
      }
      return jsonOut({ success: true, data: { postId: postId } });
    }

    // Veroeffentlichen = Status PUBLISHED – Eigentuemer pruefen (GET), dann POST.
    if (action === "publishPost") {
      const postId = String(body.postId || "");
      const check = await assertPostOwnership(postId, kundenId);
      if (!check.ok) return check.response;

      const result = await studioPost({
        action: "updatePost",
        postId: postId,
        status: POST_STATUS_PUBLISHED,
        benutzer: benutzer,
      });
      if (!result || result.success !== true) {
        const msg =
          result && result.message ? result.message : "Beitrag konnte nicht veröffentlicht werden.";
        return jsonOut({ success: false, error: { code: "PUBLISH_FAILED", message: msg } });
      }
      return jsonOut({ success: true, data: { postId: postId, status: POST_STATUS_PUBLISHED } });
    }

    // Loeschen (Soft-Delete) – Eigentuemer pruefen (GET), dann POST.
    if (action === "deletePost") {
      const postId = String(body.postId || "");
      const check = await assertPostOwnership(postId, kundenId);
      if (!check.ok) return check.response;

      const result = await studioPost({
        action: "deletePost",
        postId: postId,
        benutzer: benutzer,
      });
      if (!result || result.success !== true) {
        const msg =
          result && result.message ? result.message : "Beitrag konnte nicht gelöscht werden.";
        return jsonOut({ success: false, error: { code: "DELETE_FAILED", message: msg } });
      }
      return jsonOut({ success: true, data: { postId: postId } });
    }

    // ══════════════ Schritt 5b: Kategorien ══════════════
    // Datenquelle: Modul 05 (Studio_Categories, mandantenfaehig).
    // kundenId kommt IMMER aus der Session, nie aus dem Browser.

    // Kategorien des Session-Kunden lesen (GET).
    if (action === "loadCategories") {
      const result = await studioGet({ action: "getCategories", kundenId: kundenId });
      if (!result || result.success !== true) {
        const msg =
          result && result.message ? result.message : "Kategorien konnten nicht geladen werden.";
        return jsonOut({ success: false, error: { code: "LOAD_FAILED", message: msg } });
      }
      return jsonOut({
        success: true,
        data: { categories: Array.isArray(result.categories) ? result.categories : [] },
      });
    }

    // Neue Kategorie erstellen (POST) – kundenId serverseitig.
    if (action === "createCategory") {
      const payload: Record<string, string> = {
        action: "createCategory",
        kundenId: kundenId, // serverseitig, nicht aus Browser-Angabe
        name: String(body.name || ""),
        beschreibung: String(body.beschreibung || ""),
        sortierung: String(body.sortierung || ""),
      };
      const result = await studioPost(payload);
      if (!result || result.success !== true) {
        const code =
          result && result.error ? String(result.error) : "CREATE_FAILED";
        const msg =
          result && result.message ? result.message : "Kategorie konnte nicht erstellt werden.";
        return jsonOut({ success: false, error: { code: code, message: msg } });
      }
      return jsonOut({ success: true, data: { kategorieId: result.kategorieId } });
    }

    // Kategorie aktualisieren (POST) – kundenId serverseitig.
    // Modul 05 prueft zusaetzlich Kategorie_ID + Kunden_ID.
    if (action === "updateCategory") {
      const payload: Record<string, string> = {
        action: "updateCategory",
        kundenId: kundenId, // serverseitig
        categoryId: String(body.categoryId || ""),
      };
      // Nur uebergebene Felder weiterreichen (Modul 05 aktualisiert selektiv).
      if (body.name !== undefined) payload.name = String(body.name);
      if (body.beschreibung !== undefined) payload.beschreibung = String(body.beschreibung);
      if (body.sortierung !== undefined) payload.sortierung = String(body.sortierung);
      if (body.aktiv !== undefined) payload.aktiv = String(body.aktiv);

      const result = await studioPost(payload);
      if (!result || result.success !== true) {
        const code =
          result && result.error ? String(result.error) : "UPDATE_FAILED";
        const msg =
          result && result.message ? result.message : "Kategorie konnte nicht gespeichert werden.";
        return jsonOut({ success: false, error: { code: code, message: msg } });
      }
      return jsonOut({ success: true, data: { kategorieId: result.kategorieId } });
    }

    // Kategorie loeschen (POST) – kundenId serverseitig.
    // Modul 05 prueft Kategorie_ID + Kunden_ID und blockt bei CATEGORY_IN_USE.
    if (action === "deleteCategory") {
      const payload: Record<string, string> = {
        action: "deleteCategory",
        kundenId: kundenId, // serverseitig
        categoryId: String(body.categoryId || ""),
      };
      const result = await studioPost(payload);
      if (!result || result.success !== true) {
        const code =
          result && result.error ? String(result.error) : "DELETE_FAILED";
        const msg =
          result && result.message ? result.message : "Kategorie konnte nicht gelöscht werden.";
        return jsonOut({ success: false, error: { code: code, message: msg } });
      }
      return jsonOut({ success: true, data: { kategorieId: result.kategorieId } });
    }

    // ══════════════ Media Schritt 1: Medienliste (read-only) ══════════════
    // Datenquelle: Modul 04 (Media_Files). Modul 04 trennt Mandanten NICHT
    // zuverlaessig selbst, daher wird die Sicherheit hier im Proxy erzwungen:
    // 1) getFiles wird IMMER mit der Session-kundenId aufgerufen,
    // 2) das Ergebnis wird zusaetzlich gegengeprueft – nur Datensaetze mit
    //    media.kundenId === Session-kundenId gelangen ans Frontend,
    // 3) geloeschte Datensaetze werden standardmaessig nicht zurueckgegeben.
    if (action === "loadMedia") {
      const result = await mediaGet({ action: "getFiles", kundenId: kundenId });

      if (!result || result.success !== true) {
        const msg =
          result && result.message ? result.message : "Medien konnten nicht geladen werden.";
        return jsonOut({ success: false, error: { code: "LOAD_FAILED", message: msg } });
      }

      // Reale Modul-04-Struktur (successResponse_):
      //   { success: true, data: { files: [...], count, filters } }
      // Primaer wird result.data.files ausgewertet. Die weiteren Varianten
      // sind nur defensive Rueckfallebenen und aendern nichts an der Struktur.
      const rawList =
        (result.data && Array.isArray(result.data.files)) ? result.data.files
        : (result.data && Array.isArray(result.data.media)) ? result.data.media
        : Array.isArray(result.files) ? result.files
        : Array.isArray(result.media) ? result.media
        : Array.isArray(result.data) ? result.data
        : [];

      const sessionKunde = kundenId; // bereits uppercase
      const safe: Array<Record<string, unknown>> = [];

      for (const item of rawList) {
        if (!item) continue;

        // kundenId des Datensatzes robust ermitteln (verschiedene Feldnamen).
        const itemKunde = String(
          item.kundenId !== undefined ? item.kundenId :
          item.Kunden_ID !== undefined ? item.Kunden_ID : ""
        ).trim().toUpperCase();

        // Sicherheits-Gegenpruefung: fremde Mandanten strikt verwerfen.
        if (itemKunde !== sessionKunde) continue;

        // Status ermitteln; geloeschte ausblenden.
        const status = String(
          item.status !== undefined ? item.status :
          item.Status !== undefined ? item.Status : ""
        ).trim();
        const statusUpper = status.toUpperCase();
        if (statusUpper === "GELOESCHT" || statusUpper === "DELETED" || statusUpper === "GELÖSCHT") {
          continue;
        }

        // Nur die fuer die Uebersicht noetigen Felder, robust gegen Feldnamen.
        const pick = (a: string, b: string) =>
          item[a] !== undefined ? item[a] : (item[b] !== undefined ? item[b] : "");

        safe.push({
          mediaId: String(pick("mediaId", "Media_ID") || ""),
          dateiname: String(pick("dateiname", "Dateiname") || ""),
          dateityp: String(pick("dateityp", "Dateityp") || ""),
          mimeType: String(pick("mimeType", "MIME_Type") || ""),
          vorschauUrl: String(pick("vorschauUrl", "Vorschau_URL") || ""),
          dateigroesse: String(pick("dateigroesse", "Dateigröße") || ""),
          breite: String(pick("breite", "Breite") || ""),
          hoehe: String(pick("hoehe", "Höhe") || ""),
          status: status,
          hochgeladenAm: String(pick("hochgeladenAm", "Hochgeladen_Am") || ""),
        });
      }

      return jsonOut({ success: true, data: { media: safe } });
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
