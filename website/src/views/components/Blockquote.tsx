/**
 * Renders a blockquote.
 */
export function Blockquote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="pl-4 m-0 border-l-4 border-gray-300 dark:border-gray-700 italic text-gray-700 dark:text-gray-300 inline-block">
      {children}
    </blockquote>
  );
}
