
import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 py-4 px-6 md:px-12 glass animate-slide-down">
      <div className="container max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <h1 className="logo text-2xl font-bold tracking-wide">BitRoute</h1>
        </Link>
        <nav className="flex items-center gap-6">
          <Link to="/" className="text-sm font-medium transition-colors hover:text-primary">
            Home
          </Link>
          <Link to="/transfer" className="text-sm font-medium transition-colors hover:text-primary">
            Transfer
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
