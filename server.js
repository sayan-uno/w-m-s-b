const express = require("express");
const schedule = require("node-schedule");
const admin = require("firebase-admin");
const cors = require("cors"); // Add this
const app = express();

app.use(express.json());

// Enable CORS for your frontend origin
app.use(cors({
    origin: "https://5500-sayanuno-whatsappmessag-yigfteta2q1.ws-us118.gitpod.io", // Your frontend URL
    methods: ["GET", "POST"], // Allow these methods
    allowedHeaders: ["Content-Type"] // Allow this header
}));

// Initialize Firebase Admin
const serviceAccount = require("./serviceAccountKey.json"); // Path to your downloaded JSON
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

let scheduledJobs = {};

app.post("/schedule", (req, res) => {
    const { phone, message, time, fcmToken } = req.body;

    if (!phone || !message || !time || !fcmToken) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    const jobId = Date.now().toString();
    const jobTime = new Date(time);

    scheduledJobs[jobId] = schedule.scheduleJob(jobTime, () => {
        const notification = {
            data: { phone, message }, // Send phone and message as data
            token: fcmToken
        };

        admin.messaging().send(notification)
            .then(() => console.log(`Notification sent to ${phone}`))
            .catch(error => console.error("Error sending notification:", error));

        delete scheduledJobs[jobId];
    });

    res.json({ message: "Message scheduled successfully!" });
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});