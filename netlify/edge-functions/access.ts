// ONLANG Admin Panel V1.1 – Schritt 1
// Proxy (Plan A) fuer Modul 02 – Access.
//
// Das Frontend spricht NIEMALS direkt mit Google Apps Script.
// Es ruft ausschliesslich /api/access auf. Dieser Proxy leitet die
// Anfrage 1:1 an die Access-Modul-Bereitstellung weiter und gibt die
// Antwort als JSON zurueck.
//
// Unterstuetzt:
//   GET  /api/access?action=session&token=...   -> Session pruefen
//   GET  /api/access?action=health              -> Health-Check
//   POST /api/access  (JSON-Body)               -> loginPassword / logout
//
// WICHTIG: Es wird KEINE alte Login-Logik und KEIN action=login verwendet.
// Der eigentliche Login laeuft ueber POST mit action=loginPassword.

import type { Context } from "https://edge.netlify.com";

// Aktuelle, bereitgestellte /exec-URL von Modul 02 (Access).
const ACCESS_URL =
  "https://script.google.com/macros/s/AKfycbxvxZlmxj2GRcOFNmow4DGDcLwev6Cy5emcKPwoR2USitkdy2_Q0dNvowxhmqz81BcT/exec";

export default async (request: Request, _context: Context) => {
  const incoming = new URL(request.url);

  // Query-Parameter (z. B. action=session&token=...) 1:1 uebernehmen.
  const query = incoming.searchParams.toString();
  const targetUrl = ACCESS_URL + (query ? "?" + query : "");

  try {
    let response: Response;

    if (request.method === "POST") {
      // POST-Body (JSON) unveraendert an Access weiterreichen.
      const body = await request.text();
      response = await fetch(targetUrl, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ONLANG-Admin-Proxy/1.1",
        },
        body: body,
        redirect: "follow",
      });
    } else {
      // GET (session / health).
      response = await fetch(targetUrl, {
        method: "get",
        headers: { "User-Agent": "ONLANG-Admin-Proxy/1.1" },
        redirect: "follow",
      });
    }

    const text = await response.text();

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "PROXY_ERROR", message: String(error) },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
};

export const config = { path: "/api/access" };
