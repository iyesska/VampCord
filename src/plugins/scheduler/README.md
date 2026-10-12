# Scheduler

Schedule messages to be sent later and set reminders for yourself. Everything is saved, so it survives restarting
Discord.

-   `/schedule message:Happy birthday! 🎂 at:00:00` – send a message at a time of day (today, or tomorrow if it passed)
-   `/schedule message:Ready? in:15m` – send a message after a delay (`30s`, `10m`, `1h30m`, `2d`, `1w`...)
-   `/remind about:Take the pizza out in:12m` – get a notification and a private note in the channel
-   `/scheduled` – list everything that is scheduled, with ids
-   `/unschedule id:ab12` – cancel something

Messages are sent by your Discord client, so Discord has to be open. If it was closed at the scheduled time, the message
is sent as soon as you open Discord if it's only a few minutes late (configurable). Otherwise you get a notification
and can choose to send it.
