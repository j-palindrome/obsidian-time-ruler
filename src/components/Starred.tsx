import { useAppStore, setters } from '../app/store'
import Block from './Block'
import Droppable from './Droppable'

export default function Starred() {
  const starredIds = useAppStore((state) => state.starred ?? [])
  const tasks = useAppStore((state) =>
    starredIds.map((id) => state.tasks[id]).filter((task) => !!task)
  )

  return (
    <Droppable id='starred' data={{ type: 'starred' }}>
      <div className='mb-2'>
        <div className='font-bold text-accent mb-1'>Starred</div>
        {tasks.length > 0 && (
          <Block
            dragContainer='starred'
            startISO=''
            tasks={tasks}
            events={[]}
            type='starred'
            blocks={[]}
          />
        )}
      </div>
    </Droppable>
  )
}
