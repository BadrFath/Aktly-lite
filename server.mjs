import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

const port = Number(process.env.PORT || 10000);
const host = "0.0.0.0";
const distDir = path.resolve("dist");
const dataDir = path.resolve(".data");
const usersFile = path.join(dataDir, "users.json");
const authLoginUrl = (process.env.AUTH_LOGIN_URL || "").trim();
const authSignupUrl = (process.env.AUTH_SIGNUP_URL || "").trim();
const veriffSessionUrl = (process.env.VERIFF_SESSION_URL || "").trim();
const legakteBearerToken = (process.env.LEGAKTE_BEARER_TOKEN || "").trim();
const bnbApiBaseUrl = (process.env.BNB_API_BASE_URL_DEV || "").trim().replace(/\/$/, "");
const bnbApiKey = (process.env.BNB_API_KEY || "").trim();
const bnbEnterpriseSearchUrl = (process.env.BNB_ENTERPRISE_SEARCH_URL || "").trim();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function toSafePath(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || "/").split("?")[0]);
  const relativePath = cleanPath.replace(/^\/+/, "");
  return path.normalize(relativePath);
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function ensureUsersStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(usersFile);
  } catch {
    await fs.writeFile(usersFile, "[]", "utf8");
  }
}

async function readUsers() {
  await ensureUsersStore();
  const raw = await fs.readFile(usersFile, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeUsers(users) {
  await ensureUsersStore();
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password || "")).digest("hex");
}

function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

function makeCompanyPayload(enterpriseNumber, langue) {
  const number = String(enterpriseNumber || "").replace(/\D+/g, "") || "0000000000";
  const companyName = `Entreprise ${number}`;
  const city = langue === "nl" ? "Brussel" : "Bruxelles";
  const status = langue === "nl" ? "Actief" : "Actif";

  return {
    lang_entre: langue || "fr",
    number,
    denomination: [
      {
        description: [
          { language: "fr", value: companyName },
          { language: "nl", value: companyName },
        ],
      },
    ],
    address: `Avenue Centrale 10, 1000 ${city}`,
    typeOfEnterprise: "ELP",
    juridicalSituation: {
      status: {
        description: [{ language: langue || "fr", value: status }],
      },
    },
  };
}

function normalizeBnbCompanyPayload(raw, enterpriseNumber, langue) {
  const number = String(
    raw?.number ||
      raw?.enterpriseNumber ||
      raw?.enterprise_number ||
      raw?.kboNumber ||
      enterpriseNumber ||
      "",
  ).replace(/\D+/g, "");

  const fromDescriptions = raw?.denomination?.[0]?.description;
  const companyName =
    (Array.isArray(fromDescriptions)
      ? fromDescriptions.find((item) => item?.language === langue)?.value ||
        fromDescriptions.find((item) => item?.value)?.value
      : null) ||
    raw?.company_name ||
    raw?.companyName ||
    raw?.name ||
    raw?.legalName ||
    `Entreprise ${number}`;

  const rawAddress =
    raw?.address ||
    raw?.headOfficeAddress ||
    raw?.head_office_address ||
    raw?.registeredOffice ||
    raw?.registered_office ||
    raw?.location ||
    null;

  const address =
    typeof rawAddress === "string"
      ? rawAddress
      : [rawAddress?.street, rawAddress?.number, rawAddress?.postalCode, rawAddress?.city]
          .filter(Boolean)
          .join(" ") || "Adresse non disponible";

  const status =
    raw?.juridicalSituation?.status?.description?.[0]?.value ||
    raw?.status ||
    (langue === "nl" ? "Actief" : "Actif");

  return {
    lang_entre: langue || "fr",
    number,
    denomination: [
      {
        description: [
          { language: "fr", value: String(companyName) },
          { language: "nl", value: String(companyName) },
        ],
      },
    ],
    address,
    typeOfEnterprise: raw?.typeOfEnterprise || raw?.enterpriseType || "ELP",
    juridicalSituation: {
      status: {
        description: [{ language: langue || "fr", value: String(status) }],
      },
    },
  };
}

function buildBnbCandidateUrls(enterpriseNumber, langue) {
  const cleanNumber = String(enterpriseNumber || "").replace(/\D+/g, "");

  if (bnbEnterpriseSearchUrl) {
    if (bnbEnterpriseSearchUrl.includes("{enterprise_number}")) {
      return [bnbEnterpriseSearchUrl.replace("{enterprise_number}", cleanNumber)];
    }

    const separator = bnbEnterpriseSearchUrl.includes("?") ? "&" : "?";
    return [`${bnbEnterpriseSearchUrl}${separator}enterprise_number=${encodeURIComponent(cleanNumber)}&langue=${encodeURIComponent(langue || "fr")}`];
  }

  if (!bnbApiBaseUrl) {
    return [];
  }

  return [
    `${bnbApiBaseUrl}/v1/enterprises/${cleanNumber}`,
    `${bnbApiBaseUrl}/v1/enterprise/${cleanNumber}`,
    `${bnbApiBaseUrl}/v1/kbo/${cleanNumber}`,
    `${bnbApiBaseUrl}/v1/company/${cleanNumber}`,
    `${bnbApiBaseUrl}/v1/companies/${cleanNumber}`,
    `${bnbApiBaseUrl}/v1/enterprises?enterprise_number=${encodeURIComponent(cleanNumber)}&langue=${encodeURIComponent(langue || "fr")}`,
  ];
}

async function fetchBnbCompany(enterpriseNumber, langue) {
  const urls = buildBnbCandidateUrls(enterpriseNumber, langue);
  if (urls.length === 0) {
    return null;
  }

  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(bnbApiKey
            ? {
                "X-API-KEY": bnbApiKey,
                "x-api-key": bnbApiKey,
                Authorization: `Bearer ${bnbApiKey}`,
              }
            : {}),
        },
      });

      if (!response.ok) {
        lastError = `HTTP ${response.status} on ${url}`;
        continue;
      }

      const payload = await response.json();
      const selected = Array.isArray(payload?.data) ? payload.data[0] : payload;
      return normalizeBnbCompanyPayload(selected || {}, enterpriseNumber, langue);
    } catch (error) {
      lastError = String(error?.message || error);
    }
  }

  throw new Error(lastError || "Aucune route BNB valide repond");
}

function makeDirigeantsPayload() {
  return {
    data: [
      {
        id: "657",
        demande_id: "a0eaa59a-31f1-4e54-8b16-0ec5f69705d3",
        given_name: "Mohamed",
        nom: "El Yakoubi",
        role: "Administrateur",
      },
      {
        id: "652",
        demande_id: "a0d5cc74-2911-4044-9369-e05188669e5f",
        given_name: "Celine",
        nom: "Pousseur",
        role: "Administrateur",
      },
    ],
  };
}

function authorizeLegakte(req) {
  if (!legakteBearerToken) {
    return true;
  }

  const authHeader = String(req.headers.authorization || "");
  return authHeader === `Bearer ${legakteBearerToken}`;
}

async function proxyAuth(req, res, targetUrl) {
  if (!targetUrl) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Auth endpoint non configure sur le serveur." }));
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const upstreamBody = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.end(upstreamBody);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Erreur reseau vers le backend auth.", details: String(error?.message || error) }));
  }
}

async function proxyJsonPost(payload, targetUrl) {
  const upstream = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: text };
  }

  return { status: upstream.status, body: parsed };
}

async function handleLocalSignup(req, res) {
  const payload = await readJsonBody(req);
  const name = String(payload?.name || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();
  const password = String(payload?.password || "");

  if (!name || !email || !password) {
    sendJson(res, 422, { message: "name, email et password sont obligatoires." });
    return;
  }

  const users = await readUsers();
  if (users.some((user) => user.email === email)) {
    sendJson(res, 409, { message: "Cet email existe deja." });
    return;
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeUsers(users);

  sendJson(res, 201, {
    token: createToken(),
    user: { id: user.id, name: user.name, email: user.email },
  });
}

async function handleLocalLogin(req, res) {
  const payload = await readJsonBody(req);
  const email = String(payload?.email || "").trim().toLowerCase();
  const password = String(payload?.password || "");

  if (!email || !password) {
    sendJson(res, 422, { message: "email et password sont obligatoires." });
    return;
  }

  const users = await readUsers();
  const user = users.find((item) => item.email === email);
  if (!user || user.passwordHash !== hashPassword(password)) {
    sendJson(res, 401, { message: "Identifiants invalides." });
    return;
  }

  sendJson(res, 200, {
    token: createToken(),
    user: { id: user.id, name: user.name, email: user.email },
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || "GET";
    const requestPath = (req.url || "/").split("?")[0];

    if (method === "POST" && requestPath === "/api/auth/login") {
      if (authLoginUrl) {
        await proxyAuth(req, res, authLoginUrl);
      } else {
        await handleLocalLogin(req, res);
      }
      return;
    }

    if (method === "POST" && requestPath === "/api/auth/signup") {
      if (authSignupUrl) {
        await proxyAuth(req, res, authSignupUrl);
      } else {
        await handleLocalSignup(req, res);
      }
      return;
    }

    if (method === "POST" && requestPath === "/api/legakte/identification-entreprise/search") {
      if (!authorizeLegakte(req)) {
        sendJson(res, 401, { message: "Token Legakte invalide." });
        return;
      }

      const payload = await readJsonBody(req);
      try {
        const bnbPayload = await fetchBnbCompany(payload?.enterprise_number, payload?.langue);
        if (bnbPayload) {
          sendJson(res, 200, bnbPayload);
          return;
        }
      } catch (error) {
        sendJson(res, 502, {
          message: "Echec de recuperation BNB.",
          details: String(error?.message || error),
        });
        return;
      }

      sendJson(res, 200, makeCompanyPayload(payload?.enterprise_number, payload?.langue));
      return;
    }

    if (method === "GET" && requestPath === "/api/legakte/dirigeants") {
      if (!authorizeLegakte(req)) {
        sendJson(res, 401, { message: "Token Legakte invalide." });
        return;
      }

      sendJson(res, 200, makeDirigeantsPayload());
      return;
    }

    if (method === "POST" && requestPath === "/api/veriff/session") {
      const payload = await readJsonBody(req);

      if (veriffSessionUrl) {
        try {
          const proxied = await proxyJsonPost(payload, veriffSessionUrl);
          sendJson(res, proxied.status, proxied.body);
        } catch (error) {
          sendJson(res, 502, {
            message: "Erreur reseau vers Veriff.",
            details: String(error?.message || error),
          });
        }
        return;
      }

      const fallbackUrl = `/adresse-info?veriff=ok&dirigeant=${encodeURIComponent(payload?.dirigeant?.id || "")}`;
      sendJson(res, 200, {
        session_id: crypto.randomUUID(),
        url: fallbackUrl,
      });
      return;
    }

    const safePath = toSafePath(req.url || "/");
    let filePath = path.join(distDir, safePath);

    if (!filePath.startsWith(distDir)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    if (safePath === "" || safePath === ".") {
      filePath = path.join(distDir, "index.html");
    }

    if (!(await fileExists(filePath))) {
      filePath = path.join(distDir, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");

    const content = await fs.readFile(filePath);
    res.statusCode = 200;
    res.end(content);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
    console.error(error);
  }
});

server.listen(port, host, () => {
  console.log(`Backend + static server running on http://${host}:${port}`);
});
