const express = require("express");
const router = express.Router();

const {
  createSegment,
  getSegments,
  getSegmentContacts,
  deleteSegment
} = require("../config/controllers/segmentController");

// Get all segments
router.get("/", getSegments);

// Create segment
router.post("/", createSegment);

// Get contacts inside segment
router.get("/:id/contacts", getSegmentContacts);

// Delete segment
router.delete("/:id", deleteSegment);

module.exports = router;