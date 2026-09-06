import assert from "node:assert/strict";
import test from "node:test";

import { applyApiCors, isAllowedApiOrigin } from "../server/api/_cors.js";

function createMockResponse() {
  const headers = new Map();

  return {
    ended: false,
    statusCode: 0,
    setHeader(name, value) {
      headers.set(name, value);
    },
    getHeader(name) {
      return headers.get(name);
    },
    end() {
      this.ended = true;
    },
  };
}

test("API CORS preflight allows native PATCH requests", () => {
  const response = createMockResponse();
  const handled = applyApiCors(
    {
      method: "OPTIONS",
      headers: {
        origin: "capacitor://localhost",
        "access-control-request-method": "PATCH",
      },
    },
    response,
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 204);
  assert.equal(response.ended, true);
  assert.equal(response.getHeader("Access-Control-Allow-Origin"), "capacitor://localhost");
  assert.match(response.getHeader("Access-Control-Allow-Methods"), /\bPATCH\b/);
});

test("API CORS still rejects untrusted origins", () => {
  const response = createMockResponse();
  applyApiCors(
    {
      method: "OPTIONS",
      headers: {
        origin: "https://example.com",
      },
    },
    response,
  );

  assert.equal(isAllowedApiOrigin("https://example.com"), false);
  assert.equal(response.getHeader("Access-Control-Allow-Origin"), undefined);
});
