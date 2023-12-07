import { setters, useAppStore } from 'src/app/store'
import Block from './Block'
import _ from 'lodash'
import Event from './Event'
import Droppable from './Droppable'
import { memo } from 'react'
import { useCollapsed } from 'src/services/util'
import Button from './Button'

const Unscheduled = memo(_Unscheduled, _.isEqual)
export default Unscheduled

function _Unscheduled({ isFlex }: { isFlex: boolean }) {
  const showCompleted = useAppStore((state) => state.settings.showCompleted)
  const tasks = useAppStore((state) =>
    _.filter(
      state.tasks,
      (task) =>
        !task.scheduled && (!task.completed || showCompleted) && !task.parent
    )
  )
  const calendarMode = useAppStore((state) => state.calendarMode)
  const { collapsed, allHeadings } = useCollapsed(tasks)
  return (
    <div className={`h-0 grow flex flex-col ${calendarMode ? '!w-full' : ''}`}>
      <div className='flex items-center space-x-1 group'>
        <Button
          className='w-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
          onClick={() => setters.patchCollapsed(allHeadings, !collapsed)}
          src={collapsed ? 'chevron-right' : 'chevron-down'}
        />
        <Droppable id='unscheduled-timespan' data={{ scheduled: '' }}>
          <div className='font-menu mb-2'>{'Unscheduled'}</div>
        </Droppable>
      </div>
      <div
        className={`h-0 grow rounded-lg bg-secondary-alt ${
          isFlex
            ? 'overflow-hidden child:flex child:h-full child:overflow-x-auto child:snap-x child:snap-mandatory child:child:h-full child:child:overflow-y-auto child:child:flex-none child:child:w-full sm:child:child:w-1/2 lg:child:child:w-1/3 xl:child:child:w-1/4 child:child:snap-start'
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
