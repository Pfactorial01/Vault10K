import { Link, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import IngestPage from "./pages/IngestPage";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          Vault10K
        </Link>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/ingest">Ingestion</Link>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/ingest" element={<IngestPage />} />
        </Routes>
      </main>
    </div>
  );
}
