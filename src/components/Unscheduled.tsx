import _ from 'lodash'
import { memo } from 'react'
import { useAppStore } from 'src/app/store'
import { parseTaskDate } from 'src/services/util'
import Block from './Block'
import Droppable from './Droppable'

const Unscheduled = memo(_Unscheduled, () => true)
export default Unscheduled
export const COLLAPSE_UNSCHEDULED = 'tr-collapse-unscheduled'

function _Unscheduled() {
  const showCompleted = useAppStore((state) => state.settings.showCompleted)
  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const tasks = useAppStore((state) =>
    _.filter(
      state.tasks,
      (task) =>
        (showCompleted ||
          (showingPastDates ? task.completed : !task.completed)) &&
        !task.parent &&
        !task.queryParent &&
        !parseTaskDate(task, state.tasks) &&
        !task.due
    )
  )
  const childWidth = useAppStore((state) =>
    (state.settings.viewMode === 'week' ||
      state.settings.viewMode === 'hour') &&
    state.childWidth > 1
      ? state.childWidth
      : 1
  )

  return (
    <div className={`h-0 grow flex flex-col`}>
      <div className='flex items-center space-x-1 group flex-none'>
        <div
          className='w-indent flex-none pr-1'
          id={COLLAPSE_UNSCHEDULED}
        ></div>
        <Droppable id='unscheduled-timespan' data={{ scheduled: '' }}>
          <div className='font-menu'>{'Unscheduled'}</div>
        </Droppable>
      </div>
      <div
        className={`h-0 grow w-full mt-1 rounded-icon ${
          childWidth > 1
            ? `unscheduled child:h-full child:child:h-full ${
                [
                  '',
                  'child:child:child:child:w-full',
                  'child:child:child:child:w-1/2',
                  'child:child:child:child:w-1/3',
                  'child:child:child:child:w-1/4',
                ][childWidth]
              }`
            : 'overflow-x-hidden overflow-y-auto'
        }`}
        data-auto-scroll={childWidth > 1 ? 'x' : 'y'}
      >
        <Block
          startISO={undefined}
          blocks={[]}
          events={[]}
          type='unscheduled'
          dragContainer='unscheduled'
          tasks={tasks}
        />
      </div>
    </div>
  )
}
