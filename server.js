console.log("SERVER FILE LOADED");

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "x-ray_system",
  password: "Ezaz@8721",
  port: 5432,
});



/* =========================
ADD PATIENT
========================= */

app.post("/patients", async (req, res) => {

  const { name, age, gender, phone, address, referring_doctor } = req.body;

  const result = await pool.query(
    "INSERT INTO patients(name,age,gender,phone,address,referring_doctor) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [name, age, gender, phone, address, referring_doctor]
  );

  res.json(result.rows[0]);

});



/* =========================
EDIT PATIENT
========================= */

app.put("/patients/:id", async (req, res) => {

  const { id } = req.params;

  const { name, phone, address, referring_doctor } = req.body;

  const result = await pool.query(
    "UPDATE patients SET name=$1, phone=$2, address=$3, referring_doctor=$4 WHERE id=$5 RETURNING *",
    [name, phone, address, referring_doctor, id]
  );

  res.json(result.rows[0]);

});



/* =========================
ADD TEST
========================= */

app.post("/bills", async (req, res) => {

  const { patient_id, test_name, price, discount } = req.body;

  const amount = price - discount;

  const result = await pool.query(
    "INSERT INTO bills(patient_id,test_name,price,discount,amount) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [patient_id, test_name, price, discount, amount]
  );

  res.json(result.rows[0]);

});



/* =========================
EDIT TEST
========================= */

app.put("/bills/:id", async (req, res) => {

  const { id } = req.params;

  const { test_name, price, discount } = req.body;

  const amount = price - discount;

  const result = await pool.query(
    "UPDATE bills SET test_name=$1, price=$2, discount=$3, amount=$4 WHERE id=$5 RETURNING *",
    [test_name, price, discount, amount, id]
  );

  res.json(result.rows[0]);

});



/* =========================
DELETE TEST
========================= */

app.delete("/bills/:id", async (req, res) => {

  const { id } = req.params;

  await pool.query("DELETE FROM bills WHERE id=$1", [id]);

  res.send("Deleted");

});



/* =========================
PATIENT FULL DATA
========================= */

app.get("/patients/full/:id", async (req, res) => {

  const { id } = req.params;

  const patient = await pool.query(
    "SELECT * FROM patients WHERE id=$1",
    [id]
  );

  const tests = await pool.query(
    "SELECT * FROM bills WHERE patient_id=$1",
    [id]
  );

  const total = await pool.query(
    "SELECT COALESCE(SUM(amount),0) AS total FROM bills WHERE patient_id=$1",
    [id]
  );

  res.json({
    patient: patient.rows[0],
    tests: tests.rows,
    total: total.rows[0].total
  });

});



/* =========================
PATIENT SEARCH
========================= */

app.get("/patients/search/:keyword", async (req, res) => {

  const { keyword } = req.params;

  const result = await pool.query(
    "SELECT * FROM patients WHERE name ILIKE $1 OR phone ILIKE $1",
    [`%${keyword}%`]
  );

  res.json(result.rows);

});



/* =========================
PAGINATION (10 PER PAGE)
========================= */

app.get("/patients/page/:page", async (req, res) => {

  const page = parseInt(req.params.page);

  const limit = 10;

  const offset = (page - 1) * limit;

  const result = await pool.query(
    "SELECT * FROM patients ORDER BY id DESC LIMIT $1 OFFSET $2",
    [limit, offset]
  );

  res.json(result.rows);

});



/* =========================
PRINT BILL
========================= */

app.get("/print/bill/:patient_id", async (req, res) => {

  const { patient_id } = req.params;

  const patient = await pool.query(
    "SELECT * FROM patients WHERE id=$1",
    [patient_id]
  );

  const tests = await pool.query(
    "SELECT test_name,price,discount,amount FROM bills WHERE patient_id=$1",
    [patient_id]
  );

  const total = await pool.query(
    "SELECT COALESCE(SUM(amount),0) AS total FROM bills WHERE patient_id=$1",
    [patient_id]
  );

  const p = patient.rows[0];

  const invoiceNo = String(patient_id).padStart(3, "0");

  let testsHtml = "";

  tests.rows.forEach(t => {

    testsHtml += `
    <tr>
      <td>${t.test_name}</td>
      <td>${t.price}</td>
      <td>${t.discount}</td>
      <td>${t.amount}</td>
    </tr>
    `;

  });

  res.send(`

  <html>

  <head>

  <title>X-ray Bill</title>

  <style>

  body{font-family:Arial;padding:40px;}

  table{width:100%;border-collapse:collapse;margin-top:20px;}

  th,td{border:1px solid black;padding:8px;}

  @media print{button{display:none;}}

  </style>

  </head>

  <body>

  <h2 style="text-align:center">Life Line Rural Hospital, Goroimari</h2>

  <p style="text-align:center">
  GOROIMARI SATRA, PIN:781137, DIST: KAMRUP, ASSAM
  </p>

  <p style="text-align:center">
  Phone: 9365741511 / 9954297266
  </p>

  <hr>

  <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:300px;">

  <div>
  <p><b>Date:</b> ${new Date().toLocaleDateString()}</p>
  <p><b>Patient Name:</b> ${p.name}</p>
  <p><b>Phone:</b> ${p.phone}</p>
  </div>

  <div>
  <p><b>Address:</b> ${p.address || ""}</p>
  <p><b>Referring Doctor:</b> ${p.referring_doctor || ""}</p>
  <p><b>Invoice No:</b> ${invoiceNo}</p>
  </div>

  </div>

  <table>

  <tr>
  <th>Test</th>
  <th>Price</th>
  <th>Discount</th>
  <th>Amount</th>
  </tr>

  ${testsHtml}

  </table>

  <h3>Total: ₹ ${total.rows[0].total}</h3>

  <button onclick="window.print()">Print Bill</button>

  <div style="float:right;margin-top:40px;">Signature</div>

  </body>

  </html>

  `);

});
app.delete("/patients/:id", async (req, res) => {

const { id } = req.params;

try{

// delete tests first
await pool.query(
"DELETE FROM bills WHERE patient_id=$1",
[id]
);

// delete patient
await pool.query(
"DELETE FROM patients WHERE id=$1",
[id]
);

res.send("Patient deleted");

}catch(err){

console.error(err);
res.status(500).send("Delete failed");

}

});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});