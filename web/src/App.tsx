import { Link, NavLink, Route, Routes } from "react-router-dom";
import { ConnectButton } from "./components/ConnectButton";
import { NewAgreement } from "./screens/NewAgreement";
import { AgreementDetail } from "./screens/AgreementDetail";
import { Lookup } from "./screens/Lookup";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="wordmark">
          Handshake
        </Link>
        <nav>
          <NavLink to="/">New agreement</NavLink>
          <NavLink to="/lookup">Look up a wallet</NavLink>
        </nav>
        <ConnectButton />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<NewAgreement />} />
          <Route path="/agreement/:id" element={<AgreementDetail />} />
          <Route path="/lookup" element={<Lookup />} />
          <Route path="/lookup/:address" element={<Lookup />} />
        </Routes>
      </main>
    </div>
  );
}
