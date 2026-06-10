import { Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import { LocaleProvider } from "./features/locale/LocaleContext.jsx";
import { WordsProvider } from "./features/words/WordsContext.jsx";
import AddWordPage from "./pages/AddWordPage.jsx";
import FlashcardsPage from "./pages/FlashcardsPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import MistakesPage from "./pages/MistakesPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import QuizPage from "./pages/QuizPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import FishingBlastPage from "./pages/FishingBlastPage.jsx";
import SpellingNinjaPage from "./pages/SpellingNinjaPage.jsx";
import GrammarArenaPage from "./pages/GrammarArenaPage.jsx";
import BattleJetQuizPage from "./pages/BattleJetQuizPage.jsx";
import PenaltyTwelvePage from "./pages/PenaltyTwelvePage.jsx";
import WordKartPage from "./pages/WordKartPage.jsx";
import WordDetailPage from "./pages/WordDetailPage.jsx";
import WordListPage from "./pages/WordListPage.jsx";

function App() {
  return (
    <LocaleProvider>
      <WordsProvider>
        <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/words" element={<WordListPage />} />
          <Route path="/words/new" element={<AddWordPage />} />
          <Route path="/words/:wordId" element={<WordDetailPage />} />
          <Route path="/review/flashcards" element={<FlashcardsPage />} />
          <Route path="/review/quiz" element={<QuizPage />} />
          <Route path="/games/spelling-ninja" element={<SpellingNinjaPage />} />
          <Route path="/games/fishing-blast" element={<FishingBlastPage />} />
          <Route path="/games/word-kart" element={<WordKartPage />} />
          <Route path="/games/grammar-arena" element={<GrammarArenaPage />} />
          <Route path="/games/battle-jet" element={<BattleJetQuizPage />} />
          <Route path="/games/penalty-twelve" element={<PenaltyTwelvePage />} />
          <Route path="/mistakes" element={<MistakesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </AppLayout>
      </WordsProvider>
    </LocaleProvider>
  );
}

export default App;
