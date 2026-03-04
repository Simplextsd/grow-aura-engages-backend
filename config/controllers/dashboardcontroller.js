const db = require("../db");

exports.getDashboardStats = async (req, res) => {

  try {

    const range = Number(req.query.range) || 7;

    const [bookings] = await db.query("SELECT * FROM bookings");
    const [contacts] = await db.query("SELECT * FROM contacts");
    const [packages] = await db.query("SELECT * FROM packages");

    /* ================= TOTAL COUNTS ================= */

    const totalBookings = bookings.length;

    const totalHotels = packages.filter(
      p => (p.category || "").toLowerCase().includes("hotel")
    ).length;

    const totalContacts = contacts.length;

    const totalLeads = contacts.length;

    const totalEmails = contacts.length;


    /* ================= REAL REVENUE ================= */

   const totalRevenue = packages.reduce((sum, p) => {
  return sum + Number(p.price || 0);
}, 0);


    /* ================= PERCENTAGE SYSTEM ================= */

    const bookingPercent = totalBookings * 20;
    const hotelPercent = totalHotels * 20;
    const contactPercent = totalContacts * 20;
    const leadsPercent = totalLeads * 20;
    const emailPercent = totalEmails * 20;


    /* ================= TOTAL REVENUE PERCENTAGE ================= */

    const revenuePercent =
      bookingPercent +
      hotelPercent +
      contactPercent +
      leadsPercent +
      emailPercent;


    /* ================= GRAPH ================= */

    const graph = [];

    const today = new Date();

    for (let i = range - 1; i >= 0; i--) {

      const d = new Date();
      d.setDate(today.getDate() - i);

      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit"
      });

      const count = bookings.filter(b => {

        if (!b.created_at) return false;

        const date = new Date(b.created_at);

        return date.toDateString() === d.toDateString();

      }).length;

      graph.push({
        day: label,
        sales: count
      });

    }


    /* ================= RESPONSE ================= */

    res.json({

      totals: {
        bookings: totalBookings,
        hotels: totalHotels,
        contacts: totalContacts,
        revenue: totalRevenue
      },

      growth: {
        bookings: `+${bookingPercent}%`,
        hotels: `+${hotelPercent}%`,
        contacts: `+${contactPercent}%`,
        leads: `+${leadsPercent}%`,
        emails: `+${emailPercent}%`,
        revenue: `+${revenuePercent}%`
      },

      graph

    });

  }

  catch (error) {

    console.log("Dashboard Error:", error);

    res.status(500).json({
      success: false,
      message: "Dashboard error"
    });

  }

};