import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import Avatar from "./components/Avatar";
import Shell from "./components/Shell";
import { Loading } from "./components/ui";
import { SessionProvider, useSession } from "./lib/session";
import Home from "./pages/Home";
import Practice from "./pages/Practice";
import Progress from "./pages/Progress";
import RoadmapPage from "./pages/RoadmapPage";
import Start from "./pages/Start";
import Studio from "./pages/Studio";

function App() {
  const { ready, error, refresh } = useSession();
  if (!ready) return <div className="grid min-h-dvh place-items-center"><Loading label="Opening ArtOfSoul.N" /></div>;
  if (error) return (
    <div className="mx-auto grid min-h-dvh max-w-lg place-items-center p-6 text-center">
      <div><Avatar mood="thinking" size={200} />
        <h1 className="mt-4 text-3xl">I can't reach the ArtOfSoul.N server</h1>
        <p className="mt-2 text-ink-soft">Start it by double-clicking <strong>start-backend.bat</strong>, wait for “Uvicorn running”, then try again.</p>
        <button className="btn-big mt-6" onClick={refresh}>Try again</button></div>
    </div>);
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/start" element={<Start />} />
      <Route element={<Shell />}>
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/studio/:lessonId" element={<Studio />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/:lessonId" element={<Practice />} />
        <Route path="/progress" element={<Progress />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><BrowserRouter><SessionProvider><App /></SessionProvider></BrowserRouter></StrictMode>,
);
