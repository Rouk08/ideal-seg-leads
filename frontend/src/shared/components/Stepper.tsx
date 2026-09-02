export function Stepper({ total, current }: { total: number; current: number }) {
  return (
    <div className="stepper" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`stepper-dot ${i < current ? 'done' : i === current ? 'current' : ''}`} />
      ))}
    </div>
  );
}
