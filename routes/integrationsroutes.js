const express = require("express");
const router = express.Router();
const axios = require("axios");
const db = require("../config/db");

/* TEST META TOKEN */

router.post("/meta/test", async (req, res) => {

  try {

    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success:false,
        message:"Access token missing"
      });
    }

    const response = await axios.get(
      `https://graph.facebook.com/v20.0/me?access_token=${accessToken}`
    );

    return res.json({
      success:true,
      user:response.data
    });

  } catch (error) {

    console.error(error.response?.data || error.message);

    return res.status(400).json({
      success:false,
      message:"Invalid token"
    });

  }

});


router.post("/save", async (req, res) => {

  try {

    const { platform, pageId, accessToken } = req.body;

    if (!platform) {
      return res.status(400).json({
        success:false,
        message:"Platform missing"
      });
    }

    await db.query(
      `INSERT INTO integrations (platform,page_id,access_token,is_connected)
       VALUES (?,?,?,1)
       ON DUPLICATE KEY UPDATE
       page_id=VALUES(page_id),
       access_token=VALUES(access_token),
       is_connected=1`,
      [platform,pageId || null,accessToken || null]
    );

    res.json({
      success:true,
      message:"Integration connected"
    });

  } catch (error) {

    console.error("SAVE ERROR:",error);

    res.status(500).json({
      success:false,
      message:"Server error"
    });

  }

});


/* GET STATUS */

router.get("/status", async (req,res)=>{

  const [rows] = await db.query(
    "SELECT platform,status FROM integrations"
  );

  const result={
    whatsapp:false,
    facebook:false,
    instagram:false,
    email:false
  };

 rows.forEach(r=>{
  const platform = String(r.platform).toLowerCase();
  if (result.hasOwnProperty(platform)) {
    result[platform] = r.status === "connected";
  }
});
/* DISCONNECT INTEGRATION */

router.delete("/:platform", async (req, res) => {

  try {

    const { platform } = req.params;

    await db.query(
      "DELETE FROM integrations WHERE platform=?",
      [platform]
    );

    res.json({
      success: true,
      message: "Integration disconnected"
    });

  } catch (error) {

    console.error("DISCONNECT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

});

  res.json(result);

});

module.exports = router;