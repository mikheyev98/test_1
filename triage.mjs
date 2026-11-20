/** Темы, которые менеджер может получить от AI. */
const TOPICS = new Set(["delivery", "pricing", "other"]);

/** Сколько ждать модель, прежде чем отдать заявку на ручной разбор. */
export const MODEL_TIMEOUT_MS = 300;

/** Возвращает текст заявки из тела запроса или null, если ввод некорректен. */
export function readRequestText(rawBody) {
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const text = body?.text;
  return typeof text === "string" && text.trim() !== "" ? text : null;
}

/** Проверяет сырой ответ модели; возвращает { topic, draft } или null, если ответ не годится. */
export function parseModelReply(raw) {
  if (typeof raw !== "string") return null;
  let reply;
  try {
    reply = JSON.parse(raw);
  } catch {
    return null;
  }
  const topic = reply?.topic;
  const draft = reply?.draft;
  if (!TOPICS.has(topic) || typeof draft !== "string" || draft.trim() === "") return null;
  return { topic, draft };
}

/**
 * Разбирает заявку моделью. Таймаут, ошибка модели и неподходящий ответ
 * дают manual_review: менеджер разбирает заявку сам.
 */
export async function triage(text, { classify, timeoutMs = MODEL_TIMEOUT_MS }) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Модель не ответила за ${timeoutMs} мс`));
    }, timeoutMs);
  });
  try {
    const raw = await Promise.race([classify(text, { signal: controller.signal }), timeout]);
    const reply = parseModelReply(raw);
    if (reply) return { status: "ready", ...reply };
  } catch {
    // Сбой модели или таймаут обрабатываются так же, как неподходящий ответ.
  } finally {
    clearTimeout(timer);
  }
  return { status: "manual_review", topic: null, draft: null };
}
