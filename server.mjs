import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
const legacyApiBaseUrl = (process.env.LEGACY_API_BASE_URL || "http://127.0.0.1:8000/api").trim().replace(/\/$/, "");
const bceSoapServiceUrl = (process.env.BCE_SOAP_URL || "https://kbopub.economie.fgov.be/kbopubws110000/services/wsKBOPub").trim();
const bceSoapAction = (process.env.BCE_SOAP_ACTION || "http://fgov.economie.be/kbopub/ReadEnterprise").trim();
const bceWsUsername = (process.env.BCE_WS_USERNAME || "wsop4830").trim();
const bceWsPassword = (process.env.BCE_WS_PASSWORD || "cBRABbE6qmvvFWBEnc6RJJVd").trim();
const bceCacheTtlMs = Number(process.env.BCE_CACHE_TTL_MS || 5 * 60 * 1000);
const bceCompanyCache = new Map();

// Translation map for Belgian legal forms (fr <-> nl)
const LEGAL_FORM_FR_TO_NL = {
  "Société à responsabilité limitée": "Besloten Vennootschap",
  "SRL": "BV",
  "SPRL": "BVBA",
  "Société Privée à Responsabilité Limitée": "Besloten Vennootschap met Beperkte Aansprakelijkheid",
  "Société Anonyme": "Naamloze Vennootschap",
  "SA": "NV",
  "Société en commandite simple": "Gewone commanditaire vennootschap",
  "SCS": "CommV",
  "SComm": "CommV",
  "Société en commandite par actions": "Commanditaire vennootschap op aandelen",
  "SCA": "CVA",
  "Société en nom collectif": "Vennootschap onder firma",
  "SNC": "VOF",
  "Société coopérative": "Coöperatieve vennootschap",
  "SC": "CV",
  "Association sans but lucratif": "Vereniging zonder winstoogmerk",
  "ASBL": "VZW",
  "Association internationale sans but lucratif": "Internationale vereniging zonder winstoogmerk",
  "AISBL": "IVZW",
  "Fondation": "Stichting",
  "Fondation privée": "Private stichting",
  "Société de droit commun": "Maatschap",
  "Entreprise individuelle": "Eenmanszaak",
  "Société agricole": "Landbouwvennootschap",
  "SA": "NV",
  "Groupement d'intérêt économique": "Economisch samenwerkingsverband",
  "GIE": "ESV",
  "Société européenne": "Europese vennootschap",
  "SE": "SE",
};
const LEGAL_FORM_NL_TO_FR = Object.fromEntries(
  Object.entries(LEGAL_FORM_FR_TO_NL).map(([fr, nl]) => [nl, fr])
);

function translateLegalForm(legalForm, targetLang) {
  if (!legalForm) return legalForm;
  const normalizedTarget = String(targetLang || "fr").toLowerCase();
  if (normalizedTarget === "fr") {
    return LEGAL_FORM_NL_TO_FR[legalForm] || legalForm;
  }
  if (normalizedTarget === "nl") {
    return LEGAL_FORM_FR_TO_NL[legalForm] || legalForm;
  }
  return legalForm;
}

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
  const legalFormFr = pickDescriptionValue(juridicalFormXml, "fr") || null;
  const legalFormNl = pickDescriptionValue(juridicalFormXml, "nl") || null;
  const legalForm = pickDescriptionValue(juridicalFormXml, langue) || null;
  const legalFormDescriptions = [
    legalFormFr ? { language: "fr", value: legalFormFr } : null,
    legalFormNl ? { language: "nl", value: legalFormNl } : null,
  ].filter(Boolean);
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
        legalFormDescriptions,
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

function extractCompanyDenominationFromHtml(html) {
  const source = String(html || "");
  if (!source) {
    return "";
  }

  const rowMatch = source.match(
    /<td[^>]*>\s*(?:D[ée]nomination|Denomination|Benaming|Naam)\s*:?\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i,
  );
  if (rowMatch?.[1]) {
    return cleanBceLines(htmlCellToText(rowMatch[1]))[0] || "";
  }

  const headingMatch = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (headingMatch?.[1]) {
    const heading = cleanBceLines(htmlCellToText(headingMatch[1]))[0] || "";
    if (heading && !/kbo|bce/i.test(heading)) {
      return heading;
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
  const denominationRaw = pickRowValue(rows, ["Denomination", "Dénomination", "Benaming", "Naam"]);
  const statusRaw = pickRowValue(rows, ["Statut", "Status"]);
  const legalSituationRaw = pickRowValue(rows, ["Situation juridique", "Juridische situatie"]);
  const startDateRaw = pickRowValue(rows, ["Date de debut", "Date de début", "Startdatum", "Begindatum", "Datum oprichting", "Ingeschreven sinds"]);
  const legalFormRaw = pickRowValue(rows, ["Forme legale", "Forme légale", "Rechtsvorm"]);
  const addressRaw = pickRowValue(rows, ["Adresse du siege", "Adresse du siège", "Adres van de zetel"]);

  const number = String(numberRaw || cleanNumber).replace(/\D+/g, "") || cleanNumber;
  const denomination =
    cleanBceLines(denominationRaw)[0] ||
    extractCompanyDenominationFromHtml(html) ||
    `Entreprise ${number}`;
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

function parseDirigeantName(fullName) {
  const cleaned = String(fullName || "").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return { givenName: "", surname: "" };
  }

  if (cleaned.includes(",")) {
    const [left, right] = cleaned.split(",", 2);
    return {
      givenName: String(right || "").trim(),
      surname: String(left || "").trim(),
    };
  }

  const parts = cleaned.split(/\s+/);
  const givenName = parts.shift() || "";
  const surname = parts.join(" ");
  return { givenName, surname };
}

function parseBcePublicDirigeantsFromHtml(html, enterpriseNumber) {
  const source = String(html || "");
  if (!source) {
    return [];
  }
  const rows = [];
  const rolePattern = /(administrateur|bestuurder|g[ée]rant|zaakvoerder|mandataire|gedelegeerd|directeur)/i;
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(source)) !== null) {
    const roleRaw = htmlCellToText(match[1]);
    const nameRaw = htmlCellToText(match[2]);
    const role = cleanBceLines(roleRaw)[0] || "";
    if (!rolePattern.test(role)) {
      continue;
    }

    const normalizedName = cleanBceLines(nameRaw).join(" ").trim();
    if (
      !normalizedName ||
      /geen gegevens|pas de donn|depuis|sedert|sinds/i.test(normalizeLabel(normalizedName))
    ) {
      continue;
    }

    const { givenName, surname } = parseDirigeantName(normalizedName);

    if (!givenName && !surname) {
      continue;
    }

    rows.push({
      id: `${enterpriseNumber}-${rows.length + 1}`,
      demande_id: String(enterpriseNumber || ""),
      given_name: givenName,
      nom: surname,
      role: role || "Administrateur",
    });
  }

  return rows;
}

async function fetchBcePublicDirigeants(enterpriseNumber, langue) {
  const cleanNumber = String(enterpriseNumber || "").replace(/\D+/g, "");
  if (!cleanNumber) {
    return [];
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
        continue;
      }

      const html = await response.text();
      const dirigeants = parseBcePublicDirigeantsFromHtml(html, cleanNumber);
      if (dirigeants.length > 0) {
        return dirigeants;
      }
    } catch {
      // Keep trying other public BCE request variants.
    }
  }

  return [];
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

  // Build individual address fields for formulaire1 and other templates
  const streetVal = String(rawAddress?.street || "").trim();
  const houseNumberVal = String(rawAddress?.number || rawAddress?.houseNumber || "").trim();
  const boxVal = String(rawAddress?.box || "").trim();
  const postalCodeVal = String(rawAddress?.postalCode || rawAddress?.zipCode || rawAddress?.zip || rawAddress?.postal_code || "").trim();
  const municipalityVal = String(rawAddress?.city || rawAddress?.municipality || rawAddress?.locality || "").trim();
  const countryVal = String(rawAddress?.country || "Belgique").trim();

  // If rawAddress is a string, parse it
  let parsedAddress = null;
  if (typeof rawAddress === "string") {
    parsedAddress = parseAddressParts(rawAddress);
  } else if (!postalCodeVal && !municipalityVal && address !== "Adresse non disponible") {
    parsedAddress = parseAddressParts(address);
  }

  const finalAddress = {
    street: streetVal || parsedAddress?.street || "",
    houseNumber: houseNumberVal || parsedAddress?.houseNumber || "",
    box: boxVal || parsedAddress?.box || "",
    postalCode: postalCodeVal || parsedAddress?.postalCode || "",
    municipality: municipalityVal || parsedAddress?.municipality || "",
    country: countryVal || "Belgique",
    full: typeof address === "string" ? address : (parsedAddress?.full || ""),
  };

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
    address: finalAddress.full || address,
    addresses: [finalAddress],
    typeOfEnterprise: raw?.typeOfEnterprise || raw?.enterpriseType || "ELP",
    juridicalSituation: {
      status: {
        description: [{ language: langue || "fr", value: String(status) }],
      },
    },
    enterprise: {
      legalForm: raw?.enterprise?.legalForm || raw?.legalForm || raw?.juridicalForm || null,
      startDate: raw?.enterprise?.startDate || null,
      vatLiable: null,
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

  const fromPublic = await fetchBcePublicDirigeants(cleanNumber, "fr");
  if (fromPublic.length > 0) {
    return {
      data: fromPublic,
      source: "bce-public",
    };
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

function readDescriptionValue(descriptions, preferredLang = "fr") {
  if (!Array.isArray(descriptions)) {
    return "";
  }

  const normalizedLang = String(preferredLang || "fr").toLowerCase();
  const preferred = descriptions.find((item) => String(item?.language || "").toLowerCase() === normalizedLang);
  if (preferred?.value) {
    return String(preferred.value).trim();
  }

  const fallback = descriptions.find((item) => item?.value);
  return fallback?.value ? String(fallback.value).trim() : "";
}

function toScalarString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (Object.prototype.hasOwnProperty.call(value, "value")) {
      return String(value.value ?? "");
    }
    const first = value[0];
    if (first && typeof first === "object" && Object.prototype.hasOwnProperty.call(first, "value")) {
      return String(first.value ?? "");
    }
    if (typeof first === "string" || typeof first === "number" || typeof first === "boolean") {
      return String(first);
    }
    return "";
  }
  if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")) {
    return String(value.value ?? "");
  }
  return "";
}

function formatNowForHeader() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function formatNowForFileName() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function pickDepositaireName(depositaire) {
  return (
    [
      depositaire?.dirigeant?.givenName,
      depositaire?.dirigeant?.given_name,
      depositaire?.given_name,
      depositaire?.dirigeant?.surname,
      depositaire?.dirigeant?.nom,
      depositaire?.nom,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" ") || "Non renseigne"
  );
}

const dossierPdfTemplates = {
  // All documents now use HTML templates; kept for reference only
};

async function resolveTemplateFilePath(fileName) {
  const candidates = [
    path.join(distDir, "legakte-docs", fileName),
    path.resolve("frontend", "public", "legakte-docs", fileName),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep trying next candidate.
    }
  }

  return "";
}

async function resolveHtmlTemplatePath(styleFolder, fileName) {
  const candidates = [
    path.join(distDir, styleFolder, fileName),
    path.resolve("frontend", "public", styleFolder, fileName),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep trying.
    }
  }

  return "";
}

/** Format a date string "YYYY-MM-DD" to "D mois YYYY" in French */
function formatDateFr(dateStr) {
  if (!dateStr) return "";
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const day = parseInt(m[3], 10);
    const month = months[parseInt(m[2], 10) - 1] || "";
    return `${day} ${month} ${m[1]}`;
  }
  return String(dateStr);
}

function formatDateLong(dateStr, lang = "fr") {
  if (!dateStr) return "";
  const raw = String(dateStr).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let date;
  if (isoMatch) {
    date = new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
  } else {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }
    date = parsed;
  }
  const locale = String(lang || "fr").toLowerCase() === "nl" ? "nl-BE" : "fr-BE";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Format a date string to "DD-MM-YYYY" when possible. */
function formatDateNumeric(dateStr) {
  if (!dateStr) return "";
  const raw = String(dateStr).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }
  const slashMatch = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (slashMatch) {
    const day = String(slashMatch[1]).padStart(2, "0");
    const month = String(slashMatch[2]).padStart(2, "0");
    return `${day}-${month}-${slashMatch[3]}`;
  }
  return raw;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wordwrapHtml(text, width, breakStr = "<br>") {
  const value = String(text || "").trim();
  if (!value) return "";
  const limit = Number(width) || 0;
  if (limit <= 0) return value;

  const words = value.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    if (!word) continue;
    if (!line) {
      if (word.length <= limit) {
        line = word;
      } else {
        for (let i = 0; i < word.length; i += limit) {
          const chunk = word.slice(i, i + limit);
          if (chunk.length === limit) {
            lines.push(chunk);
          } else {
            line = chunk;
          }
        }
      }
      continue;
    }

    const next = `${line} ${word}`;
    if (next.length <= limit) {
      line = next;
      continue;
    }

    lines.push(line);
    line = "";

    if (word.length <= limit) {
      line = word;
    } else {
      for (let i = 0; i < word.length; i += limit) {
        const chunk = word.slice(i, i + limit);
        if (chunk.length === limit) {
          lines.push(chunk);
        } else {
          line = chunk;
        }
      }
    }
  }

  if (line) lines.push(line);
  return lines.join(breakStr);
}

/**
 * Generate the publication text (procès-verbal) in plain text.
 * Only includes sections that have data, following the legacy template.
 */
function generatePubTextHtml(data) {
  const lang = String(data?.lang || data?.demandeLang || "fr").toLowerCase();
  const isNl = lang === "nl";
  const assemblee = data?.assemblee || {};
  const dateAg = formatDateLong(assemblee.date || data.dateAssemblee || data.changeDate || "", lang);
  const lieu = toScalarString(assemblee.lieu || data.faitA || data.lieu || "");
  const heureDebut = toScalarString(
    assemblee.heure_debut || assemblee.heureDebut || data.heureDebut || data.heure_debut || ""
  );
  const heureFin = toScalarString(
    assemblee.heure_fin || assemblee.heureFin || data.heureFin || data.heure_fin || ""
  );

  const services = data?.services || {};
  const servicesList = Array.isArray(data?.servicesList) ? data.servicesList : [];
  const participants = Array.isArray(data?.participants) ? data.participants : [];
  const capitalTotal = toScalarString(
    data?.capitalTotal || data?.capital?.total_actions || data?.capital?.totalActions || ""
  );
  const cessions = Array.isArray(data?.cessions) ? data.cessions : [];
  const repartitionParts = data?.repartitionParts || data?.repartition_parts || null;
  const transfertSiege = data?.transfertSiege || data?.transfert_siege || {};
  const administrateursDemissionnaires = Array.isArray(data?.administrateursDemissionnaires)
    ? data.administrateursDemissionnaires
    : Array.isArray(data?.administrateurs_demissionnaires)
    ? data.administrateurs_demissionnaires
    : [];
  const administrateursNommes = Array.isArray(data?.administrateursNommes)
    ? data.administrateursNommes
    : Array.isArray(data?.administrateurs_nommes)
    ? data.administrateurs_nommes
    : [];
  const signataires = Array.isArray(data?.signataires) ? data.signataires : [];

  const normalizeName = (person) => {
    if (person === null || person === undefined) return "";
    if (typeof person === "string" || typeof person === "number" || typeof person === "boolean") {
      return String(person).trim();
    }
    if (typeof person !== "object") return "";
    const explicit = toScalarString(person.name || person.fullName || person.full_name || person.nom_complet);
    const given = toScalarString(person.givenName || person.prenom || person.firstName || person.given_name);
    const surname = toScalarString(person.surname || person.lastName || person.nom || person.family_name);
    const combined = [given, surname].filter(Boolean).join(" ").trim();
    if (explicit) return explicit;
    if (combined) return combined;
    return toScalarString(person.nom);
  };

  const normalizeNameList = (entries) =>
    Array.isArray(entries)
      ? entries.map(normalizeName).filter((value) => value)
      : [];

  const normalizeParticipants = (entries) =>
    Array.isArray(entries)
      ? entries
          .map((participant) => {
            if (!participant) return "";
            const civilite = toScalarString(participant.civilite || participant.title || participant.civility);
            const nom = normalizeName(participant);
            const actions = toScalarString(participant.actions || participant.aandelen || participant.shares);
            const namePart = [civilite, nom].filter(Boolean).join(" ").trim();
            const actionsLabel = actions ? `${actions} ${isNl ? "aandelen" : "actions"}` : "";
            return [namePart, actionsLabel].filter(Boolean).join(", ");
          })
          .filter(Boolean)
      : [];

  const normalizeCessions = (entries) =>
    Array.isArray(entries)
      ? entries
          .map((cession) => {
            if (!cession || typeof cession !== "object") return null;
            const cedant = normalizeName(cession.cedant || cession.cedant_name || cession.cedantName);
            const acquereur = normalizeName(cession.acquereur || cession.acquereur_name || cession.acquereurName);
            const quantite = toScalarString(cession.quantite || cession.quantity || cession.actions || cession.shares);
            if (!cedant || !acquereur || !quantite) {
              return null;
            }
            return { cedant, acquereur, quantite };
          })
          .filter(Boolean)
      : [];

  const normalizedServices = {
    cessionParts: Boolean(
      services.cessionParts || services.cession_parts || services.cession || services.cession_parts_service
    ),
    addressChange: Boolean(
      services.addressChange || services.address_change || services.address || services.address_service
    ),
    dirigeants: Boolean(services.dirigeants || services.dirigeants_service),
  };

  if (!normalizedServices.cessionParts && cessions.length > 0) {
    normalizedServices.cessionParts = true;
  }
  if (!normalizedServices.addressChange && toScalarString(transfertSiege?.nouvelle_adresse || data?.newAddress)) {
    normalizedServices.addressChange = true;
  }
  if (
    !normalizedServices.dirigeants &&
    (administrateursDemissionnaires.length > 0 || administrateursNommes.length > 0)
  ) {
    normalizedServices.dirigeants = true;
  }
  if (servicesList.length > 0) {
    const normalizedServiceLabels = servicesList.map((item) => String(item || "").toLowerCase());
    if (normalizedServiceLabels.some((label) => label.includes("cession") || label.includes("aandeel"))) {
      normalizedServices.cessionParts = true;
    }
    if (normalizedServiceLabels.some((label) => label.includes("siege") || label.includes("zetel"))) {
      normalizedServices.addressChange = true;
    }
    if (normalizedServiceLabels.some((label) => label.includes("démission") || label.includes("ontslag"))) {
      normalizedServices.dirigeants = true;
    }
    if (normalizedServiceLabels.some((label) => label.includes("nomination") || label.includes("benoeming"))) {
      normalizedServices.dirigeants = true;
    }
  }

  const serviceSummary = [];
  if (normalizedServices.cessionParts) {
    serviceSummary.push(isNl ? "Cessie van aandelen" : "Cession de parts");
  }
  if (normalizedServices.addressChange) {
    serviceSummary.push(isNl ? "Overdracht van maatschappelijke zetel" : "Transfert de siège social");
  }
  if (normalizedServices.dirigeants) {
    serviceSummary.push(isNl ? "Ontslag en benoeming van bestuurder" : "Démission et nomination d’administrateur");
  }

  const orderItems = [];
  if (normalizedServices.cessionParts) {
    orderItems.push(isNl ? "Cessie van aandelen" : "Cession de parts");
  }
  if (normalizedServices.addressChange) {
    orderItems.push(isNl ? "Overdracht van maatschappelijke zetel" : "Transfert de siège social");
  }
  if (normalizedServices.dirigeants) {
    orderItems.push(isNl ? "Ontslag van de bestuurder" : "Démission de l’administrateur");
    orderItems.push(isNl ? "Benoeming van de bestuurder" : "Nomination de l’administrateur");
  }

  const normalizedParticipants = normalizeParticipants(participants);
  const normalizedCessions = normalizeCessions(cessions);
  const demissionnaires = normalizeNameList(administrateursDemissionnaires);
  const nommes = normalizeNameList(administrateursNommes);
  const signatairesList = normalizeNameList(signataires);

  const lines = [];
  const pushBlank = () => {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
  };

  if (dateAg) {
    lines.push(
      isNl
        ? `Proces-verbaal van de buitengewone algemene vergadering van ${dateAg}`
        : `Procès-verbal de l’assemblée générale extraordinaire du ${dateAg}`
    );
    pushBlank();
  }

  if (serviceSummary.length > 0) {
    lines.push(`${serviceSummary.join(", ")}.`);
    pushBlank();
  }

  if (dateAg || lieu || heureDebut) {
    if (isNl) {
      const details = [];
      if (lieu) details.push(`te ${lieu}`);
      if (dateAg) details.push(`op ${dateAg}`);
      if (heureDebut) details.push(`om ${heureDebut}`);
      lines.push(
        `De buitengewone algemene vergadering van de vennootschap werd gehouden${details.length ? " " + details.join(" ") : ""} in aanwezigheid van:`
      );
    } else {
      const details = [];
      if (lieu) details.push(`au ${lieu}`);
      if (dateAg) details.push(`le ${dateAg}`);
      if (heureDebut) details.push(`à ${heureDebut}`);
      lines.push(
        `L’assemblée générale extraordinaire de la société a été réunie${details.length ? " " + details.join(" ") : ""} en présence de :`
      );
    }
    normalizedParticipants.forEach((participant) => lines.push(`- ${participant}`));
    pushBlank();
  }

  if (capitalTotal) {
    lines.push(
      isNl
        ? `Het volledige kapitaal is vertegenwoordigd (${capitalTotal} aandelen), de vergadering kan geldig beslissen over de agenda:`
        : `L’ensemble du capital étant réuni (${capitalTotal} actions), l’assemblée peut valablement statuer sur l’ordre du jour :`
    );
    orderItems.forEach((item) => lines.push(`- ${item}`));
    pushBlank();
  }

  const hasResolutions =
    normalizedCessions.length > 0 ||
    (repartitionParts && Array.isArray(repartitionParts.actionnaires) && repartitionParts.actionnaires.length > 0) ||
    toScalarString(transfertSiege?.nouvelle_adresse || data?.newAddress) ||
    demissionnaires.length > 0 ||
    nommes.length > 0;

  if (hasResolutions) {
    lines.push(isNl ? "Besluiten:" : "Résolutions:");
    pushBlank();
  }

  if (normalizedCessions.length > 0) {
    lines.push(isNl ? "1. Cessie van aandelen" : "1. Cession d’actions");
    normalizedCessions.forEach((cession) => {
      lines.push(
        isNl
          ? `- ${cession.cedant} draagt ${cession.quantite} aandelen over aan ${cession.acquereur}, die aanvaardt.`
          : `- ${cession.cedant} cède ${cession.quantite} actions à ${cession.acquereur}, lequel/laquelle accepte.`
      );
    });
    pushBlank();
  }

  const actionnaires = Array.isArray(repartitionParts?.actionnaires) ? repartitionParts.actionnaires : [];
  if (actionnaires.length > 0) {
    const totalActions = toScalarString(repartitionParts?.total_actions || repartitionParts?.totalActions || "");
    const actionnaireLines = actionnaires
      .map((actionnaire) => {
        if (!actionnaire || typeof actionnaire !== "object") return "";
        const nom = normalizeName(actionnaire);
        const avant = toScalarString(actionnaire.avant || actionnaire.before);
        const apres = toScalarString(actionnaire.apres || actionnaire.after);
        if (!nom || !avant || !apres) return "";
        return isNl
          ? `${nom}: ${avant} aandelen voor de wijziging, ${apres} aandelen na de wijziging.`
          : `${nom} : ${avant} actions avant modification, ${apres} actions après modification.`;
      })
      .filter(Boolean)
      .join(" ");

    if (actionnaireLines) {
      lines.push(
        isNl
          ? `De verdeling van de aandelen voor en na de wijziging, met in totaal ${totalActions || capitalTotal} aandelen, luidt als volgt: ${actionnaireLines}`
          : `La répartition des actions avant et après modification, pour un total de ${totalActions || capitalTotal} actions, est la suivante : ${actionnaireLines}`
      );
      pushBlank();
    }
  }

  const transfertAddress = toScalarString(transfertSiege?.nouvelle_adresse || data?.newAddress || "");
  if (transfertAddress) {
    const effectDate = formatDateLong(transfertSiege?.date_effet || data?.changeDate || "", lang);
    lines.push(isNl ? "2. Overdracht van maatschappelijke zetel" : "2. Transfert de siège social");
    if (effectDate) {
      lines.push(
        isNl
          ? `De maatschappelijke zetel wordt overgedragen naar ${transfertAddress}, met ingang op ${effectDate}.`
          : `Le siège social est transféré à ${transfertAddress}, avec effet au ${effectDate}.`
      );
    } else {
      lines.push(
        isNl
          ? `De maatschappelijke zetel wordt overgedragen naar ${transfertAddress}.`
          : `Le siège social est transféré à ${transfertAddress}.`
      );
    }
    pushBlank();
  }

  if (demissionnaires.length > 0) {
    const names = demissionnaires.join(", ");
    lines.push(isNl ? "3. Ontslag van de bestuurder" : "3. Démission de l’administrateur");
    if (dateAg) {
      lines.push(
        isNl
          ? `Het ontslag van ${names} uit zijn functie van bestuurder met kwijting van alle aansprakelijkheid zonder voorbehoud, met ingang op ${dateAg}.`
          : `La démission de ${names} de son poste d’administrateur lui donnant décharge de toute responsabilité sans réserve, avec effet au ${dateAg}.`
      );
    } else {
      lines.push(
        isNl
          ? `Het ontslag van ${names} uit zijn functie van bestuurder met kwijting van alle aansprakelijkheid zonder voorbehoud.`
          : `La démission de ${names} de son poste d’administrateur lui donnant décharge de toute responsabilité sans réserve.`
      );
    }
    pushBlank();
  }

  if (nommes.length > 0) {
    const names = nommes.join(", ");
    lines.push(isNl ? "4. Benoeming van een bestuurder" : "4. Nomination d’un administrateur");
    if (dateAg) {
      lines.push(
        isNl
          ? `Deze buitengewone algemene vergadering aanvaardt de benoeming van ${names} tot bestuurder, die aanvaardt, met ingang op ${dateAg}.`
          : `La dite assemblée générale extraordinaire accepte la nomination de ${names} au poste d’administrateur, lequel/laquelle accepte, avec effet au ${dateAg}.`
      );
    } else {
      lines.push(
        isNl
          ? `Deze buitengewone algemene vergadering aanvaardt de benoeming van ${names} tot bestuurder, die aanvaardt.`
          : `La dite assemblée générale extraordinaire accepte la nomination de ${names} au poste d’administrateur, lequel/laquelle accepte.`
      );
    }
    pushBlank();
  }

  if (isNl) {
    lines.push(
      heureFin
        ? `De agenda is uitgeput, de vergadering wordt gesloten om ${heureFin}.`
        : "De agenda is uitgeput, de vergadering wordt gesloten."
    );
  } else {
    lines.push(
      heureFin
        ? `L'ordre du jour étant épuisé, l'assemblée est levée à ${heureFin}.`
        : "L'ordre du jour étant épuisé, l'assemblée est levée."
    );
  }

  pushBlank();
  if (signatairesList.length > 0) {
    lines.push(isNl ? "Handtekeningen:" : "Signatures:");
    signatairesList.forEach((name) => lines.push(`- ${name}`));
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return { part1: lines.join("\n"), part2: "" };
}

async function buildFormulaire1HtmlPage(data, autoprint = false) {

  // Language-aware template selection
  let templatePath;
  if (data.langue === "nl") {
    templatePath = path.resolve("templates-nl", "formulier1-template.html");
    try {
      await fs.access(templatePath);
    } catch {
      templatePath = await resolveHtmlTemplatePath("style3", "formulaire1-template.html");
    }
  } else {
    templatePath = await resolveHtmlTemplatePath("style3", "formulaire1-template.html");
  }
  if (!templatePath) {
    throw new Error("Template formulaire1-template.html introuvable");
  }
  let html = await fs.readFile(templatePath, "utf-8");

  // Format enterprise number: 9 digits → prepend leading 0
  const rawNumber = String(data.enterpriseNumber || "");
  const digits = rawNumber.replace(/\D/g, "");
  const formattedNumber = digits.length === 9 ? "0" + digits : rawNumber;

  // Build action phrase from active services
  const actions = [];
  if (data.services?.cessionParts) actions.push("cession de parts");
  if (data.services?.addressChange) actions.push("transfert de siège social");
  if (data.services?.dirigeants) {
    actions.push("démission administrateur");
    actions.push("nomination d'administrateur");
  }
  let phrase = "";
  if (actions.length > 0) {
    const last = actions.length > 1 ? actions.pop() : "";
    phrase = actions.join(", ") + (last ? " et " + last : "");
    phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    phrase = wordwrapHtml(phrase, 88);
  }

  const he = (v) => String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const toString = (value) => {
    if (Array.isArray(value)) {
      const flattened = value
        .map((item) => (typeof item === "string" || typeof item === "number" || typeof item === "boolean" ? String(item) : ""))
        .filter(Boolean);
      return flattened.join("<br>");
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return "";
  };
  const normalizePubText = (raw) => {
    if (typeof raw === "string") {
      return { part1: raw };
    }
    if (raw && typeof raw === "object") {
      const normalized = {};
      for (const key of ["part1", "part2", "part3", "part4"]) {
        if (Object.prototype.hasOwnProperty.call(raw, key)) {
          normalized[key] = toString(raw[key]);
        }
      }
      if (Object.keys(normalized).length === 0 && Object.keys(raw).length > 0) {
        normalized.part1 = toString(raw);
      }
      return normalized;
    }
    return {};
  };

  html = html.replaceAll("__ENTERPRISE_NUMBER__", he(formattedNumber));
  html = html.replaceAll("__COMPANY_NAME__", he(data.companyName));
  html = html.replaceAll("__LEGAL_FORM__", he(data.legalForm));
  html = html.replaceAll("__ADDR_STREET__", he(data.address?.street));
  html = html.replaceAll("__ADDR_HOUSE_NUMBER__", he(data.address?.houseNumber));
  html = html.replaceAll("__ADDR_BOX__", he(data.address?.box));
  html = html.replaceAll("__ADDR_ZIPCODE__", he(data.address?.postalCode));
  html = html.replaceAll("__ADDR_MUNICIPALITY__", he(data.address?.municipality));
  html = html.replaceAll("__ADDR_COUNTRY__", he(data.address?.country || ""));
  html = html.replaceAll("__PHRASE__", phrase); // raw – may contain <br>

  const pubText = normalizePubText(data.pubText);
  const hasPart1 = Boolean(pubText?.part1 && String(pubText.part1).trim());
  const hasPart2 = Boolean(pubText?.part2 && String(pubText.part2).trim());
  if (!hasPart1) {
    html = html.replace(/<style>[\s\S]*?<\/style>\s*/i, "");
  }
  if (!hasPart2) {
    html = html.replace(
      /<div id="pf3"[^>]*data-page-no="3"[^>]*>[\s\S]*?<div class="pi"[^>]*><\/div><\/div>/g,
      ""
    );
  }

  const attestationIdentifier = toScalarString(data.attestation?.identifier ?? data.attestationIdentifier);
  const pubTextPrefix = attestationIdentifier ? `${attestationIdentifier} ` : "";
  html = html.replaceAll("__PUB_TEXT_PART1__", `${pubTextPrefix}${pubText.part1 || ""}`);
  html = html.replaceAll("__PUB_TEXT_PART2__", pubText.part2 || "");
  html = html.replaceAll("__USER_FIRST_NAME__", he(data.userFirstName));
  html = html.replaceAll("__USER_LAST_NAME__", he(data.userLastName));
  html = html.replaceAll("__FAIT_A__", he(data.faitA));
  html = html.replaceAll("__DATE_ASSEMBLEE__", he(formatDateNumeric(data.dateAssemblee)));

  if (autoprint) {
    html = html.replace("</body>", '<script>window.onload=function(){window.print();}</script></body>');
  }

  return html;
}

async function buildFormulaire2HtmlPage(data, autoprint = false) {
  const templatePath = await resolveHtmlTemplatePath("style4", "formulaire2-template.html");
  if (!templatePath) throw new Error("Template formulaire2-template.html introuvable");

  let html = await fs.readFile(templatePath, "utf-8");
  const he = (v) => String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const replaceOnce = (source, search, replacement) => {
    const index = source.indexOf(search);
    if (index === -1) return source;
    return source.slice(0, index) + replacement + source.slice(index + search.length);
  };
  const toString = toScalarString;
  const isDeleted = (user) => {
    let raw = null;
    if (user && typeof user === "object") {
      raw = user.is_deleted ?? user.isDeleted ?? null;
    }
    if (raw === null || raw === undefined) return false;
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw === 1;
    const normalized = String(raw).trim().toLowerCase();
    return ["1", "true", "yes", "y"].includes(normalized);
  };

  const rawNumber = String(data.enterpriseNumber || "");
  const digits = rawNumber.replace(/\D/g, "");
  const formattedNumber = digits.length === 9 ? "0" + digits : rawNumber;

  const currentCompanyName = he(toString(data.companyName || ""));
  const newCompanyName = he(toString(data.newCompanyName || ""));
  const sigle = he(toString(data.sigle || ""));

  html = html.replaceAll("__ENTERPRISE_NUMBER__", he(formattedNumber));
  html = replaceOnce(html, "__COMPANY_NAME__", currentCompanyName);
  html = replaceOnce(html, "__COMPANY_NAME__", newCompanyName);
  html = replaceOnce(html, "__COMPANY_NAME__", sigle);
  html = html.replaceAll("__LEGAL_FORM__", he(toString(data.legalForm || "")));
  html = html.replaceAll("__CAPITAL_CURRENCY__", he(toString(data.capitalCurrency || "")));
  html = html.replaceAll("__CAPITAL_AMOUNT__", he(toString(data.capitalAmount || "")));
  html = html.replaceAll("__FISCAL_YEAR_END_DAY__", he(toString(data.fiscalYearEndDay || "")));
  html = html.replaceAll("__FISCAL_YEAR_END_MONTH__", he(toString(data.fiscalYearEndMonth || "")));
  html = html.replaceAll("__ANNUAL_MEETING_MONTH__", he(toString(data.annualMeetingMonth || "")));
  html = html.replaceAll("__DATE_CONSTITUTION__", he(formatDateNumeric(toString(data.dateConstitution || ""))));
  html = html.replaceAll("__ADDRESS__", he(toString(data.companyAddress || "")));
  html = html.replaceAll("__ADDR_STREET__", he(toString(data.addrStreet || "")));
  html = html.replaceAll("__ADDR_HOUSE_NUMBER__", he(toString(data.addrHouseNumber || "")));
  html = html.replaceAll("__ADDR_BOX__", he(toString(data.addrBox || "")));
  html = html.replaceAll("__ADDR_ZIPCODE__", he(toString(data.addrZipcode || "")));
  html = html.replaceAll("__ADDR_MUNICIPALITY__", he(toString(data.addrMunicipality || "")));
  html = html.replaceAll("__ADDR_COUNTRY__", he(toString(data.addrCountry || "")));
  html = html.replaceAll("__FAIT_A__", he(data.faitA || ""));
  html = html.replaceAll("__DATE_ASSEMBLEE__", he(formatDateNumeric(data.dateAssemblee || "")));

  const users = Array.isArray(data.users)
    ? data.users.filter((user) => {
        const fn = toString(user?.function ?? user?.fonction ?? "");
        if (String(fn).trim().toLowerCase() === "actionnaire") {
          return false;
        }
        return !isDeleted(user);
      })
    : [];
  const assembleeDateStr = he(formatDateNumeric(data.dateAssemblee || ""));
  const checkboxCHtml = 'C <span class="xmark" style="left:-38px;">&#x2716;</span>';
  const checkboxNHtml = 'N <span class="xmark" style="left:-38px;">&#x2716;</span>';
  for (let i = 1; i <= 5; i++) {
    const u = users[i - 1] || {};
    const userName = toString(u.name ?? u.nom ?? "");
    const userId = toString(u.idNumber ?? u.id_number ?? "");
    const userFunction = toString(u.function ?? u.fonction ?? "");
    html = html.replaceAll(`__USER_${i}_NAME__`, he(userName));
    html = html.replaceAll(`__USER_${i}_ID__`, he(userId));
    html = html.replaceAll(`__USER_${i}_FUNCTION__`, he(userFunction));
    html = html.replaceAll(`__USER_${i}_DATE__`, userName ? assembleeDateStr : "");
    html = html.replaceAll(`__USER_${i}_CHECKBOX__`, userName ? checkboxCHtml : "");
    html = html.replaceAll(`__USER_${i}_NCHECKBOX__`, userName ? checkboxNHtml : "");
  }

  // Replace signatory pattern "__TOKEN__ __TOKEN__ agissant" with the depositaire name
  const signatoryName = he(data.signatoryName || data.depositaireName || "");
  html = html.replace(/__TOKEN__\s+__TOKEN__\s+agissant/g, `${signatoryName} agissant`);

  // Replace "le __TOKEN__" (signing date line) with the assembly date
  const dateStr = he(formatDateNumeric(data.dateAssemblee || ""));
  html = html.replace(/le\s+__TOKEN__/g, `le ${dateStr}`);

  // Replace email __TOKEN__
  html = html.replace(/Adresse e-m<[^>]*>ail[^>]*>\s*\(6\)\s*:\s*__TOKEN__/g,
    `Adresse e-mail (6) : ${he(data.userEmail || "")}`);

  const branchStreet = he(data.branchStreet || "");
  const branchHouseNumber = he(data.branchHouseNumber || "");
  const branchBox = he(data.branchBox || "");
  const branchZipcode = he(data.branchZipcode || "");
  const branchMunicipality = he(data.branchMunicipality || "");
  html = html.replace(/Rue\s*:\s*__TOKEN__/, `Rue :  ${branchStreet}`);
  html = html.replace(/N°\s*:\s*__TOKEN__/, `N° :   ${branchHouseNumber}`);
  html = html.replace(/Boîte\s*<span class="ls3">:\s*__TOKEN__/, `Boîte <span class="ls3">:  ${branchBox}`);
  html = html.replace(/postal\s*:\s*__TOKEN__/, `postal :  ${branchZipcode}`);
  html = html.replace(/calité\s*:\s*__TOKEN__/, `calité :  ${branchMunicipality}`);

  const cessationName1 = he(data.cessationName1 || "");
  const cessationNumber1 = he(data.cessationNumber1 || "");
  const cessationName2 = he(data.cessationName2 || "");
  const cessationNumber2 = he(data.cessationNumber2 || "");
  const cessationName3 = he(data.cessationName3 || "");
  const cessationNumber3 = he(data.cessationNumber3 || "");
  html = html.replace(
    'Nom : <span class="ff7 fs4">',
    `Nom : ${cessationName1}<span class="ff7 fs4">`,
  );
  html = html.replace(
    'N° d’entreprise<span class="_ _0"></span><span class="ff3"> : <span class="ff7 fs4">',
    `N° d’entreprise<span class="_ _0"></span><span class="ff3"> : ${cessationNumber1}<span class="ff7 fs4">`,
  );
  html = replaceOnce(
    html,
    'Nom </span>: <span class="ls0"> </span>',
    `Nom </span>: <span class="ls0">${cessationName2}</span>`,
  );
  html = replaceOnce(
    html,
    'N° d’entreprise<span class="_ _0"></span><span class="ff3"> </span></span>: <span class="ls0"> </span>',
    `N° d’entreprise<span class="_ _0"></span><span class="ff3"> </span></span>: <span class="ls0">${cessationNumber2}</span>`,
  );
  html = replaceOnce(
    html,
    'Nom </span>: <span class="ls0"> </span>',
    `Nom </span>: <span class="ls0">${cessationName3}</span>`,
  );
  html = replaceOnce(
    html,
    'N° d’entreprise<span class="_ _0"></span><span class="ff3"> </span></span>: <span class="ls0"> </span>',
    `N° d’entreprise<span class="_ _0"></span><span class="ff3"> </span></span>: <span class="ls0">${cessationNumber3}</span>`,
  );

  // Blank out all remaining __TOKEN__ (succursale, dissolution, liquidation, registre, site web, etc.)
  html = html.replaceAll("__TOKEN__", "");

  if (autoprint) {
    html = html.replace("</body>", '<script>window.onload=function(){window.print();}</script></body>');
  }
  return html;
}

async function buildAttestation1HtmlPage(data, autoprint = false) {
  // Language-aware template selection
  let templatePath;
  if (data.langue === "nl") {
    templatePath = path.resolve("templates-nl", "attestation1-template.html");
    try {
      await fs.access(templatePath);
    } catch {
      templatePath = await resolveHtmlTemplatePath("style5", "attestation1-template.html");
    }
  } else {
    templatePath = await resolveHtmlTemplatePath("style1", "attestation1-template.html");
    if (!templatePath) {
      templatePath = await resolveHtmlTemplatePath("style5", "attestation1-template.html");
    }
  }
  if (!templatePath) throw new Error("Template attestation1-template.html introuvable");
  let html = await fs.readFile(templatePath, "utf-8");
  const he = escapeHtml;
  const attestation = data.attestation || {};
  const cleanAttestationValue = (value, fallback = "") => {
    if (typeof value !== "string") {
      return value ?? fallback;
    }
    const normalized = String(value ?? "").trim();
    if (
      !normalized ||
      normalized.toLowerCase().includes("_token_") ||
      normalized.toLowerCase().includes("__token__") ||
      /__+[A-Z0-9_]+__+/i.test(normalized)
    ) {
      return fallback;
    }
    return normalized;
  };
  const normalizedAttestation = { ...attestation };
  for (const key of ["phone_number", "autre_modification_value", "agissant_societe", "agissant_societe_asbl", "qualite"]) {
    if (Object.prototype.hasOwnProperty.call(attestation, key)) {
      normalizedAttestation[key] = cleanAttestationValue(attestation[key], "");
    }
  }
  const hasField = (key) =>
    Object.prototype.hasOwnProperty.call(attestation, key) && attestation[key] !== null && attestation[key] !== undefined;
  const checkboxChecked = "☑";
  const checkboxEmpty = "☐";
  const checkboxConstitution = hasField("constitution") ? checkboxChecked : checkboxEmpty;
  const checkboxNomination = hasField("nomination") ? checkboxChecked : checkboxEmpty;
  const checkboxDemission = hasField("demission") ? checkboxChecked : checkboxEmpty;
  const checkboxTransfert = hasField("transfert") ? checkboxChecked : checkboxEmpty;
  const checkboxAutre = hasField("autre_modification") ? checkboxChecked : checkboxEmpty;
  const replaceTokenWithDots = (source, token, value) => {
    const normalized = cleanAttestationValue(value, "");
    if (normalized) {
      const escaped = he(normalized);
      const pattern = new RegExp(`${token}\\s*\\.{5,}`, "g");
      return source.replace(pattern, escaped).replaceAll(token, escaped);
    }
    return source.replaceAll(token, "");
  };
  const fallbackName = "………………………………………………………………………………………";
  const fullName = cleanAttestationValue(normalizedAttestation.company_name ?? "", "");
  html = html.replaceAll("__FIRST_NAME__", he(fullName || fallbackName));
  html = html.replaceAll("__LAST_NAME__", "");
  html = replaceTokenWithDots(html, "__DATE_OF_BIRTH__", normalizedAttestation?.company_names?.[0]?.start_date);
  html = replaceTokenWithDots(html, "__PLACE_OF_BIRTH__", normalizedAttestation?.addresses?.[0]?.municipality);
  html = replaceTokenWithDots(html, "__NATIONAL_ID__", normalizedAttestation?.identifier);
  html = replaceTokenWithDots(html, "__ADDRESS_FULL__", normalizedAttestation?.domicilie);
  html = replaceTokenWithDots(html, "__PHONE__", normalizedAttestation?.phone_number);
  html = replaceTokenWithDots(html, "__AGISSANT_SOCIETE__", normalizedAttestation?.agissant_societe);
  html = replaceTokenWithDots(html, "__AGISSANT_SOCIETE_ASBL__", normalizedAttestation?.agissant_societe_asbl);
  html = replaceTokenWithDots(html, "__FUNCTION__", normalizedAttestation?.qualite);
  html = replaceTokenWithDots(html, "__OTHER_MODIFICATION__", normalizedAttestation?.autre_modification_value);
  html = replaceTokenWithDots(html, "__DATE_ASSEMBLEE__", normalizedAttestation?.en_date_du);
  html = html.replaceAll("__CHECKBOX_CONSTITUTION__", checkboxConstitution);
  html = html.replaceAll("__CHECKBOX_NOMINATION__", checkboxNomination);
  html = html.replaceAll("__CHECKBOX_DEMISSION__", checkboxDemission);
  html = html.replaceAll("__CHECKBOX_TRANSFERT__", checkboxTransfert);
  html = html.replaceAll("__CHECKBOX_AUTRE__", checkboxAutre);
  html = html.replaceAll("__TOKEN__", "");

  if (autoprint) {
    html = html.replace("</body>", '<script>window.onload=function(){window.print();}</script></body>');
  }
  return html;
}

async function buildDeclarationHtmlPage(data, autoprint = false) {
  const templatePath = await resolveHtmlTemplatePath("style2", "declaration-template.html");
  if (!templatePath) throw new Error("Template declaration-template.html introuvable");

  let html = await fs.readFile(templatePath, "utf-8");
  const he = (v) => String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const rawNumber = String(data.enterpriseNumber || "");
  const digits = rawNumber.replace(/\D/g, "");
  const formattedNumber = digits.length === 9 ? "0" + digits : rawNumber;

  html = html.replaceAll("__ENTERPRISE_NUMBER__", he(formattedNumber));
  html = html.replaceAll("__COMPANY_NAME__", he(data.companyName || ""));
  html = html.replaceAll("__LEGAL_FORM__", he(data.legalForm || ""));
  html = html.replaceAll("__ADDRESS__", he(data.companyAddress || ""));
  html = html.replaceAll("__SIGNATORY_NAME__", he(data.signatoryName || ""));
  html = html.replaceAll("__FAIT_A__", he(data.faitA || ""));
  html = html.replaceAll("__DATE_ASSEMBLEE__", he(formatDateNumeric(data.dateAssemblee || "")));

  const dirigeants = data.dirigeants || [];
  for (let i = 1; i <= 3; i++) {
    const d = dirigeants[i - 1] || {};
    html = html.replaceAll(`__DIRIGEANT_${i}_NAME__`, he(d.name || ""));
    html = html.replaceAll(`__DIRIGEANT_${i}_ID__`, he(d.idNumber || ""));
    html = html.replaceAll(`__DIRIGEANT_${i}_FUNCTION__`, he(d.function || ""));
  }

  if (autoprint) {
    html = html.replace("</body>", '<script>window.onload=function(){window.print();}</script></body>');
  }
  return html;
}

function buildPvAssembleeGeneraleHtmlPage(data, autoprint = false) {
  const lang = String(data.lang || "fr").toLowerCase();
  const demandeLang = String(data.demandeLang || lang).toLowerCase();
  const meetingDate = formatDateLong(data.dateAssemblee || data.changeDate || "", demandeLang);
  const formJuridique = escapeHtml(data.formJuridique || "");
  const denomination = escapeHtml(data.denomination || "");
  const street = escapeHtml(data.street || "");
  const houseNumber = escapeHtml(data.houseNumber || "");
  const zipcode = escapeHtml(data.zipcode || "");
  const municipality = escapeHtml(data.municipality || "");
  const services = data.services || {};
  const parts = [];
  if (services.cessionParts) {
    parts.push(demandeLang === "nl" ? "Overdracht van aandelen" : "Cession de parts");
  }
  if (services.addressChange) {
    parts.push(demandeLang === "nl" ? "Zetelverplaatsing" : "Transfert de siège social");
  }
  if (services.dirigeants) {
    parts.push(demandeLang === "nl" ? "Ontslag en benoeming van bestuurder" : "Démission et nomination d’administrateur");
  }
  const servicesTitle = parts.length > 0 ? `<h3>${escapeHtml(parts.join(", "))}</h3>` : "";
  const pubTextRaw = String(data.pubText || "");
  const pubTextHtml = escapeHtml(pubTextRaw).replace(/\r\n|\r|\n/g, "<br>");
  const dirigeants = Array.isArray(data.dirigeants) ? data.dirigeants : [];
  const dirigeantsHtml = dirigeants
    .map((dirigeant) => {
      const givenName = escapeHtml(dirigeant?.givenName || "");
      const surname = escapeHtml(dirigeant?.surname || "");
      const roleLabel = demandeLang === "nl" ? "Bestuurder" : "Administrateur";
      return `        <div class="text-center">
            <div>
                ${givenName} ${surname}<br>
                ${roleLabel}
            </div>
            <div></div>
        </div>`;
    })
    .join("");
  const meetingTitle =
    demandeLang === "nl"
      ? `Proces-verbaal van de buitengewone algemene vergadering van ${meetingDate}`
      : `Procès-verbal de l’assemblée générale extraordinaire du ${meetingDate}`;
  const autoprintScript = autoprint ? "\n<script>window.print();</script>" : "";
  let html = `<!DOCTYPE html>
<html lang="__LANG__">
<head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/png" href="/favicon_new.ico">

    <title>Legakte</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        h1, h2, h3 { text-align: center; }
        .signature { margin-top: 60px; display: flex; justify-content: space-between; }
        .signature div { text-align: center; }
    </style>
</head>
<body>
    <p>
        __FORM_JURIDIQUE__
        « __DENOMINATION__ »<br>
        __STREET__
        __HOUSE_NUMBER__<br>
        __ZIPCODE__
        __MUNICIPALITY__
    </p>

    <h3>
        __MEETING_TITLE__
    </h3>

    __SERVICES_TITLE__

    <p>__PUB_TEXT__</p>

<div class="signature d-flex justify-content-between">
__DIRIGEANTS__
</div>
</body>__AUTOPRINT_SCRIPT__

</html>`;
  html = html.replaceAll("__LANG__", lang || "fr");
  html = html.replaceAll("__FORM_JURIDIQUE__", formJuridique);
  html = html.replaceAll("__DENOMINATION__", denomination);
  html = html.replaceAll("__STREET__", street);
  html = html.replaceAll("__HOUSE_NUMBER__", houseNumber);
  html = html.replaceAll("__ZIPCODE__", zipcode);
  html = html.replaceAll("__MUNICIPALITY__", municipality);
  html = html.replaceAll("__MEETING_TITLE__", escapeHtml(meetingTitle));
  html = html.replaceAll("__SERVICES_TITLE__", servicesTitle);
  html = html.replaceAll("__PUB_TEXT__", pubTextHtml);
  html = html.replaceAll("__DIRIGEANTS__", dirigeantsHtml);
  html = html.replaceAll("__AUTOPRINT_SCRIPT__", autoprintScript);
  return html;
}

function drawWrappedOnPage(page, font, text, x, y, fontSize, maxWidth, maxLines = 2) {
  const safeText = String(text || "").trim();
  if (!safeText) {
    return;
  }

  const lines = wrapPdfLines(safeText, font, fontSize, maxWidth).slice(0, Math.max(1, maxLines));
  let cursorY = y;
  for (const line of lines) {
    if (!line) {
      continue;
    }
    page.drawText(line, {
      x,
      y: cursorY,
      size: fontSize,
      font,
      color: rgb(0.05, 0.1, 0.2),
      maxWidth,
      lineHeight: fontSize + 2,
    });
    cursorY -= fontSize + 2;
  }
}

function getTemplatePlacements(documentKey, payload) {
  const common = {
    enterpriseNumber: String(payload.enterpriseNumber || ""),
    companyName: String(payload.companyName || ""),
    legalForm: String(payload.legalForm || ""),
    companyAddress: String(payload.companyAddress || ""),
    newAddress: String(payload.newAddress || ""),
    changeDate: String(payload.changeDate || ""),
    agDate: String(payload.agDate || ""),
    depositaireName: String(payload.depositaireName || ""),
    depositaireFunction: String(payload.depositaireFunction || ""),
    userName: String(payload.userName || ""),
    userEmail: String(payload.userEmail || ""),
  };

  const byDocument = {
    "formulaire1entr": [
      // Page 0 — Volet A/B identification section
      { page: 0, x: 270, y: 611, size: 9, maxWidth: 110, maxLines: 1, text: common.enterpriseNumber },
      { page: 0, x: 200, y: 593, size: 9, maxWidth: 355, maxLines: 2, text: common.companyName },
      { page: 0, x: 237, y: 548, size: 9, maxWidth: 315, maxLines: 1, text: common.legalForm },
      { page: 0, x: 219, y: 521, size: 8, maxWidth: 355, maxLines: 1, text: common.companyAddress },
      // Page 1 — Volet B publication copy (Moniteur belge)
      { page: 1, x: 222, y: 648, size: 9, maxWidth: 110, maxLines: 1, text: common.enterpriseNumber },
      { page: 1, x: 222, y: 625, size: 9, maxWidth: 330, maxLines: 1, text: common.companyName },
      { page: 1, x: 222, y: 598, size: 9, maxWidth: 330, maxLines: 1, text: common.legalForm },
      { page: 1, x: 222, y: 581, size: 9, maxWidth: 330, maxLines: 1, text: common.companyAddress },
      { page: 1, x: 192, y: 554, size: 9, maxWidth: 380, maxLines: 1, text: common.agDate },
      { page: 1, x: 120, y: 537, size: 9, maxWidth: 440, maxLines: 1, text: common.newAddress },
      { page: 1, x: 120, y: 526, size: 9, maxWidth: 440, maxLines: 1, text: common.changeDate },
    ],
    "formulaire2entr": [
      { page: 0, x: 245, y: 108, size: 10, maxWidth: 230, maxLines: 1, text: common.enterpriseNumber },
      { page: 0, x: 165, y: 84, size: 10, maxWidth: 340, maxLines: 2, text: common.companyName },
      { page: 0, x: 165, y: 60, size: 9, maxWidth: 340, maxLines: 2, text: common.newAddress },
      { page: 0, x: 180, y: 36, size: 9, maxWidth: 220, maxLines: 1, text: common.changeDate },
    ],
    "attestation-identite": [
      { page: 0, x: 180, y: 626, size: 10, maxWidth: 340, maxLines: 2, text: common.companyName },
      { page: 0, x: 180, y: 595, size: 10, maxWidth: 220, maxLines: 1, text: common.enterpriseNumber },
      { page: 0, x: 180, y: 468, size: 9, maxWidth: 340, maxLines: 2, text: common.depositaireName },
      { page: 0, x: 180, y: 442, size: 9, maxWidth: 340, maxLines: 2, text: common.depositaireFunction },
      { page: 0, x: 180, y: 318, size: 9, maxWidth: 340, maxLines: 2, text: `${common.userName} - ${common.userEmail}` },
    ],
  };

  return byDocument[documentKey] || [];
}

async function createTemplateOverlayPdf(templateFileName, documentKey, payload) {
  const templatePath = await resolveTemplateFilePath(templateFileName);
  if (!templatePath) {
    throw new Error(`Template introuvable: ${templateFileName}`);
  }

  const templateBytes = await fs.readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const placements = getTemplatePlacements(documentKey, payload);
  for (const placement of placements) {
    const page = pdfDoc.getPage(Math.max(0, Math.min(placement.page, pdfDoc.getPageCount() - 1)));
    drawWrappedOnPage(
      page,
      font,
      placement.text,
      placement.x,
      placement.y,
      placement.size,
      placement.maxWidth,
      placement.maxLines,
    );
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

function wrapPdfLines(text, font, fontSize, maxWidth) {
  const lines = [];
  const paragraphs = String(text || "").split(/\n/);

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);

      if (width <= maxWidth || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    lines.push(currentLine);
  }

  return lines;
}

async function createPdfDocumentFromText(title, bodyText) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const titleSize = 14;
  const bodySize = 11;
  const lineHeight = 16;
  const maxWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText(String(title || "Document Aktly Lite"), {
    x: margin,
    y,
    size: titleSize,
    font: boldFont,
    color: rgb(0.08, 0.14, 0.24),
  });
  y -= 26;

  const lines = wrapPdfLines(bodyText, font, bodySize, maxWidth);
  for (const line of lines) {
    if (y < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    if (line) {
      page.drawText(line, {
        x: margin,
        y,
        size: bodySize,
        font,
        color: rgb(0.07, 0.09, 0.12),
      });
    }

    y -= lineHeight;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

async function buildDossierDocument(documentKey, body) {
  const companyData = body?.company_data || {};
  const addressInfo = body?.address_info || {};
  const depositaire = body?.depositaire || {};
  const user = body?.user || {};
  const payment = body?.payment || {};

  const lang = companyData?.lang_entre || "fr";
  const docLang = String(body?.file_language || lang).toLowerCase();
  const companyNameDisplay =
    safeValue(companyData?.company_name, "") ||
    safeValue(readDescriptionValue(companyData?.denomination?.[0]?.description, docLang), "");
  const enterpriseNumberDisplay = safeValue(companyData?.number, "");
  const legalFormDisplay =
    readDescriptionValue(companyData?.enterprise?.legalFormDescriptions, docLang) ||
    translateLegalForm(
      safeValue(companyData?.enterprise?.legalForm, "") ||
        safeValue(companyData?.legalForm, "") ||
        safeValue(companyData?.juridicalForm, "") ||
        safeValue(companyData?.juridicalSituation?.legalForm, ""),
      docLang
    );
  const companyAddressDisplay =
    safeValue(companyData?.address, "") ||
    safeValue(companyData?.addresses?.[0]?.full, "");
  const companyName = safeValue(companyNameDisplay, "Non renseigne");
  const enterpriseNumber = safeValue(enterpriseNumberDisplay, "Non renseigne");
  const legalForm = safeValue(legalFormDisplay, "Non renseigne");
  const companyAddress = safeValue(companyAddressDisplay, "Non renseignee");
  const status = safeValue(companyData?.juridicalSituation?.status?.description?.[0]?.value, "Non renseigne");
  const changeDateDisplay = safeValue(addressInfo?.dateChangement, "");
  const agDateDisplay = safeValue(addressInfo?.dateAssembleeGenerale, "");
  const changeDate = safeValue(changeDateDisplay, "Non renseignee");
  const agDate = safeValue(agDateDisplay, "Non renseignee");
  const newStreet = `${String(addressInfo?.rue || "").trim()} ${String(addressInfo?.numero || "").trim()}`.trim();
  const newBox = String(addressInfo?.boite || "").trim();
  const newPostal = String(addressInfo?.codePostal || "").trim();
  const newCity = String(addressInfo?.commune || "").trim();
  const newAddressLine = `${newStreet}${newBox ? ` boite ${newBox}` : ""}`.trim();
  const newAddressDisplay = `${newAddressLine} - ${newPostal} ${newCity}`.trim();
  const newAddress = safeValue(newAddressDisplay, "Non renseignee");
  const depositaireName = pickDepositaireName(depositaire);
  const depositaireFunction = safeValue(
    depositaire?.dirigeant?.function || depositaire?.dirigeant?.role || depositaire?.role,
    "Non renseignee",
  );
  const depositaireType = safeValue(depositaire?.depositaire_type, "Non renseigne");
  const userName = safeValue(user?.name, "Non renseigne");
  const userEmail = safeValue(user?.email, "Non renseigne");
  const pack = safeValue(payment?.pack?.slug, "Non renseigne");
  const credits = safeValue(payment?.pack?.credits, "0");
  const fileTimestamp = formatNowForFileName();
  const attestationInput =
    (body?.attestation && typeof body.attestation === "object" ? body.attestation : null) ||
    (body?.attestation_data && typeof body.attestation_data === "object" ? body.attestation_data : null) ||
    (body?.attestationData && typeof body.attestationData === "object" ? body.attestationData : null) ||
    {};
  const attestationData =
    attestationInput?.data && typeof attestationInput.data === "object" ? attestationInput.data : {};
  const attestationForForms = { ...attestationData, ...attestationInput };
  delete attestationForForms.data;
  if (!attestationForForms.company_name && companyNameDisplay) {
    attestationForForms.company_name = companyNameDisplay;
  }
  if (!attestationForForms.identifier && enterpriseNumberDisplay) {
    attestationForForms.identifier = enterpriseNumberDisplay;
  }
  const attestationForIdentity = Object.keys(attestationData).length ? attestationData : attestationForForms;

  const header = [
    "Aktly Lite - Document pre-rempli",
    `Generation: ${formatNowForHeader()}`,
    "",
  ].join("\n");

  const common = [
    `Entreprise: ${companyName}`,
    `Numero BCE: ${enterpriseNumber}`,
    `Forme juridique: ${legalForm}`,
    `Statut: ${status}`,
    `Adresse BCE actuelle: ${companyAddress}`,
    `Nouvelle adresse: ${newAddress}`,
    `Date changement: ${changeDate}`,
    `Date AG: ${agDate}`,
    `Depositaire: ${depositaireName} (${depositaireFunction})`,
    `Type depositaire: ${depositaireType}`,
    `Utilisateur: ${userName} - ${userEmail}`,
    `Pack: ${pack} - Credits: ${credits}`,
    "",
  ].join("\n");

  const documents = {
    "formulaire1entr": `${header}FORMULAIRE 1 - MODIFICATION ENTREPRISE\n\n${common}`,
    "formulaire2entr": `${header}FORMULAIRE 2 - DONNEES COMPLEMENTAIRES\n\n${common}`,
    "attestation-identite": `${header}ATTESTATION D'IDENTITE - MODELE 1\n\n${common}`,
    "pv-assemblee-generale": `${header}PROCES-VERBAL DE L'ASSEMBLEE GENERALE\n\n${common}Resolution\nL'assemblee generale de ${companyName} decide de transferer le siege social a ${newAddress}.\nLa decision prend effet a la date du ${changeDate}.\n`,
  };

  if (documentKey === "formulaire1entr") {
    const defaultCountry = lang === "nl" ? "België" : "Belgique";
    let address = companyData?.addresses?.[0] || {};
    // Fallback: if postalCode/municipality missing, parse from full address string
    if (!address.postalCode && !address.municipality && companyAddressDisplay) {
      const parsed = parseAddressParts(companyAddressDisplay);
      address = {
        street: address.street || parsed.street,
        houseNumber: address.houseNumber || parsed.houseNumber,
        box: address.box || parsed.box,
        postalCode: parsed.postalCode,
        municipality: parsed.municipality,
        country: address.country || parsed.country || defaultCountry,
      };
    }
    if (!address.country) {
      address.country = defaultCountry;
    }
    const pubText = body?.pub_text ?? null;

    const services = {
      cessionParts: Boolean(body?.cession_parts_service),
      addressChange: Boolean(body?.address_service),
      dirigeants: Boolean(body?.dirigeants_service),
    };

    const autoprint = String(body?.autoprint || "").toLowerCase() === "true" || body?.autoprint === 1;
    const dateForPv = agDateDisplay || changeDateDisplay;

    const htmlContent = await buildFormulaire1HtmlPage({
      enterpriseNumber: enterpriseNumberDisplay,
      companyName: companyNameDisplay,
      legalForm: legalFormDisplay,
      address: {
        street: address.street || "",
        houseNumber: address.houseNumber || "",
        box: address.box || "",
        postalCode: address.postalCode || "",
        municipality: address.municipality || "",
        country: address.country || "Belgique",
      },
      newAddress: {
        street: newStreet,
        postalCode: newPostal,
        municipality: newCity,
      },
      pubText,
      attestation: attestationForForms,
      services,
      userFirstName: String(depositaire?.dirigeant?.given_name || user?.given_name || "").trim(),
      userLastName: String(depositaire?.dirigeant?.nom || user?.nom || user?.name || "").trim(),
      faitA: newCity || String(addressInfo?.commune || "").trim(),
      dateAssemblee: dateForPv,
      changeDate,
      depositaireName,
      autoprint,
    });

    return {
      fileName: `formulaire1entr-${fileTimestamp}.html`,
      mimeType: "text/html; charset=utf-8",
      content: Buffer.from(htmlContent, "utf-8"),
    };
  }

  if (documentKey === "formulaire2entr") {
    const autoprint = String(body?.autoprint || "").toLowerCase() === "true" || body?.autoprint === 1;
    const demandeAddress = addressInfo || {};
    const defaultCountry = lang === "nl" ? "België" : "Belgique";
    const pickValue = (...values) => {
      for (const value of values) {
        const normalized = toScalarString(value).trim();
        if (normalized) return normalized;
      }
      return "";
    };
    const financialData = companyData?.financialData || {};
    const capital = companyData?.capital || {};
    const users = (body?.users || depositaire?.users || []).map((u) => ({
      name: String(u?.name || u?.nom || "").trim(),
      idNumber: String(u?.idNumber || u?.id_number || "").trim(),
      function: String(u?.function || u?.fonction || "").trim(),
    }));
    // Add depositaire as first user if no users provided
    if (users.length === 0 && depositaireName) {
      users.push({ name: depositaireName, idNumber: "", function: depositaireFunction });
    }

    const htmlContent = await buildFormulaire2HtmlPage({
      enterpriseNumber: enterpriseNumberDisplay,
      companyName: companyNameDisplay,
      newCompanyName: pickValue(attestationForForms?.company_name, attestationForForms?.companyName),
      sigle: pickValue(attestationForForms?.sigle),
      legalForm: legalFormDisplay,
      companyAddress: companyAddressDisplay,
      addrStreet: pickValue(demandeAddress?.rue, demandeAddress?.street),
      addrHouseNumber: pickValue(demandeAddress?.numero, demandeAddress?.houseNumber),
      addrBox: pickValue(demandeAddress?.box, demandeAddress?.boite),
      addrZipcode: pickValue(demandeAddress?.zip_code, demandeAddress?.postalCode, demandeAddress?.codePostal),
      addrMunicipality: pickValue(demandeAddress?.localite, demandeAddress?.municipality, demandeAddress?.commune),
      addrCountry: pickValue(demandeAddress?.pays, demandeAddress?.country, defaultCountry),
      branchStreet: pickValue(attestationForForms?.rue2, attestationForForms?.street2),
      branchHouseNumber: pickValue(attestationForForms?.n2, attestationForForms?.numero2, attestationForForms?.houseNumber2),
      branchBox: pickValue(attestationForForms?.boite2, attestationForForms?.box2),
      branchZipcode: pickValue(attestationForForms?.code_postal2, attestationForForms?.postalCode2, attestationForForms?.zip_code2),
      branchMunicipality: pickValue(attestationForForms?.localite2, attestationForForms?.municipality2),
      cessationName1: "",
      cessationNumber1: "",
      cessationName2: "",
      cessationNumber2: "",
      cessationName3: "",
      cessationNumber3: "",
      capitalCurrency: String(capital?.currency || "EUR"),
      capitalAmount: String(capital?.amount || ""),
      fiscalYearEndDay: String(financialData?.fiscalYearEndDay || ""),
      fiscalYearEndMonth: String(financialData?.fiscalYearEndMonth || ""),
      annualMeetingMonth: String(financialData?.annualMeetingMonth || ""),
      dateConstitution: String(companyData?.enterprise?.startDate || ""),
      faitA: newCity || String(addressInfo?.commune || "").trim(),
      dateAssemblee: agDateDisplay || changeDateDisplay,
      depositaireName,
      signatoryName: depositaireName,
      userEmail: String(user?.email || ""),
      users,
      autoprint,
    });

    return {
      fileName: `formulaire2entr-${fileTimestamp}.html`,
      mimeType: "text/html; charset=utf-8",
      content: Buffer.from(htmlContent, "utf-8"),
    };
  }

  if (documentKey === "attestation-identite") {
    const autoprint = String(body?.autoprint || "").toLowerCase() === "true" || body?.autoprint === 1;
    // Utiliser la même logique de fallback que les autres documents
    const lang = companyData?.lang_entre || "fr";
    const docLang = String(body?.file_language || lang).toLowerCase();
    const normalizedCompanyName =
      safeValue(companyData?.company_name, "") ||
      safeValue(readDescriptionValue(companyData?.denomination?.[0]?.description, docLang), "") ||
      "Non renseigne";
    const normalizedEnterpriseNumber = safeValue(companyData?.number, "Non renseigne");
    const normalizedLegalForm =
      readDescriptionValue(companyData?.enterprise?.legalFormDescriptions, docLang) ||
      translateLegalForm(safeValue(companyData?.enterprise?.legalForm, "") || safeValue(companyData?.legalForm, "") || safeValue(companyData?.juridicalForm, "") || safeValue(companyData?.juridicalSituation?.legalForm, ""), docLang) ||
      "Non renseigne";
    const normalizedCompanyAddress =
      safeValue(companyData?.address, "") ||
      safeValue(companyData?.addresses?.[0]?.full, "") ||
      "Non renseignee";
    const normalizedDepositaireName = pickDepositaireName(depositaire);
    const normalizedDepositaireFunction = safeValue(
      depositaire?.dirigeant?.function || depositaire?.dirigeant?.role || depositaire?.role,
      "Non renseignee",
    );
    const person = depositaire?.dirigeant || {};
    // Prénom/Nom robustes
    const normalizedFirstName = safeValue(
      person?.givenName || person?.given_name || person?.prenom || person?.firstName || user?.given_name,
      normalizedDepositaireName.split(" ")[0] || ""
    );
    const normalizedLastName = safeValue(
      person?.surname || person?.lastName || person?.nom || person?.family_name || person?.last_name || user?.nom,
      normalizedDepositaireName.split(" ").slice(1).join(" ") || ""
    );
    // Champs robustes pour date/lieu naissance, id, adresse
    const normalizedDateOfBirth = safeValue(
      person?.dateOfBirth || person?.date_naissance || person?.birthDate || person?.birth_date
    );
    const normalizedPlaceOfBirth = safeValue(
      person?.placeOfBirth || person?.lieu_naissance || person?.birthPlace || person?.birth_place
    );
    const normalizedNationalId = safeValue(
      person?.nationalId || person?.national_id || person?.idNumber || person?.id_number || person?.nn
    );
    const normalizedAddressFull = safeValue(
      person?.addressFull || person?.adresse || person?.address,
      normalizedCompanyAddress
    );
    const normalizedGender = safeValue(
      person?.gender || person?.sexe || person?.civilite || person?.genre || person?.sex
    );
    const normalizedPhone = safeValue(
      depositaire?.gsm || person?.gsm || person?.phone || depositaire?.verification?.GSM || body?.gsm
    );
    const services = {
      cessionParts: Boolean(body?.cession_parts_service),
      addressChange: Boolean(body?.address_service),
      dirigeants: Boolean(body?.dirigeants_service),
    };
    const faitAValue = newCity || String(addressInfo?.commune || "").trim();
    const dateAssembleeValue = agDateDisplay || changeDateDisplay;

    const htmlContent = await buildAttestation1HtmlPage({
      enterpriseNumber: normalizedEnterpriseNumber,
      companyName: normalizedCompanyName,
      legalForm: normalizedLegalForm,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      dateOfBirth: normalizedDateOfBirth,
      placeOfBirth: normalizedPlaceOfBirth,
      nationalId: normalizedNationalId,
      addressFull: normalizedAddressFull,
      depositaireFunction: normalizedDepositaireFunction,
      gender: normalizedGender,
      phone: normalizedPhone,
      email: String(user?.email || ""),
      services,
      faitA: faitAValue,
      dateAssemblee: dateAssembleeValue,
      attestation: attestationForIdentity,
      autoprint,
    });

    return {
      fileName: `attestation-identite-${fileTimestamp}.html`,
      mimeType: "text/html; charset=utf-8",
      content: Buffer.from(htmlContent, "utf-8"),
    };
  }

  if (documentKey === "pv-assemblee-generale") {
    let address = companyData?.addresses?.[0] || {};
    if (!address.street && companyAddressDisplay) {
      const parsed = parseAddressParts(companyAddressDisplay);
      address = {
        street: address.street || parsed.street,
        houseNumber: address.houseNumber || parsed.houseNumber,
        postalCode: address.postalCode || parsed.postalCode,
        municipality: address.municipality || parsed.municipality,
      };
    }
    const dirigeants = (body?.dirigeants || depositaire?.dirigeants || []).map((d) => ({
      givenName: String(d?.givenName || d?.given_name || d?.prenom || d?.firstName || "").trim(),
      surname: String(d?.surname || d?.family_name || d?.nom || d?.lastName || "").trim(),
    }));
    if (dirigeants.length === 0 && depositaireName) {
      const parts = depositaireName.split(" ").filter(Boolean);
      dirigeants.push({
        givenName: parts.shift() || depositaireName,
        surname: parts.join(" "),
      });
    }
    const services = {
      cessionParts: Boolean(body?.cession_parts_service),
      addressChange: Boolean(body?.address_service),
      dirigeants: Boolean(body?.dirigeants_service),
    };
    const donneesActe = body?.donnees_acte || body?.donneesActe || null;
    const pubTextRaw = body?.pub_text ?? donneesActe?.pub_text ?? donneesActe?.pubText;
    let pvPubText = "";
    if (typeof pubTextRaw === "string") {
      pvPubText = pubTextRaw;
    } else if (pubTextRaw && typeof pubTextRaw === "object") {
      const parts = [];
      for (const key of ["part1", "part2", "part3", "part4"]) {
        if (pubTextRaw[key]) {
          parts.push(toScalarString(pubTextRaw[key]));
        }
      }
      if (parts.length === 0) {
        const fallback = toScalarString(pubTextRaw);
        if (fallback) {
          parts.push(fallback);
        }
      }
      pvPubText = parts.filter(Boolean).join("\n");
    }
    if (!pvPubText.trim()) {
      const assembleeInfo = donneesActe?.assemblee || {};
      const signatairesFallback = dirigeants
        .map((dirigeant) => `${dirigeant?.givenName || ""} ${dirigeant?.surname || ""}`.trim())
        .filter(Boolean);
      const fallbackText = generatePubTextHtml({
        lang: body?.langue_entreprise || companyData?.langue_entreprise || docLang,
        services,
        servicesList: donneesActe?.services || body?.services || [],
        assemblee: {
          date: assembleeInfo?.date || agDateDisplay || changeDateDisplay,
          lieu: assembleeInfo?.lieu || body?.fait_a || body?.faitA || faitAValue,
          heure_debut: assembleeInfo?.heure_debut || body?.heure_debut || body?.heureDebut || "",
          heure_fin: assembleeInfo?.heure_fin || body?.heure_fin || body?.heureFin || "",
        },
        participants: donneesActe?.participants || body?.participants || [],
        capital: donneesActe?.capital || body?.capital || {},
        capitalTotal:
          donneesActe?.capital?.total_actions ||
          body?.capital_total_actions ||
          body?.total_actions ||
          body?.capital?.total_actions ||
          "",
        cessions: donneesActe?.cessions || body?.cessions || [],
        repartitionParts:
          donneesActe?.repartition_parts || donneesActe?.repartitionParts || body?.repartition_parts || body?.repartitionParts || null,
        transfertSiege:
          donneesActe?.transfert_siege ||
          body?.transfert_siege ||
          {
            nouvelle_adresse: newAddressDisplay,
            date_effet: changeDateDisplay,
          },
        administrateurs_demissionnaires:
          donneesActe?.administrateurs_demissionnaires || body?.administrateurs_demissionnaires || [],
        administrateurs_nommes: donneesActe?.administrateurs_nommes || body?.administrateurs_nommes || [],
        signataires: donneesActe?.signataires || body?.signataires || signatairesFallback,
        newAddress: newAddressDisplay,
        dateAssemblee: agDateDisplay || changeDateDisplay,
        changeDate: changeDateDisplay,
        faitA: faitAValue,
      });
      pvPubText = fallbackText?.part1 || "";
    }
    const autoprint = String(body?.autoprint || "").toLowerCase() === "true" || body?.autoprint === 1;
    const pvHtml = buildPvAssembleeGeneraleHtmlPage(
      {
        lang,
        demandeLang: body?.langue_entreprise || companyData?.langue_entreprise || docLang,
        formJuridique: legalFormDisplay,
        denomination: companyNameDisplay,
        street: address.street || "",
        houseNumber: address.houseNumber || "",
        zipcode: address.postalCode || "",
        municipality: address.municipality || "",
        dateAssemblee: agDateDisplay || changeDateDisplay,
        services,
        pubText: pvPubText,
        dirigeants,
      },
      autoprint
    );

    return {
      fileName: `pv-assemblee-generale-${fileTimestamp}.html`,
      mimeType: "text/html; charset=utf-8",
      content: Buffer.from(pvHtml, "utf-8"),
    };
  }

  if (dossierPdfTemplates[documentKey]) {
    const pdfBuffer = await createTemplateOverlayPdf(dossierPdfTemplates[documentKey], documentKey, {
      companyName,
      enterpriseNumber,
      legalForm,
      companyAddress,
      newAddress,
      changeDate,
      agDate,
      depositaireName,
      depositaireFunction,
      userName,
      userEmail,
    });

    return {
      fileName: `${documentKey}-${fileTimestamp}.pdf`,
      mimeType: "application/pdf",
      content: pdfBuffer,
    };
  }

  if (documents[documentKey]) {
    const pdfTitleByKey = {
      "formulaire1entr": "Formulaire 1 - Modification entreprise",
      "formulaire2entr": "Formulaire 2 - Donnees complementaires",
      "attestation-identite": "Attestation d'identite - Modele 1",
      "pv-assemblee-generale": "Proces-verbal de l'assemblee generale",
    };

    const pdfBuffer = await createPdfDocumentFromText(pdfTitleByKey[documentKey], documents[documentKey]);

    return {
      fileName: `${documentKey}-${fileTimestamp}.pdf`,
      mimeType: "application/pdf",
      content: pdfBuffer,
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
      const doc = await buildDossierDocument(documentKey, payload);

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

    if (requestPath.startsWith("/api/legacy-proxy/")) {
      const upstreamPath = requestPath.replace("/api/legacy-proxy", "");
      const queryString = req.url && req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      const upstreamUrl = `${legacyApiBaseUrl}${upstreamPath}${queryString}`;
      const authHeader = req.headers["authorization"] || "";
      const contentType = req.headers["content-type"] || "";

      try {
        const chunks = [];
        await new Promise((resolve, reject) => {
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", resolve);
          req.on("error", reject);
        });
        const body = chunks.length ? Buffer.concat(chunks) : null;

        const upstreamHeaders = { Accept: "application/json" };
        if (authHeader) upstreamHeaders["Authorization"] = authHeader;
        if (body && contentType) upstreamHeaders["Content-Type"] = contentType;

        const upstreamRes = await fetch(upstreamUrl, {
          method,
          headers: upstreamHeaders,
          body: body && body.length > 0 ? body : undefined,
        });

        const responseBody = await upstreamRes.arrayBuffer();
        res.statusCode = upstreamRes.status;
        const upstreamContentType = upstreamRes.headers.get("content-type") || "application/json";
        res.setHeader("Content-Type", upstreamContentType);
        res.end(Buffer.from(responseBody));
      } catch (err) {
        sendJson(res, 502, { message: "Legacy API proxy error", details: String(err?.message || err) });
      }
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
