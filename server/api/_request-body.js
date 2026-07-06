function safeJsonParse(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return {};
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return {};
  }
}

function readStream(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      resolve(body);
    });

    request.on("error", reject);
  });
}

export function getRequestBody(request) {
  if (typeof request.body === "string") {
    return safeJsonParse(request.body);
  }

  if (Buffer.isBuffer(request.body)) {
    return safeJsonParse(request.body.toString("utf8"));
  }

  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  return {};
}

export async function ensureRequestBody(request) {
  if (request._bodyPrepared) {
    return;
  }

  request._bodyPrepared = true;

  const contentType = String(
    request.headers?.["content-type"] || request.headers?.["Content-Type"] || "",
  ).toLowerCase();
  const method = String(request.method || "GET").toUpperCase();

  if (method === "GET" || method === "HEAD") {
    request.body = {};
    return;
  }

  if (typeof request.body === "string") {
    request.body = contentType.includes("application/json")
      ? safeJsonParse(request.body)
      : request.body;
    return;
  }

  if (Buffer.isBuffer(request.body)) {
    request.body = contentType.includes("application/json")
      ? safeJsonParse(request.body.toString("utf8"))
      : request.body.toString("utf8");
    return;
  }

  if (request.body && typeof request.body === "object") {
    return;
  }

  const raw = await readStream(request);
  request.body = contentType.includes("application/json") ? safeJsonParse(raw) : raw;
}
