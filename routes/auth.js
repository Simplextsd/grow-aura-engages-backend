import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/login", (req, res) => {
  res.json({ message: "Login handled by Supabase" });
});

app.listen(5000, () => console.log("Server running on 5000"));
