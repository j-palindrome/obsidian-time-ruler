import { produce } from 'immer'
import { useRef } from 'react'
import { create } from 'zustand'
import CalendarAPI from '../services/calendarApi'
import ObsidianAPI from '../services/obsidianApi'
import { TaskActions } from '../types/enums'

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
  searchStatus: boolean | Partial<TaskProps>
  calendarMode: boolean
  dailyNote: string | null
  dailyNoteFormat: string
  dailyNotePath: string
  fileOrder: string[]
}

export const useAppStore = create<AppState>(() => ({
  tasks: {},
  events: {},
  apis: {},
  dragData: null,
  findingTask: null,
  inScroll: 0,
  searchStatus: false,
  calendarMode: false,
  fileOrder: [],
  dailyNote: null,
  dailyNoteFormat: 'YYYY-MM-DD',
  dailyNotePath: '',
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
  updateFileOrder: (file: string, before: string) => {
    const obsidianAPI = getters.getObsidianAPI()
    obsidianAPI.updateFileOrder(file, before)
  },
}

export const getters = {
  getEvent: (id: string) => useAppStore.getState().events[id],
  getTask: (id: string) => useAppStore.getState().tasks[id],
  getObsidianAPI: () => useAppStore.getState().apis.obsidian as ObsidianAPI,
  getCalendarAPI: () => useAppStore.getState().apis.calendar as CalendarAPI,
  get: <T extends keyof AppState>(key: T) => useAppStore.getState()[key],
}
