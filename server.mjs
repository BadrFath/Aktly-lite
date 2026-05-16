import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

const port = Number(process.env.PORT || 10000);
const host = "0.0.0.0";
const distDir = path.resolve("dist");
const dataDir = path.resolve(".data");
const usersFile = path.join(dataDir, "users.json");
const sessionsFile = path.join(dataDir, "sessions.json");
const privilegedEmails = new Set(["badrfath16@gmail.com", "contact@legakte.be"]);
const authLoginUrl = (process.env.AUTH_LOGIN_URL || "").trim();
const authSignupUrl = (process.env.AUTH_SIGNUP_URL || "").trim();
const useRemoteAuth = Boolean(authLoginUrl && authSignupUrl);
const authAutoProvision = String(process.env.AUTH_AUTO_PROVISION || "true").trim().toLowerCase() !== "false";
const veriffSessionUrl = (process.env.VERIFF_SESSION_URL || "").trim();
const veriffNotifyUrl = (process.env.VERIFF_NOTIFY_URL || "").trim();
const legakteBearerToken = (process.env.LEGAKTE_BEARER_TOKEN || "").trim();
const bnbApiBaseUrl = (process.env.BNB_API_BASE_URL_DEV || "").trim().replace(/\/$/, "");
const bnbApiKey = (process.env.BNB_API_KEY || "").trim();
const bnbEnterpriseSearchUrl = (process.env.BNB_ENTERPRISE_SEARCH_URL || "").trim();
const stripeSecretKey = (
  process.env.STRIPE_SECRET ||
  process.env.STRIPE_SECRET_KEY ||
  ""
).trim();
const stripePaymentLinkRuntime = (
  process.env.STRIPE_PAYMENT_LINK ||
  process.env.STRIPE_CHECKOUT_URL ||
  process.env.VITE_STRIPE_PAYMENT_LINK ||
  ""
).trim();
const bceSoapServiceUrl = (process.env.BCE_SOAP_URL || "https://kbopub.economie.fgov.be/kbopubws110000/services/wsKBOPub").trim();
const bceSoapAction = (process.env.BCE_SOAP_ACTION || "http://fgov.economie.be/kbopub/ReadEnterprise").trim();
const bceWsUsername = (process.env.BCE_WS_USERNAME || "wsop4830").trim();
const bceWsPassword = (process.env.BCE_WS_PASSWORD || "cBRABbE6qmvvFWBEnc6RJJVd").trim();
const bceCacheTtlMs = Number(process.env.BCE_CACHE_TTL_MS || 5 * 60 * 1000);
const bceCompanyCache = new Map();

// Source: C:/Users/hp/Downloads/Compressed/Aktly-main/storage/logs/laravel.log
// (entries "response bce" for enterprise 1022158878)
const companyDirectoryFromAktlyMain = {
  "1022158878": {
    number: "1022158878",
    denomination: "LEGAKTE",
    status: "Actif",
    legalSituation: "Situation normale",
    typeOfEnterprise: "ELP",
    legalForm: "Société à responsabilité limitée",
    startDate: "2025-04-09",
    address: {
      street: "Avenue des Gerfauts",
      houseNumber: "10",
      box: "34",
      postalCode: "1170",
      municipality: "Watermael-Boitsfort",
      country: "Belgique",
    },
    dirigeants: [
      {
        givenName: "Mohamed",
        surname: "El Yakoubi",
        function: "Administrateur",
      },
    ],
  },
  "0834252359": {
    number: "0834252359",
    denomination: "Entreprise 0834252359",
    status: "Inconnu",
    legalSituation: "Information non disponible",
    typeOfEnterprise: "ELP",
    legalForm: null,
    startDate: null,
    address: {
      street: "",
      houseNumber: "",
      box: "",
      postalCode: "",
      municipality: "",
      country: "Belgique",
    },
    dirigeants: [],
  },
  "0793532155": {
    number: "0793532155",
    denomination: "Entreprise 0793532155",
    status: "Inconnu",
    legalSituation: "Information non disponible",
    typeOfEnterprise: "ELP",
    legalForm: null,
    startDate: null,
    address: {
      street: "",
      houseNumber: "",
      box: "",
      postalCode: "",
      municipality: "",
      country: "Belgique",
    },
    dirigeants: [],
  },
  "0544946196": {
    number: "0544946196",
    denomination: "Entreprise 0544946196",
    status: "Inconnu",
    legalSituation: "Information non disponible",
    typeOfEnterprise: "ELP",
    legalForm: null,
    startDate: null,
    address: {
      street: "",
      houseNumber: "",
      box: "",
      postalCode: "",
      municipality: "",
      country: "Belgique",
    },
    dirigeants: [],
  },
  "0478743894": {
    number: "0478743894",
    denomination: "Entreprise 0478743894",
    status: "Inconnu",
    legalSituation: "Information non disponible",
    typeOfEnterprise: "ELP",
    legalForm: null,
    startDate: null,
    address: {
      street: "",
      houseNumber: "",
      box: "",
      postalCode: "",
      municipality: "",
      country: "Belgique",
    },
    dirigeants: [],
  },
};

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

async function ensureSessionsStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(sessionsFile);
  } catch {
    await fs.writeFile(sessionsFile, "[]", "utf8");
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

async function readSessions() {
  await ensureSessionsStore();
  const raw = await fs.readFile(sessionsFile, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeSessions(sessions) {
  await ensureSessionsStore();
  await fs.writeFile(sessionsFile, JSON.stringify(sessions, null, 2), "utf8");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password || "")).digest("hex");
}

function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function createAccessSession(email, userId) {
  const normalizedEmail = normalizeEmail(email);
  const token = createToken();
  const privileged = privilegedEmails.has(normalizedEmail);
  const sessions = await readSessions();

  sessions.push({
    token,
    email: normalizedEmail,
    userId: String(userId || ""),
    privileged,
    createdAt: new Date().toISOString(),
  });

  if (sessions.length > 2000) {
    sessions.splice(0, sessions.length - 2000);
  }

  await writeSessions(sessions);

  return {
    token,
    email: normalizedEmail,
    privileged,
  };
}

async function findAccessSession(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    return null;
  }

  const sessions = await readSessions();
  return sessions.find((session) => session.token === normalizedToken) || null;
}

function extractAccessToken(req) {
  const direct = String(req.headers['x-auth-token'] || '').trim();
  if (direct) {
    return direct;
  }

  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
}

function normalizeExternalUrl(url) {
  const cleaned = String(url || "").trim();
  if (!cleaned) {
    return "";
  }

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  return `https://${cleaned}`;
}

function buildOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  if (!hostHeader) {
    return ''
  }
  return `${proto}://${hostHeader}`
}

async function stripeRequest(pathname, formDataEntries) {
  if (!stripeSecretKey) {
    throw new Error('Cle Stripe serveur manquante. Definis STRIPE_SECRET.')
  }

  const body = new URLSearchParams()
  for (const [key, value] of formDataEntries) {
    body.append(key, String(value))
  }

  const response = await fetch(`https://api.stripe.com/v1${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe HTTP ${response.status}`)
  }

  return payload
}

async function stripeGet(pathname) {
  if (!stripeSecretKey) {
    throw new Error('Cle Stripe serveur manquante. Definis STRIPE_SECRET.')
  }

  const response = await fetch(`https://api.stripe.com/v1${pathname}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      Accept: 'application/json',
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe HTTP ${response.status}`)
  }

  return payload
}

function makeCompanyPayload(enterpriseNumber, langue) {
  const number = String(enterpriseNumber || "").replace(/\D+/g, "") || "0000000000";
  const companyName = `Entreprise ${number}`;
  const status = langue === "nl" ? "Onbekend" : "Inconnu";

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
    address: langue === "nl" ? "Adres niet beschikbaar" : "Adresse non disponible",
    addresses: [
      {
        street: "",
        houseNumber: "",
        box: "",
        postalCode: "",
        municipality: "",
        country: "Belgique",
        full: langue === "nl" ? "Adres niet beschikbaar" : "Adresse non disponible",
      },
    ],
    enterprise: {
      legalForm: null,
      startDate: null,
      vatLiable: null,
    },
    typeOfEnterprise: "ELP",
    juridicalSituation: {
      status: {
        description: [{ language: langue || "fr", value: status }],
      },
    },
  };
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripXmlTags(value) {
  return xmlDecode(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function firstTagValue(xml, tagName) {
  const match = String(xml || "").match(new RegExp(`<(?:\\w+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`, "i"));
  return match ? stripXmlTags(match[1]) : "";
}

function allTagBlocks(xml, tagName) {
  return Array.from(String(xml || "").matchAll(new RegExp(`<(?:\\w+:)?${tagName}\\b[^>]*>[\\s\\S]*?<\\/(?:\\w+:)?${tagName}>`, "gi"))).map((m) => m[0]);
}

function pickDescriptionValue(xml, preferredLanguage) {
  const descriptions = allTagBlocks(xml, "Description");
  if (descriptions.length === 0) {
    return firstTagValue(xml, "Value");
  }

  const wanted = String(preferredLanguage || "fr").toLowerCase();
  for (const desc of descriptions) {
    const lang = firstTagValue(desc, "Language").toLowerCase();
    if (lang === wanted) {
      const value = firstTagValue(desc, "Value");
      if (value) {
        return value;
      }
    }
  }

  for (const desc of descriptions) {
    const value = firstTagValue(desc, "Value");
    if (value) {
      return value;
    }
  }

  return "";
}

function buildBceSoapEnvelope(enterpriseNumber, langue) {
  const nonceBytes = crypto.randomBytes(16);
  const nonceB64 = nonceBytes.toString("base64");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 5 * 60 * 1000);
  const created = createdAt.toISOString();
  const expires = expiresAt.toISOString();
  const digestSource = Buffer.concat([
    nonceBytes,
    Buffer.from(created, "utf8"),
    Buffer.from(String(bceWsPassword || ""), "utf8"),
  ]);
  const passwordDigest = crypto.createHash("sha1").update(digestSource).digest("base64");
  const usernameTokenId = `UsernameToken-${crypto.randomUUID().toUpperCase()}`;
  const timestampId = `TS-${crypto.randomUUID().toUpperCase()}`;
  const language = String(langue || "fr").toLowerCase() === "nl" ? "nl" : "fr";
  const cleanNumber = String(enterpriseNumber || "").replace(/\D+/g, "");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:dat="http://economie.fgov.be/kbopub/webservices/v1/datamodel" xmlns:mes="http://economie.fgov.be/kbopub/webservices/v1/messages" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" soapenv:mustUnderstand="1">
      <wsse:UsernameToken wsu:Id="${xmlEscape(usernameTokenId)}">
        <wsse:Username>${xmlEscape(bceWsUsername)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${xmlEscape(passwordDigest)}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${xmlEscape(nonceB64)}</wsse:Nonce>
        <wsu:Created>${xmlEscape(created)}</wsu:Created>
      </wsse:UsernameToken>
      <wsu:Timestamp wsu:Id="${xmlEscape(timestampId)}">
        <wsu:Created>${xmlEscape(created)}</wsu:Created>
        <wsu:Expires>${xmlEscape(expires)}</wsu:Expires>
      </wsu:Timestamp>
    </wsse:Security>
    <mes:RequestContext>
      <mes:Id>Aktly-lite</mes:Id>
      <mes:Language>${xmlEscape(language)}</mes:Language>
    </mes:RequestContext>
  </soapenv:Header>
  <soapenv:Body>
    <mes:ReadEnterpriseRequest>
      <dat:EnterpriseNumber>${xmlEscape(cleanNumber)}</dat:EnterpriseNumber>
    </mes:ReadEnterpriseRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function parseBceEnterpriseResponse(xml, enterpriseNumber, langue) {
  const normalizedXml = String(xml || "");
  if (!normalizedXml.trim()) {
    throw new Error("Reponse BCE vide");
  }

  const faultString = firstTagValue(normalizedXml, "faultstring") || firstTagValue(normalizedXml, "Fault");
  if (faultString && /fault|error|erreur|invalid|not authorized|unauthorized/i.test(faultString)) {
    throw new Error(`BCE SOAP Fault: ${faultString}`);
  }

  const replyMatch = normalizedXml.match(/<(?:\w+:)?ReadEnterpriseReply\b[\s\S]*?<\/(?:\w+:)?ReadEnterpriseReply>/i);
  if (!replyMatch) {
    throw new Error("ReadEnterpriseReply introuvable dans la reponse BCE");
  }

  const replyXml = replyMatch[0];
  const enterpriseMatch = replyXml.match(/<(?:\w+:)?Enterprise\b[\s\S]*?<\/(?:\w+:)?Enterprise>/i);
  if (!enterpriseMatch) {
    throw new Error("Noeud Enterprise introuvable dans la reponse BCE");
  }

  const enterpriseXml = enterpriseMatch[0];
  const cleanNumber = String(enterpriseNumber || "").replace(/\D+/g, "");

  const number = firstTagValue(enterpriseXml, "Number").replace(/\D+/g, "") || cleanNumber;
  const typeOfEnterprise = firstTagValue(enterpriseXml, "TypeOfEnterprise") || "ELP";
  const periodXml = allTagBlocks(enterpriseXml, "Period")[0] || "";
  const periodBegin = firstTagValue(periodXml, "Begin");
  const juridicalFormXml = allTagBlocks(enterpriseXml, "JuridicalForm")[0] || "";
  const legalForm = pickDescriptionValue(juridicalFormXml, langue) || null;
  const juridicalSituationXml = allTagBlocks(enterpriseXml, "JuridicalSituation")[0] || "";
  const statusXml = allTagBlocks(juridicalSituationXml, "Status")[0] || "";
  const status = pickDescriptionValue(statusXml, langue) || (String(langue || "fr").toLowerCase() === "nl" ? "Actief" : "Actif");
  const legalSituation = pickDescriptionValue(juridicalSituationXml, langue) || status;

  const denominationXml = allTagBlocks(enterpriseXml, "Denomination")[0] || "";
  const denomination = pickDescriptionValue(denominationXml, langue) || `Entreprise ${number}`;

  const addressBlocks = allTagBlocks(enterpriseXml, "Address");
  const selectedAddress = addressBlocks[0] || "";
  const streetXml = allTagBlocks(selectedAddress, "Street")[0] || "";
  const municipalityXml = allTagBlocks(selectedAddress, "Municipality")[0] || "";
  const address = {
    street: pickDescriptionValue(streetXml, langue),
    houseNumber: firstTagValue(selectedAddress, "HouseNumber"),
    box: firstTagValue(selectedAddress, "Box"),
    postalCode: firstTagValue(selectedAddress, "Zipcode"),
    municipality: pickDescriptionValue(municipalityXml, langue),
    country: firstTagValue(selectedAddress, "Country") || "Belgique",
  };
  const fullAddress = [
    [address.street, address.houseNumber].filter(Boolean).join(" "),
    address.box ? `boite ${address.box}` : "",
    [address.postalCode, address.municipality].filter(Boolean).join(" "),
    address.country,
  ]
    .filter(Boolean)
    .join(", ");

  const functionBlocks = allTagBlocks(enterpriseXml, "Function");
  const dirigeants = functionBlocks
    .map((block, index) => {
      const personXml = allTagBlocks(block, "Person")[0] || "";
      const givenName = firstTagValue(personXml, "GivenName").trim();
      const surname = firstTagValue(personXml, "Surname").trim();
      if (!givenName && !surname) {
        return null;
      }

      return {
        id: `${number}-${index + 1}`,
        demande_id: number || cleanNumber || "N/A",
        given_name: givenName,
        nom: surname,
        role: pickDescriptionValue(block, langue) || "Administrateur",
      };
    })
    .filter(Boolean);

  return {
    company: {
      lang_entre: String(langue || "fr").toLowerCase() === "nl" ? "nl" : "fr",
      number,
      denomination: [
        {
          description: [
            { language: "fr", value: denomination },
            { language: "nl", value: denomination },
          ],
        },
      ],
      address: fullAddress,
      addresses: [
        {
          ...address,
          full: fullAddress,
        },
      ],
      enterprise: {
        legalForm,
        startDate: periodBegin || null,
        vatLiable: null,
        legalSituation,
      },
      typeOfEnterprise,
      juridicalSituation: {
        status: {
          description: [{ language: String(langue || "fr").toLowerCase() === "nl" ? "nl" : "fr", value: status }],
        },
      },
      source: "bce-soap",
    },
    dirigeants,
  };
}

function getBceCacheKey(enterpriseNumber, langue) {
  const number = String(enterpriseNumber || "").replace(/\D+/g, "");
  const language = String(langue || "fr").toLowerCase() === "nl" ? "nl" : "fr";
  return `${number}:${language}`;
}

function readBceCache(enterpriseNumber, langue) {
  const key = getBceCacheKey(enterpriseNumber, langue);
  const entry = bceCompanyCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    bceCompanyCache.delete(key);
    return null;
  }

  return entry;
}

function writeBceCache(enterpriseNumber, langue, company, dirigeants) {
  const key = getBceCacheKey(enterpriseNumber, langue);
  bceCompanyCache.set(key, {
    company,
    dirigeants: Array.isArray(dirigeants) ? dirigeants : [],
    expiresAt: Date.now() + Math.max(10_000, bceCacheTtlMs),
  });
}

async function fetchBceSoapCompany(enterpriseNumber, langue) {
  const cleanNumber = String(enterpriseNumber || "").replace(/\D+/g, "");
  if (!cleanNumber) {
    throw new Error("Numero d'entreprise invalide");
  }

  const cached = readBceCache(cleanNumber, langue || "fr");
  if (cached) {
    return { company: cached.company, dirigeants: cached.dirigeants };
  }

  let lastError = null;
  const requestedLang = String(langue || "fr").toLowerCase() === "nl" ? "nl" : "fr";
  const attemptLanguages = requestedLang === "fr" ? ["fr", "nl"] : ["nl", "fr"];

  for (const attemptLang of attemptLanguages) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const soapEnvelope = buildBceSoapEnvelope(cleanNumber, attemptLang);
        console.log(
          "SOAP URL:",
          process.env.BCE_SOAP_URL
        );
        console.log(
          "Entreprise:",
          cleanNumber
        );
        const response = await fetch(bceSoapServiceUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml;charset=UTF-8",
            SOAPAction: `"${bceSoapAction}"`,
            Accept: "text/xml, application/xml",
          },
          body: soapEnvelope,
          signal: AbortSignal.timeout(15_000),
        });

        const body = await response.text();
        if (!response.ok) {
          throw new Error(`BCE SOAP HTTP ${response.status}`);
        }

        const parsed = parseBceEnterpriseResponse(body, cleanNumber, attemptLang);
        writeBceCache(cleanNumber, attemptLang, parsed.company, parsed.dirigeants);
        if (attemptLang !== requestedLang) {
          writeBceCache(cleanNumber, requestedLang, parsed.company, parsed.dirigeants);
        }
        return parsed;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw new Error(String(lastError?.message || lastError || "BCE SOAP indisponible"));
}

function mapAktlyMainCompanyPayload(enterpriseNumber, langue) {
  const cleanNumber = String(enterpriseNumber || "").replace(/\D+/g, "");
  const source = companyDirectoryFromAktlyMain[cleanNumber];

  if (!source) {
    return null;
  }

  const lineOne = [source.address.street, source.address.houseNumber]
    .filter(Boolean)
    .join(" ");
  const withBox = source.address.box ? `${lineOne} boite ${source.address.box}` : lineOne;
  const lineTwo = [source.address.postalCode, source.address.municipality]
    .filter(Boolean)
    .join(" ");
  const fullAddress = [withBox, lineTwo, source.address.country].filter(Boolean).join(", ");

  return {
    lang_entre: langue || "fr",
    number: source.number,
    denomination: [
      {
        description: [
          { language: "fr", value: source.denomination },
          { language: "nl", value: source.denomination },
        ],
      },
    ],
    address: fullAddress,
    addresses: [
      {
        street: source.address.street,
        houseNumber: source.address.houseNumber,
        box: source.address.box,
        postalCode: source.address.postalCode,
        municipality: source.address.municipality,
        country: source.address.country,
        full: fullAddress,
      },
    ],
    enterprise: {
      legalForm: source.legalForm,
      startDate: source.startDate,
      vatLiable: null,
      legalSituation: source.legalSituation,
    },
    typeOfEnterprise: source.typeOfEnterprise,
    juridicalSituation: {
      status: {
        description: [{ language: langue || "fr", value: source.status }],
      },
    },
    source: "aktly-main",
  };
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&eacute;/gi, "e")
    .replace(/&egrave;/gi, "e")
    .replace(/&ecirc;/gi, "e")
    .replace(/&agrave;/gi, "a")
    .replace(/&uuml;/gi, "u")
    .replace(/&ouml;/gi, "o")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeLabel(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:]/g, "");
}

function htmlCellToText(value) {
  const withBreaks = String(value || "").replace(/<br\s*\/?\s*>/gi, "\n");
  return decodeHtmlEntities(withBreaks)
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function cleanBceLines(value) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .map((line) => line.replace(/\b(?:depuis|sedert|sinds)\b[\s\S]*$/i, "").trim())
    .filter(Boolean)
    .filter((line) => !/^depuis\b/i.test(line))
    .filter((line) => !/^sedert\b/i.test(line))
    .filter((line) => !/^pas de donnees\b/i.test(normalizeLabel(line)))
    .filter((line) => !/^geen gegevens\b/i.test(normalizeLabel(line)));
}

function extractStartDateFromText(value) {
  const text = String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }

  const phraseMatch = text.match(/(?:depuis|sedert|sinds)\s+([^,;]+)/i);
  if (phraseMatch?.[1]) {
    return phraseMatch[1].trim();
  }

  const dayMonthYear = text.match(/\b\d{1,2}\s+[A-Za-z\u00C0-\u017F]+\s+\d{4}\b/);
  if (dayMonthYear?.[0]) {
    return dayMonthYear[0];
  }

  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso?.[0]) {
    return iso[0];
  }

  return null;
}

function parseBceRows(html) {
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1] || "";
    const cells = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]);
    }

    if (cells.length >= 2) {
      rows.push({
        label: normalizeLabel(cells[0]),
        value: htmlCellToText(cells[1]),
      });
    }
  }

  return rows;
}

function pickRowValue(rows, labels) {
  const normalizedLabels = labels.map((item) => normalizeLabel(item));

  for (const row of rows) {
    for (const wanted of normalizedLabels) {
      if (row.label === wanted || row.label.startsWith(wanted)) {
        return row.value;
      }
    }
  }

  return "";
}

function parseAddressParts(addressText) {
  const lines = cleanBceLines(addressText);

  const lineOne = lines[0] || "";
  const lineTwo = lines[1] || "";

  let postalCode = "";
  let municipality = "";
  const lineTwoMatch = lineTwo.match(/^(\d{4})\s+(.+)$/);
  if (lineTwoMatch) {
    postalCode = lineTwoMatch[1];
    municipality = lineTwoMatch[2];
  }

  let street = "";
  let houseNumber = "";
  let box = "";

  const withBox = lineOne.match(/^(.*?)\s+(\d+[\w\/-]*)\s+(?:boite|boite\.|bus|bte)\s*([\w\/-]+)$/i);
  const withoutBox = lineOne.match(/^(.*?)\s+(\d+[\w\/-]*)$/i);

  if (withBox) {
    street = withBox[1].trim();
    houseNumber = withBox[2].trim();
    box = withBox[3].trim();
  } else if (withoutBox) {
    street = withoutBox[1].trim();
    houseNumber = withoutBox[2].trim();
  } else {
    street = lineOne;
  }

  return {
    street,
    houseNumber,
    box,
    postalCode,
    municipality,
    country: "Belgique",
    full: lines.join(", "),
  };
}

async function fetchBcePublicCompany(enterpriseNumber, langue) {
  const cleanNumber = String(enterpriseNumber || "").replace(/\D+/g, "");
  if (!cleanNumber) {
    return null;
  }

  const requestedLang = String(langue || "fr").toLowerCase() === "nl" ? "nl" : "fr";
  const requests = [
    {
      method: "GET",
      url: `https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?nummer=${encodeURIComponent(cleanNumber)}&actionLu=${encodeURIComponent(requestedLang === "nl" ? "Zoeken" : "Rechercher")}`,
    },
    {
      method: "GET",
      url: `https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?nummer=${encodeURIComponent(cleanNumber)}&actionLu=${encodeURIComponent("Rechercher")}`,
    },
    {
      method: "GET",
      url: `https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?nummer=${encodeURIComponent(cleanNumber)}&actionLu=${encodeURIComponent("Zoeken")}`,
    },
    {
      method: "POST",
      url: "https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html",
      body: new URLSearchParams({
        nummer: cleanNumber,
        actionLu: requestedLang === "nl" ? "Zoeken" : "Rechercher",
      }).toString(),
    },
  ];

  let html = "";
  let lastError = null;

  for (const request of requests) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (compatible; AktlyLite/1.0)",
          ...(request.method === "POST"
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        ...(request.body ? { body: request.body } : {}),
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      html = await response.text();
      if (/<table|Ondernemingsnummer|Num[eé]ro d'entreprise|Benaming|D[eé]nomination/i.test(html)) {
        break;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!html) {
    throw new Error(String(lastError?.message || lastError || "BCE public indisponible"));
  }

  const rows = parseBceRows(html);

  const numberRaw = pickRowValue(rows, ["Numero d'entreprise", "Numéro d'entreprise", "Ondernemingsnummer"]);
  const denominationRaw = pickRowValue(rows, ["Denomination", "Dénomination", "Benaming"]);
  const statusRaw = pickRowValue(rows, ["Statut", "Status"]);
  const legalSituationRaw = pickRowValue(rows, ["Situation juridique", "Juridische situatie"]);
  const startDateRaw = pickRowValue(rows, ["Date de debut", "Date de début", "Startdatum", "Begindatum", "Datum oprichting", "Ingeschreven sinds"]);
  const legalFormRaw = pickRowValue(rows, ["Forme legale", "Forme légale", "Rechtsvorm"]);
  const addressRaw = pickRowValue(rows, ["Adresse du siege", "Adresse du siège", "Adres van de zetel"]);

  const number = String(numberRaw || cleanNumber).replace(/\D+/g, "") || cleanNumber;
  const denomination = cleanBceLines(denominationRaw)[0] || `Entreprise ${number}`;
  const status = cleanBceLines(statusRaw)[0] || (langue === "nl" ? "Actief" : "Actif");
  const legalSituation = cleanBceLines(legalSituationRaw)[0] || status;
  const startDate = cleanBceLines(startDateRaw)[0] || extractStartDateFromText(startDateRaw) || extractStartDateFromText(addressRaw) || null;
  const legalForm = cleanBceLines(legalFormRaw)[0] || null;
  const address = parseAddressParts(cleanBceLines(addressRaw).join("\n"));

  return {
    lang_entre: requestedLang,
    number,
    denomination: [
      {
        description: [
          { language: "fr", value: denomination },
          { language: "nl", value: denomination },
        ],
      },
    ],
    address: address.full || (requestedLang === "nl" ? "Adres niet beschikbaar" : "Adresse non disponible"),
    addresses: [address],
    enterprise: {
      legalForm,
      startDate,
      vatLiable: null,
      legalSituation,
    },
    typeOfEnterprise: "ELP",
    juridicalSituation: {
      status: {
        description: [{ language: requestedLang, value: status }],
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
    `${bnbApiBaseUrl}/ws/v1/enterprises/${cleanNumber}`,
    `${bnbApiBaseUrl}/ws/v1/enterprise/${cleanNumber}`,
    `${bnbApiBaseUrl}/ws/v1/kbo/${cleanNumber}`,
    `${bnbApiBaseUrl}/api/v1/enterprises/${cleanNumber}`,
    `${bnbApiBaseUrl}/services/v1/enterprises/${cleanNumber}`,
    `${bnbApiBaseUrl}/services/enterprise/${cleanNumber}`,
    `${bnbApiBaseUrl}/v1/enterprises?enterprise_number=${encodeURIComponent(cleanNumber)}&langue=${encodeURIComponent(langue || "fr")}`,
    `${bnbApiBaseUrl}/ws/v1/enterprises?enterprise_number=${encodeURIComponent(cleanNumber)}&langue=${encodeURIComponent(langue || "fr")}`,
    `${bnbApiBaseUrl}/api/v1/enterprises?enterprise_number=${encodeURIComponent(cleanNumber)}&langue=${encodeURIComponent(langue || "fr")}`,
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
      const headers = {
        Accept: "application/json",
        ...(bnbApiKey
          ? {
              "X-API-KEY": bnbApiKey,
              "x-api-key": bnbApiKey,
              Authorization: `Bearer ${bnbApiKey}`,
            }
          : {}),
      };

      const urlWithKey = bnbApiKey
        ? `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(bnbApiKey)}`
        : url;

      const getResponse = await fetch(urlWithKey, {
        method: "GET",
        headers,
      });

      if (getResponse.ok) {
        const payload = await getResponse.json();
        const selected = Array.isArray(payload?.data) ? payload.data[0] : payload;
        return normalizeBnbCompanyPayload(selected || {}, enterpriseNumber, langue);
      }

      const postResponse = await fetch(urlWithKey, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enterprise_number: enterpriseNumber, langue: langue || "fr" }),
      });

      if (postResponse.ok) {
        const payload = await postResponse.json();
        const selected = Array.isArray(payload?.data) ? payload.data[0] : payload;
        return normalizeBnbCompanyPayload(selected || {}, enterpriseNumber, langue);
      }

      lastError = `HTTP ${getResponse.status}/${postResponse.status} on ${url}`;
    } catch (error) {
      lastError = String(error?.message || error);
    }
  }

  throw new Error(lastError || "Aucune route BNB valide repond");
}

async function makeDirigeantsPayload(req, enterpriseNumber) {
  const cleanNumber = String(
      enterpriseNumber || ""
  ).replace(/\D+/g, "");

  try {

      const fromBce =
        await fetchBceSoapCompany(
            cleanNumber,
            "fr"
        );

      console.log(
         "BCE dirigeants:",
         JSON.stringify(fromBce,null,2)
      );

      if (
        Array.isArray(
            fromBce?.dirigeants
        ) &&
        fromBce.dirigeants.length
      ) {

          return {
            data:
             fromBce.dirigeants
          };
      }

  } catch(error){

      console.error(
        "Erreur BCE:",
        error.message
      );
  }

  return {
      data:[]
  };
}

async function authorizeLegakte(req) {
  const authHeader = String(req.headers.authorization || "").trim();
  const hasStaticBearer = Boolean(legakteBearerToken);

  if (hasStaticBearer && authHeader === `Bearer ${legakteBearerToken}`) {
    return true;
  }

  const token = extractAccessToken(req);
  if (token) {
    const session = await findAccessSession(token);
    if (session) {
      return true;
    }
  }

  return !hasStaticBearer;
}

function safeValue(value, fallback = "-") {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || fallback;
}

function pickDescription(descriptions, preferredLang = "fr") {
  if (!Array.isArray(descriptions)) {
    return "";
  }

  const normalizedLang = String(preferredLang || "fr").toLowerCase();
  const match = descriptions.find((item) => String(item?.language || "").toLowerCase() === normalizedLang);
  if (match?.value) {
    return String(match.value);
  }

  const first = descriptions.find((item) => item?.value);
  return first?.value ? String(first.value) : "";
}

function resolveCompanyName(companyData) {
  return (
    safeValue(companyData?.company_name, "") ||
    safeValue(pickDescription(companyData?.denomination?.[0]?.description, companyData?.lang_entre || "fr"), "") ||
    `Entreprise ${safeValue(companyData?.number, "")}`
  );
}

function resolveAddress(companyData, addressInfo) {
  const fromCompany = companyData?.addresses?.[0] || {};
  const normalized = {
    street: safeValue(addressInfo?.rue || fromCompany?.street, ""),
    houseNumber: safeValue(addressInfo?.numero || fromCompany?.houseNumber, ""),
    box: safeValue(addressInfo?.boite || fromCompany?.box, ""),
    postalCode: safeValue(addressInfo?.codePostal || fromCompany?.postalCode, ""),
    municipality: safeValue(addressInfo?.commune || fromCompany?.municipality, ""),
    country: safeValue(fromCompany?.country || "Belgique", "Belgique"),
  };

  const line1 = [normalized.street, normalized.houseNumber].filter(Boolean).join(" ");
  const line1WithBox = normalized.box ? `${line1} boite ${normalized.box}` : line1;
  const line2 = [normalized.postalCode, normalized.municipality].filter(Boolean).join(" ");
  const full = [line1WithBox, line2, normalized.country].filter(Boolean).join(", ");

  return {
    ...normalized,
    full,
  };
}

function buildDossierDocument(documentKey, body) {
  const companyData = body?.company_data || {};
  const addressInfo = body?.address_info || {};
  const depositaire = body?.depositaire || {};
  const user = body?.user || {};
  const payment = body?.payment || {};
  const language = String(body?.file_language || companyData?.lang_entre || "fr").toLowerCase() === "nl" ? "nl" : "fr";
  const isNl = language === "nl";

  const companyName = resolveCompanyName(companyData);
  const enterpriseNumber = safeValue(companyData?.number);
  const companyAddress = resolveAddress(companyData, addressInfo);
  const legalForm = safeValue(companyData?.enterprise?.legalForm);
  const startDate = safeValue(companyData?.enterprise?.startDate);
  const status = safeValue(companyData?.juridicalSituation?.status?.description?.[0]?.value);
  const depositaireName = [safeValue(depositaire?.given_name, ""), safeValue(depositaire?.nom, "")]
    .filter(Boolean)
    .join(" ");

  const commonHeader = [
    `${isNl ? "Onderneming" : "Entreprise"}: ${companyName}`,
    `${isNl ? "Ondernemingsnummer" : "Numero BCE"}: ${enterpriseNumber}`,
    `${isNl ? "Rechtsvorm" : "Forme juridique"}: ${legalForm}`,
    `${isNl ? "Status" : "Statut"}: ${status}`,
    `${isNl ? "Adres" : "Adresse"}: ${safeValue(companyAddress.full)}`,
  ];

  if (documentKey === "formulaire1entr") {
    const content = [
      isNl ? "FORMULIER 1 - IDENTIFICATIE ONDERNEMING" : "FORMULAIRE 1 - IDENTIFICATION ENTREPRISE",
      "",
      ...commonHeader,
      "",
      isNl ? "Adresgegevens:" : "Adresse detaillee:",
      `- ${isNl ? "Straat" : "Rue"}: ${safeValue(companyAddress.street)}`,
      `- ${isNl ? "Nummer" : "Numero"}: ${safeValue(companyAddress.houseNumber)}`,
      `- ${isNl ? "Bus" : "Boite"}: ${safeValue(companyAddress.box)}`,
      `- ${isNl ? "Postcode" : "Code postal"}: ${safeValue(companyAddress.postalCode)}`,
      `- ${isNl ? "Gemeente" : "Commune"}: ${safeValue(companyAddress.municipality)}`,
      `- ${isNl ? "Land" : "Pays"}: ${safeValue(companyAddress.country)}`,
      "",
      `${isNl ? "Startdatum onderneming" : "Date debut entreprise"}: ${startDate}`,
      `${isNl ? "Wijzigingsdatum" : "Date changement"}: ${safeValue(addressInfo?.dateChangement)}`,
    ].join("\n");

    return {
      fileName: isNl ? "formulier1ingevuld.txt" : "formulaire1entr-rempli.txt",
      mimeType: "text/plain; charset=utf-8",
      content,
    };
  }

  if (documentKey === "formulaire2entr") {
    const content = [
      isNl ? "FORMULIER 2 - ONDERNEMING UPDATE" : "FORMULAIRE 2 - MISE A JOUR ENTREPRISE",
      "",
      ...commonHeader,
      "",
      isNl ? "Aanvullende informatie:" : "Informations complementaires:",
      `- ${isNl ? "Wijzigingsdatum" : "Date de changement"}: ${safeValue(addressInfo?.dateChangement)}`,
      `- ${isNl ? "Datum algemene vergadering" : "Date assemblee generale"}: ${safeValue(addressInfo?.dateAssembleeGenerale)}`,
      `- ${isNl ? "Bewaarnemer" : "Depositaire"}: ${safeValue(depositaireName)}`,
      `- ${isNl ? "Rol bewaarnemer" : "Role depositaire"}: ${safeValue(depositaire?.role || "Administrateur")}`,
      `- ${isNl ? "E-mail gebruiker" : "Email utilisateur"}: ${safeValue(user?.email)}`,
      `- Pack: ${safeValue(payment?.pack?.slug)}`,
    ].join("\n");

    return {
      fileName: isNl ? "formulier2ingevuld.txt" : "formulaire2entr-rempli.txt",
      mimeType: "text/plain; charset=utf-8",
      content,
    };
  }

  if (documentKey === "attestation-identite") {
    const content = [
      isNl ? "IDENTITEITSATTEST - MODEL 1" : "ATTESTATION D'IDENTITE - MODELE 1",
      "",
      ...commonHeader,
      "",
      `${isNl ? "Vertegenwoordiger" : "Representant"}: ${safeValue(depositaireName)}`,
      `${isNl ? "Functie" : "Fonction"}: ${safeValue(depositaire?.role || "Administrateur")}`,
      `${isNl ? "Oprichtings/startdatum" : "Date de constitution/debut"}: ${startDate}`,
      `${isNl ? "Boekjaar" : "Exercice social"}: ${safeValue(companyData?.enterprise?.fiscalYear || "Non renseigne")}`,
      `${isNl ? "Algemene vergadering" : "Assemblee generale"}: ${safeValue(addressInfo?.dateAssembleeGenerale)}`,
    ].join("\n");

    return {
      fileName: isNl ? "identiteitsattest-ingevuld.txt" : "attestation-identite-remplie.txt",
      mimeType: "text/plain; charset=utf-8",
      content,
    };
  }

  if (documentKey === "pv-assemblee-generale") {
    const content = [
      isNl ? "PROCES-VERBAAL VAN DE ALGEMENE VERGADERING" : "PROCES-VERBAL DE L'ASSEMBLEE GENERALE",
      "",
      `${isNl ? "Vennootschap" : "Societe"}: ${companyName}`,
      `${isNl ? "Ondernemingsnummer" : "Numero BCE"}: ${enterpriseNumber}`,
      `${isNl ? "Maatschappelijke zetel" : "Siege social"}: ${safeValue(companyAddress.full)}`,
      `${isNl ? "Datum vergadering" : "Date de l'assemblee"}: ${safeValue(addressInfo?.dateAssembleeGenerale)}`,
      `${isNl ? "Wijzigingsdatum" : "Date de changement"}: ${safeValue(addressInfo?.dateChangement)}`,
      "",
      isNl ? "Deelnemers/bestuurders:" : "Participants/dirigeants:",
      `- ${safeValue(depositaireName || user?.name || "Representant")}`,
      "",
      `${isNl ? "Beslissing" : "Decision"}:`,
      isNl
        ? "De vergadering keurt de zetelwijziging en de bijhorende formaliteiten goed."
        : "L'assemblee approuve la mise a jour du siege social et les formalites associees.",
    ].join("\n");

    return {
      fileName: isNl ? "pv-algemene-vergadering-ingevuld.txt" : "pv-assemblee-generale-rempli.txt",
      mimeType: "text/plain; charset=utf-8",
      content,
    };
  }

  return null;
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

    if (!upstream.ok) {
      res.statusCode = upstream.status;
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
      res.end(upstreamBody);
      return;
    }

    let parsed = {};
    try {
      parsed = upstreamBody ? JSON.parse(upstreamBody) : {};
    } catch {
      parsed = {};
    }

    const email =
      parsed?.user?.email ||
      parsed?.data?.user?.email ||
      payload?.email ||
      '';
    const userId = parsed?.user?.id || parsed?.data?.user?.id || '';

    if (email) {
      const appSession = await createAccessSession(email, userId);
      parsed = {
        ...parsed,
        app_token: appSession.token,
        access: {
          email: appSession.email,
          privileged: appSession.privileged,
        },
      };
    }

    sendJson(res, upstream.status, parsed);
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
  const email = normalizeEmail(payload?.email || "");
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

  const appSession = await createAccessSession(user.email, user.id);

  sendJson(res, 201, {
    token: appSession.token,
    app_token: appSession.token,
    access: {
      email: appSession.email,
      privileged: appSession.privileged,
    },
    user: { id: user.id, name: user.name, email: user.email },
  });
}

async function handleLocalLogin(req, res) {
  const payload = await readJsonBody(req);
  const email = normalizeEmail(payload?.email || "");
  const password = String(payload?.password || "");
  const fallbackName = String(payload?.name || "").trim();

  if (!email || !password) {
    sendJson(res, 422, { message: "email et password sont obligatoires." });
    return;
  }

  const users = await readUsers();
  let user = users.find((item) => item.email === email);

  if (!user && authAutoProvision) {
    user = {
      id: crypto.randomUUID(),
      name: fallbackName || email.split('@')[0] || 'Utilisateur Lite',
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await writeUsers(users);
  }

  if (!user || user.passwordHash !== hashPassword(password)) {
    sendJson(res, 401, { message: "Identifiants invalides." });
    return;
  }

  const appSession = await createAccessSession(user.email, user.id);

  sendJson(res, 200, {
    token: appSession.token,
    app_token: appSession.token,
    access: {
      email: appSession.email,
      privileged: appSession.privileged,
    },
    user: { id: user.id, name: user.name, email: user.email },
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || "GET";
    const requestPath = (req.url || "/").split("?")[0];

    if (method === "POST" && requestPath === "/api/auth/login") {
      if (useRemoteAuth) {
        await proxyAuth(req, res, authLoginUrl);
      } else {
        await handleLocalLogin(req, res);
      }
      return;
    }

    if (method === "POST" && requestPath === "/api/auth/signup") {
      if (useRemoteAuth) {
        await proxyAuth(req, res, authSignupUrl);
      } else {
        await handleLocalSignup(req, res);
      }
      return;
    }

    if (method === 'GET' && requestPath === '/api/auth/access-scope') {
      const token = extractAccessToken(req);
      const session = await findAccessSession(token);

      if (!session) {
        sendJson(res, 401, { message: 'Session invalide.', authenticated: false });
        return;
      }

      sendJson(res, 200, {
        authenticated: true,
        email: session.email,
        privileged: Boolean(session.privileged),
      });
      return;
    }

    if (method === "POST" && requestPath === "/api/legakte/identification-entreprise/search") {
      if (!(await authorizeLegakte(req))) {
        sendJson(res, 401, { message: "Token Legakte invalide." });
        return;
      }

      const payload = await readJsonBody(req);
      const enterpriseNumber = payload?.enterprise_number;
      const requestedLang = payload?.langue || "fr";
      try {
        const fromBce = await fetchBceSoapCompany(enterpriseNumber, requestedLang);
        sendJson(res, 200, fromBce.company);
      } catch (soapError) {
        try {
          const publicPayload = await fetchBcePublicCompany(enterpriseNumber, requestedLang);
          if (publicPayload) {
            sendJson(res, 200, {
              ...publicPayload,
              source: "bce-public-fallback",
              warning: "BCE SOAP indisponible, donnees issues du service public BCE.",
            });
            return;
          }
        } catch (publicError) {
          const localPayload = mapAktlyMainCompanyPayload(enterpriseNumber, requestedLang);
          if (localPayload) {
            sendJson(res, 200, {
              ...localPayload,
              warning: "BCE indisponible, donnees locales Aktly-main utilisees en secours.",
            });
            return;
          }

          sendJson(res, 502, {
            message: "Impossible de recuperer les donnees BCE pour ce numero.",
            details: `SOAP: ${String(soapError?.message || soapError)} | Public: ${String(publicError?.message || publicError)}`,
          });
          return;
        }

        sendJson(res, 502, {
          message: "Impossible de recuperer les donnees BCE pour ce numero.",
          details: String(soapError?.message || soapError),
        });
      }
      return;
    }

    if (method === "GET" && requestPath === "/api/legakte/dirigeants") {
      if (!(await authorizeLegakte(req))) {
        sendJson(res, 401, { message: "Token Legakte invalide." });
        return;
      }

      const url = new URL(req.url || "/", "http://localhost");
      const enterpriseNumber = String(url.searchParams.get("enterprise_number") || "").replace(/\D+/g, "");
      const payload = await makeDirigeantsPayload(req, enterpriseNumber);
      sendJson(res, 200, payload);
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

    if (method === "POST" && requestPath === "/api/veriff/notify") {
      const payload = await readJsonBody(req);

      if (veriffNotifyUrl) {
        try {
          const proxied = await proxyJsonPost(payload, veriffNotifyUrl);
          sendJson(res, proxied.status, proxied.body);
        } catch (error) {
          sendJson(res, 502, {
            message: "Erreur reseau vers le service de notification Veriff.",
            details: String(error?.message || error),
          });
        }
        return;
      }

      sendJson(res, 503, {
        status: "not_configured",
        message: "Service de notification Veriff non configure. Definis VERIFF_NOTIFY_URL.",
      });
      return;
    }

    if (method === "POST" && requestPath.startsWith("/lite/dossier/generate/")) {
      const documentKey = decodeURIComponent(requestPath.replace("/lite/dossier/generate/", "")).trim();
      const payload = await readJsonBody(req);
      const doc = buildDossierDocument(documentKey, payload);

      if (!doc) {
        sendJson(res, 404, { message: "Type de document non supporte." });
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", doc.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename=\"${doc.fileName}\"`);
      res.end(doc.content);
      return;
    }

    if (method === "GET" && requestPath === "/api/stripe/payment-link") {
      const url = normalizeExternalUrl(stripePaymentLinkRuntime);
      if (!url) {
        sendJson(res, 404, {
          message: "Lien Stripe non configure. Definis STRIPE_PAYMENT_LINK (ou STRIPE_CHECKOUT_URL).",
        });
        return;
      }

      sendJson(res, 200, { url });
      return;
    }

    if (method === "POST" && requestPath === "/api/stripe/create-checkout-session") {
      try {
        const payload = await readJsonBody(req)
        const amountEur = Number(payload?.amount_eur || 29)
        const amountCents = Math.max(100, Math.round(amountEur * 100))
        const title = String(payload?.title || 'Aktly - Formalites siege social')
        const slug = String(payload?.slug || 'formalites-siege-social')
        const credits = String(payload?.credits || 50)

        const origin = buildOrigin(req)
        const successUrl = `${origin}/stripe/result?status=success&session_id={CHECKOUT_SESSION_ID}`
        const cancelUrl = `${origin}/stripe/result?status=cancel`

        if (stripeSecretKey) {
          const session = await stripeRequest('/checkout/sessions', [
            ['mode', 'payment'],
            ['success_url', successUrl],
            ['cancel_url', cancelUrl],
            ['line_items[0][price_data][currency]', 'eur'],
            ['line_items[0][price_data][product_data][name]', title],
            ['line_items[0][price_data][unit_amount]', amountCents],
            ['line_items[0][quantity]', 1],
            ['metadata[slug]', slug],
            ['metadata[credits]', credits],
          ])

          sendJson(res, 200, {
            id: session?.id,
            url: session?.url,
          })
          return
        }

        const fallbackLink = normalizeExternalUrl(stripePaymentLinkRuntime)
        if (!fallbackLink) {
          sendJson(res, 503, {
            message: 'Stripe non configure: ajoute STRIPE_SECRET ou STRIPE_PAYMENT_LINK.',
          })
          return
        }

        sendJson(res, 200, { id: null, url: fallbackLink })
      } catch (error) {
        sendJson(res, 502, {
          message: 'Creation de session Stripe echouee.',
          details: String(error?.message || error),
        })
      }
      return
    }

    if (method === "GET" && requestPath.startsWith('/api/stripe/checkout-session/')) {
      const sessionId = decodeURIComponent(requestPath.replace('/api/stripe/checkout-session/', ''))

      if (!sessionId) {
        sendJson(res, 400, { message: 'session_id manquant.' })
        return
      }

      if (!stripeSecretKey) {
        sendJson(res, 503, { message: 'STRIPE_SECRET manquante pour verifier le paiement.' })
        return
      }

      try {
        const session = await stripeGet(`/checkout/sessions/${encodeURIComponent(sessionId)}`)
        sendJson(res, 200, {
          id: session?.id,
          status: session?.status,
          payment_status: session?.payment_status,
          amount_total: session?.amount_total,
          currency: session?.currency,
          customer_email: session?.customer_details?.email || session?.customer_email || null,
        })
      } catch (error) {
        sendJson(res, 502, {
          message: 'Verification Stripe echouee.',
          details: String(error?.message || error),
        })
      }
      return
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
