const RECIPIENT_EMAIL = "pranav@fosterhealth.io";
const SENDER_EMAIL = "followup@fosterhealth.io";
const RESEND_API_URL = "https://api.resend.com/emails";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePhone(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function phoneDigits(value) {
  return normalizePhone(value).replace(/\D/g, "");
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function validatePayload(payload) {
  const facilityName = normalizeText(payload.facilityName);
  const email = normalizeText(payload.email).toLowerCase();
  const phone = normalizePhone(payload.phone);

  const census = toNumber(payload.census);
  const adc = toNumber(payload.adc);
  const medicare = toNumber(payload.medicare);
  const managedCare = toNumber(payload.managedCare);
  const medicaid = toNumber(payload.medicaid);
  const other = toNumber(payload.other);

  if (!facilityName) {
    return { ok: false, error: "Facility name is required." };
  }

  if (!Number.isFinite(census) || census <= 0) {
    return { ok: false, error: "Total licensed beds must be greater than 0." };
  }

  if (!Number.isFinite(adc) || adc <= 0) {
    return { ok: false, error: "Average daily census must be greater than 0." };
  }

  const payerValues = [
    ["Medicare FFS", medicare],
    ["Managed care", managedCare],
    ["Medicaid", medicaid],
    ["Other", other],
  ];

  for (const [label, value] of payerValues) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return { ok: false, error: `${label} must be between 0 and 100.` };
    }
  }

  const payerTotal = medicare + managedCare + medicaid + other;
  if (Math.abs(payerTotal - 100) > 0.001) {
    return { ok: false, error: "Payer mix must total 100%." };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A valid work email is required." };
  }

  const digits = phoneDigits(phone);
  if (!phone || digits.length < 10 || digits.length > 15) {
    return { ok: false, error: "A valid phone number is required." };
  }

  return {
    ok: true,
    data: {
      facilityName,
      census,
      adc,
      medicare,
      managedCare,
      medicaid,
      other,
      email,
      phone,
    },
  };
}

function calculateEstimate(data) {
  const medicareDays = data.adc * (data.medicare / 100) * 365;
  const pdpm = medicareDays * 48;
  const billing = medicareDays * 12;
  const denials = medicareDays * 18;
  const total = pdpm + billing + denials;

  return {
    medicareDays,
    pdpm,
    billing,
    denials,
    total,
  };
}

function buildEmailText(data, estimate) {
  return [
    `New ROI calculator submission from ${data.facilityName}`,
    "",
    "Contact info",
    `Facility name: ${data.facilityName}`,
    `Work email: ${data.email}`,
    `Phone number: ${data.phone}`,
    "",
    "Facility inputs",
    `Total licensed beds: ${formatNumber(data.census)}`,
    `Average daily census: ${formatNumber(data.adc)}`,
    `Medicare FFS %: ${data.medicare}%`,
    `Managed care %: ${data.managedCare}%`,
    `Medicaid %: ${data.medicaid}%`,
    `Other %: ${data.other}%`,
    "",
    "Estimated revenue figures",
    `Medicare FFS patient-days / yr: ${formatNumber(estimate.medicareDays)}`,
    `Missed PDPM drivers: ${formatCurrency(estimate.pdpm)}`,
    `Pre-bill claim errors: ${formatCurrency(estimate.billing)}`,
    `Unchallenged denials: ${formatCurrency(estimate.denials)}`,
    `Total estimated leakage: ${formatCurrency(estimate.total)}`,
  ].join("\n");
}

function buildEmailHtml(data, estimate) {
  const rows = [
    ["Facility name", escapeHtml(data.facilityName)],
    ["Work email", escapeHtml(data.email)],
    ["Phone number", escapeHtml(data.phone)],
    ["Total licensed beds", escapeHtml(formatNumber(data.census))],
    ["Average daily census", escapeHtml(formatNumber(data.adc))],
    ["Medicare FFS %", `${escapeHtml(data.medicare)}%`],
    ["Managed care %", `${escapeHtml(data.managedCare)}%`],
    ["Medicaid %", `${escapeHtml(data.medicaid)}%`],
    ["Other %", `${escapeHtml(data.other)}%`],
    ["Medicare FFS patient-days / yr", escapeHtml(formatNumber(estimate.medicareDays))],
    ["Missed PDPM drivers", escapeHtml(formatCurrency(estimate.pdpm))],
    ["Pre-bill claim errors", escapeHtml(formatCurrency(estimate.billing))],
    ["Unchallenged denials", escapeHtml(formatCurrency(estimate.denials))],
    ["Total estimated leakage", escapeHtml(formatCurrency(estimate.total))],
  ];

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:10px 12px;border:1px solid #d8e0ea;font-weight:600;text-align:left;">${label}</td>
          <td style="padding:10px 12px;border:1px solid #d8e0ea;text-align:left;">${value}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#102038;line-height:1.6;">
      <h2 style="margin:0 0 16px;">New ROI calculator submission</h2>
      <p style="margin:0 0 20px;">
        A new ROI request came in from <strong>${escapeHtml(data.facilityName)}</strong>.
      </p>
      <table style="border-collapse:collapse;width:100%;max-width:720px;">
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}

async function sendResendEmail({ apiKey, data, estimate }) {
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
      subject: `New ROI calculator submission: ${data.facilityName}`,
      text: buildEmailText(data, estimate),
      html: buildEmailHtml(data, estimate),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload.message || payload.error || "Resend failed to accept the message.";
    throw new Error(message);
  }

  return payload;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.RESEND_API || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Missing Resend configuration on the server." });
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
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const estimate = calculateEstimate(validation.data);

  try {
    await sendResendEmail({
      apiKey,
      data: validation.data,
      estimate,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("ROI submission email failed:", error);
    return res.status(502).json({
      error: "Unable to send your request right now. Please try again.",
    });
  }
};

module.exports._test = {
  validatePayload,
  calculateEstimate,
  buildEmailText,
};
