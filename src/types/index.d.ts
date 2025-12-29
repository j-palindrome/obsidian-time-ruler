import { STask } from 'obsidian-dataview'
import { GroupComponentProps } from '../components/Group'
import { TaskComponentProps } from '../components/Task'
import { BlockComponentProps } from 'src/components/Block'
/// <reference types="vite/client" />
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
    editable?: false | string
  }

  type TaskProps = {
    type: 'task'
    id: string
    page: boolean
    title: string
    originalTitle: string
    originalText: string
    notes?: string
    tags: string[]
    children: string[]
    position: STask['position']
    path: string
    parent?: string
    extraFields?: Record<string, string>
    duration?: { hour: number; minute: number }
    status: string
    blockReference?: string
    fieldFormat: FieldFormat['main']
    completed: boolean
    query?: string
    queryParent?: string
    queryChildren?: string[]
    links: string[]

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

    subtasks?: TaskProps[]
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
    | ({ dragType: 'group' } & GroupComponentProps)
    | ({ dragType: 'task' } & TaskComponentProps)
    | ({ dragType: 'block' } & BlockComponentProps)
    | ({ dragType: 'task-length' } & {
        id: string
        start: string
        end?: string
      })
    | ({ dragType: 'time' } & { start: string; end?: string })
    | ({ dragType: 'due' } & { task: TaskProps })
    | ({ dragType: 'new-task' } & { title: string; path?: string })

  type DropData =
    | Partial<TaskProps>
    | { type: 'heading'; heading: string }
    | { type: 'delete' }
    | { type: 'move' }
    | { type: 'unschedule' }
    | { type: 'starred' }
}

declare module 'obsidian' {
  interface App {
    isMobile: boolean
  }

  interface Vault {
    getConfig: (key: string) => string | string[] | undefined
    readConfigJson: (
      path: string
    ) => Promise<Record<string, string | number | boolean>>
  }
}
