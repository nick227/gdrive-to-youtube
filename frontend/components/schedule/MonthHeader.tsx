interface Props {
  label: string
  onPrev(): void
  onNext(): void
}

function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function MonthHeader({ label, onPrev, onNext }: Props) {
  return (
    <div className="flex items-center justify-between mb-4 w-[640px]">
      <button
        aria-label="Previous month"
        onClick={onPrev}
        className="p-1 rounded hover:bg-neutral-100"
      >
        <ArrowLeft />
      </button>

      <div className="font-medium tracking-tight">{label}</div>

      <button
        aria-label="Next month"
        onClick={onNext}
        className="p-1 rounded hover:bg-neutral-100"
      >
        <ArrowRight />
      </button>
    </div>
  )
}
