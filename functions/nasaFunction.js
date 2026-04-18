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

const fetchEarthImages = async (apiKey) => {
  const datesToTry = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(Date.now() - i * 86400000)
      .toISOString()
      .slice(0, 10);
    datesToTry.push(d);
  }

  for (const date of datesToTry) {
    const res = await fetchWithRetry(
      `https://api.nasa.gov/EPIC/api/natural/date/${date}?api_key=${apiKey}`
    );

    if (res && res.length > 0) {
      logger.info("Earth fallback used");
      return res.slice(0, 12).map(e => ({
        image: `https://epic.gsfc.nasa.gov/archive/natural/${e.date
          .slice(0, 10)
          .replaceAll("-", "/")}/png/${e.image}.png`,
        caption: e.caption,
      }));
    }
  }

  return [];
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

    const [apodRes, earthRes, sunRes, asteroidRes] = await Promise.all([
      fetchWithRetry(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`).catch(() => null),
      fetchEarthImages(apiKey).catch(() => []),
      fetchWithRetry(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}&count=5`).catch(() => []),
      fetchWithRetry(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${apiKey}`).catch(() => null)
    ]);

    logger.info("Earth count:", earthRes?.length || 0);
    logger.info("Sun count:", sunRes?.length || 0);

    // 🔥 CLEAN + STRUCTURED DATA
    const data = {
      date: today,

      apod: apodRes && apodRes.url
        ? {
          title: apodRes.title,
          explanation: apodRes.explanation,
          image: apodRes.url,
          media_type: apodRes.media_type,
          date: apodRes.date,
        }
        : {
          title: "Space Image",
          explanation: "Fallback image",
          image: "https://apod.nasa.gov/apod/image/1901/IC405_Abolfath_3952.jpg",
          media_type: "image",
          date: today,
        },

      earth: earthRes || [],

      sun: sunRes?.map(s => ({
        image: s.url,
        title: s.title,
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
