const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.getPanchang = onRequest(
  {
    region: "us-central1",
    memory: "256MiB"
  },
  async (req, res) => {
    try {
      const city = req.query.city || "chennai";
      const today = new Date().toISOString().split("T")[0];

      const docRef = db.collection("panchang").doc(today);
      const doc = await docRef.get();

      // ✅ If cached data exists
      if (doc.exists && doc.data()[city]) {
        console.log("Returning cached data");
        return res.json(doc.data()[city]);
      }

      // 🔥 TEMP DUMMY DATA
      const data = {
        tithi: "Shukla Chaturthi",
        nakshatra: "Mrigashira",
        sunrise: "6:00 AM",
        sunset: "6:24 PM",
        rahu: "12:18 PM - 1:54 PM"
      };

      // Save to Firestore
      await docRef.set(
        { [city]: data },
        { merge: true }
      );

      console.log("Saved new data");

      res.json(data);

    } catch (error) {
      console.error(error);
      res.status(500).send(error.toString());
    }
  }
);