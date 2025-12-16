export interface ScheduleItem {
  id: number
  date: string
  time?: string
  title: string
  status: string
  channelTitle?: string | null
  privacyStatus: string
}