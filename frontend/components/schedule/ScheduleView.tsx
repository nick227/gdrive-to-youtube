import { useMemo, useState } from 'react'
import { MonthHeader } from './MonthHeader'
import { MonthView } from './MonthView'
import { ScheduleItem } from './types'

type ViewMode = 'month' | 'day'

interface Props {
  items: ScheduleItem[];
  onQuickPost(date: string): void;
}

export default function ScheduleView({ items, onQuickPost }: Props) {
  const today = new Date()
  const [view, setView] = useState<ViewMode>('month')
  const [cursorMonth, setCursorMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const monthKey = cursorMonth.toISOString().slice(0, 7)
  const startDay = cursorMonth.getDay()
  const daysInMonth = new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 0).getDate()

  const itemsByDay = useMemo(() => {
    return items.reduce<Record<string, ScheduleItem[]>>((acc, i) => {
      acc[i.date] ??= []
      acc[i.date].push(i)
      return acc
    }, {})
  }, [items])

  return (
    <div>
      <MonthHeader
        label={cursorMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
        onPrev={() => setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() - 1, 1))}
        onNext={() => setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 1))}
      />

      <MonthView
        monthKey={monthKey}
        startDay={startDay}
        daysInMonth={daysInMonth}
        itemsByDay={itemsByDay}
        onOpenDay={(d) => {
          setSelectedDate(d)
        }}
        onQuickPost={onQuickPost}
      />
    </div>
  )
}
