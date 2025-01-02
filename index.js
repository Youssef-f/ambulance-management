import express from "express";
import mysql from "mysql2";
import dotenv from "dotenv";
import cors from "cors";
import client from "prom-client";

const app = express();

dotenv.config({ path: "./.env" });

// Middleware to parse JSON request bodies
app.use(express.json());
app.use(cors());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Ensure compatibility with local and Heroku environments
  })
);

console.log("Connecting to Database...");
const pool = mysql
  .createPool({
    host: process.env.DATABASE_HOST, // Read from environment variables
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE,
    port: process.env.DATABASE_PORT || 3306,
  })
  .promise();

const port = process.env.PORT || 3002;

// Prometheus metrics setup
const register = new client.Registry();
client.collectDefaultMetrics({ register }); // Collect default Node.js metrics

// Custom Prometheus metrics
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
});
register.registerMetric(httpRequestDuration);

// Middleware to record metrics
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer({
    method: req.method,
    route: req.path,
  });

  res.on("finish", () => {
    end({ status: res.statusCode });
  });

  next();
});

async function getAmbulances() {
  try {
    const [rows] = await pool.query("SELECT * FROM ambulances");
    return rows;
  } catch (error) {
    console.error("Error fetching ambulances:", error);
    throw error;
  }
}

async function getAmbulanceById(id) {
  try {
    const [rows] = await pool.query("SELECT * FROM ambulances WHERE id = ?", [
      id,
    ]);
    return rows[0];
  } catch (error) {
    console.error("Error fetching ambulance by ID:", error);
    throw error;
  }
}

async function createAmbulance(ambulance) {
  try {
    const [result] = await pool.query(
      "INSERT INTO ambulances (title) VALUES (?)",
      [ambulance.title]
    );
    return result.insertId;
  } catch (error) {
    console.error("Error creating ambulance:", error);
    throw error;
  }
}

async function updateAmbulance(ambulance) {
  try {
    const [result] = await pool.query(
      "UPDATE ambulances SET title = ? WHERE id = ?",
      [ambulance.title, ambulance.id]
    );
    return result.insertId;
  } catch (error) {
    console.error("Error updating ambulance:", error);
    throw error;
  }
}

async function deleteAmbulance(id) {
  try {
    const [result] = await pool.query("DELETE FROM ambulances WHERE id = ?", [
      id,
    ]);
    return result.insertId;
  } catch (error) {
    console.error("Error deleting ambulance:", error);
    throw error;
  }
}

app.get("/ambulances", async (req, res) => {
  try {
    const ambulances = await getAmbulances();
    res.json(ambulances);
  } catch (error) {
    res.status(500).send("Error fetching ambulances");
  }
});

app.get("/ambulances/:id", async (req, res) => {
  try {
    const ambulance = await getAmbulanceById(req.params.id);
    res.json(ambulance);
  } catch (error) {
    res.status(500).send("Error fetching ambulance");
  }
});

app.post("/ambulances", async (req, res) => {
  try {
    const ambulanceId = await createAmbulance(req.body);
    res.json({ id: ambulanceId });
  } catch (error) {
    res.status(500).send("Error creating ambulance");
  }
});

app.put("/ambulances/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      "UPDATE ambulances SET title = ? WHERE id = ?",
      [req.body.title, req.params.id]
    );
    res.json({ message: "Ambulance updated" });
  } catch (error) {
    res.status(500).send("Error updating ambulance");
  }
});

app.delete("/ambulances/:id", async (req, res) => {
  try {
    const ambulanceId = await deleteAmbulance(req.params.id);
    res.json({ id: ambulanceId });
  } catch (error) {
    res.status(500).send("Error deleting ambulance");
  }
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

// Metrics endpoint for Prometheus
app.get("/metrics", async (req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.send(await register.metrics());
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
