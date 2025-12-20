import { ScheduleItem } from './types'
import { parseTime } from './utils'

interface Props {
  date: string
  items: ScheduleItem[]
  onBack(): void
}

/* ---------- config ---------- */
const HEIGHT = 850
const HOURS = 12
const ROW_H = HEIGHT / HOURS

const hourLabel = (h: number) =>
  `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`

/* ---------- helpers ---------- */
const groupByHour = (items: ScheduleItem[]) =>
  items.reduce(
    (acc, item) => {
      if (!item.time) {
        acc.unscheduled.push(item)
        return acc
      }
      const hour = Math.floor(parseTime(item.time) / 60)
      acc.byHour[hour] ??= []
      acc.byHour[hour].push(item)
      return acc
    },
    { byHour: {} as Record<number, ScheduleItem[]>, unscheduled: [] as ScheduleItem[] }
  )

const renderItems = (list?: ScheduleItem[]) =>
  list?.map(item => (
    <div key={item.id} className="rounded-md bg-black text-white px-2 py-1.5">
      <div className="font-medium leading-tight text-sm">{item.title}</div>
      <div className="text-xs opacity-70 mt-0.5">
        {item.channelTitle} • {item.privacyStatus}
      </div>
    </div>
  ))

/* ---------- view ---------- */
export function DayView({ date, items, onBack }: Props) {
  const { byHour, unscheduled } = groupByHour(items)
  const hasScheduledItems = Object.keys(byHour).length > 0

  return (
    <div className="p-6 w-full">
      <button 
        onClick={onBack} 
        className="text-lg text-black mb-4 hover:opacity-70 transition-opacity"
        aria-label="Go back"
      >
        ← Back
      </button>
      
      <h2 className="text-xl font-medium text-black mb-6">
        {new Date(date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
      </h2>

      {unscheduled.length > 0 && (
        <section className="mb-6" aria-label="Unscheduled items">
          <h3 className="text-xs uppercase tracking-wide text-black mb-2 font-semibold">
            Unscheduled
          </h3>
          <div className="flex gap-2 flex-wrap">
            {renderItems(unscheduled)}
          </div>
        </section>
      )}

      {hasScheduledItems ? (
        <div
          className="grid grid-cols-2 w-full rounded-xl border border-black bg-white overflow-hidden"
          style={{ height: HEIGHT }}
          role="table"
          aria-label="Daily schedule"
        >
          {Array.from({ length: HOURS }, (_, h) => (
            <div
              key={h}
              className="col-span-2 grid grid-cols-2 border-b last:border-b-0 border-black"
              style={{ height: ROW_H }}
            >
              {[h, h + 12].map(hour => (
                <div
                  key={hour}
                  className="flex gap-6 px-6 py-4 items-start border-l first:border-l-0 border-black"
                >
                  <div className="text-sm font-semibold text-black w-20 flex-shrink-0">
                    {hourLabel(hour)}
                  </div>
                  <div className="space-y-2 flex-1">
                    {renderItems(byHour[hour])}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-black opacity-60">
          No uploads scheduled for this day
        </div>
      )}
    </div>
  )
}