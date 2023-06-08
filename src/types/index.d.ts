import { STask } from 'obsidian-dataview'
import { GroupProps } from '../components/Block'
import { EventComponentProps } from '../components/Event'
import { TaskComponentProps } from '../components/Task'

declare global {
  type EventProps = {
    id: string
    start: string
    end: string
    title: string
    calendarName: string
    calendarId: string
    color: string
    notes?: string
    location?: string
    type: 'event'
  }

  type TaskProps = {
    id: string
    type: 'task' | 'child' | 'parent' | 'deadline' | 'link'
    title: string
    notes?: string
    tags: string[]
    area: string
    children: string[]
    position: STask['position']
    path: string
    extraFields?: Record<string, string>
    length?: { hour: number; minute: number }
    parent?: string
    heading?: string

    // TASKS values, to be translated to emojis if setting is enabled
    created?: string
    start?: string
    scheduled?: string
    priority: number
    due?: string
    completion?: string
  }

  type GoogleEvent = {
    id: string
    summary?: string
    description?: string
    location?: string
  } & (
    | {
        start: { date: string; dateTime?: null }
        end: { date: string; dateTime?: null }
      }
    | {
        start: { dateTime: string; date?: null }
        end: { dateTime: string; date?: null }
      }
  )

  type GoogleCalendar = {
    id: string
    summary: string
    backgroundColor: string
    primary: boolean
    deleted: boolean
  }

  type DragData =
    | ({ dragType: 'group' } & GroupProps)
    | ({ dragType: 'task' } & TaskComponentProps)
    | ({ dragType: 'event' } & EventComponentProps)
    | { dragType: 'new'; path: string }
    | ({ dragType: 'task-length' } & { id: string; start: string })

  type DropData = Partial<TaskProps>
}
