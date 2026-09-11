import { Route, Routes } from 'react-router-dom';
import Layout from "./components/Layout";
import Home from "./pages/Home";
import ExamSelect from "./pages/ExamSelect";
import SubjectSelect from "./pages/SubjectSelect";
import Subject from "./pages/Subject";
import ModuleBuilder from "./pages/ModuleBuilder";
import Quiz from "./pages/Quiz";
import Result from "./pages/Result";
import Progress from "./pages/Progress";
import AIPrompt from "./pages/AIPrompt";
import Bookmarks from "./pages/Bookmarks";
import BookmarkQuiz from "./pages/BookmarkQuiz";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pyqs" element={<ExamSelect />} />
        <Route path="/pyqs/:exam" element={<SubjectSelect />} />
        <Route path="/pyqs/:exam/:subjectId" element={<Subject />} />
        <Route path="/module/:exam" element={<ModuleBuilder />} />
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
      </Routes>
    </Layout>
  );
}