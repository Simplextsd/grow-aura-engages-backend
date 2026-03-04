const db = require("../db");

/* ================= LIST CAMPAIGNS ================= */

const listCampaigns = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM campaigns
      ORDER BY id DESC
    `);

    return res.json({ campaigns: rows || [] });

  } catch (e) {
    console.error("listCampaigns error:", e);
    return res.status(500).json({ message: "Failed to fetch campaigns" });
  }
};


/* ================= GET SINGLE CAMPAIGN ================= */

const getCampaignById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const [rows] = await db.query(
      "SELECT * FROM campaigns WHERE id=?",
      [id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Campaign not found" });

    return res.json({ campaign: rows[0] });

  } catch (e) {
    console.error("getCampaignById error:", e);
    return res.status(500).json({ message: "Error fetching campaign" });
  }
};


/* ================= LIST RECIPIENTS ================= */

const listRecipients = async (req, res) => {
  try {
    const campaignId = Number(req.params.id);

    const [rows] = await db.query(
      "SELECT * FROM campaign_recipients WHERE campaign_id=? ORDER BY id DESC",
      [campaignId]
    );

    return res.json({ recipients: rows });

  } catch (e) {
    console.error("listRecipients error:", e);
    return res.status(500).json({ message: "Failed to load recipients" });
  }
};


/* ================= CREATE CAMPAIGN ================= */

const createCampaign = async (req, res) => {
  try {
    const { name, type, segment, messages, scheduledTime } = req.body;

    if (!name || !type)
      return res.status(400).json({ message: "name and type required" });

    if (!Array.isArray(messages) || !messages.length)
      return res.status(400).json({ message: "messages required" });

    const payload = {
      name: name.trim(),
      type,
      segment: segment || "all",
      messages: JSON.stringify(messages),
      scheduled_time: scheduledTime || null,
      status: scheduledTime ? "scheduled" : "draft",
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
    };

    const [result] = await db.query("INSERT INTO campaigns SET ?", payload);

    return res.status(201).json({
      message: "Campaign created",
      campaignId: result.insertId,
    });

  } catch (e) {
    console.error("createCampaign error:", e);
    return res.status(500).json({ message: "Create failed" });
  }
};


/* ================= SEND CAMPAIGN ================= */

const sendCampaign = async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    if (!campaignId)
      return res.status(400).json({ message: "Invalid id" });

    const [cRows] = await db.query(
      "SELECT * FROM campaigns WHERE id=?",
      [campaignId]
    );

    if (!cRows.length)
      return res.status(404).json({ message: "Campaign not found" });

    const campaign = cRows[0];
    const messages = JSON.parse(campaign.messages || "[]");

    let contacts = [];

    if (campaign.segment === "all") {
      const [rows] = await db.query("SELECT * FROM contacts");
      contacts = rows;
    }

    if (campaign.segment === "new") {
      const [rows] = await db.query(
        "SELECT * FROM contacts WHERE tag='new_lead'"
      );
      contacts = rows;
    }

    if (!contacts.length)
      return res.status(400).json({ message: "No contacts found" });

    const recipientsData = [];

    contacts.forEach((contact, index) => {
      const messageIndex = index % messages.length;
      const messageText = messages[messageIndex];

      if (campaign.type === "email" && !contact.email) return;
      if (campaign.type === "whatsapp" && !contact.phone) return;

      recipientsData.push([
        campaignId,
        contact.id,
        campaign.type,
        messageText,
        "delivered",
        1,
        0,
        0,
        new Date(),
        new Date(),
      ]);
    });

    if (!recipientsData.length)
      return res.status(400).json({ message: "No valid contacts" });

    await db.query(
      `INSERT INTO campaign_recipients
       (campaign_id, contact_id, channel, message_content,
        status, delivered, opened, clicked,
        sent_at, delivered_at)
       VALUES ?`,
      [recipientsData]
    );

    await db.query(
      `UPDATE campaigns
       SET status='active',
           sent = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id=?),
           delivered = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id=? AND delivered=1)
       WHERE id=?`,
      [campaignId, campaignId, campaignId]
    );

    return res.json({
      message: "Campaign sent successfully",
      total: recipientsData.length,
    });

  } catch (e) {
    console.error("sendCampaign error:", e);
    return res.status(500).json({ message: "Send failed" });
  }
};


/* ================= ANALYTICS ================= */

const getAnalytics = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        COUNT(*) as totalCampaigns,
        IFNULL(SUM(sent),0) as totalSent,
        IFNULL(SUM(delivered),0) as totalDelivered,
        IFNULL(SUM(opened),0) as totalOpened,
        IFNULL(SUM(clicked),0) as totalClicked
      FROM campaigns
    `);

    const data = rows[0];

    const deliveryRate = data.totalSent > 0
      ? ((data.totalDelivered / data.totalSent) * 100).toFixed(1)
      : 0;

    const clickRate = data.totalDelivered > 0
      ? ((data.totalClicked / data.totalDelivered) * 100).toFixed(1)
      : 0;

    return res.json({
      totalCampaigns: data.totalCampaigns,
      totalSent: data.totalSent,
      deliveryRate,
      clickRate,
    });

  } catch (e) {
    console.error("analytics error:", e);
    return res.status(500).json({ message: "Analytics failed" });
  }
};


/* ================= TRACK OPEN ================= */

const trackOpen = async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const rid = Number(req.query.rid);

    if (!campaignId || !rid) return res.status(400).end();

    await db.query(
      `UPDATE campaign_recipients
       SET opened=1, opened_at=NOW()
       WHERE id=? AND campaign_id=?`,
      [rid, campaignId]
    );

    await db.query(
      `UPDATE campaigns
       SET opened = (
         SELECT COUNT(*) FROM campaign_recipients
         WHERE campaign_id=? AND opened=1
       )
       WHERE id=?`,
      [campaignId, campaignId]
    );

    res.set("Content-Type", "image/gif");
    return res.send(Buffer.from("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==","base64"));

  } catch (e) {
    return res.status(200).end();
  }
};


const trackClick = async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const rid = Number(req.query.rid);
    const url = String(req.query.url || "");

    if (!campaignId || !rid || !url)
      return res.status(400).send("Bad request");

    await db.query(
      `UPDATE campaign_recipients
       SET clicked=1, clicked_at=NOW(), click_url=?
       WHERE id=? AND campaign_id=?`,
      [url, rid, campaignId]
    );

    await db.query(
      `UPDATE campaigns
       SET clicked = (
         SELECT COUNT(*) FROM campaign_recipients
         WHERE campaign_id=? AND clicked=1
       )
       WHERE id=?`,
      [campaignId, campaignId]
    );

    return res.redirect(url);

  } catch (e) {
    return res.redirect("/");
  }
};


module.exports = {
  listCampaigns,
  getCampaignById,
  listRecipients,
  createCampaign,
  sendCampaign,
  getAnalytics,
  trackOpen,
  trackClick,
};