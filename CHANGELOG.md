# Roadmap

## In progress
- Add support for [Full Calendar full notes](https://github.com/joshuatazrein/obsidian-time-ruler/issues/10#issuecomment-1655804209)

## Planned
-  Option to [hide/show headings](https://github.com/joshuatazrein/obsidian-time-ruler/issues/11#issuecomment-1655862428) to reduce visual clutter
- Add support for [task repeats](https://github.com/joshuatazrein/obsidian-time-ruler/issues/5#issuecomment-1646958839)
- Option to [add tasks at start or end of headings](https://github.com/joshuatazrein/obsidian-time-ruler/issues/12)

## Considering
- Providing [names for time blocks](https://github.com/joshuatazrein/obsidian-time-ruler/issues/11#issuecomment-1655862428) (perhaps by moving tasks with durations to the "name" field of a time block)

# Changelog

## 1.0.3
- **Fixed:** if daily notes folder is not set, headings still format daily notes nicely.
- **Added:** `Unscheduled` button to [drag tasks to](https://github.com/joshuatazrein/obsidian-time-ruler/issues/13)
- **Documented:** added `.gif` to explain dragging more, added pictures of features
- **Refactored:** Moved `Heading` and `Group` components to their own files
- **Refactored:** `SearchStatus` can now be set directly in the app store

## 7/28/2023 (1.0.2)
- **Fixed:** bug where notes and headings get mistaken for daily notes and titled "Daily: ..." (this was an issue with the Regex used to parse daily note titles), responding to [This issue](https://github.com/joshuatazrein/obsidian-time-ruler/issues/11#issuecomment-1655862428)
- **Fixed:** Saving tasks no longer [strips recurrence information](https://github.com/joshuatazrein/obsidian-time-ruler/issues/9#issuecomment-1655801314)
- **Fixed:** Saving tasks no longer [strips links](https://github.com/joshuatazrein/obsidian-time-ruler/issues/9#issuecomment-1655801314)
- **Improved:** Tasks without a scheduled time now show up as a [single block at the top of the day](https://github.com/joshuatazrein/obsidian-time-ruler/issues/11#issuecomment-1655862428), instead of separated into previous times.
- **Refactored:** Split up some of `ObsidianApi` class into independent functions.

## 7/22/2023 (1.0.1)
- **Added:** Support for including/excluding custom statuses
- **Improved:** Removed Upcoming view, integrated due dates with rest of days. Now tasks with due dates will show up as links each day from when they are scheduled until they are due. 
- **Improved:** Removed Unscheduled view, improved search to show filterable tasks
- **Added:** Ability to reorder headings with drag-and-drop
- **Added:** Calendar view (according to the [Calendar view?](https://github.com/joshuatazrein/obsidian-time-ruler/issues/1) request). Calendar View is daily instead of hourly, showing a vertical day-by-day list of your tasks and an expanded, calendar-style arrangement for switching dates. Switch between this and the hourly view to get a more or less granular view of your tasks.
- **Added:** Daily note shows at the top of the search box for easy access

## 6/28/2023 (1.0.0)
- **Added:** custom Dataview filter for tasks (according to the [Custom Statuses](https://github.com/joshuatazrein/obsidian-time-ruler/issues/3) request)
- **Added:** Plus buttons to add new tasks at specific times
- **Fixed:** [issue](https://github.com/joshuatazrein/obsidian-time-ruler/issues/2) with formatting tasks for Tasks plugin
- **Fixed:** [issue](https://github.com/joshuatazrein/obsidian-time-ruler/issues/4) with stripping tags from task when moved
- **Fixed:** issue where you can't drag length of tasks with children
