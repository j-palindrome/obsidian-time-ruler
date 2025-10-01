import { useAppStore, setters } from '../app/store'
import Block from './Block'
import Droppable from './Droppable'

export default function Starred() {
  const starredIds = useAppStore((state) => state.starred ?? [])
  const tasks = useAppStore((state) =>
    starredIds.map((id) => state.tasks[id]).filter((task) => !!task)
  )

  return (
    <div className='mb-2'>
      <Droppable id='starred-button' data={{ type: 'starred' }}>
        <div className='font-bold text-accent mb-1 w-full'>Starred</div>
      </Droppable>
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
  )
}
