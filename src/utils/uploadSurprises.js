import { doc, setDoc } from "firebase/firestore"
import { db } from "../firebase"
import data from "../data/surprise_pack_100.json"

export async function uploadSurprises() {
  try {
    for (const item of data) {
      await setDoc(doc(db, "surprise_cards", item.factId), item)
    }

    console.log("✅ Uploaded all surprise cards")
    alert("Uploaded all surprise cards")
  } catch (e) {
    console.error("Upload error:", e)
    alert("Upload failed")
  }
}