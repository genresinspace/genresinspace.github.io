import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
  // Track whether user has explicitly set a theme preference
  const [userPreference, setUserPreference] = useState<Theme | null>(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return null;
  });

  // Current effective theme (user preference or system preference)
  const [systemTheme, setSystemTheme] = useState<Theme>(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const theme = userPreference ?? systemTheme;

  useEffect(() => {
    if (userPreference) {
      localStorage.setItem("theme", userPreference);
    } else {
      localStorage.removeItem("theme");
    }
    // Update document class and body class for Tailwind dark mode
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [theme, userPreference]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    setUserPreference((prev) => {
      const currentTheme = prev ?? systemTheme;
      return currentTheme === "light" ? "dark" : "light";
    });
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
