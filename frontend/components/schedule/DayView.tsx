import { ScheduleItem } from './types'
import { parseTime } from './utils'

interface Props {
  date: string
  items: ScheduleItem[]
  onBack(): void
}

export function DayView({ date, items, onBack }: Props) {
  return (
    <div className='p-4'>
      <button onClick={onBack} className="mb-3 text-sm">← Back</button>
      <div className="text-sm text-neutral-500 mb-4">
        {new Date(date).toDateString()}
      </div>

      {items.length === 0 && (
        <div className="text-sm text-neutral-400">No uploads scheduled</div>
      )}

      <div className="divide-y">
        {items.sort((a,b) => parseTime(a.time) - parseTime(b.time)).map(i => (
          <div key={i.id} className="py-3 flex gap-4">
            <div className="w-14 text-xs text-neutral-400">{i.time ?? '—'}</div>
            <div>
              <div className="text-sm font-medium">{i.title}</div>
              <div className="text-xs text-neutral-500">
                {i.channelTitle} • {i.privacyStatus}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}