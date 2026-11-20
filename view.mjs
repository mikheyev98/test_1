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
  unavailable: "Сервис разбора недоступен. Разберите заявку вручную или повторите позже.",
};

/**
 * Показывает ответ API на странице. Каждый вызов перезаписывает все поля,
 * поэтому черновик прошлой заявки не остаётся видимым после сбоя.
 * Неизвестный статус (500, 404, обрыв сети) показывается как unavailable.
 */
export function renderTriage(view, reply) {
  const status = Object.hasOwn(NOTICES, reply?.status) ? reply.status : "unavailable";
  const ready = status === "ready";
  view.notice.textContent = NOTICES[status];
  view.topic.textContent = ready ? (TOPIC_LABELS[reply.topic] ?? reply.topic) : "";
  view.draft.textContent = ready ? reply.draft : "";
  view.suggestion.hidden = !ready;
}
