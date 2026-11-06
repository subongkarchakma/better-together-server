
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";

const app = express();

// Middleware
app.use(
    cors({
        origin: process.env.CLIENT_URL,
    })
);
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

const dbConnect = client.connect();

const eventsCollection = dbConnect.then(() => {
    const db = client.db("better-together");

    console.log("Successfully connected to MongoDB!");

    return db.collection("events");
});

// Create Event API
app.post("/create-event", async (req, res) => {
    const collection = await eventsCollection;
    const eventData = req.body;

    const result = await collection.insertOne(eventData);

    res.status(201).json({
        message: "Event created successfully!",
        insertedId: result.insertedId,
    });
});

// Test API
app.get("/", (req, res) => {
    res.send("events is coming soon");
});

// Get all events API
app.get("/events", async (req, res) => {
    const collection = await eventsCollection;

    const events = await collection
        .find({})
        .sort({ eventDate: 1 })
        .toArray();

    res.send(events);
});

// Get event details API
app.get("/events/:id", async (req, res) => {
    const collection = await eventsCollection;
    const { id } = req.params;

    const result = await collection.findOne({
        _id: new ObjectId(id),
    });

    res.send(result);
});

// Export Express app for Vercel
export default app;
