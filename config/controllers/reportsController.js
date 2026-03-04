const db = require("../db");

const getAnalytics = async (req, res) => {
  try {

    /* =====================================
       1️⃣ MONTHLY REVENUE (Bookings)
    ===================================== */
    const [monthly] = await db.query(`
      SELECT 
        MONTH(created_at) as month,
        SUM(IFNULL(balance_amount,0)) as revenue
      FROM bookings
      GROUP BY MONTH(created_at)
      ORDER BY MONTH(created_at)
    `);

    const monthNames = [
      "Jan","Feb","Mar","Apr","May","Jun",
      "Jul","Aug","Sep","Oct","Nov","Dec"
    ];

    const monthlyRevenue = monthly
      .filter(row => Number(row.revenue) > 0)
      .map(row => ({
        month: monthNames[row.month - 1] || "",
        revenue: Number(row.revenue) || 0,
        cost: 0
      }));


    /* =====================================
       2️⃣ CHANNEL ROI (Contacts Source)
    ===================================== */
    const [channels] = await db.query(`
      SELECT source as channel, COUNT(*) as total
      FROM contacts
      GROUP BY source
    `);

    const channelROI = channels.map(c => ({
      channel: c.channel,
      roi: Number(c.total) * 10, // temporary ROI logic
      spend: Number(c.total)
    }));


    /* =====================================
       3️⃣ CUSTOMER GROWTH (Weekly Chart)
    ===================================== */
    const [customers] = await db.query(`
      SELECT 
        WEEK(created_at) as week,
        COUNT(*) as total
      FROM contacts
      GROUP BY WEEK(created_at)
      ORDER BY WEEK(created_at)
    `);

    const customerGrowth = customers.map((c, index) => ({
      week: "W" + (index + 1),
      total: Number(c.total),
      new: Number(c.total),
      churned: 0
    }));


    /* =====================================
       4️⃣ TOTAL CUSTOMERS (IMPORTANT FIX)
    ===================================== */
    const [[totalResult]] = await db.query(`
      SELECT COUNT(*) as total FROM contacts
    `);

    const totalCustomers = Number(totalResult.total) || 0;


    /* =====================================
       FINAL RESPONSE
    ===================================== */
    return res.json({
      monthlyRevenue: monthlyRevenue || [],
      channelROI: channelROI || [],
      customerGrowth: customerGrowth || [],
      totalCustomers
    });

  } catch (err) {
    console.error("Analytics Error:", err);
    return res.status(500).json({
      monthlyRevenue: [],
      channelROI: [],
      customerGrowth: [],
      totalCustomers: 0
    });
  }
};

module.exports = { getAnalytics };