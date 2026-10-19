import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import { Loading } from "./components/ui";
import { AuthProvider, useAuth } from "./lib/auth";
import Analysis from "./pages/Analysis";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Diagnostic from "./pages/Diagnostic";
import History from "./pages/History";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Portfolio from "./pages/Portfolio";
import References from "./pages/References";
import RoadmapPage from "./pages/Roadmap";
import Settings from "./pages/Settings";
import Skills from "./pages/Skills";
import SyllabusPage from "./pages/Syllabus";
import Teacher from "./pages/Teacher";
import TrackPage from "./pages/Track";

function Protected({ children, needsOnboarding = true }: { children: ReactNode; needsOnboarding?: boolean }) {
  const { user, profile, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-10"><Loading /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (needsOnboarding && profile && !profile.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/onboarding" element={<Protected needsOnboarding={false}><Onboarding /></Protected>} />
      <Route path="/assessment" element={<Protected needsOnboarding={false}><Diagnostic /></Protected>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/track/:track" element={<TrackPage />} />
        <Route path="/teacher" element={<Teacher />} />
        <Route path="/teacher/:cid" element={<Teacher />} />
        <Route path="/syllabus" element={<SyllabusPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/analysis/:aid" element={<Analysis />} />
        <Route path="/references" element={<References />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></StrictMode>,
);
