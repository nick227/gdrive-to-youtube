import { ScheduleItem } from './types'
import { MAX_ITEMS_PER_DAY } from './constants'
import { isToday } from './utils'

interface Props {
  date: string
  day: number
  items: ScheduleItem[]
  onOpen(date: string): void
  onQuickPost(date: string): void
}

export function DayCell({ date, day, items, onOpen, onQuickPost }: Props) {
  return (
    <div
      tabIndex={0}
      onClick={() => onOpen(date)}
      onKeyDown={e => e.key === 'Enter' && onOpen(date)}
      className={`p-2 h-32 ${isToday(date) ? 'bg-cyan-50' : 'bg-white'}`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="text-xs text-neutral-500">{day}</div>
        <button
          type="button"
          className="btn btn-small"
          onClick={(e) => {
            e.stopPropagation()
            onQuickPost(date)
          }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={`Schedule a YouTube post for ${date}`}
        >
          post
        </button>
      </div>
      {items.slice(0, MAX_ITEMS_PER_DAY).map(i => (
        <div key={i.id} className="text-xs truncate bg-amber-200">{i.title}</div>
      ))}
      {items.length > MAX_ITEMS_PER_DAY && (
        <div className="text-xs text-neutral-400">
          +{items.length - MAX_ITEMS_PER_DAY} more
        </div>
      )}
    </div>
  )
}
