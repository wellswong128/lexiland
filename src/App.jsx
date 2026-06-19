import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import { LocaleProvider } from "./features/locale/LocaleContext.jsx";
import { useWordsContext, WordsProvider } from "./features/words/WordsContext.jsx";
import AchievementsPage from "./pages/AchievementsPage.jsx";
import AdminUserRolesPage from "./pages/AdminUserRolesPage.jsx";
import AddWordPage from "./pages/AddWordPage.jsx";
import FlashcardsPage from "./pages/FlashcardsPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import InstallPage from "./pages/InstallPage.jsx";
import MistakesPage from "./pages/MistakesPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import QuizPage from "./pages/QuizPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import FishingBlastPage from "./pages/FishingBlastPage.jsx";
import SpellingNinjaPage from "./pages/SpellingNinjaPage.jsx";
import GrammarArenaPage from "./pages/GrammarArenaPage.jsx";
import BattleJetQuizPage from "./pages/BattleJetQuizPage.jsx";
import PenaltyTwelvePage from "./pages/PenaltyTwelvePage.jsx";
import WordKartPage from "./pages/WordKartPage.jsx";
import WordDetailPage from "./pages/WordDetailPage.jsx";
import WordListPage from "./pages/WordListPage.jsx";
import { canRoute, getRoleFromUser } from "./lib/authorization.js";

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

function App() {
  return (
    <LocaleProvider>
      <WordsProvider>
        <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/achievements" element={<ProtectedRoute><AchievementsPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminUserRolesPage /></ProtectedRoute>} />
          <Route path="/words" element={<ProtectedRoute><WordListPage /></ProtectedRoute>} />
          <Route path="/words/new" element={<ProtectedRoute><AddWordPage /></ProtectedRoute>} />
          <Route path="/words/:wordId" element={<ProtectedRoute><WordDetailPage /></ProtectedRoute>} />
          <Route path="/review/flashcards" element={<ProtectedRoute><FlashcardsPage /></ProtectedRoute>} />
          <Route path="/review/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
          <Route path="/games/spelling-ninja" element={<ProtectedRoute><SpellingNinjaPage /></ProtectedRoute>} />
          <Route path="/games/fishing-blast" element={<ProtectedRoute><FishingBlastPage /></ProtectedRoute>} />
          <Route path="/games/word-kart" element={<ProtectedRoute><WordKartPage /></ProtectedRoute>} />
          <Route path="/games/grammar-arena" element={<ProtectedRoute><GrammarArenaPage /></ProtectedRoute>} />
          <Route path="/games/battle-jet" element={<ProtectedRoute><BattleJetQuizPage /></ProtectedRoute>} />
          <Route path="/games/penalty-twelve" element={<ProtectedRoute><PenaltyTwelvePage /></ProtectedRoute>} />
          <Route path="/mistakes" element={<ProtectedRoute><MistakesPage /></ProtectedRoute>} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </AppLayout>
      </WordsProvider>
    </LocaleProvider>
  );
}

export default App;
