Time Ruler combines the best parts of a nested tasklist and an event-based calendar view. Drag-and-drop tasks to time-block and reschedule, and view tasks on top of read-only online calendars. Integrates seamlessly with the Tasks and FullCalendar plugins.

# Features
- Reads and writes tasks in a variety of formats (Dataview inline fields, Tasks plugin emojis, or Full Calendar task-events)
- Time-blocks with nested tasks
- View all scheduled tasks, upcoming deadlines, and unscheduled tasks
- Drag 'n drop tasks to reschedule and change length
- Search projects and headings, drag to create new tasks
- Create new tasks at specific times via drag-and-drop
- Read-only online calendars via sharing links
- Integrated timer/stopwatch
- Play a sound when you check a task!

# Documentation
Time Ruler requires the Dataview plugin to read tasks.

## Reading tasks
Task metadata can be specified in any of the following formats:
- **Dataview**: [scheduled:: yyyy-mm-ddThh:mm]   [due:: yyyy-mm-dd]  [length:: \#h\#m]  [priority:: lowest/low/medium/high/highest]
- **Tasks**: ⏳ yyyy-mm-dd [startTime:: hh-mm]  📅 yyyy-mm-dd  [length:: \#h\#m] ⏬/🔽/🔼/⏫/🔺
- **Full Calendar**: [date:: yyyy-mm-dd]  [startTime:: hh-mm]  [due:: yyyy-mm-dd]  [endTime:: hh-mm] 
 [priority:: lowest/low/medium/high/highest]

When editing a task via drag-and-drop, tasks are converted to the user's preferred format (Dataview, Tasks, or Full Calendar). This can be changed in Settings.

## Scheduling tasks
- To reschedule a task, drag-and-drop the task onto the target block or time. You can drag a task to one of the day buttons or a day's heading to reschedule to that day. Click on a task to jump to it in Obsidian.
- To create a new scheduled task, drag the heading from the Search popover onto a target time. A new task is created under that heading.
- Dragging and holding over a date button will scroll to that date, allowing you to drop the task there.
- To change the length of a task, drag it by the bottom (the "resize arrow" cursor) to a target time.
- You can also drag groups, headings, and blocks to reschedule all of the tasks contained in them.
- The "Upcoming" view shows any upcoming due dates in a zoomed-out time ruler. Drag a task on this ruler to schedule its due date.

## Online calendars
- To import a calendar, simply copy a shared link (iCal format) into Settings.
- Events show as blocks which can contain tasks scheduled at the same time. You can drag an event to reschedule the tasks contained, but the event is read-only. 
- To refresh events, click the "Refresh" button (the circular arrow) in the toolbar.

## Timer
- To start a stopwatch, click the play button without any time entered.
- To start a timer, enter an amount in minutes and press the play button or "Enter."
- You can add or subtract time while the timer is playing. 