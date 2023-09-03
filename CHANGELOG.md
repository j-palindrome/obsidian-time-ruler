# Roadmap

## In progress
- Add support for [Full Calendar full notes](https://github.com/joshuatazrein/obsidian-time-ruler/issues/10#issuecomment-1655804209)

## Planned
- Add support for [task repeats](https://github.com/joshuatazrein/obsidian-time-ruler/issues/5#issuecomment-1646958839)
- Option to [add tasks at start or end of headings](https://github.com/joshuatazrein/obsidian-time-ruler/issues/12)
- Support [custom status emojis](https://github.com/joshuatazrein/obsidian-time-ruler/issues/28)

## Considering
- [CalDAV calendars](https://github.com/joshuatazrein/obsidian-time-ruler/issues/34)
- Providing [names for time blocks](https://github.com/joshuatazrein/obsidian-time-ruler/issues/11#issuecomment-1655862428) (perhaps by moving tasks with durations to the "name" field of a time block)
- Option to [hide/show headings](https://github.com/joshuatazrein/obsidian-time-ruler/issues/11#issuecomment-1655862428) to reduce visual clutter
- Options to drag [deadlines and reminder times](https://github.com/joshuatazrein/obsidian-time-ruler/issues/20) in addition to scheduled time
- Options for [sorting](https://github.com/joshuatazrein/obsidian-time-ruler/issues/16):
  - The capability to sort tasks, even those that have been filtered using specific keywords, based on due dates or priority. This means having multiple sorting and filtering views. For instance, in amplenote, tasks can be viewed by individual notes they were created in, while still being sorted alphabetically or by priority.

# Changelog

## 1.3.1 (9/2/2023)

**Added:**
- `scheduled` and `due` modes in Search now sort tasks by scheduled or due
- Tasks without set lengths or deadlines still have a draggable handle to set them

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
