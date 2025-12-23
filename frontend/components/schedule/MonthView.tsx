import { DAYS } from './constants'
import { ScheduleItem } from './types'
import { DayCell } from './DayCell'

interface Props {
  monthKey: string
  startDay: number
  daysInMonth: number
  itemsByDay: Record<string, ScheduleItem[]>
  onOpenDay(date: string): void
  onQuickPost(date: string): void
}

export function MonthView({ monthKey, startDay, daysInMonth, itemsByDay, onOpenDay, onQuickPost }: Props) {
  return (
    <>
      <div className="grid grid-cols-7 text-xs text-neutral-500 mb-2 w-full">
        {DAYS.map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-px bg-neutral-200 w-full">
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={i} className="bg-white h-32" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const date = `${monthKey}-${String(day).padStart(2, '0')}`
          return (
            <DayCell
              key={date}
              date={date}
              day={day}
              items={itemsByDay[date] ?? []}
              onOpen={onOpenDay}
              onQuickPost={onQuickPost}
            />
          )
        })}
      </div>
    </>
  )
}
