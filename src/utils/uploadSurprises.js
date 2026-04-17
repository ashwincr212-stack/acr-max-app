import { collection, addDoc } from "firebase/firestore"
import { db } from "../firebase"
import data from "../data/surprise_pack1.json"

export async function uploadSurprises() {
  try {
    for (const item of data) {
      await addDoc(collection(db, "surprise_cards"), item)
    }
    console.log("✅ Uploaded all surprise cards")
    alert("Uploaded all surprise cards")
  } catch (e) {
    console.error("Upload error:", e)
    alert("Upload failed")
  }
}