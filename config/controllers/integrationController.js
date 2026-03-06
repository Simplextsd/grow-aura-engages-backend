// const db = require("../../db");

// /* ================= SAVE INTEGRATION ================= */

// exports.saveIntegration = async (req, res) => {

//   try {

//     const userId = req.user.id;
//     const { platform } = req.params;
//     const data = req.body;

//     if (!platform) {
//       return res.status(400).json({ message: "Platform required" });
//     }

//     const pageId = data.pageId || null;
//     const accessToken = data.accessToken || null;

//     const config = JSON.stringify(data);

//     const [existing] = await db.query(
//       "SELECT id FROM integrations WHERE user_id=? AND platform=?",
//       [userId, platform]
//     );

//     if (existing.length > 0) {

//       await db.query(
//         `UPDATE integrations 
//          SET page_id=?, access_token=?, config=? 
//          WHERE user_id=? AND platform=?`,
//         [
//           pageId,
//           accessToken,
//           config,
//           userId,
//           platform
//         ]
//       );

//     } else {

//       await db.query(
//         `INSERT INTO integrations 
//          (user_id, platform, page_id, access_token, config)
//          VALUES (?, ?, ?, ?, ?)`,
//         [
//           userId,
//           platform,
//           pageId,
//           accessToken,
//           config
//         ]
//       );

//     }

//     res.json({
//       success: true,
//       message: `${platform} connected successfully`
//     });

//   } catch (error) {

//     console.error("Integration Save Error:", error);

//     res.status(500).json({
//       message: "Server error"
//     });

//   }

// };


// /* ================= GET INTEGRATION ================= */

// exports.getIntegration = async (req, res) => {

//   try {

//     const userId = req.user.id;
//     const { platform } = req.params;

//     const [rows] = await db.query(
//       "SELECT * FROM integrations WHERE user_id=? AND platform=?",
//       [userId, platform]
//     );

//     if (rows.length === 0) {
//       return res.json({ connected: false });
//     }

//     let config = {};

//     try {
//       config = JSON.parse(rows[0].config || "{}");
//     } catch {
//       config = {};
//     }

//     res.json({
//       connected: true,
//       data: {
//         ...rows[0],
//         config
//       }
//     });

//   } catch (error) {

//     console.error("Integration Fetch Error:", error);

//     res.status(500).json({
//       message: "Server error"
//     });

//   }

// };



const express = require("express");
const router = express.Router();
const axios = require("axios");
const db = require("../config/db");

/* ================= SAVE INTEGRATION ================= */

router.post("/save", async (req, res) => {

  try {

    const { platform, pageId, accessToken } = req.body;

    if (!platform || !accessToken) {
      return res.status(400).json({
        success:false,
        message:"Missing platform or access token"
      });
    }

    await db.query(
      `INSERT INTO integrations (platform, page_id, access_token, is_connected)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
       page_id = VALUES(page_id),
       access_token = VALUES(access_token),
       is_connected = 1`,
      [platform, pageId || null, accessToken]
    );

    return res.json({
      success:true,
      message:"Integration saved"
    });

  } catch (error) {

    console.error("SAVE ERROR:", error);

    return res.status(500).json({
      success:false,
      message:"Server error"
    });

  }

});


/* ================= TEST META TOKEN ================= */

router.post("/meta/test", async (req, res) => {

  try {

    const { pageId, accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success:false,
        message:"Access token missing"
      });
    }

    /* Facebook Graph API test */

    const response = await axios.get(
      `https://graph.facebook.com/v20.0/me?access_token=${accessToken}`
    );

    if (!response.data || !response.data.id) {
      return res.status(400).json({
        success:false,
        message:"Invalid access token"
      });
    }

    return res.json({
      success:true,
      message:"Token valid",
      user:response.data
    });

  } catch (error) {

    console.error("META TEST ERROR:", error.response?.data || error.message);

    return res.status(400).json({
      success:false,
      message:"Invalid details"
    });

  }

});


/* ================= GET STATUS ================= */

router.get("/status", async (req, res) => {

  try {

    const [rows] = await db.query(
      "SELECT platform, is_connected FROM integrations"
    );

    const result = {
      whatsapp:false,
      facebook:false,
      instagram:false,
      email:false
    };

    rows.forEach(row => {
      result[row.platform] = row.is_connected === 1;
    });

    return res.json(result);

  } catch (error) {

    console.error("STATUS ERROR:", error);

    return res.status(500).json({
      success:false,
      message:"Server error"
    });

  }

});


module.exports = router;