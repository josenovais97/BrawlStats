/** A burst of confetti over the page; a new `burst` number fires another. */
export function Confetti({ burst }: { burst: number }) {
  if (burst === 0) return null;
  const colors = ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#ffffff', '#fb923c'];
  return (
    <div key={burst} className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {Array.from({ length: 60 }, (_unused, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-[-5%] block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 12) * 40}ms`,
            animationDuration: `${1400 + ((i * 53) % 900)}ms`,
            ['--drift' as string]: `${((i * 29) % 160) - 80}px`,
            ['--spin' as string]: `${((i * 71) % 720) - 360}deg`,
          }}
        />
      ))}
    </div>
  );
}
