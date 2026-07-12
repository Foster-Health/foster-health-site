const assert = require("node:assert/strict");
const test = require("node:test");

const handler = require("../api/contact-submit.js");

const validBody = {
  name: "Ada Lovelace",
  title: "VP Clinical",
  email: "ada@example.com",
  org: "Example Health",
  buildings: "2–5",
  interest: "A one-building pilot",
  message: "Please follow up.",
};

function response() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function invoke(method, body) {
  const res = response();
  await handler({ method, body }, res);
  return res;
}

test("contact endpoint rejects unsupported methods", async () => {
  const res = await invoke("GET");
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});

test("contact endpoint validates required and enumerated fields", async () => {
  assert.equal((await invoke("POST", { ...validBody, name: "" })).statusCode, 400);
  assert.equal((await invoke("POST", { ...validBody, email: "invalid" })).statusCode, 400);
  assert.equal((await invoke("POST", { ...validBody, org: "" })).statusCode, 400);
  assert.equal((await invoke("POST", { ...validBody, buildings: "many" })).statusCode, 400);
  assert.equal((await invoke("POST", { ...validBody, interest: "anything" })).statusCode, 400);
  assert.equal((await invoke("POST", { ...validBody, message: "x".repeat(5001) })).statusCode, 400);
  assert.equal((await invoke("POST", "{" )).statusCode, 400);
});

test("contact endpoint reports missing Resend configuration", async () => {
  const previousApi = process.env.RESEND_API;
  const previousKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API;
  delete process.env.RESEND_API_KEY;
  try {
    assert.equal((await invoke("POST", validBody)).statusCode, 500);
  } finally {
    if (previousApi === undefined) delete process.env.RESEND_API;
    else process.env.RESEND_API = previousApi;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});

test("contact endpoint sends the expected Resend payload", async () => {
  const previousApi = process.env.RESEND_API;
  const previousKey = process.env.RESEND_API_KEY;
  const previousFetch = global.fetch;
  delete process.env.RESEND_API;
  process.env.RESEND_API_KEY = "test-key";
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ id: "email-id" }) };
  };

  try {
    const res = await invoke("POST", validBody);
    assert.equal(res.statusCode, 200);
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.options.headers.Authorization, "Bearer test-key");
    const email = JSON.parse(request.options.body);
    assert.equal(email.from, "followup@fosterhealth.io");
    assert.deepEqual(email.to, ["pranav@fosterhealth.io"]);
    assert.equal(email.reply_to, validBody.email);
    assert.match(email.subject, /Example Health/);
  } finally {
    global.fetch = previousFetch;
    if (previousApi === undefined) delete process.env.RESEND_API;
    else process.env.RESEND_API = previousApi;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});

test("contact endpoint converts upstream rejection to 502", async () => {
  const previousApi = process.env.RESEND_API;
  const previousKey = process.env.RESEND_API_KEY;
  const previousFetch = global.fetch;
  const previousError = console.error;
  delete process.env.RESEND_API;
  process.env.RESEND_API_KEY = "test-key";
  global.fetch = async () => ({ ok: false, json: async () => ({ message: "rejected" }) });
  console.error = () => {};

  try {
    assert.equal((await invoke("POST", validBody)).statusCode, 502);
  } finally {
    console.error = previousError;
    global.fetch = previousFetch;
    if (previousApi === undefined) delete process.env.RESEND_API;
    else process.env.RESEND_API = previousApi;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});
