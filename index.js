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


// Get logged-in user's events
app.get("/my-events", async (req, res) => {
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

    // Get creator email from authenticated Next.js server
    const creatorEmail = req.headers["x-user-email"];

    if (typeof creatorEmail !== "string" || !creatorEmail) {
        return res.status(400).json({
            message: "Creator email is required.",
        });
    }

    // Fetch only events created by this user
    const collection = await userEventsCollection;

    const events = await collection
        .find({ creatorEmail })
        .sort({ eventDate: 1 })
        .toArray();

    res.status(200).json(events);
});


// Delete an event created by the logged-in user
app.delete("/my-events/:id", async (req, res) => {
    const { id } = req.params;

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

    // Validate event ID
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            message: "Invalid event ID.",
        });
    }

    // Get authenticated user's email from Next.js
    const creatorEmail = req.headers["x-user-email"];

    if (typeof creatorEmail !== "string" || !creatorEmail) {
        return res.status(401).json({
            message: "Unauthorized user.",
        });
    }

    // Delete only the event owned by this user
    const collection = await userEventsCollection;

    const result = await collection.deleteOne({
        _id: new ObjectId(id),
        creatorEmail,
    });

    if (result.deletedCount === 0) {
        return res.status(404).json({
            message: "Event not found or you don't have permission to delete it.",
        });
    }

    res.status(200).json({
        message: "Event deleted successfully!",
    });
});


// Update an event created by the logged-in user
app.patch("/my-events/:id", async (req, res) => {
    const { id } = req.params;

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

    // Validate event ID
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            message: "Invalid event ID.",
        });
    }

    // Get authenticated user's email
    const creatorEmail = req.headers["x-user-email"];

    if (typeof creatorEmail !== "string" || !creatorEmail) {
        return res.status(401).json({
            message: "Unauthorized user.",
        });
    }

    // Allow only editable fields
    const allowedFields = [
        "title",
        "description",
        "eventType",
        "thumbnail",
        "location",
        "eventDate",
    ];

    const updates = Object.fromEntries(
        Object.entries(req.body).filter(([key]) =>
            allowedFields.includes(key)
        )
    );

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({
            message: "No valid fields provided.",
        });
    }

    // Update only the event owned by this user
    const collection = await userEventsCollection;

    const result = await collection.updateOne(
        {
            _id: new ObjectId(id),
            creatorEmail,
        },
        {
            $set: updates,
        }
    );

    if (result.matchedCount === 0) {
        return res.status(404).json({
            message: "Event not found or you don't have permission to edit it.",
        });
    }

    res.status(200).json({
        message: "Event updated successfully!",
    });
});


// Get All Upcoming Events API
app.get("/events", async (req, res) => {
    const [existingEvents, userEvents] = await Promise.all([
        eventsCollection,
        userEventsCollection,
    ]);

    // Get today's date in Bangladesh timezone
    const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());

    console.log("Today's date:", today);

    // Fetch only upcoming events from both collections
    const [events, createdEvents] = await Promise.all([
        existingEvents.find(
            { eventDate: { $gte: today } },
            { projection: { creatorEmail: 0 } }
        ).toArray(),

        userEvents.find(
            { eventDate: { $gte: today } },
            { projection: { creatorEmail: 0 } }
        ).toArray(),
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
        String(a.eventDate).localeCompare(String(b.eventDate))
    );

    console.log("Upcoming events:", allEvents.length);

    res.set("Cache-Control", "no-store");
    res.status(200).send(allEvents);
});



// Test API
app.get("/", (req, res) => {
    res.send("events is coming soon");
});


// Get event details from both collections
app.get("/events/:id", async (req, res) => {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            message: "Invalid event ID",
        });
    }

    const [existingEvents, userEvents] = await Promise.all([
        eventsCollection,
        userEventsCollection,
    ]);

    // Search in the original events collection first
    let result = await existingEvents.findOne({
        _id: new ObjectId(id),
    });

    // If not found, search in userEvents
    if (!result) {
        result = await userEvents.findOne({
            _id: new ObjectId(id),
        });
    }

    // Return 404 if event doesn't exist
    if (!result) {
        return res.status(404).json({
            message: "Event not found",
        });
    }

    res.status(200).json(result);
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Export Express app for Vercel
export default app;
