import { usePersistedToggle } from '../../hooks/usePersistedToggle';
import type { ScheduleItem } from '../schedule/types';
import ScheduleView from '../schedule/ScheduleView';

interface ScheduleSectionProps {
  items: ScheduleItem[];
  onQuickPost(date: string): void;
}

export function ScheduleSection({ items, onQuickPost }: ScheduleSectionProps) {
  const schedule = usePersistedToggle('scheduleOpen', false);

  return (
    <section className="mt-2">
      <div
        onClick={schedule.toggle}
        className="flex cursor-pointer justify-between bg-slate-50 p-3"
      >
        <h3 className="section-title m-0">Schedule</h3>
        <i className={`fa-solid fa-chevron-${schedule.open ? 'up' : 'down'}`} />
      </div>

      {schedule.open && (
        <div className="mb-8 mt-2">
          <ScheduleView items={items} onQuickPost={onQuickPost} />
        </div>
      )}
    </section>
  );
}
