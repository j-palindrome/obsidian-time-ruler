import { getAPI } from 'obsidian-dataview'
import invariant from 'tiny-invariant'
import { textToTask } from '../services/parser'
import { getDailyNoteInfo } from '../services/obsidianApi'
import _ from 'lodash'

app['__timeRulerTests'] = async (testPath: string, format = 'dataview') => {
  const dv = getAPI()
  invariant(dv, 'get Dataview')
  const tasks = dv.pages(`"${testPath}"`)['file']['tasks']

  const dailyNoteInfo = await getDailyNoteInfo()
  invariant(dailyNoteInfo)

  for (let testTask of tasks) {
    try {
      const task = textToTask(testTask, dailyNoteInfo, 'dataview')

      const expected = JSON.parse(testTask['expect'])
      for (let key of Object.keys(expected)) {
        const parsedKey =
          expected[key] === 'undefined' ? undefined : expected[key]

        invariant(
          _.isEqual(task[key] ?? 0, parsedKey ?? 0),
          `${task[key]} is not ${parsedKey}`
        )
      }
    } catch (err) {
      console.error('Failed:', err.message)
    }
  }
}
