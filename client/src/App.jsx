import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import UploadPage   from "./pages/UploadPage";
import ResultsPage  from "./pages/ResultsPage";
import HistoryPage  from "./pages/HistoryPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                element={<UploadPage />}  />
        <Route path="/results/:run_id" element={<ResultsPage />} />
        <Route path="/history"         element={<HistoryPage />} />
        <Route path="*"                element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
