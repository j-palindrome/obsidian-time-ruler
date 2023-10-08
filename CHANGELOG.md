# Roadmap

## Planned
- Add support for [ICS Timezones](https://github.com/joshuatazrein/obsidian-time-ruler/issues/65)
- Add support for [ICS Calendar repeats](https://github.com/joshuatazrein/obsidian-time-ruler/issues/50)
- Add support for [task repeats](https://github.com/joshuatazrein/obsidian-time-ruler/issues/5#issuecomment-1646958839)

## Considering
- Better Completed Tasks - [Weekly Review](https://github.com/joshuatazrein/obsidian-time-ruler/issues/62?notification_referrer_id=NT_kwDOBQ8O87M3ODg1NjIyNTg3Ojg0ODcyOTQ3#issuecomment-1742924623)
- [CalDAV calendars](https://github.com/joshuatazrein/obsidian-time-ruler/issues/34)
- Add more flexibility for [Tasks](https://github.com/joshuatazrein/obsidian-time-ruler/issues/46#issuecomment-1708749520) users
- Optimize [performance](https://github.com/joshuatazrein/obsidian-time-ruler/issues/48)

# Changelog

## 1.5.0 (Upcoming)
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
