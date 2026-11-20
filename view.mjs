const TOPIC_LABELS = {
  delivery: "Доставка",
  pricing: "Цена и стоимость",
  other: "Другое",
};

const NOTICES = {
  pending: "Разбираем заявку…",
  ready: "Черновик готов. Проверьте его и решите, что отправить клиенту.",
  manual_review:
    "AI не смог надёжно разобрать заявку. Определите тему и подготовьте ответ вручную.",
  invalid_input: "Введите текст заявки.",
};

const UNAVAILABLE = "Сервис разбора недоступен. Разберите заявку вручную или повторите позже.";

/**
 * Показывает ответ API на странице. Каждый вызов перезаписывает все поля,
 * поэтому черновик прошлой заявки не остаётся видимым после сбоя.
 */
export function renderTriage(view, reply) {
  const status = reply?.status;
  const ready = status === "ready";
  view.notice.textContent = Object.hasOwn(NOTICES, status) ? NOTICES[status] : UNAVAILABLE;
  view.topic.textContent = ready ? (TOPIC_LABELS[reply.topic] ?? reply.topic) : "";
  view.draft.textContent = ready ? reply.draft : "";
  view.suggestion.hidden = !ready;
}
