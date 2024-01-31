# Roadmap

## Developing
- Add support for [ICS Calendar repeats](https://github.com/joshuatazrein/obsidian-time-ruler/issues/50)
- Fix [wrong date bug](https://github.com/joshuatazrein/obsidian-time-ruler/issues/85)

## Planned
- Support [Task repeats](https://github.com/joshuatazrein/obsidian-time-ruler/issues/5)
- Support [aliases](https://github.com/joshuatazrein/obsidian-time-ruler/issues/76)
- Fix [timezones](https://github.com/joshuatazrein/obsidian-time-ruler/issues/70) in calendars
- Support [colors in calendar & tasks](https://github.com/joshuatazrein/obsidian-time-ruler/issues/72)
- Option to support [Tasks API on click](https://github.com/joshuatazrein/obsidian-time-ruler/issues/74)
- support [tag sorting](https://github.com/joshuatazrein/obsidian-time-ruler/issues/96)

## Considering
- [CalDAV calendars](https://github.com/joshuatazrein/obsidian-time-ruler/issues/34)
- Add more flexibility for [Tasks](https://github.com/joshuatazrein/obsidian-time-ruler/issues/46#issuecomment-1708749520) users

# Changelog

## 2.1.1 (Upcoming)

**Added:**
- Option to switch between timer events (notification or sound)

## 2.1.0 (1/1/2023)

**Added:**
- **Now** view: timer has been moved to its own pane, which collects all incomplete tasks scheduled for past times. Now is a focused view for current tasks.

**Fixed:**
- Bug where events crossing date boundaries render as 0 length
- Smoothed out deleting multiple tasks at once
- Improved look of dragged tasks

## 2.0.3 (12/25/2023)

**Fixed:**
- Quick fix for menu hiding too quickly

**Added:**
- Better UI for dragging

## 2.0.2 (12/25/2023)

**Fixed:**
- Quick fix for Daily Notes not existing.
- Fixed React keys for `Buttons`

## 2.0.1 (12/25/2023)

**Fixed:**
- Scheduling tasks for today

## 2.0.0 (12/24/2023)

**Major changes:**
- Added **Queries!** `[query:: ]` tasks will auto-assign their children based on a Dataview query. Useful for automatic scheduling!
- Search is now a "Jump to:" search a task to jump to it within Time Ruler.
- Three layouts are now available: One (single date with split day/hours), Row (rolling view of days), and Grid (week view).
- Four options for grouping: Path, Priority, Hybrid (priority first, then path if no priority set), or None
- Times now exist alongside scheduled tasks, saving vertical space, and are no longer full-width. To schedule, drag tasks on top of the times to the right.
- Tasks now have handles at the right for scheduling/dragging.

**Added:**
- Day start setting now sets when days transition, allowing days to extend past 12 AM
- Use Daily Note template when creating new daily notes
- Improved styling: [borders between dates](https://github.com/joshuatazrein/obsidian-time-ruler/issues/88#issuecomment-1846164954) and button layout for grid view
- Option to toggle times moved to menu, turn on/off from within Time Ruler

**Fixed:**
- Parsing error with daily notes
- New tasks in notes with headings create them before the first heading, unless one is selected

## 1.7.0 (12/5/2023)

**Added:**
- Drag target to delete tasks & their children
- Collapse headings and events
- Support [| based link text](https://github.com/joshuatazrein/obsidian-time-ruler/issues/81)
- Option to extend blocks until next for easier time-blocking
- [Show past dates](https://github.com/joshuatazrein/obsidian-time-ruler/issues/62?notification_referrer_id=NT_kwDOBQ8O87M3ODg1NjIyNTg3Ojg0ODcyOTQ3#issuecomment-1742924623)
- Show completed tasks in Search
- Calendar [grid view](https://github.com/joshuatazrein/obsidian-time-ruler/issues/84)

**Improved:**
- Timer View has simpler UI

**Refactored:**
- Moved settings in `AppStore` to consolidated object

## 1.6.0 (11/25/2023)

**Fixed:**
- Issue with not all [dates displaying](https://github.com/joshuatazrein/obsidian-time-ruler/issues/83)

**Added:**
- Option to collapse/expand subtasks

**Improved:**
- Subtasks of Page tasks show up as subtasks of that Page
- Subtasks are also grouped by heading

**Refactored:**
- Streamlined `dailyNoteInfo` functions
- Headings now are defined with a string, not an object
- Easier task nesting

## 1.5.3 (11/20/2023)

**Fixed:**
- Can't find Daily Notes [config info](https://github.com/joshuatazrein/obsidian-time-ruler/issues/80)
- can't click on untitled tasks
- Glitch with dragging event durations
- Don't show deadlines before their scheduled date
- Major performance improvements for DOM

## 1.5.2 (10/25/2023)

**Added:**
- Support for [ICS Timezones](https://github.com/joshuatazrein/obsidian-time-ruler/issues/65)

**Fixed:**
- Error with default Dataview queries being [incorrect](https://github.com/joshuatazrein/obsidian-time-ruler/issues/71)

## 1.5.1 (10/22/2023)

**Added:**
- Add bulk edits for task times

**Fixed:**
- [Bug with lengths](https://github.com/joshuatazrein/obsidian-time-ruler/issues/68#event-10732474581)
- Preserve [due times](https://github.com/joshuatazrein/obsidian-time-ruler/issues/66#issuecomment-1753184899)

**Improved:**
- Optimized [performance](https://github.com/joshuatazrein/obsidian-time-ruler/issues/48): now only changed files are loaded in. 

## 1.5.0 (10/08/2023)
**Added:**
- Support for [full notes](https://github.com/joshuatazrein/obsidian-time-ruler/issues/10#issuecomment-1655804209) as tasks
- Support for FullCalendar note events

**Fixed:**
- [Due date removal on reschedule](https://github.com/joshuatazrein/obsidian-time-ruler/issues/66)
- Events no longer have leading extra tick

## 1.4.0 (9/22/2023)

**Fixed:**
- Fixed [tag search regex](https://github.com/joshuatazrein/obsidian-time-ruler/issues/58)
- Fixed [completed tasks showing in scheduled](https://github.com/joshuatazrein/obsidian-time-ruler/issues/57)
- Fixed [not loading tasks correctly](https://github.com/joshuatazrein/obsidian-time-ruler/issues/53#issuecomment-1731714675)

**Added:**
-  Resizeable split between [all day and hourly view](https://github.com/joshuatazrein/obsidian-time-ruler/issues/45)
- Add more sounds to [timer](https://github.com/joshuatazrein/obsidian-time-ruler/issues/43)
- Option to [add tasks at start or end of headings](https://github.com/joshuatazrein/obsidian-time-ruler/issues/12)
- Add custom Tasks [classes](https://github.com/joshuatazrein/obsidian-time-ruler/issues/46#issuecomment-1710172169): now `task-due`, `task-scheduled`, `data-task`, `task-priority`, and additional `task-length` and `task-reminder` classes are added to those parts of tasks, so you can style them with CSS snippets. Also added `time-ruler-heading`, and `time-ruler-block` classes to style headings and blocks.
- Support [custom statuses](https://github.com/joshuatazrein/obsidian-time-ruler/issues/28) - you can now add your own custom status styling to Time Ruler. 

## 1.3.3 (9/11/2023)

**Fixed:**
- Bug with emoji date keys

**Added:**
- 24-hour [format](https://github.com/joshuatazrein/obsidian-time-ruler/issues/51)
- Custom JavaScript for [filtering](https://github.com/joshuatazrein/obsidian-time-ruler/issues/49)
- Command to open in [main tab](https://github.com/joshuatazrein/obsidian-time-ruler/issues/52)

## 1.3.2 (9/7/2023)

**Fixed:**
- Fixed parser to allow for scheduling in Daily notes again
- Made headings smaller to be less distracting

**Added:**
- Option to [hide/show headings](https://github.com/joshuatazrein/obsidian-time-ruler/issues/11#issuecomment-1655862428)
- Priority sort [option](https://github.com/joshuatazrein/obsidian-time-ruler/issues/16): you can now sort tasks by due, scheduled, & priority

## 1.3.1 (9/2/2023)

**Added:**
- `scheduled` and `due` modes in Search now sort tasks by scheduled or due
- Tasks without set lengths or deadlines still have a draggable handle to set them

**Fixed:**
- Removed automatic scroll on hover for date buttons, it was too fast and unpredictable.

## 1.3.0 (9/2/2023)

** Added:** 
- New quick-add for tasks: Click or drag the `+` button to a time, enter the task title, and select a file!
- Red line to make seeing [current time easier](https://github.com/joshuatazrein/obsidian-time-ruler/issues/16)
- Easier way to drag [task times]()
- Option to set `Day Planner` format as default.
- Use `Day Planner` format in any note (not just Daily) and add dates to it
- Options to drag [deadlines](https://github.com/joshuatazrein/obsidian-time-ruler/issues/20) in addition to scheduled time

** Fixed:**
- Day Planner parsing is now more consistent.

** Documented:**
- How to format [query sources](https://github.com/joshuatazrein/obsidian-time-ruler/issues/37)
- Better description of [task formats](https://github.com/joshuatazrein/obsidian-time-ruler/issues/38)

## 1.2.0 (8/20/2023)

** Added:** 
- Support for [changing day start and hours](https://github.com/joshuatazrein/obsidian-time-ruler/issues/30)
- Formatting for [many tags in tasks](https://github.com/joshuatazrein/obsidian-time-ruler/issues/29#issuecomment-1680609684)
- Formatting for [block references](https://github.com/joshuatazrein/obsidian-time-ruler/issues/29#issuecomment-1680609684) and [here](https://github.com/joshuatazrein/obsidian-time-ruler/issues/32)
- Allow for [singe-digit hours](https://github.com/joshuatazrein/obsidian-time-ruler/issues/27) in simple mode
- More specific Dataview custom filter [at task level](https://github.com/joshuatazrein/obsidian-time-ruler/issues/18)

## 1.1.0 (8/9/2023)

** Added:** 
- Right-click option to [schedule tasks for now](https://github.com/joshuatazrein/obsidian-time-ruler/issues/16#event-9959008621) and to unschedule tasks 
- Support [emoji and custom status](https://github.com/joshuatazrein/obsidian-time-ruler/issues/26) displaying in tasks
- Filter by [custom status](https://github.com/joshuatazrein/obsidian-time-ruler/issues/25)
- A [simple mode](https://github.com/joshuatazrein/obsidian-time-ruler/issues/21) with `HH:mm-HH:mm` formatting for scheduled times.
- larger drop target for [dates](https://github.com/joshuatazrein/obsidian-time-ruler/issues/24)

** Improved:**
- Moved search, refresh, and view buttons to a collapsible menu

## 1.0.5 (8/6/2023)

** Added:**
- Support for [Obsidian Reminder](https://github.com/joshuatazrein/obsidian-time-ruler/issues/20)

** Improved:**
- Time Ruler now auto-detects field formats (Dataview, Tasks, and Full Calendar) and will format changed tasks appropriately. When auto-detecting is impossible, defaults to selected setting.
- Timer focus mode

** Fixed:** 
- Error with drag `id`s for all-day  headings
- Scheduled tasks with deadlines disappearing

## 1.0.4 (8/4/2023)

** Fixed:** 
- `Unscheduled` button is now full-width in Day view
- Preserves [custom statuses](https://github.com/joshuatazrein/obsidian-time-ruler/issues/19) on edit
- Certain notes get mistaken for daily notes

** Documented:** 
- Update documentation for [custom Dataview filters](https://github.com/joshuatazrein/obsidian-time-ruler/issues/18) and throw an error when they are invalid

## 1.0.3 (7/30/2023)

** Fixed:** 
- Issue with Time Ruler not updating when Dataview index wasn't ready yet
- Search shows tasks in today's daily note under the [proper heading](https://github.com/joshuatazrein/obsidian-time-ruler/issues/14)
- if daily notes folder is not set, headings still format daily notes nicely.

** Added:**
- `Unscheduled` button to [drag tasks to](https://github.com/joshuatazrein/obsidian-time-ruler/issues/13)
- [Filter](https://github.com/joshuatazrein/obsidian-time-ruler/issues/16#event-9959008621) by tag, priority, path, and heading in Search

** Documented:** 
- added `.gif` to explain dragging more, added pictures of features

** Refactored:** 
- Moved `Heading` and `Group` components to their own files
- `SearchStatus` can now be set directly in the app store

## 1.0.2 (7/28/2023)

** Fixed:** 
- bug where notes and headings get mistaken for daily notes and titled "Daily: ..." (this was an issue with the Regex used to parse daily note titles), responding to [This issue](https://github.com/joshuatazrein/obsidian-time-ruler/issues/11#issuecomment-1655862428)
- Saving tasks no longer [strips recurrence information](https://github.com/joshuatazrein/obsidian-time-ruler/issues/9#issuecomment-1655801314)
- Saving tasks no longer [strips links](https://github.com/joshuatazrein/obsidian-time-ruler/issues/9#issuecomment-1655801314)

** Improved:** 
- Tasks without a scheduled time now show up as a [single block at the top of the day](https://github.com/joshuatazrein/obsidian-time-ruler/issues/11#issuecomment-1655862428), instead of separated into previous times.

** Refactored:** 
- Split up some of `ObsidianApi` class into independent functions.

## 1.0.1 (7/22/2023)

** Added:** 
- Support for including/excluding custom statuses
- Ability to reorder headings with drag-and-drop
- Calendar view (according to the [Calendar view?](https://github.com/joshuatazrein/obsidian-time-ruler/issues/1) request). Calendar View is daily instead of hourly, showing a vertical day-by-day list of your tasks and an expanded, calendar-style arrangement for switching dates. Switch between this and the hourly view to get a more or less granular view of your tasks.
- Daily note shows at the top of the search box for easy access

** Improved:** 
- Removed Upcoming view, integrated due dates with rest of days. Now tasks with due dates will show up as links each day from when they are scheduled until they are due. 
- Removed Unscheduled view, improved search to show filterable tasks


## 1.0.0 (6/28/2023)

** Added:** 
- custom Dataview filter for tasks (according to the [Custom Statuses](https://github.com/joshuatazrein/obsidian-time-ruler/issues/3) request)
- Plus buttons to add new tasks at specific times

** Fixed:** 
- [issue](https://github.com/joshuatazrein/obsidian-time-ruler/issues/2) with formatting tasks for Tasks plugin
- [issue](https://github.com/joshuatazrein/obsidian-time-ruler/issues/4) with stripping tags from task when moved
- issue where you can't drag length of tasks with children
