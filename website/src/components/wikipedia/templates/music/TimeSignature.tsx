/**
 * Component for rendering time signatures
 */
export function TimeSignature({
  numerator,
  denominator,
}: {
  numerator: string;
  denominator: string;
}) {
  return (
    <span className="inline-flex flex-col items-center justify-center leading-tight text-xs align-middle">
      <span className="text-center leading-none">{numerator}</span>
      <span className="text-center leading-none">{denominator}</span>
    </span>
  );
}
