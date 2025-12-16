import { ScheduleItem } from './types'
import { MAX_ITEMS_PER_DAY } from './constants'
import { isToday } from './utils'

interface Props {
  date: string
  day: number
  items: ScheduleItem[]
  onOpen(date: string): void
}

export function DayCell({ date, day, items, onOpen }: Props) {
  return (
    <div
      tabIndex={0}
      onClick={() => onOpen(date)}
      onKeyDown={e => e.key === 'Enter' && onOpen(date)}
      className={`p-2 h-16 cursor-pointer ${isToday(date) ? 'bg-cyan-50' : 'bg-white'}`}
    >
      <div className="text-xs text-neutral-500 mb-1">{day}</div>
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