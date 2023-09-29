import pop from './pop.mp3'
import start from './start.mp3'
import timer from './timer.mp3'

const popSnd = new Audio(pop)
const startSnd = new Audio(start)
const timerSnd = new Audio(timer)

export const sounds = {
  pop: popSnd,
  start: startSnd,
  timer: timerSnd,
}
