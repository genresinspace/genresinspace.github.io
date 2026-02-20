import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

/** The theme mode */
export type Theme = "light" | "dark";

/** Theme context type */
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Theme provider component that manages light/dark mode */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Theme state - localStorage is the single source of truth
  const [theme, setTheme] = useState<Theme>(() => {
    // Initialize from localStorage, or system preference if not set
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    // Default to system preference
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    // Store the initial system preference
    localStorage.setItem("theme", systemPreference);
    return systemPreference;
  });

  useEffect(() => {
    // Always keep localStorage in sync with state
    localStorage.setItem("theme", theme);

    // Update document class and body class for Tailwind dark mode
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [theme]);

  // Listen for system preference changes and update localStorage/state
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      setTheme(newTheme);
      localStorage.setItem("theme", newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook to access theme context */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
