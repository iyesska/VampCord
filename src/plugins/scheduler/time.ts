/*
 * VampCord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const UNITS: Record<string, number> = {
    s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
    m: 60_000, min: 60_000, mins: 60_000, minute: 60_000, minutes: 60_000,
    h: 3_600_000, hr: 3_600_000, hrs: 3_600_000, hour: 3_600_000, hours: 3_600_000,
    d: 86_400_000, day: 86_400_000, days: 86_400_000,
    w: 604_800_000, week: 604_800_000, weeks: 604_800_000
};

export const MAX_DELAY = 365 * 86_400_000;

/** Parses durations like "10m", "1h30m", "2 days", "1.5h" or "90 seconds" into milliseconds */
export function parseDuration(input: string): number {
    const text = input.trim().toLowerCase().replace(/\s+/g, "");
    if (!text) throw new Error("Empty duration");

    const parts = text.match(/(\d+(?:\.\d+)?)([a-z]+)/g);
    if (!parts || parts.join("") !== text)
        throw new Error(`Invalid duration "${input}". Use something like 10m, 1h30m or 2d`);

    let total = 0;
    for (const part of parts) {
        const [, amount, unit] = part.match(/(\d+(?:\.\d+)?)([a-z]+)/)!;
        if (!Object.hasOwn(UNITS, unit)) throw new Error(`Unknown unit "${unit}" in "${input}"`);
        total += Number(amount) * UNITS[unit];
    }

    total = Math.round(total);
    if (total < 1000) throw new Error("The duration must be at least 1 second");
    if (total > MAX_DELAY) throw new Error("The duration can be at most 1 year");

    return total;
}

/**
 * Parses a time of day like "18:30", "6:30pm", "7pm" or "07:05" into the next moment it happens:
 * today if it's still ahead, otherwise tomorrow
 */
export function parseClock(input: string, now = new Date()): Date {
    const match = input.trim().toLowerCase().replace(/\s+/g, "").match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
    if (!match) throw new Error(`Invalid time "${input}". Use something like 18:30, 6:30pm or 7pm`);

    let hours = Number(match[1]);
    const minutes = match[2] ? Number(match[2]) : 0;
    const meridiem = match[3];

    if (!match[2] && !meridiem) throw new Error(`Invalid time "${input}". Use something like 18:30, 6:30pm or 7pm`);
    if (minutes > 59) throw new Error(`Invalid minutes in "${input}"`);

    if (meridiem) {
        if (hours < 1 || hours > 12) throw new Error(`Invalid hour in "${input}"`);
        if (hours === 12) hours = 0;
        if (meridiem === "pm") hours += 12;
    } else if (hours > 23) {
        throw new Error(`Invalid hour in "${input}"`);
    }

    const date = new Date(now);
    date.setHours(hours, minutes, 0, 0);
    if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);

    return date;
}

/** Works out when something should happen from either a delay ("in") or a time of day ("at") */
export function resolveWhen(when: { in?: string; at?: string; }, now = new Date()): number {
    if (when.in && when.at) throw new Error("Use either `in` or `at`, not both");
    if (when.in) return now.getTime() + parseDuration(when.in);
    if (when.at) return parseClock(when.at, now).getTime();
    throw new Error("Say when, with `in` (eg 10m, 2h) or `at` (eg 18:30)");
}

/** Discord timestamp markdown, rendered in the user's own timezone and language */
export const discordTimestamp = (time: number, style: "R" | "F" | "f" | "t" = "f") => `<t:${Math.floor(time / 1000)}:${style}>`;
