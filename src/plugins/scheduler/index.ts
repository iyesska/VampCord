/*
 * VampCord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { toInlineCode } from "@utils/text";
import definePlugin, { OptionType } from "@utils/types";
import { CommandArgument, CommandContext, CommandOption } from "@vampcord/discord-types";
import { ChannelRouter, ChannelStore } from "@webpack/common";

import { discordTimestamp, resolveWhen } from "./time";

interface ScheduledItem {
    id: string;
    kind: "message" | "reminder";
    channelId: string;
    content: string;
    dueAt: number;
    createdAt: number;
}

const STORE_KEY = "VampCord_scheduled";
const CHECK_INTERVAL = 10_000;
const MAX_ITEMS = 100;

const logger = new Logger("Scheduler");

let items: ScheduledItem[] = [];
let intervalId: ReturnType<typeof setInterval> | undefined;
// Serialises changes so the interval and commands never overwrite each other's saves
let queue = Promise.resolve();

const settings = definePluginSettings({
    missedMessageGrace: {
        type: OptionType.NUMBER,
        description: "If Discord was closed when a message should have been sent, still send it automatically if it's at most this many minutes late. Older ones ask you first",
        default: 5
    }
});

function update(fn: () => void | Promise<void>) {
    queue = queue.then(async () => {
        await fn();
        await DataStore.set(STORE_KEY, items);
    }).catch(err => logger.error("Failed to save scheduled items", err));
    return queue;
}

function newId() {
    let id: string;
    do id = Math.random().toString(36).slice(2, 6);
    while (items.some(i => i.id === id));
    return id;
}

const channelLabel = (channelId: string) => {
    const channel = ChannelStore.getChannel(channelId);
    return channel?.guild_id ? `<#${channelId}>` : "your DM";
};

const preview = (content: string) => content.length > 80 ? content.slice(0, 77) + "..." : content;

function deliver(item: ScheduledItem, now: number) {
    const lateBy = now - item.dueAt;

    if (item.kind === "reminder") {
        const late = lateBy > 60_000 ? " (late, Discord was closed)" : "";
        showNotification({
            title: `⏰ Reminder${late}`,
            body: item.content,
            permanent: true,
            onClick: () => ChannelRouter.transitionToChannel(item.channelId)
        });
        sendBotMessage(item.channelId, { content: `⏰ **Reminder**${late}: ${item.content}` });
        return;
    }

    if (lateBy > settings.store.missedMessageGrace * 60_000) {
        // Sending a message long after the intended time could be confusing, so ask first
        showNotification({
            title: "Scheduled message not sent",
            body: `Discord was closed when "${preview(item.content)}" should have been sent ${discordTimeAgo(lateBy)}. Click to send it now.`,
            permanent: true,
            onClick: () => sendMessage(item.channelId, { content: item.content }, false)
        });
        return;
    }

    sendMessage(item.channelId, { content: item.content }, false);
}

function discordTimeAgo(ms: number) {
    const minutes = Math.round(ms / 60_000);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    return `${Math.round(hours / 24)} days ago`;
}

function checkDue() {
    const now = Date.now();
    if (!items.some(i => i.dueAt <= now)) return;

    update(() => {
        const due = items.filter(i => i.dueAt <= now);
        items = items.filter(i => i.dueAt > now);

        for (const item of due) {
            try {
                deliver(item, now);
            } catch (err) {
                logger.error("Failed to deliver scheduled item", item, err);
            }
        }
    });
}

const WhenOptions: CommandOption[] = [
    {
        name: "in",
        description: "How long from now, eg 10m, 1h30m or 2d",
        type: ApplicationCommandOptionType.STRING,
        required: false
    },
    {
        name: "at",
        description: "Time of day, eg 18:30 or 7pm (today, or tomorrow if it already passed)",
        type: ApplicationCommandOptionType.STRING,
        required: false
    }
];

function schedule(kind: ScheduledItem["kind"], content: string, args: CommandArgument[], ctx: CommandContext) {
    const reply = (text: string) => sendBotMessage(ctx.channel.id, { content: text });

    let dueAt: number;
    try {
        dueAt = resolveWhen({ in: findOption(args, "in"), at: findOption(args, "at") });
    } catch (err) {
        return reply(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!content.trim()) return reply("❌ Nothing to schedule");
    if (items.length >= MAX_ITEMS) return reply(`❌ You can have at most ${MAX_ITEMS} scheduled messages and reminders`);

    const item: ScheduledItem = { id: newId(), kind, channelId: ctx.channel.id, content, dueAt, createdAt: Date.now() };
    update(() => void items.push(item));

    reply(
        `${kind === "message" ? "📨 Message scheduled" : "⏰ Reminder set"} for ${discordTimestamp(dueAt, "f")} (${discordTimestamp(dueAt, "R")}). ` +
        `Cancel it with ${toInlineCode(`/unschedule id:${item.id}`)}`
    );
}

export default definePlugin({
    name: "Scheduler",
    description: "Schedule messages to be sent later and set reminders. They survive restarts",
    tags: ["Chat", "Commands", "Utility"],
    authors: [Devs.iyesska],
    settings,

    async start() {
        items = await DataStore.get<ScheduledItem[]>(STORE_KEY) ?? [];
        intervalId = setInterval(checkDue, CHECK_INTERVAL);
        // Deliver anything that became due while Discord was closed
        setTimeout(checkDue, 5000);
    },

    stop() {
        clearInterval(intervalId);
    },

    commands: [
        {
            name: "schedule",
            description: "Send a message later",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "message",
                    description: "The message to send",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                ...WhenOptions
            ],
            execute: (args, ctx) => schedule("message", findOption(args, "message", ""), args, ctx)
        },
        {
            name: "remind",
            description: "Get a reminder later",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "about",
                    description: "What to remind you about",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                ...WhenOptions
            ],
            execute: (args, ctx) => schedule("reminder", findOption(args, "about", ""), args, ctx)
        },
        {
            name: "scheduled",
            description: "List your scheduled messages and reminders",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                if (!items.length)
                    return sendBotMessage(ctx.channel.id, { content: "Nothing scheduled. Use `/schedule` or `/remind`" });

                const lines = [...items]
                    .sort((a, b) => a.dueAt - b.dueAt)
                    .map(i =>
                        `${toInlineCode(i.id)} ${i.kind === "message" ? "📨" : "⏰"} ${discordTimestamp(i.dueAt, "R")} in ${channelLabel(i.channelId)}: ${preview(i.content)}`
                    );

                sendBotMessage(ctx.channel.id, { content: `**Scheduled (${items.length})**\n${lines.join("\n")}` });
            }
        },
        {
            name: "unschedule",
            description: "Cancel a scheduled message or reminder",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [{
                name: "id",
                description: "The id shown by /scheduled",
                type: ApplicationCommandOptionType.STRING,
                required: true
            }],
            execute: (args, ctx) => {
                const id = findOption(args, "id", "").trim().toLowerCase();
                const item = items.find(i => i.id === id);
                if (!item)
                    return sendBotMessage(ctx.channel.id, { content: `❌ Nothing scheduled with id ${toInlineCode(id)}. See \`/scheduled\`` });

                update(() => void (items = items.filter(i => i.id !== id)));
                sendBotMessage(ctx.channel.id, { content: `🗑️ Cancelled: ${preview(item.content)}` });
            }
        }
    ]
});
