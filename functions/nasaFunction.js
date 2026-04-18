"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const axios = require("axios");

const NASA_API_KEY = defineSecret("NASA_API_KEY");

if (!getApps().length) initializeApp();
const db = getFirestore();

const TODAY = () => new Date().toISOString().slice(0, 10);

const fetchWithRetry = async (url, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { timeout: 15000 });
      return res.data;
    } catch (e) {
      logger.warn("Retrying...", url);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
};

exports.fetchNASAData = onSchedule(
  {
    schedule: "every 12 hours",
    timeZone: "Asia/Kolkata",
    secrets: [NASA_API_KEY],
  },
  async () => {
    const apiKey = NASA_API_KEY.value();
    const today = TODAY();
    logger.info("🚀 NASA FUNCTION v2 UPDATED");
    logger.info("[NASA] Fetch started");

    // 🚀 APOD
    const apodRes = await fetchWithRetry(
      `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`
    );

    // 🚀 Mars Rover
    const marsRes = await fetchWithRetry(
      `https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/latest_photos?api_key=${apiKey}`
    );

    // 🌍 Earth (EPIC)
    const earthRes = await fetchWithRetry(
      `https://api.nasa.gov/EPIC/api/natural/images?api_key=${apiKey}`
    );

    // ☄️ Asteroids
    const asteroidRes = await fetchWithRetry(
      `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${apiKey}`
    );

    // 🔥 CLEAN + STRUCTURED DATA
    const data = {
      date: today,

      apod: apodRes
  ? {
      title: apodRes.title,
      explanation: apodRes.explanation,
      image: apodRes.url,
      media_type: apodRes.media_type, // 🔥 ADD THIS
      date: apodRes.date,
    }
        : null,

      mars: marsRes?.latest_photos?.slice(0, 5).map(p => ({
        id: p.id,
        img: p.img_src,
        rover: p.rover?.name,
        camera: p.camera?.name,
      })) || [],

      earth: earthRes?.slice(0, 5).map(e => ({
        image: `https://epic.gsfc.nasa.gov/archive/natural/${e.date.slice(0,10).replaceAll("-", "/")}/png/${e.image}.png`,
        caption: e.caption,
      })) || [],

      asteroids:
        asteroidRes?.near_earth_objects?.[today]?.map(a => ({
          id: a.id,
          name: a.name,
          hazardous: a.is_potentially_hazardous_asteroid,
          distance:
            a.close_approach_data?.[0]?.miss_distance?.kilometers,
          velocity:
            a.close_approach_data?.[0]?.relative_velocity?.kilometers_per_hour,
          sizeMin: Math.round(a.estimated_diameter.meters.estimated_diameter_min),
          sizeMax: Math.round(a.estimated_diameter.meters.estimated_diameter_max),
        })) || [],

      updatedAt: Timestamp.now(),
    };

    // ✅ STORE ALWAYS (no partial skip)
    await db.collection("space_nasa").doc(today).set(data, { merge: true });

    logger.info("[NASA] FULL data stored");
  }
);

// 🔧 Manual trigger
exports.manualFetchNASA = onRequest(
  { secrets: [NASA_API_KEY] },
  async (req, res) => {
    try {
      await exports.fetchNASAData.run();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);
