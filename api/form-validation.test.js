const assert = require("node:assert/strict");
const test = require("node:test");

const contactHandler = require("./contact-submit");
const roiHandler = require("./roi-submit");

const contact = {
  name: "Avery Smith",
  title: "Director",
  email: "Avery@Example.com",
  org: "Example SNF",
  buildings: "1",
  interest: "A one-building pilot",
  message: "Please contact me.",
};

const roi = {
  facilityName: "Example SNF",
  census: 120,
  adc: 100,
  medicare: 25,
  managedCare: 15,
  medicaid: 55,
  other: 5,
  email: "Avery@Example.com",
  phone: "(415) 555-0100",
};

async function post(handler, body) {
  const response = {
    code: null,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
  await handler({ method: "POST", body }, response);
  return response;
}

test("contact form accepts and normalizes a valid submission", () => {
  const result = contactHandler._test.validatePayload(contact);
  assert.equal(result.ok, true);
  assert.equal(result.data.email, "avery@example.com");
  assert.equal(result.data.name, "Avery Smith");
});

test("contact form rejects malformed bodies and invalid fields", () => {
  for (const body of [null, [], "text", { ...contact, org: { name: "bad" } }]) {
    assert.equal(contactHandler._test.validatePayload(body).ok, false);
  }
  assert.equal(contactHandler._test.validatePayload({ ...contact, name: "x".repeat(121) }).ok, false);
  assert.equal(contactHandler._test.validatePayload({ ...contact, buildings: "1000" }).ok, false);
});

test("ROI form accepts valid numbers and numeric strings", () => {
  const result = roiHandler._test.validatePayload({ ...roi, census: "120", medicare: "25" });
  assert.equal(result.ok, true);
  assert.equal(result.data.census, 120);
  assert.equal(result.data.email, "avery@example.com");
  assert.equal(roiHandler._test.calculateEstimate(result.data).medicareDays, 9125);
});

test("ROI form rejects malformed or unsafe values", () => {
  const badBodies = [
    null,
    [],
    "text",
    { ...roi, facilityName: "x".repeat(161) },
    { ...roi, facilityName: "Injected\nSubject" },
    { ...roi, census: "" },
    { ...roi, census: "0x78" },
    { ...roi, census: 100001 },
    { ...roi, census: 1.5 },
    { ...roi, medicare: [] },
    { ...roi, email: `${"a".repeat(250)}@example.com` },
    { ...roi, phone: "1".repeat(41) },
  ];
  for (const body of badBodies) {
    assert.equal(roiHandler._test.validatePayload(body).ok, false);
  }
});

test("both API routes return 400 for malformed JSON without email configuration", async () => {
  for (const handler of [contactHandler, roiHandler]) {
    const response = await post(handler, "{");
    assert.equal(response.code, 400);
    assert.equal(response.body.error, "Invalid JSON payload.");
  }
});

test("ROI API returns 400 for an invalid body before it checks email configuration", async () => {
  const response = await post(roiHandler, []);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, "Invalid ROI submission.");
});

test("valid requests send normalized and escaped content to the email service", async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.RESEND_API;
  const sent = [];
  process.env.RESEND_API = "test-only";
  global.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({}) };
  };

  try {
    assert.equal((await post(contactHandler, { ...contact, message: "<script>alert(1)</script>" })).code, 200);
    assert.equal((await post(roiHandler, roi)).code, 200);
    assert.equal(sent.length, 2);
    assert.equal(sent[0].reply_to, "avery@example.com");
    assert.match(sent[0].html, /&lt;script&gt;/);
    assert.doesNotMatch(sent[0].html, /<script>/);
    assert.equal(sent[1].reply_to, "avery@example.com");
    assert.match(sent[1].subject, /Example SNF/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API;
    else process.env.RESEND_API = originalKey;
  }
});
