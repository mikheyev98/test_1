import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.mjs";
import { renderTriage } from "../view.mjs";

const MANUAL_REVIEW = { status: "manual_review", topic: null, draft: null };
const MOCK_DRAFT = "Спасибо за обращение. Уточним детали заявки.";

/** Поднимает приложение на свободном порту и возвращает функцию запроса к API. */
async function startApp(options) {
  const server = createApp(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    async triage(body) {
      const response = await fetch(`http://127.0.0.1:${port}/api/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      return { status: response.status, body: await response.json() };
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

describe("POST /api/triage с выданным имитатором", () => {
  let app;
  before(async () => {
    app = await startApp();
  });
  after(() => app.close());

  const invalidBodies = {
    "битый JSON": "{text:",
    "нет поля text": "{}",
    "пустая строка": JSON.stringify({ text: "" }),
    "только пробелы": JSON.stringify({ text: "  \n " }),
    "число вместо строки": JSON.stringify({ text: 42 }),
    "тело null": "null",
  };
  for (const [name, body] of Object.entries(invalidBodies)) {
    test(`некорректный ввод (${name}) → 400 invalid_input`, async () => {
      assert.deepEqual(await app.triage(body), {
        status: 400,
        body: { status: "invalid_input" },
      });
    });
  }

  test("корректный ответ модели → 200 ready с темой и черновиком", async () => {
    assert.deepEqual(await app.triage(JSON.stringify({ text: "Когда будет доставка?" })), {
      status: 200,
      body: { status: "ready", topic: "delivery", draft: MOCK_DRAFT },
    });
  });

  for (const marker of ["[error]", "[bad-json]", "[bad-topic]", "[empty-draft]"]) {
    test(`сбой модели ${marker} → 200 manual_review`, async () => {
      assert.deepEqual(await app.triage(JSON.stringify({ text: `Цена? ${marker}` })), {
        status: 200,
        body: MANUAL_REVIEW,
      });
    });
  }

  test("таймаут модели → manual_review раньше, чем ответит имитатор (1200 мс)", async () => {
    const started = performance.now();
    const reply = await app.triage(JSON.stringify({ text: "Где заказ? [timeout]" }));
    const elapsed = performance.now() - started;

    assert.deepEqual(reply, { status: 200, body: MANUAL_REVIEW });
    assert.ok(elapsed >= 250 && elapsed < 800, `ожидание модели заняло ${elapsed.toFixed(0)} мс`);
  });
});

describe("POST /api/triage с подменённой моделью", () => {
  test("модель игнорирует отмену и не отвечает → manual_review по таймауту", async () => {
    const app = await startApp({ classify: () => new Promise(() => {}) });
    try {
      assert.deepEqual(await app.triage(JSON.stringify({ text: "Привет" })), {
        status: 200,
        body: MANUAL_REVIEW,
      });
    } finally {
      await app.close();
    }
  });

  test("лишние поля из ответа модели не попадают клиенту", async () => {
    const reply = JSON.stringify({ topic: "other", draft: "Ответим завтра.", debug: "внутреннее" });
    const app = await startApp({ classify: async () => reply });
    try {
      assert.deepEqual(await app.triage(JSON.stringify({ text: "Вопрос" })), {
        status: 200,
        body: { status: "ready", topic: "other", draft: "Ответим завтра." },
      });
    } finally {
      await app.close();
    }
  });
});

describe("страница заявки", () => {
  const fakeView = () => ({
    notice: { textContent: "" },
    suggestion: { hidden: true },
    topic: { textContent: "" },
    draft: { textContent: "" },
  });

  test("ready показывает тему и черновик", () => {
    const view = fakeView();
    renderTriage(view, { status: "ready", topic: "pricing", draft: "Пришлём прайс." });

    assert.equal(view.suggestion.hidden, false);
    assert.equal(view.draft.textContent, "Пришлём прайс.");
    assert.notEqual(view.topic.textContent, "");
  });

  for (const status of ["manual_review", "server_error"]) {
    test(`${status} после успешного разбора очищает прежний черновик`, () => {
      const view = fakeView();
      renderTriage(view, { status: "ready", topic: "delivery", draft: "Старый черновик" });
      assert.equal(view.draft.textContent, "Старый черновик");
      const readyNotice = view.notice.textContent;

      renderTriage(view, { status, topic: null, draft: null });

      assert.equal(view.draft.textContent, "");
      assert.equal(view.topic.textContent, "");
      assert.equal(view.suggestion.hidden, true);
      assert.notEqual(view.notice.textContent, "");
      assert.notEqual(view.notice.textContent, readyNotice);
    });
  }
});
