const express = require("express");
const schedule = require("node-schedule");
const admin = require("firebase-admin");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(express.json());

// Enable CORS for your frontend origin
app.use(cors({
    origin: "https://5500-sayanuno-whatsappmessag-yigfteta2q1.ws-us118.gitpod.io", // Your frontend URL
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"]
}));

app.options("*", cors()); // ✅ Handles preflight requests

// MongoDB Connection
const mongoURI = "mongodb+srv://doluipriya866:W2JY6fAlpCtgy6xS@cluster0.sz2rx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));

// Define Mongoose Schema and Model
const scheduleSchema = new mongoose.Schema({
    phone: String,
    message: String,
    time: Date,
    fcmToken: String,
    allDays: Boolean
});
const Schedule = mongoose.model("Schedule", scheduleSchema);

// Initialize Firebase Admin
const serviceAccount = require("./serviceAccountKey.json"); // Ensure this file is present in your backend
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

let scheduledJobs = {};

// Endpoint to schedule a message
app.post("/schedule", async (req, res) => {
    const { phone, message, time, fcmToken, allDays } = req.body;

    if (!phone || !message || !time || !fcmToken) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        // Save to MongoDB
        const newSchedule = new Schedule({ phone, message, time, fcmToken, allDays });
        await newSchedule.save();

        const jobId = newSchedule._id.toString();
        const jobTime = new Date(time);

        if (allDays) {
            // Schedule a daily job
            scheduledJobs[jobId] = schedule.scheduleJob({ hour: jobTime.getHours(), minute: jobTime.getMinutes() }, async () => {
                const notification = {
                    data: { phone, message },
                    token: fcmToken
                };

                try {
                    await admin.messaging().send(notification);
                    console.log(`Daily Notification sent to ${phone}`);
                } catch (error) {
                    console.error("Error sending notification:", error);
                }
            });
        } else {
            // Schedule a one-time job
            scheduledJobs[jobId] = schedule.scheduleJob(jobTime, async () => {
                const notification = {
                    data: { phone, message },
                    token: fcmToken
                };

                try {
                    await admin.messaging().send(notification);
                    console.log(`Notification sent to ${phone}`);
                    await Schedule.findByIdAndDelete(jobId); // Remove from DB after execution
                } catch (error) {
                    console.error("Error sending notification:", error);
                }

                delete scheduledJobs[jobId];
            });
        }

        res.json({ message: "Message scheduled successfully!" });
    } catch (error) {
        console.error("Error saving schedule:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Endpoint to fetch all scheduled messages
app.get("/schedules", async (req, res) => {
    const { fcmToken } = req.query; // Get FCM token from query parameters

    if (!fcmToken) {
        return res.status(400).json({ message: "FCM Token is required" });
    }

    try {
        const schedules = await Schedule.find({ fcmToken }); // Fetch only user-specific schedules
        res.json(schedules);
    } catch (error) {
        console.error("Error fetching schedules:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

app.delete("/schedule/:id", async (req, res) => {
    const { id } = req.params;
    const { fcmToken } = req.body; // Get FCM token from request body

    if (!fcmToken) {
        return res.status(400).json({ message: "FCM Token is required" });
    }

    try {
        const schedule = await Schedule.findById(id);
        if (!schedule) {
            return res.status(404).json({ message: "Schedule not found" });
        }

        // Check if the FCM token matches the stored token
        if (schedule.fcmToken !== fcmToken) {
            return res.status(403).json({ message: "Unauthorized: You can only delete your own schedules" });
        }

        // Cancel the scheduled job if it exists
        if (scheduledJobs[id]) {
            scheduledJobs[id].cancel();
            delete scheduledJobs[id]; // Remove from the scheduled job list
        }

        // Delete from MongoDB
        await Schedule.findByIdAndDelete(id);

        res.json({ message: "Scheduled message deleted successfully!" });
    } catch (error) {
        console.error("Error deleting schedule:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Start Server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
