const { z } = require("zod");

const RECIPIENT_EMAIL = "pranav@fosterhealth.io";
const SENDER_EMAIL = "followup@notify.fosterhealth.io";
const RESEND_API_URL = "https://api.resend.com/emails";

const BUILDING_OPTIONS = new Set(["1", "2–5", "6–20", "20+"]);
const INTEREST_OPTIONS = new Set([
  "Full service — run MDS for us",
  "Copilot — power our coordinators",
  "A one-building pilot",
  "Not sure yet",
  "Chat with our team",
  "Join the waitlist",
]);

const CONTACT_PAYLOAD_SCHEMA = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  org: z.string().optional(),
  buildings: z.string().optional(),
  interest: z.string().optional(),
  message: z.string().optional(),
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function validatePayload(payload) {
  const parsed = CONTACT_PAYLOAD_SCHEMA.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid contact submission." };
  }

  const input = parsed.data;
  const data = {
    name: normalizeText(input.name),
    title: normalizeText(input.title),
    email: normalizeText(input.email).toLowerCase(),
    org: normalizeText(input.org),
    buildings: normalizeText(input.buildings),
    interest: normalizeText(input.interest),
    message: normalizeText(input.message),
  };

  if (data.name.length > 120) return { ok: false, error: "Name is too long." };
  if (data.title.length > 120) return { ok: false, error: "Title is too long." };
  if (!data.email || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { ok: false, error: "A valid work email is required." };
  }
  if (!data.org) return { ok: false, error: "Organization is required." };
  if (data.org.length > 160) return { ok: false, error: "Organization is too long." };
  if (data.buildings && !BUILDING_OPTIONS.has(data.buildings)) {
    return { ok: false, error: "Select a valid building range." };
  }
  if (!INTEREST_OPTIONS.has(data.interest)) {
    return { ok: false, error: "Select a valid area of interest." };
  }
  if (data.message.length > 5000) return { ok: false, error: "Message is too long." };

  return { ok: true, data };
}

function buildEmailText(data) {
  return [
    `New Foster inquiry from ${data.name || data.email}`,
    "",
    `Name: ${data.name || "Not provided"}`,
    `Title: ${data.title || "Not provided"}`,
    `Work email: ${data.email}`,
    `Organization: ${data.org}`,
    `Buildings: ${data.buildings || "Not provided"}`,
    `Interested in: ${data.interest}`,
    "",
    "Message:",
    data.message || "Not provided",
  ].join("\n");
}

function buildEmailHtml(data) {
  const rows = [
    ["Name", data.name || "Not provided"],
    ["Title", data.title || "Not provided"],
    ["Work email", data.email],
    ["Organization", data.org],
    ["Buildings", data.buildings || "Not provided"],
    ["Interested in", data.interest],
  ]
    .map(
      ([label, value]) =>
        `<tr><th style="padding:10px 12px;border:1px solid #d8e0ea;text-align:left;">${escapeHtml(
          label
        )}</th><td style="padding:10px 12px;border:1px solid #d8e0ea;">${escapeHtml(
          value
        )}</td></tr>`
    )
    .join("");

  const message = escapeHtml(data.message || "Not provided").replace(/\n/g, "<br>");
  return `<div style="font-family:Arial,sans-serif;color:#0B1116;line-height:1.6">
    <h2>New Foster inquiry</h2>
    <table style="border-collapse:collapse;width:100%;max-width:720px"><tbody>${rows}</tbody></table>
    <h3>Message</h3><p>${message}</p>
  </div>`;
}

async function sendEmail(apiKey, data) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER_EMAIL,
      to: [RECIPIENT_EMAIL],
      reply_to: data.email,
      subject: `New Foster inquiry: ${data.org.replace(/[\r\n]+/g, " ")}`,
      text: buildEmailText(data),
      html: buildEmailHtml(data),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || payload.error || "Resend rejected the message.");
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  let payload = req.body || {};
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({ error: "Invalid JSON payload." });
    }
  }

  const validation = validatePayload(payload);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const apiKey = process.env.RESEND_API || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing Resend configuration on the server." });
  }

  try {
    await sendEmail(apiKey, validation.data);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Contact submission email failed:", error);
    return res.status(502).json({
      error: "Unable to send your message right now. Please try again.",
    });
  }
};

module.exports._test = { validatePayload };
