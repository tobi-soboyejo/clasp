import { Link, NavLink, Route, Routes } from "react-router-dom";
import { EXPLORER_URL, HANDSHAKE_ADDRESS } from "./lib/config";
import { ConnectButton } from "./components/ConnectButton";
import { Home } from "./screens/Home";
import { NewAgreement } from "./screens/NewAgreement";
import { AgreementDetail } from "./screens/AgreementDetail";
import { Lookup } from "./screens/Lookup";
import { Board } from "./screens/Board";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-lockup">
          <img src="/logo.svg" alt="" className="brand-logo" />
          <div className="brand">
            <Link to="/" className="wordmark">
              Hand<em>shake</em>
            </Link>
            <span className="header-sub">Monad Testnet · Registry Nº 10143</span>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/new">New agreement</NavLink>
          <NavLink to="/lookup">Look up a wallet</NavLink>
          <NavLink to="/board">Board</NavLink>
        </nav>
        <ConnectButton />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewAgreement />} />
          <Route path="/agreement/:id" element={<AgreementDetail />} />
          <Route path="/lookup" element={<Lookup />} />
          <Route path="/lookup/:address" element={<Lookup />} />
          <Route path="/board" element={<Board />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <span>A registry, not an escrow — no funds ever move onchain.</span>
        <a
          href={`${EXPLORER_URL}/address/${HANDSHAKE_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
        >
          Contract on Monad testnet
        </a>
        <a
          href="https://github.com/tobi-soboyejo/handshake"
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      </footer>
    </div>
  );
}
