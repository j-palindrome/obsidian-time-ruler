import { setters, useAppStore } from 'src/app/store'
import Block from './Block'
import _ from 'lodash'
import Event from './Event'
import Droppable from './Droppable'
import { memo } from 'react'
import { useCollapsed } from 'src/services/util'
import Button from './Button'

const Unscheduled = memo(_Unscheduled, () => true)
export default Unscheduled

function _Unscheduled() {
  const showCompleted = useAppStore((state) => state.settings.showCompleted)
  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const tasks = useAppStore((state) =>
    _.filter(
      state.tasks,
      (task) =>
        !task.scheduled &&
        (showCompleted ||
          (showingPastDates ? task.completed : !task.completed)) &&
        !task.parent
    )
  )
  const childWidth = useAppStore((state) =>
    (state.viewMode === 'week' || state.viewMode === 'hour') &&
    state.childWidth > 1
      ? state.childWidth
      : 1
  )

  const { collapsed, allHeadings } = useCollapsed(tasks)
  return (
    <div className={`h-0 grow flex flex-col`}>
      <div className='flex items-center space-x-1 group flex-none'>
        <Button
          className='w-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
          onClick={() => setters.patchCollapsed(allHeadings, !collapsed)}
          src={collapsed ? 'chevron-right' : 'chevron-down'}
        />
        <Droppable id='unscheduled-timespan' data={{ scheduled: '' }}>
          <div className='font-menu'>{'Unscheduled'}</div>
        </Droppable>
      </div>
      <div
        className={`h-0 grow w-full p-1 rounded-lg bg-secondary-alt mt-1 ${
          childWidth > 1
            ? `child:flex child:overflow-y-hidden child:overflow-x-auto child:flex-col child:flex-wrap child:h-full child:snap-x child:snap-mandatory child:child:max-h-full child:child:overflow-y-auto child:child:snap-start ${
                [
                  '',
                  'child:child:w-full',
                  'child:child:w-1/2',
                  'child:child:w-1/3',
                  'child:child:w-1/4',
                ][childWidth]
              }`
            : 'overflow-x-hidden overflow-y-auto'
        }`}
        data-auto-scroll={'y'}
      >
        <Block
          startISO={undefined}
          type='unscheduled'
          dragContainer='unscheduled'
          tasks={tasks}
        />
      </div>
    </div>
  )
}
