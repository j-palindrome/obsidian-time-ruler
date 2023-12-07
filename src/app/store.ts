import { produce } from 'immer'
import { useRef } from 'react'
import { createWithEqualityFn } from 'zustand/traditional'
import CalendarAPI from '../services/calendarApi'
import ObsidianAPI from '../services/obsidianApi'
import { TaskActions } from '../types/enums'
import TimeRulerPlugin, { DEFAULT_SETTINGS } from '../main'
import { DateTime } from 'luxon'
import _ from 'lodash'
import { parseFileFromPath } from '../services/util'

export type ViewMode =
  | 'all'
  | 'scheduled'
  | 'due'
  | 'unscheduled'
  | 'priority'
  | 'completed'
export type AppState = {
  tasks: Record<string, TaskProps>
  events: Record<string, EventProps>
  apis: {
    obsidian?: ObsidianAPI
    calendar?: CalendarAPI
  }
  dragData: DragData | null
  findingTask: string | null
  inScroll: number
  searchStatus: false | ViewMode
  calendarMode: boolean
  dailyNoteInfo: {
    dailyNoteFormat: string
    dailyNotePath: string
  }
  fileOrder: string[]
  newTask: false | Partial<TaskProps>
  settings: Pick<
    TimeRulerPlugin['settings'],
    | 'dayStartEnd'
    | 'hideHeadings'
    | 'muted'
    | 'twentyFourHourFormat'
    | 'showCompleted'
    | 'extendBlocks'
  >
  collapsed: Record<string, boolean>
  showingPastDates: boolean
  searchWithinWeeks: [number, number]
}

export const useAppStore = createWithEqualityFn<AppState>(() => ({
  tasks: {},
  events: {},
  apis: {},
  dragData: null,
  findingTask: null,
  inScroll: 0,
  searchStatus: false,
  calendarMode: false,
  fileOrder: [],
  dailyNoteInfo: {
    dailyNoteFormat: 'YYYY-MM-DD',
    dailyNotePath: '',
  },
  newTask: false,
  collapsed: {},
  settings: {
    dayStartEnd: [0, 24],
    hideHeadings: false,
    muted: false,
    twentyFourHourFormat: false,
    showCompleted: false,
    extendBlocks: false,
  },
  showingPastDates: false,
  searchWithinWeeks: [-1, 1],
}))

export const useAppStoreRef = <T>(callback: (state: AppState) => T) => {
  const storeValue = useAppStore(callback)
  const storeValueRef = useRef<T>(storeValue)
  storeValueRef.current = storeValue
  return [storeValue, storeValueRef] as [
    typeof storeValue,
    typeof storeValueRef
  ]
}

const modify = (modifier: (state: AppState) => void) =>
  useAppStore.setState(produce(modifier))

export const setters = {
  set: (newState: Partial<AppState>) => modify(() => newState),
  patchTasks: async (ids: string[], task: Partial<TaskProps>) => {
    const obsidianAPI = getters.getObsidianAPI()
    for (let id of ids) {
      const savedTask = { ...getters.getTask(id), ...task }
      if (task.scheduled === TaskActions.DELETE) delete savedTask.scheduled
      await obsidianAPI.saveTask(savedTask)
    }
    if (task.completion) obsidianAPI.playComplete()
  },
  patchCollapsed: async (ids: string[], collapsed: boolean) => {
    modify((state) => {
      for (let id of ids) {
        state.collapsed[id] = collapsed
      }
    })
  },
  updateFileOrder: (heading: string, beforeHeading: string) => {
    const obsidianAPI = getters.getObsidianAPI()
    obsidianAPI.updateFileOrder(
      parseFileFromPath(heading),
      parseFileFromPath(beforeHeading)
    )
  },
}

export const getters = {
  getEvent: (id: string) => useAppStore.getState().events[id],
  getTask: (id: string) => useAppStore.getState().tasks[id],
  getObsidianAPI: () => useAppStore.getState().apis.obsidian as ObsidianAPI,
  getCalendarAPI: () => useAppStore.getState().apis.calendar as CalendarAPI,
  get: <T extends keyof AppState>(key: T) => useAppStore.getState()[key],
}
