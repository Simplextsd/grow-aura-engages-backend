exports.detectIntent = (message) => {
  const lower = message.toLowerCase();

  if (lower.includes("desert") || lower.includes("tour"))
    return "tour_search";

  if (lower.includes("book"))
    return "create_booking";

  if (lower.includes("price"))
    return "pricing";

  return "general";
};