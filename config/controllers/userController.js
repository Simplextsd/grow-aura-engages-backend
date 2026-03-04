const db = require("../db");

const bcrypt = require("bcrypt");

/* GET USERS */

exports.getAllUsers = async (req,res)=>{

  try{

    const [rows] = await db.query(
  "SELECT id,full_name,email,role,permissions,created_at FROM users WHERE role != 'admin'"
);
    const users = rows.map(user => ({
      ...user,
      permissions: JSON.parse(user.pages || "[]")
    }));

    res.json({
      users
    });

  }catch(error){

    res.status(500).json({
      message:error.message
    });

  }

};



/* CREATE USER */

exports.createUser = async (req,res)=>{

  try{

    const { full_name, email, password, role } = req.body;

    // agar permissions na aaye to empty array
    const permissions = req.body.permissions || [];

    const [existing] = await db.query(
      "SELECT id FROM users WHERE email=?",
      [email]
    );

    if(existing.length > 0){
      return res.status(400).json({
        message:"User already exists"
      });
    }

    await db.query(
      "INSERT INTO users (full_name,email,password,role,permissions) VALUES (?,?,?,?,?)",
      [
        full_name,
        email,
        password,
        role || "user",
        JSON.stringify(permissions)
      ]
    );

    res.json({
      message:"User created successfully"
    });

  }catch(error){

    res.status(500).json({
      message:error.message
    });

  }

};




/* DELETE USER */

exports.deleteUser = async (req,res)=>{

  try{

    const { id } = req.params;

    await db.query(
      "DELETE FROM users WHERE id=?",
      [id]
    );

    res.json({
      message:"User deleted"
    });

  }catch(error){

    res.status(500).json({
      message:error.message
    });

  }

};