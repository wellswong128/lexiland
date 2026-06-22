import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import { LocaleProvider } from "./features/locale/LocaleContext.jsx";
import { useWordsContext, WordsProvider } from "./features/words/WordsContext.jsx";
import { canRoute, getRoleFromUser } from "./lib/authorization.js";

const LearningReportPage = lazy(() => import("./pages/LearningReportPage.jsx"));
const AchievementsPage = lazy(() => import("./pages/AchievementsPage.jsx"));
const AdminUserRolesPage = lazy(() => import("./pages/AdminUserRolesPage.jsx"));
const AdminWordbasePage = lazy(() => import("./pages/AdminWordbasePage.jsx"));
const AdminWordbaseLibraryPage = lazy(() => import("./pages/AdminWordbaseLibraryPage.jsx"));
const AddWordPage = lazy(() => import("./pages/AddWordPage.jsx"));
const AuthPage = lazy(() => import("./pages/AuthPage.jsx"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage.jsx"));
const BattleJetQuizPage = lazy(() => import("./pages/BattleJetQuizPage.jsx"));
const FishingBlastPage = lazy(() => import("./pages/FishingBlastPage.jsx"));
const DeepSeaFishingPage = lazy(() => import("./pages/DeepSeaFishingPage.jsx"));
const FlashcardsPage = lazy(() => import("./pages/FlashcardsPage.jsx"));
const GrammarArenaPage = lazy(() => import("./pages/GrammarArenaPage.jsx"));
const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const InstallPage = lazy(() => import("./pages/InstallPage.jsx"));
const MistakesPage = lazy(() => import("./pages/MistakesPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));
const PenaltyTwelvePage = lazy(() => import("./pages/PenaltyTwelvePage.jsx"));
const QuizPage = lazy(() => import("./pages/QuizPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const SpeedRacingPage = lazy(() => import("./pages/SpeedRacingPage.jsx"));
const SpellingNinjaPage = lazy(() => import("./pages/SpellingNinjaPage.jsx"));
const WordDetailPage = lazy(() => import("./pages/WordDetailPage.jsx"));
const WordKartPage = lazy(() => import("./pages/WordKartPage.jsx"));
const WordListPage = lazy(() => import("./pages/WordListPage.jsx"));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <p className="text-sm font-medium text-slate-600">Loading...</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthLoading, user } = useWordsContext();
  const role = getRoleFromUser(user);

  if (isAuthLoading) {
    return null;
  }

  if (canRoute(role, location.pathname)) {
    return children;
  }

  if (!user) {
    return (
      <Navigate
        replace
        to={`/auth?mode=login&redirect=${encodeURIComponent(
          `${location.pathname}${location.search}`,
        )}`}
      />
    );
  }

  return <Navigate replace to="/" />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/learning-report" element={<ProtectedRoute><LearningReportPage /></ProtectedRoute>} />
        <Route path="/achievements" element={<ProtectedRoute><AchievementsPage /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><AdminUserRolesPage /></ProtectedRoute>} />
        <Route path="/admin/wordbase" element={<ProtectedRoute><AdminWordbasePage /></ProtectedRoute>} />
        <Route path="/admin/wordbase-library" element={<ProtectedRoute><AdminWordbaseLibraryPage /></ProtectedRoute>} />
        <Route path="/words" element={<ProtectedRoute><WordListPage /></ProtectedRoute>} />
        <Route path="/words/new" element={<ProtectedRoute><AddWordPage /></ProtectedRoute>} />
        <Route path="/words/:wordId" element={<ProtectedRoute><WordDetailPage /></ProtectedRoute>} />
        <Route path="/review/flashcards" element={<ProtectedRoute><FlashcardsPage /></ProtectedRoute>} />
        <Route path="/review/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
        <Route path="/games/spelling-ninja" element={<ProtectedRoute><SpellingNinjaPage /></ProtectedRoute>} />
        <Route path="/games/fishing-blast" element={<ProtectedRoute><FishingBlastPage /></ProtectedRoute>} />
        <Route path="/games/deep-sea-fishing" element={<ProtectedRoute><DeepSeaFishingPage /></ProtectedRoute>} />
        <Route path="/games/word-kart" element={<ProtectedRoute><WordKartPage /></ProtectedRoute>} />
        <Route path="/games/grammar-arena" element={<ProtectedRoute><GrammarArenaPage /></ProtectedRoute>} />
        <Route path="/games/battle-jet" element={<ProtectedRoute><BattleJetQuizPage /></ProtectedRoute>} />
        <Route path="/games/penalty-twelve" element={<ProtectedRoute><PenaltyTwelvePage /></ProtectedRoute>} />
        <Route path="/games/speed-racing" element={<ProtectedRoute><SpeedRacingPage /></ProtectedRoute>} />
        <Route path="/mistakes" element={<ProtectedRoute><MistakesPage /></ProtectedRoute>} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/install" element={<InstallPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <LocaleProvider>
      <WordsProvider>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </WordsProvider>
    </LocaleProvider>
  );
}

export default App;
