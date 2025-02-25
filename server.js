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
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

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
    fcmToken: String
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
    const { phone, message, time, fcmToken } = req.body;

    if (!phone || !message || !time || !fcmToken) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        // Save schedule to MongoDB
        const newSchedule = new Schedule({ phone, message, time, fcmToken });
        await newSchedule.save();

        // Schedule the job
        const jobId = newSchedule._id.toString();
        const jobTime = new Date(time);

        scheduledJobs[jobId] = schedule.scheduleJob(jobTime, async () => {
            const notification = {
                data: { phone, message },
                token: fcmToken
            };

            try {
                await admin.messaging().send(notification);
                console.log(`Notification sent to ${phone}`);
                await Schedule.findByIdAndDelete(jobId); // Remove from database after execution
            } catch (error) {
                console.error("Error sending notification:", error);
            }

            delete scheduledJobs[jobId];
        });

        res.json({ message: "Message scheduled successfully!" });
    } catch (error) {
        console.error("Error saving schedule:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Start Server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
