import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { classify as mockClassify } from "./mock-ai.mjs";
import { MODEL_TIMEOUT_MS, readRequestText, triage } from "./triage.mjs";

/** Файлы страницы, которые сервер отдаёт по GET. */
const PAGES = {
  "/": {
    type: "text/html; charset=utf-8",
    body: await readFile(new URL("./index.html", import.meta.url)),
  },
  "/view.mjs": {
    type: "text/javascript; charset=utf-8",
    body: await readFile(new URL("./view.mjs", import.meta.url)),
  },
};

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/** Создаёт HTTP-сервер; модель и таймаут можно подменить в тестах. */
export function createApp({ classify = mockClassify, timeoutMs = MODEL_TIMEOUT_MS } = {}) {
  return createServer(async (request, response) => {
    if (request.method === "GET" && Object.hasOwn(PAGES, request.url)) {
      const page = PAGES[request.url];
      response.writeHead(200, { "Content-Type": page.type });
      response.end(page.body);
      return;
    }
    if (request.method !== "POST" || request.url !== "/api/triage") {
      return json(response, 404, { status: "not_found" });
    }
    try {
      const text = readRequestText(await readBody(request));
      if (text === null) return json(response, 400, { status: "invalid_input" });
      return json(response, 200, await triage(text, { classify, timeoutMs }));
    } catch {
      json(response, 500, { status: "server_error" });
    }
  });
}
