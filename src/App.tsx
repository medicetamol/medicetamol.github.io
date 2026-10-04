import { Route, Routes, useLocation } from 'react-router-dom';
import { refreshIfStale } from "./lib/autoRefresh";
import { useDataVersion } from "./lib/dataVersion";
import { lazy, Suspense, useEffect } from "react";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
const ExamSelect = lazy(() => import("./pages/ExamSelect"));
const SubjectSelect = lazy(() => import("./pages/SubjectSelect"));
const Subject = lazy(() => import("./pages/Subject"));
const ModuleBuilder = lazy(() => import("./pages/ModuleBuilder"));
const ModuleBuilderTopics = lazy(() => import("./pages/ModuleBuilderTopics"));
const ModuleBuilderCraft = lazy(() => import("./pages/ModuleBuilderCraft"));
const ModuleBuilderSolve = lazy(() => import("./pages/ModuleBuilderSolve"));
const SharedModule = lazy(() => import("./pages/SharedModule"));
const SolvedModules = lazy(() => import("./pages/SolvedModules"));
const Quiz = lazy(() => import("./pages/Quiz"));
const Result = lazy(() => import("./pages/Result"));
const Progress = lazy(() => import("./pages/Progress"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const BookmarkQuiz = lazy(() => import("./pages/BookmarkQuiz"));
const About = lazy(() => import("./pages/About"));
const Settings = lazy(() => import("./pages/Settings"));
const ReportError = lazy(() => import("./pages/ReportError"));

// React Router doesn't reset scroll position on navigation by default, so a
// scrolled-down page (e.g. reading the bottom of Home) leaves new pages
// opened mid-scroll too. Resets to top on every route change, app-wide.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    refreshIfStale(pathname); // deferred 6h+ refresh, once the user is on a safe page
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const dataVersion = useDataVersion();
  return (
    <Layout>
      <ScrollToTop />
      {/* key={pathname}: after a crash, navigating anywhere resets the boundary. */}
      <ErrorBoundary key={`${pathname}:${dataVersion}`}>
      <Suspense fallback={<div className="min-h-[60vh]" aria-hidden="true" />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/pyqs" element={<ExamSelect />} />
        <Route path="/pyqs/:exam" element={<SubjectSelect />} />
        <Route path="/pyqs/:exam/:subjectId" element={<Subject />} />

        {/* Module Builder — Step 1: subject list */}
        <Route path="/module/:exam" element={<ModuleBuilder />} />
        {/* Module Builder — Step 1b: topic picker per subject */}
        <Route path="/module/:exam/topics/:subjectId" element={<ModuleBuilderTopics />} />
        {/* Module Builder — Step 2: crafting page (status/mode/count + bg fetch) */}
        <Route path="/module/:exam/craft" element={<ModuleBuilderCraft />} />
        {/* Module Builder — Step 3: solve module (share link + begin quiz) */}
        <Route path="/module/:exam/solve" element={<ModuleBuilderSolve />} />
        {/* Shared module landing (decodes short link, then hands off to Step 3) */}
        <Route path="/custom/module" element={<SharedModule />} />
        {/* Custom module attempt history (last 10, capped) */}
        <Route path="/modules/history" element={<SolvedModules />} />

        {/* Direct subject PYQ drill */}
        <Route path="/quiz/:exam/:subjectId" element={<Quiz />} />
        {/* Custom module (source=custom, mode=quiz|guide in search params) */}
        <Route path="/quiz/:exam/custom" element={<Quiz />} />
        {/* Shared solve link */}
        <Route path="/solve/:questionId" element={<Quiz />} />
        {/* Summary (formerly Result) */}
        <Route path="/result/:exam" element={<Result />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/bookmarks/:subjectId" element={<BookmarkQuiz />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/report/:questionId?" element={<ReportError />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}