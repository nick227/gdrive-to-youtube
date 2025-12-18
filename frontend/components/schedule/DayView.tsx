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
      <button onClick={onBack} className="mb-3 text-2xl cursor-pointer">← Back</button>
      <div className="text-3xl text-neutral-500 bg-gray-50">
        {new Date(date).toDateString()}
      </div>

      {items.length === 0 && (
          <div className="bg-amber-200  text-neutral-400 text-6xl">No uploads scheduled</div>
      )}

      <div className="divide-y">
        {items.sort((a, b) => parseTime(a.time) - parseTime(b.time)).map(i => (
          <div key={i.id} className="py-3 flex gap-4">
            <div className="w-14 text-xl text-neutral-400 mr-2 pt-2">{i.time ?? '—'}</div>
            <div>
              <div className="text-3xl font-medium">{i.title}</div>
              <div className="text-xl text-neutral-500">
                {i.channelTitle} • {i.privacyStatus}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}