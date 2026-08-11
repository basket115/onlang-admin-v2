// ONLANG Admin Panel V1.1
// Abgesicherter Admin-Proxy fuer:
// - Verein & Branding
// - Beitraege
// - Kategorien
// - Medien
//
// KERNPRINZIP:
// Der Browser schickt NUR das Session-Token (+ Nutzdaten).
// Die Kunden-ID wird bei geschuetzten Aktionen AUSSCHLIESSLICH
// aus der geprueften Session genommen.
//
// Media:
// Schritt 1  = Medien lesen
// Schritt 2a = signierten Cloudinary-Direktupload vorbereiten
// Schritt 2b = erfolgreichen Cloudinary-Upload pruefen und
//              ueber Modul 04 createMedia registrieren

import type { Context } from "https://edge.netlify.com";

// Modul 02 – Access
const ACCESS_URL =
  "https://script.google.com/macros/s/AKfycbxvxZlmxj2GRcOFNmow4DGDcLwev6Cy5emcKPwoR2USitkdy2_Q0dNvowxhmqz81BcT/exec";

// Modul 01 – Registration
const REGISTRATION_URL =
  "https://script.google.com/macros/s/AKfycby2XcAJHFA70x3LFBRUqYRB9kYDber6jUC9YOCUfZzcPU4Mi7eg3mGyQnvOXuaPpIFI/exec";

// Modul 05 – Studio
const STUDIO_URL =
  "https://script.google.com/macros/s/AKfycbzxVnBKGbziJqYP0TZ3BHmk39TbyS5NmsxlZ2bDb0cgncfPsukRkvLsZSEmxzemZhAZCQ/exec";

// Modul 04 – Media
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

// ============================================================
// SESSION
// ============================================================

async function resolveSession(token: string): Promise<any | null> {
  if (!token) return null;

  try {
    const url =
      ACCESS_URL +
      "?action=session&token=" +
      encodeURIComponent(token);

    const res = await fetch(url, {
      method: "get",
      headers: {
        "User-Agent": "ONLANG-Admin-Proxy/1.1",
      },
      redirect: "follow",
    });

    const data = await res.json();

    if (
      data &&
      data.success === true &&
      data.data &&
      data.data.user
    ) {
      return data.data.user;
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================
// MODUL 01 – REGISTRATION
// ============================================================

async function loadCustomer(kundenId: string): Promise<any> {
  const url =
    REGISTRATION_URL +
    "?action=customer&kundenId=" +
    encodeURIComponent(kundenId);

  const res = await fetch(url, {
    method: "get",
    headers: {
      "User-Agent": "ONLANG-Admin-Proxy/1.1",
    },
    redirect: "follow",
  });

  return await res.json();
}

async function saveCustomer(
  payload: Record<string, string>
): Promise<any> {
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

// ============================================================
// MODUL 05 – STUDIO
// ============================================================

async function studioGet(
  params: Record<string, string>
): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const url = STUDIO_URL + "?" + qs;

  const res = await fetch(url, {
    method: "get",
    headers: {
      "User-Agent": "ONLANG-Admin-Proxy/1.1",
    },
    redirect: "follow",
  });

  return await res.json();
}

async function studioPost(
  payload: Record<string, string>
): Promise<any> {
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

// ============================================================
// MODUL 04 – MEDIA
// ============================================================

async function mediaGet(
  params: Record<string, string>
): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const url = MEDIA_URL + "?" + qs;

  const res = await fetch(url, {
    method: "get",
    headers: {
      "User-Agent": "ONLANG-Admin-Proxy/1.1",
    },
    redirect: "follow",
  });

  return await res.json();
}

// Media Schritt 2b:
// POST an Modul 04, insbesondere createMedia.
//
// Record<string, unknown> ist hier absichtlich verwendet,
// weil dateigroesse, breite und hoehe echte Zahlen bleiben muessen.
async function mediaPost(
  payload: Record<string, unknown>
): Promise<any> {
  const res = await fetch(MEDIA_URL, {
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

// ============================================================
// CLOUDINARY
// ============================================================

// SHA-256 fuer die Upload-Anforderung.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);

  let hex = "";

  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }

  return hex;
}

// Cloudinary liefert bei unserem aktuellen Upload eine
// SHA-1 Response-Signatur.
async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", data);
  const bytes = new Uint8Array(digest);

  let hex = "";

  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }

  return hex;
}

function secureHexEqual(a: string, b: string): boolean {
  const aa = String(a || "").toLowerCase();
  const bb = String(b || "").toLowerCase();

  if (aa.length !== bb.length) return false;

  let diff = 0;

  for (let i = 0; i < aa.length; i++) {
    diff |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }

  return diff === 0;
}

async function cloudinarySignature(
  paramsToSign: Record<string, string>,
  apiSecret: string
): Promise<string> {
  const sortedKeys = Object.keys(paramsToSign).sort();

  const toSign = sortedKeys
    .map((key) => key + "=" + paramsToSign[key])
    .join("&");

  return await sha256Hex(toSign + apiSecret);
}

// Cloudinary Upload-Response pruefen.
//
// Die von Cloudinary gelieferte Response-Signatur basiert auf:
// public_id=<PUBLIC_ID>&version=<VERSION> + API_SECRET
async function verifyCloudinaryUploadResponse(
  publicId: string,
  version: string,
  responseSignature: string,
  apiSecret: string
): Promise<boolean> {
  if (
    !publicId ||
    !version ||
    !responseSignature ||
    !apiSecret
  ) {
    return false;
  }

  const source =
    "public_id=" +
    publicId +
    "&version=" +
    version +
    apiSecret;

  const expected = await sha1Hex(source);

  return secureHexEqual(expected, responseSignature);
}

function makeUploadNonce(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return (
      String(Date.now()) +
      Math.random().toString(16).slice(2)
    );
  }
}

// ============================================================
// ALLGEMEINE HELPER
// ============================================================

function makeTeaser(inhalt: string): string {
  const clean = String(inhalt || "")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= TEASER_LENGTH) {
    return clean;
  }

  return (
    clean
      .slice(0, TEASER_LENGTH)
      .trim() + "…"
  );
}

async function assertPostOwnership(
  postId: string,
  kundenId: string
): Promise<
  | { ok: true; post: any }
  | { ok: false; response: Response }
> {
  if (!postId) {
    return {
      ok: false,
      response: jsonOut({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Post_ID fehlt.",
        },
      }),
    };
  }

  const result = await studioGet({
    action: "getPost",
    postId: postId,
  });

  if (
    !result ||
    result.success !== true ||
    !result.post
  ) {
    return {
      ok: false,
      response: jsonOut({
        success: false,
        error: {
          code: "POST_NOT_FOUND",
          message: "Beitrag nicht gefunden.",
        },
      }),
    };
  }

  const ownerId = String(
    result.post.kundenId || ""
  ).toUpperCase();

  if (ownerId !== kundenId) {
    return {
      ok: false,
      response: jsonOut({
        success: false,
        error: {
          code: "FORBIDDEN",
          message:
            "Kein Zugriff auf diesen Beitrag.",
        },
      }),
    };
  }

  return {
    ok: true,
    post: result.post,
  };
}

// ============================================================
// MAIN
// ============================================================

export default async (
  request: Request,
  _context: Context
) => {
  if (request.method !== "POST") {
    return jsonOut({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Nur POST erlaubt.",
      },
    });
  }

  let body: any;

  try {
    body = JSON.parse(await request.text());
  } catch {
    return jsonOut({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Ungültiger Request-Body.",
      },
    });
  }

  const action = String(body.action || "");
  const token = String(body.token || "");

  // ----------------------------------------------------------
  // 1. Session pruefen
  // ----------------------------------------------------------

  const user = await resolveSession(token);

  if (!user || !user.kundenId) {
    return jsonOut({
      success: false,
      error: {
        code: "SESSION_INVALID",
        message:
          "Sitzung ungültig oder abgelaufen.",
      },
    });
  }

  // ----------------------------------------------------------
  // 2. Mandant AUSSCHLIESSLICH aus Session
  // ----------------------------------------------------------

  const kundenId = String(
    user.kundenId
  ).toUpperCase();

  const benutzer = String(
    user.email ||
      user.name ||
      "ADMIN"
  );

  try {
    // ========================================================
    // VEREIN & BRANDING
    // ========================================================

    if (action === "loadBranding") {
      const result =
        await loadCustomer(kundenId);

      if (
        !result ||
        result.success !== true ||
        !result.data ||
        !result.data.customer
      ) {
        return jsonOut({
          success: false,
          error: {
            code: "LOAD_FAILED",
            message:
              "Vereinsdaten konnten nicht geladen werden.",
          },
        });
      }

      const c = result.data.customer;

      return jsonOut({
        success: true,
        data: {
          kundenId:
            c.kundenId || kundenId,
          vereinsname:
            c.vereinsname || "",
          sprache:
            c.sprache || "",
          logoUrl:
            c.logoUrl || "",
          primaerfarbe:
            c.primaerfarbe || "",
          sekundaerfarbe:
            c.sekundaerfarbe || "",
        },
      });
    }

    if (action === "saveBranding") {
      const payload: Record<
        string,
        string
      > = {
        action: "updateCustomer",
        kundenId: kundenId,
      };

      if (
        body.vereinsname !== undefined
      ) {
        payload.vereinsname =
          String(body.vereinsname);
      }

      if (
        body.logoUrl !== undefined
      ) {
        payload.logoUrl =
          String(body.logoUrl);
      }

      if (
        body.primaerfarbe !== undefined
      ) {
        payload.primaerfarbe =
          String(body.primaerfarbe);
      }

      if (
        body.sekundaerfarbe !== undefined
      ) {
        payload.sekundaerfarbe =
          String(body.sekundaerfarbe);
      }

      if (
        body.sprache !== undefined
      ) {
        payload.sprache =
          String(body.sprache);
      }

      const result =
        await saveCustomer(payload);

      if (
        !result ||
        result.success !== true
      ) {
        const msg =
          result &&
          result.error &&
          result.error.message
            ? result.error.message
            : "Speichern fehlgeschlagen.";

        return jsonOut({
          success: false,
          error: {
            code: "SAVE_FAILED",
            message: msg,
          },
        });
      }

      return jsonOut({
        success: true,
        data: {
          saved: true,
        },
      });
    }

    // ========================================================
    // BEITRAEGE
    // ========================================================

    if (
      action ===
      "loadPostCategories"
    ) {
      const result =
        await studioGet({
          action:
            "getPostCategories",
        });

      const categories =
        result &&
        result.success === true &&
        Array.isArray(
          result.categories
        )
          ? result.categories
          : [];

      return jsonOut({
        success: true,
        data: {
          categories: categories,
        },
      });
    }

    if (action === "loadPosts") {
      const result =
        await studioGet({
          action: "getPosts",
          kundenId: kundenId,
        });

      if (
        !result ||
        result.success !== true
      ) {
        return jsonOut({
          success: false,
          error: {
            code: "LOAD_FAILED",
            message:
              "Beiträge konnten nicht geladen werden.",
          },
        });
      }

      return jsonOut({
        success: true,
        data: {
          posts:
            Array.isArray(
              result.posts
            )
              ? result.posts
              : [],
        },
      });
    }

    if (action === "loadPost") {
      const postId =
        String(body.postId || "");

      const check =
        await assertPostOwnership(
          postId,
          kundenId
        );

      if (!check.ok) {
        return check.response;
      }

      return jsonOut({
        success: true,
        data: {
          post: check.post,
        },
      });
    }

    if (action === "createPost") {
      const inhalt =
        String(body.inhalt || "");

      const payload: Record<
        string,
        string
      > = {
        action: "createPost",
        kundenId: kundenId,
        titel:
          String(body.titel || ""),
        inhalt: inhalt,
        teaser:
          makeTeaser(inhalt),
        kategorie:
          String(
            body.kategorie || ""
          ),
        status:
          POST_STATUS_DRAFT,
        bildUrl:
          String(
            body.bildUrl || ""
          ),
        videoUrl:
          String(
            body.videoUrl || ""
          ),
        benutzer: benutzer,
      };

      const result =
        await studioPost(payload);

      if (
        !result ||
        result.success !== true
      ) {
        const msg =
          result &&
          result.message
            ? result.message
            : "Beitrag konnte nicht erstellt werden.";

        return jsonOut({
          success: false,
          error: {
            code: "CREATE_FAILED",
            message: msg,
          },
        });
      }

      return jsonOut({
        success: true,
        data: {
          postId: result.postId,
        },
      });
    }

    if (action === "updatePost") {
      const postId =
        String(body.postId || "");

      const check =
        await assertPostOwnership(
          postId,
          kundenId
        );

      if (!check.ok) {
        return check.response;
      }

      const inhalt =
        String(body.inhalt || "");

      const payload: Record<
        string,
        string
      > = {
        action: "updatePost",
        postId: postId,
        titel:
          String(body.titel || ""),
        inhalt: inhalt,
        teaser:
          makeTeaser(inhalt),
        kategorie:
          String(
            body.kategorie || ""
          ),
        bildUrl:
          String(
            body.bildUrl || ""
          ),
        videoUrl:
          String(
            body.videoUrl || ""
          ),
        benutzer: benutzer,
      };

      const result =
        await studioPost(payload);

      if (
        !result ||
        result.success !== true
      ) {
        const msg =
          result &&
          result.message
            ? result.message
            : "Beitrag konnte nicht gespeichert werden.";

        return jsonOut({
          success: false,
          error: {
            code: "UPDATE_FAILED",
            message: msg,
          },
        });
      }

      return jsonOut({
        success: true,
        data: {
          postId: postId,
        },
      });
    }

    if (
      action === "publishPost"
    ) {
      const postId =
        String(body.postId || "");

      const check =
        await assertPostOwnership(
          postId,
          kundenId
        );

      if (!check.ok) {
        return check.response;
      }

      const result =
        await studioPost({
          action: "updatePost",
          postId: postId,
          status:
            POST_STATUS_PUBLISHED,
          benutzer: benutzer,
        });

      if (
        !result ||
        result.success !== true
      ) {
        const msg =
          result &&
          result.message
            ? result.message
            : "Beitrag konnte nicht veröffentlicht werden.";

        return jsonOut({
          success: false,
          error: {
            code: "PUBLISH_FAILED",
            message: msg,
          },
        });
      }

      return jsonOut({
        success: true,
        data: {
          postId: postId,
          status:
            POST_STATUS_PUBLISHED,
        },
      });
    }

    if (action === "deletePost") {
      const postId =
        String(body.postId || "");

      const check =
        await assertPostOwnership(
          postId,
          kundenId
        );

      if (!check.ok) {
        return check.response;
      }

      const result =
        await studioPost({
          action: "deletePost",
          postId: postId,
          benutzer: benutzer,
        });

      if (
        !result ||
        result.success !== true
      ) {
        const msg =
          result &&
          result.message
            ? result.message
            : "Beitrag konnte nicht gelöscht werden.";

        return jsonOut({
          success: false,
          error: {
            code: "DELETE_FAILED",
            message: msg,
          },
        });
      }

      return jsonOut({
        success: true,
        data: {
          postId: postId,
        },
      });
    }

    // ========================================================
    // KATEGORIEN
    // ========================================================

    if (
      action === "loadCategories"
    ) {
      const result =
        await studioGet({
          action:
            "getCategories",
          kundenId: kundenId,
        });

      if (
        !result ||
        result.success !== true
      ) {
        const msg =
          result &&
          result.message
            ? result.message
            : "Kategorien konnten nicht geladen werden.";

        return jsonOut({
          success: false,
          error: {
            code: "LOAD_FAILED",
            message: msg,
          },
        });
      }

      return jsonOut({
        success: true,
        data: {
          categories:
            Array.isArray(
              result.categories
            )
              ? result.categories
              : [],
        },
      });
    }

    if (
      action === "createCategory"
    ) {
      const payload: Record<
        string,
        string
      > = {
        action:
          "createCategory",
        kundenId: kundenId,
        name:
          String(body.name || ""),
        beschreibung:
          String(
            body.beschreibung || ""
          ),
        sortierung:
          String(
            body.sortierung || ""
          ),
      };

      const result =
        await studioPost(payload);

      if (
        !result ||
        result.success !== true
      ) {
        const code =
          result &&
          result.error
            ? String(result.error)
            : "CREATE_FAILED";

        const msg =
          result &&
          result.message
            ? result.message
            : "Kategorie konnte nicht erstellt werden.";

        return jsonOut({
          success: false,
          error: {
            code: code,
            message: msg,
          },
        });
      }

      return jsonOut({
        success: true,
        data: {
          kategorieId:
            result.kategorieId,
        },
      });
    }

    if (
      action === "updateCategory"
    ) {
      const payload: Record<
        string,
        string
      > = {
        action:
          "updateCategory",
        kundenId: kundenId,
        categoryId:
          String(
            body.categoryId || ""
          ),
      };

      if (
        body.name !== undefined
      ) {
        payload.name =
          String(body.name);
      }

      if (
        body.beschreibung !==
        undefined
      ) {
        payload.beschreibung =
          String(
            body.beschreibung
          );
      }

      if (
        body.sortierung !==
        undefined
      ) {
        payload.sortierung =
          String(
            body.sortierung
          );
      }

      if (
        body.aktiv !== undefined
      ) {
        payload.aktiv =
          String(body.aktiv);
      }

      const result =
        await studioPost(payload);

      if (
        !result ||
        result.success !== true
      ) {
        const code =
          result &&
          result.error
            ? String(result.error)
            : "UPDATE_FAILED";

        const msg =
          result &&
          result.message
            ? result.message
            : "Kategorie konnte nicht gespeichert werden.";

        return jsonOut({
          success: false,
          error: {
            code: code,
            message: msg,
          },
        });
      }

      return jsonOut({
        success: true,
        data: {
          kategorieId:
            result.kategorieId,
        },
      });
    }

    if (
      action === "deleteCategory"
    ) {
      const payload: Record<
        string,
        string
      > = {
        action:
          "deleteCategory",
        kundenId: kundenId,
        categoryId:
          String(
            body.categoryId || ""
          ),
      };

      const result =
        await studioPost(payload);

      if (
        !result ||
        result.success !== true
      ) {
        const code =
          result &&
          result.error
            ? String(result.error)
            : "DELETE_FAILED";

        const msg =
          result &&
          result.message
            ? result.message
            : "Kategorie konnte nicht gelöscht werden.";

        return jsonOut({
          success: false,
          error: {
            code: code,
            message: msg,
          },
        });
      }

      return jsonOut({
        success: true,
        data: {
          kategorieId:
            result.kategorieId,
        },
      });
    }

    // ========================================================
    // MEDIA SCHRITT 1 – LESEN
    // ========================================================

    if (action === "loadMedia") {
      const result =
        await mediaGet({
          action: "getFiles",
          kundenId: kundenId,
        });

      if (
        !result ||
        result.success !== true
      ) {
        const msg =
          result &&
          result.message
            ? result.message
            : "Medien konnten nicht geladen werden.";

        return jsonOut({
          success: false,
          error: {
            code: "LOAD_FAILED",
            message: msg,
          },
        });
      }

      const rawList =
        result.data &&
        Array.isArray(
          result.data.files
        )
          ? result.data.files
          : result.data &&
            Array.isArray(
              result.data.media
            )
          ? result.data.media
          : Array.isArray(
              result.files
            )
          ? result.files
          : Array.isArray(
              result.media
            )
          ? result.media
          : Array.isArray(
              result.data
            )
          ? result.data
          : [];

      const sessionKunde =
        kundenId;

      const safe: Array<
        Record<string, unknown>
      > = [];

      for (const item of rawList) {
        if (!item) continue;

        const itemKunde =
          String(
            item.kundenId !==
              undefined
              ? item.kundenId
              : item.Kunden_ID !==
                undefined
              ? item.Kunden_ID
              : ""
          )
            .trim()
            .toUpperCase();

        if (
          itemKunde !==
          sessionKunde
        ) {
          continue;
        }

        const status =
          String(
            item.status !==
              undefined
              ? item.status
              : item.Status !==
                undefined
              ? item.Status
              : ""
          ).trim();

        const statusUpper =
          status.toUpperCase();

        if (
          statusUpper ===
            "GELOESCHT" ||
          statusUpper ===
            "DELETED" ||
          statusUpper ===
            "GELÖSCHT"
        ) {
          continue;
        }

        const pick = (
          a: string,
          b: string
        ) =>
          item[a] !== undefined
            ? item[a]
            : item[b] !==
              undefined
            ? item[b]
            : "";

        safe.push({
          mediaId: String(
            pick(
              "mediaId",
              "Media_ID"
            ) || ""
          ),

          dateiname: String(
            pick(
              "dateiname",
              "Dateiname"
            ) || ""
          ),

          dateityp: String(
            pick(
              "dateityp",
              "Dateityp"
            ) || ""
          ),

          mimeType: String(
            pick(
              "mimeType",
              "MIME_Type"
            ) || ""
          ),

          vorschauUrl: String(
            pick(
              "vorschauUrl",
              "Vorschau_URL"
            ) || ""
          ),

          dateigroesse: String(
            pick(
              "dateigroesse",
              "Dateigröße"
            ) || ""
          ),

          breite: String(
            pick(
              "breite",
              "Breite"
            ) || ""
          ),

          hoehe: String(
            pick(
              "hoehe",
              "Höhe"
            ) || ""
          ),

          status: status,

          hochgeladenAm: String(
            pick(
              "hochgeladenAm",
              "Hochgeladen_Am"
            ) || ""
          ),
        });
      }

      return jsonOut({
        success: true,
        data: {
          media: safe,
        },
      });
    }

    // ========================================================
    // MEDIA SCHRITT 2a – CLOUDINARY SIGNATUR
    // ========================================================

    if (
      action ===
      "signMediaUpload"
    ) {
      const cloudName =
        Deno.env.get(
          "CLOUDINARY_CLOUD_NAME"
        ) || "";

      const apiKey =
        Deno.env.get(
          "CLOUDINARY_API_KEY"
        ) || "";

      const apiSecret =
        Deno.env.get(
          "CLOUDINARY_API_SECRET"
        ) || "";

      if (
        !cloudName ||
        !apiKey ||
        !apiSecret
      ) {
        return jsonOut({
          success: false,
          error: {
            code:
              "CLOUDINARY_CONFIG_MISSING",
            message:
              "Cloudinary-Konfiguration fehlt.",
          },
        });
      }

      const nonce =
        makeUploadNonce();

      const assetFolder =
        "onlang/" + kundenId;

      const publicId =
        "onlang/" +
        kundenId +
        "/" +
        nonce;

      const timestamp =
        Math.floor(
          Date.now() / 1000
        );

      const paramsToSign: Record<
        string,
        string
      > = {
        asset_folder:
          assetFolder,
        public_id: publicId,
        timestamp:
          String(timestamp),
      };

      const signature =
        await cloudinarySignature(
          paramsToSign,
          apiSecret
        );

      return jsonOut({
        success: true,
        data: {
          cloudName:
            cloudName,
          apiKey: apiKey,
          timestamp:
            timestamp,
          signature:
            signature,
          publicId:
            publicId,
          assetFolder:
            assetFolder,
          resourceType:
            "image",
          uploadId:
            nonce,
        },
      });
    }

    // ========================================================
    // MEDIA SCHRITT 2b – CLOUDINARY -> MODUL 04 createMedia
    // ========================================================

    if (
      action ===
      "registerMediaUpload"
    ) {
      const apiSecret =
        Deno.env.get(
          "CLOUDINARY_API_SECRET"
        ) || "";

      const cloudName =
        Deno.env.get(
          "CLOUDINARY_CLOUD_NAME"
        ) || "";

      if (
        !apiSecret ||
        !cloudName
      ) {
        return jsonOut({
          success: false,
          error: {
            code:
              "CLOUDINARY_CONFIG_MISSING",
            message:
              "Cloudinary-Konfiguration fehlt.",
          },
        });
      }

      // Cloudinary-Ergebnis kommt vom Browser,
      // wird aber NICHT ungeprueft akzeptiert.
      const cloud =
        body.cloudinary &&
        typeof body.cloudinary ===
          "object"
          ? body.cloudinary
          : null;

      if (!cloud) {
        return jsonOut({
          success: false,
          error: {
            code:
              "CLOUDINARY_RESULT_MISSING",
            message:
              "Cloudinary-Upload-Ergebnis fehlt.",
          },
        });
      }

      const publicId =
        String(
          cloud.public_id || ""
        ).trim();

      const version =
        String(
          cloud.version || ""
        ).trim();

      const responseSignature =
        String(
          cloud.signature || ""
        ).trim();

      const resourceType =
        String(
          cloud.resource_type ||
            ""
        )
          .trim()
          .toLowerCase();

      // ------------------------------------------------------
      // Mandantenschutz
      // ------------------------------------------------------

      const expectedPrefix =
        "onlang/" +
        kundenId +
        "/";

      if (
        !publicId.startsWith(
          expectedPrefix
        )
      ) {
        return jsonOut({
          success: false,
          error: {
            code:
              "MEDIA_TENANT_MISMATCH",
            message:
              "Das hochgeladene Medium gehört nicht zum angemeldeten Kunden.",
          },
        });
      }

      // Schritt 2 derzeit NUR Bilder.
      if (
        resourceType &&
        resourceType !== "image"
      ) {
        return jsonOut({
          success: false,
          error: {
            code:
              "MEDIA_TYPE_NOT_ALLOWED",
            message:
              "Derzeit sind nur Bilder erlaubt.",
          },
        });
      }

      // ------------------------------------------------------
      // Cloudinary Response-Signatur pruefen
      // ------------------------------------------------------

      const signatureValid =
        await verifyCloudinaryUploadResponse(
          publicId,
          version,
          responseSignature,
          apiSecret
        );

      if (!signatureValid) {
        return jsonOut({
          success: false,
          error: {
            code:
              "CLOUDINARY_RESPONSE_INVALID",
            message:
              "Die Cloudinary-Antwort konnte nicht verifiziert werden.",
          },
        });
      }

      // ------------------------------------------------------
      // Zeitfenster pruefen
      // ------------------------------------------------------

      const versionNumber =
        Number(version);

      const nowSeconds =
        Math.floor(
          Date.now() / 1000
        );

      if (
        !Number.isFinite(
          versionNumber
        ) ||
        versionNumber <= 0 ||
        versionNumber >
          nowSeconds + 300 ||
        nowSeconds -
          versionNumber >
          3600
      ) {
        return jsonOut({
          success: false,
          error: {
            code:
              "CLOUDINARY_RESPONSE_EXPIRED",
            message:
              "Der Cloudinary-Upload ist zu alt oder zeitlich ungültig.",
          },
        });
      }

      // ------------------------------------------------------
      // Pflichtdaten fuer Modul 04
      // ------------------------------------------------------

      let dateiname =
        String(
          body.dateiname || ""
        ).trim();

      // Browserpfade entfernen.
      dateiname =
        dateiname
          .split("/")
          .pop()
          ?.split("\\")
          .pop() || "";

      if (!dateiname) {
        dateiname =
          publicId
            .split("/")
            .pop() ||
          "bild";
      }

      const dateigroesse =
        Number(cloud.bytes);

      if (
        !Number.isFinite(
          dateigroesse
        ) ||
        dateigroesse <= 0
      ) {
        return jsonOut({
          success: false,
          error: {
            code:
              "INVALID_FILE_SIZE",
            message:
              "Cloudinary hat keine gültige Dateigröße geliefert.",
          },
        });
      }

      const format =
        String(
          cloud.format || ""
        )
          .trim()
          .toLowerCase();

      let mimeType =
        String(
          body.mimeType || ""
        )
          .trim()
          .toLowerCase();

      // Fallback aus Cloudinary-Format.
      if (!mimeType) {
        if (
          format === "jpg" ||
          format === "jpeg"
        ) {
          mimeType =
            "image/jpeg";
        } else if (
          format === "png"
        ) {
          mimeType =
            "image/png";
        } else if (
          format === "webp"
        ) {
          mimeType =
            "image/webp";
        } else if (
          format === "gif"
        ) {
          mimeType =
            "image/gif";
        }
      }

      if (
        !mimeType ||
        !mimeType.startsWith(
          "image/"
        )
      ) {
        return jsonOut({
          success: false,
          error: {
            code:
              "INVALID_MIME_TYPE",
            message:
              "Ungültiger MIME-Type für ein Bild.",
          },
        });
      }

      if (!format) {
        return jsonOut({
          success: false,
          error: {
            code:
              "CLOUDINARY_FORMAT_MISSING",
            message:
              "Cloudinary-Dateiformat fehlt.",
          },
        });
      }

      // ------------------------------------------------------
      // Media_URL selbst bilden.
      //
      // Wir uebernehmen NICHT blind eine vom Browser
      // eingesandte Fremd-URL.
      // ------------------------------------------------------

      const mediaUrl =
        "https://res.cloudinary.com/" +
        cloudName +
        "/image/upload/v" +
        version +
        "/" +
        publicId +
        "." +
        format;

      const breite =
        Number(cloud.width);

      const hoehe =
        Number(cloud.height);

      const payload:
        Record<string, unknown> = {
          action:
            "createMedia",

          // Mandant IMMER Session:
          kundenId:
            kundenId,

          dateiname:
            dateiname,

          dateityp:
            "Bild",

          dateigroesse:
            dateigroesse,

          mimeType:
            mimeType,

          cloudinaryId:
            publicId,

          mediaUrl:
            mediaUrl,

          vorschauUrl:
            mediaUrl,

          hochgeladenVon:
            benutzer,
        };

      if (
        Number.isFinite(
          breite
        ) &&
        breite > 0
      ) {
        payload.breite =
          breite;
      }

      if (
        Number.isFinite(
          hoehe
        ) &&
        hoehe > 0
      ) {
        payload.hoehe =
          hoehe;
      }

      // ------------------------------------------------------
      // Modul 04 createMedia
      // ------------------------------------------------------

      const result =
        await mediaPost(payload);

      if (
        !result ||
        result.success !== true
      ) {
        const msg =
          result &&
          result.error &&
          result.error.message
            ? String(
                result.error
                  .message
              )
            : result &&
              result.message
            ? String(
                result.message
              )
            : "Mediendatensatz konnte nicht gespeichert werden.";

        const code =
          result &&
          result.error &&
          result.error.code
            ? String(
                result.error.code
              )
            : "MEDIA_CREATE_FAILED";

        return jsonOut({
          success: false,
          error: {
            code: code,
            message: msg,
          },
        });
      }

      const mediaId =
        result &&
        result.data &&
        result.data.mediaId
          ? result.data.mediaId
          : result &&
            result.mediaId
          ? result.mediaId
          : result &&
            result.data &&
            result.data.Media_ID
          ? result.data.Media_ID
          : "";

      return jsonOut({
        success: true,
        data: {
          registered: true,
          mediaId:
            mediaId,
          kundenId:
            kundenId,
          cloudinaryId:
            publicId,
          mediaUrl:
            mediaUrl,
          dateiname:
            dateiname,
          dateigroesse:
            dateigroesse,
          mimeType:
            mimeType,
          breite:
            Number.isFinite(
              breite
            )
              ? breite
              : "",
          hoehe:
            Number.isFinite(
              hoehe
            )
              ? hoehe
              : "",
        },
      });
    }

    // ========================================================
    // UNBEKANNTE ACTION
    // ========================================================

    return jsonOut({
      success: false,
      error: {
        code:
          "UNKNOWN_ACTION",
        message:
          "Unbekannte Admin-Aktion.",
      },
    });
  } catch (error) {
    return jsonOut({
      success: false,
      error: {
        code: "PROXY_ERROR",
        message: String(error),
      },
    });
  }
};

export const config = {
  path: "/api/admin",
};
