import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";


const app = express();
const PORT = 8000;

// Middleware
app.use(cors({
    origin: "http://localhost:3000",
}));
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

let eventsCollection;

export async function connectToMongoDB() {
    try {
        await client.connect();

        const db = client.db("better-together");
        eventsCollection = db.collection("events");

        console.log("Successfully connected to MongoDB!");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}

// Create Event API
app.post("/create-event", async (req, res) => {
    try {
        const eventData = req.body;

        const result = await eventsCollection.insertOne(eventData);

        res.status(201).json({
            message: "Event created successfully!",
            insertedId: result.insertedId,
        });
    } catch (error) {
        console.error("Event creation failed:", error);

        res.status(500).json({
            message: "Failed to create event",
        });
    }
});

// Test API
app.get('/', (req,res) =>{
    res.send("events is coming soon");
})
// get events api
app.get("/events", async (req, res) => {
    const events = await eventsCollection
        .find({})
        .sort({ eventDate: 1 })
        .toArray();
    res.send(events);
});
// get eventDetails api
app.get('/events/:id', async(req,res) =>{
    const {id} = req.params;
    const result = await eventsCollection.findOne({_id: new ObjectId(id)})

    res.send(result)
})

// Start server after MongoDB connects
async function startServer() {
    await connectToMongoDB();

    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}

startServer();
