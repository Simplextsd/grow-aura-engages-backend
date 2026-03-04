// 🔥 FREE MOCK AI SERVICE (No OpenAI Needed)

exports.askAI = async (messages) => {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

  // Basic smart responses
  if (lastMessage.includes("hello") || lastMessage.includes("hi")) {
    return "👋 Hello! How can I help you with your travel plans today?";
  }

  if (lastMessage.includes("desert")) {
    return "🏜️ We offer Desert Safari packages starting from $50 per person. Would you like Standard or VIP option?";
  }

  if (lastMessage.includes("book")) {
    return "📝 Please share your travel date and number of adults so I can create your booking.";
  }

  if (lastMessage.includes("price")) {
    return "💰 Our prices depend on package type and number of guests. Please tell me your preferred package.";
  }

  if (lastMessage.includes("italy")) {
    return "🇮🇹 A 7-day Italy trip usually includes Rome, Florence & Venice. Would you like a budget or luxury itinerary?";
  }

  // Default fallback
  return "🤖 I'm your AI travel assistant (Demo Mode). Please tell me your destination or package interest.";
};