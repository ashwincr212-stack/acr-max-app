// AstroRouter.jsx
// Thin state-based router for the Astro feature.
// Drop-in replacement for wherever your app renders the old Astro.jsx.
//
// Usage in Home.jsx or your tab renderer:
//   {currentPage === "astro" && <AstroRouter onBack={() => setCurrentPage("home")} />}
//
// That's it. No other changes needed.

import React, { useState } from "react";
import AstroHome from "./AstroHome";
import AstroDaily from "./AstroDaily";
import AstroDetails from "./AstroDetails";
import AstroFestivals from "./AstroFestivals";

export default function AstroRouter({ onBack }) {
  const [page, setPage]   = useState("home");
  const [prefs, setPrefs] = useState({ location: "Chennai", lang: "en" });

  const handleNavigate = (target, newPrefs) => {
    if (newPrefs) setPrefs(newPrefs);
    setPage(target);
  };

  const backToHome = () => setPage("home");

  if (page === "daily") {
    return <AstroDaily location={prefs.location} lang={prefs.lang} onBack={backToHome}/>;
  }
  if (page === "details") {
    return <AstroDetails location={prefs.location} lang={prefs.lang} onBack={backToHome}/>;
  }
  if (page === "festivals") {
    return <AstroFestivals location={prefs.location} lang={prefs.lang} onBack={backToHome}/>;
  }

  return <AstroHome onNavigate={handleNavigate} onBack={onBack}/>;
}