import { timingSafeEqual } from "node:crypto";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 8000;

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
const userEventsCollection = dbConnect.then(() => {
    const db = client.db("better-together");

    return db.collection("userEvents");
});

// create event api
app.post("/create-event", async (req, res) => {
    // Verify private API secret
    const secret = process.env.EVENT_API_SECRET;
    const requestSecret = req.headers["x-internal-api-secret"];

    if (!secret) {
        return res.status(500).json({
            message: "Server authentication is not configured.",
        });
    }

    if (
        typeof requestSecret !== "string" ||
        Buffer.byteLength(secret) !== Buffer.byteLength(requestSecret) ||
        !timingSafeEqual(Buffer.from(secret), Buffer.from(requestSecret))
    ) {
        return res.status(403).json({
            message: "Unauthorized request.",
        });
    }
    // Save newly created event in userEvents collection
    const collection = await userEventsCollection;

    const result = await collection.insertOne({
        ...req.body,
        createdAt: new Date(),
    });

    res.status(201).json({
        message: "Event created successfully!",
        insertedId: result.insertedId,
    });
});

    
// Get All Events API
app.get("/events", async (req, res) => {
    const [existingEvents, userEvents] = await Promise.all([
        eventsCollection,
        userEventsCollection,
    ]);

    // Fetch events from both collections
    const [events, createdEvents] = await Promise.all([
        existingEvents.find({}, {
            projection: { creatorEmail: 0 },
        }).toArray(),

        userEvents.find({}, {
            projection: { creatorEmail: 0 },
        }).toArray(),
    ]);

    // Combine and sort events by date
    const allEvents = [
        ...events.map(event => ({
            ...event,
            source: "events",
        })),
        ...createdEvents.map(event => ({
            ...event,
            source: "userEvents",
        })),
    ].sort((a, b) =>
        String(a.eventDate ?? "").localeCompare(
            String(b.eventDate ?? "")
        )
    );

    res.send(allEvents);
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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Export Express app for Vercel
export default app;
