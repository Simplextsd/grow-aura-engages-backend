const db = require("../db");

const addBooking = async (req, res) => {
    try {
        const { customer, flight, package: pkg, ...rest } = req.body;
        const sql = `INSERT INTO bookings (first_name, last_name, airline, flight_no, package_price, extra_data) VALUES (?, ?, ?, ?, ?, ?)`;
        const [result] = await db.query(sql, [
            customer.firstName, customer.lastName, flight.airline, flight.flightNo, pkg.price, JSON.stringify(rest)
        ]);
        res.status(201).json({ message: "Success", id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getBookings = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM bookings ORDER BY id DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { addBooking, getBookings };