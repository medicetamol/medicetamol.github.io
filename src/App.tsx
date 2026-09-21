import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from "react";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import ExamSelect from "./pages/ExamSelect";
import SubjectSelect from "./pages/SubjectSelect";
import Subject from "./pages/Subject";
import ModuleBuilder from "./pages/ModuleBuilder";
import ModuleBuilderTopics from "./pages/ModuleBuilderTopics";
import ModuleBuilderCraft from "./pages/ModuleBuilderCraft";
import ModuleBuilderSolve from "./pages/ModuleBuilderSolve";
import SharedModule from "./pages/SharedModule";
import Quiz from "./pages/Quiz";
import Result from "./pages/Result";
import Progress from "./pages/Progress";
import AIPrompt from "./pages/AIPrompt";
import Bookmarks from "./pages/Bookmarks";
import BookmarkQuiz from "./pages/BookmarkQuiz";
import About from "./pages/About";
import Settings from "./pages/Settings";

// React Router doesn't reset scroll position on navigation by default, so a
// scrolled-down page (e.g. reading the bottom of Home) leaves new pages
// opened mid-scroll too. Resets to top on every route change, app-wide.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <Layout>
      <ScrollToTop />
      {/* key={pathname}: after a crash, navigating anywhere resets the boundary. */}
      <ErrorBoundary key={pathname}>
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

        {/* Direct subject PYQ drill */}
        <Route path="/quiz/:exam/:subjectId" element={<Quiz />} />
        {/* Custom module (source=custom, mode=quiz|guide in search params) */}
        <Route path="/quiz/:exam/custom" element={<Quiz />} />
        {/* Shared solve link */}
        <Route path="/solve/:questionId" element={<Quiz />} />
        <Route path="/ai/:questionId" element={<AIPrompt />} />
        {/* Summary (formerly Result) */}
        <Route path="/result/:exam" element={<Result />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/bookmarks/:subjectId" element={<BookmarkQuiz />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      </ErrorBoundary>
    </Layout>
  );
}