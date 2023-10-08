import { STask } from 'obsidian-dataview'
import { GroupProps } from '../components/Group'
import { EventComponentProps } from '../components/Event'
import { TaskComponentProps } from '../components/Task'
import { DueDateComponentProps } from '../components/DueDate'

declare global {
  type FieldFormat = {
    main: 'dataview' | 'full-calendar' | 'tasks' | 'simple' | 'kanban'
    reminder: 'native' | 'tasks' | 'kanban'
    scheduled: 'default' | 'kanban'
  }

  type EventProps = {
    id: string
    startISO: string
    endISO: string
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
    page: boolean
    type: 'task' | 'parent' | 'deadline' | 'link' | 'search'
    title: string
    originalTitle: string
    originalText: string
    notes?: string
    tags: string[]
    children: string[]
    position: STask['position']
    path: string
    extraFields?: Record<string, string>
    length?: { hour: number; minute: number }
    parent?: string
    heading?: string
    status: string
    blockReference?: string
    fieldFormat: FieldFormat['main']

    // Obsidian Reminder
    reminder?: string

    // TASKS values, to be translated to emojis if setting is enabled
    created?: string
    start?: string
    scheduled?: string
    priority: number
    due?: string
    completion?: string
    repeat?: string
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
    | { dragType: 'new'; path: string; isPage: boolean }
    | ({ dragType: 'task-length' } & {
        id: string
        start: string
        end?: string
      })
    | ({ dragType: 'time' } & { start: string; end?: string })
    | ({ dragType: 'due' } & DueDateComponentProps)
    | { dragType: 'new_button' }

  type DropData = Partial<TaskProps> | { type: 'heading'; heading: string }

  type BlockData = [string, (EventProps | TaskProps)[]]
}

declare module 'obsidian' {
  interface Vault {
    getConfig: (key: string) => string | string[] | undefined
    readConfigJson: (
      path: string
    ) => Promise<Record<string, string | number | boolean>>
  }
}
