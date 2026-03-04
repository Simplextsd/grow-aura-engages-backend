const db = require("../db");
const { askAI } = require("../../services/openaiService");
const { detectIntent } = require("../../services/intentService");

exports.chat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    const intent = detectIntent(message);

    // -------------------------------
    // 🔹 SAVE LEAD (SAFE MODE)
    // -------------------------------
    try {
      await db.query(
        "INSERT INTO leads (message, intent) VALUES (?, ?)",
        [message, intent]
      );
    } catch (leadError) {
      console.error("Lead Insert Error:", leadError.message);
      // Continue execution (don't break AI)
    }

    // -------------------------------
    // 🔹 TOUR SEARCH
    // -------------------------------
    if (intent === "tour_search") {
      try {
        const [tours] = await db.query(
          "SELECT name, price FROM tours LIMIT 3"
        );

        if (!tours.length) {
          return res.json({
            response:
              "Currently no tours available. Please contact our support team.",
          });
        }

        let reply = "Here are our available tours:\n\n";
        tours.forEach((t) => {
          reply += `• ${t.name} - $${t.price}\n`;
        });

        return res.json({ response: reply });

      } catch (tourError) {
        console.error("Tour Fetch Error:", tourError.message);
        return res.json({
          response:
            "Sorry, we are unable to fetch tours right now.",
        });
      }
    }

    // -------------------------------
    // 🔹 CREATE BOOKING
    // -------------------------------
    if (intent === "create_booking") {
      try {
        await db.query(
          `INSERT INTO bookings 
          (customer_name, phone, tour_id, travel_date, adults) 
          VALUES (?, ?, ?, ?, ?)`,
          ["Guest User", "000000000", 1, "2026-02-20", 2]
        );

        return res.json({
          response:
            "Your booking request has been created successfully. Our agent will contact you shortly.",
        });

      } catch (bookingError) {
        console.error("Booking Error:", bookingError.message);
        return res.json({
          response:
            "Booking system is temporarily unavailable. Please contact support.",
        });
      }
    }

    // -------------------------------
    // 🔹 GENERAL AI RESPONSE
    // -------------------------------
    try {
      const aiReply = await askAI([
        {
          role: "system",
          content:
            "You are a professional travel assistant. Be concise and business-focused.",
        },
        { role: "user", content: message },
      ]);

      return res.json({ response: aiReply });

    } catch (aiError) {
      console.error("OpenAI Error:", aiError.message);
      return res.json({
        response:
          "AI service is temporarily unavailable. Please try again later.",
      });
    }

  } catch (error) {
    console.error("Critical Error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};