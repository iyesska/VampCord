/*
 * VampCord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import { toInlineCode } from "@utils/text";
import definePlugin from "@utils/types";
import { CommandArgument, CommandContext, CommandOption } from "@vampcord/discord-types";

import { evaluateExpression, formatNumber, parseChoices, randomInt, rollDice } from "./utils";

const SendOption: CommandOption = {
    name: "send",
    description: "Send the result in chat so everyone can see it (default: only visible to you)",
    type: ApplicationCommandOptionType.BOOLEAN,
    required: false
};

function reply(args: CommandArgument[], ctx: CommandContext, content: string) {
    if (findOption(args, "send", false))
        sendMessage(ctx.channel.id, { content });
    else
        sendBotMessage(ctx.channel.id, { content });
}

function replyError(ctx: CommandContext, err: unknown) {
    sendBotMessage(ctx.channel.id, {
        content: `❌ ${err instanceof Error ? err.message : String(err)}`
    });
}

export default definePlugin({
    name: "UtilityCommands",
    description: "Adds handy slash commands: /roll for dice, /coinflip, /choose to pick a random option and /calc as a calculator",
    tags: ["Chat", "Commands", "Utility"],
    authors: [Devs.iyesska],

    commands: [
        {
            name: "roll",
            description: "Roll some dice, eg d20, 2d6 or 3d8+2",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "dice",
                    description: "Dice to roll in NdM+K notation (default: d6)",
                    type: ApplicationCommandOptionType.STRING,
                    required: false
                },
                SendOption
            ],
            execute(args, ctx) {
                try {
                    const { count, sides, modifier, rolls, total } = rollDice(findOption(args, "dice", "d6"));

                    const notation = `${count}d${sides}${modifier ? (modifier > 0 ? "+" : "") + modifier : ""}`;
                    const breakdown = count > 1 || modifier
                        ? ` (${rolls.join(" + ")}${modifier ? ` ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}` : ""})`
                        : "";

                    reply(args, ctx, `🎲 ${toInlineCode(notation)} → **${total}**${breakdown}`);
                } catch (e) {
                    replyError(ctx, e);
                }
            }
        },
        {
            name: "coinflip",
            description: "Flip a coin",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [SendOption],
            execute(args, ctx) {
                reply(args, ctx, `🪙 **${randomInt(2) === 0 ? "Heads" : "Tails"}**`);
            }
        },
        {
            name: "choose",
            description: "Pick a random option from a list",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "options",
                    description: "Options separated by commas or |, eg: pizza, tacos, sushi",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                SendOption
            ],
            execute(args, ctx) {
                const choices = parseChoices(findOption(args, "options", ""));
                if (choices.length < 2)
                    return replyError(ctx, "Give me at least two options separated by commas, eg: pizza, tacos, sushi");

                reply(args, ctx, `🤔 I choose **${choices[randomInt(choices.length)]}**`);
            }
        },
        {
            name: "calc",
            description: "Calculate a math expression, eg (2 + 3) * 4, sqrt(16) or 2^10",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "expression",
                    description: "Supports + - * / % ^, parentheses, pi, e and functions like sqrt, sin, log, round",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                SendOption
            ],
            execute(args, ctx) {
                const expression: string = findOption(args, "expression", "");
                try {
                    const result = formatNumber(evaluateExpression(expression));
                    reply(args, ctx, `🧮 ${toInlineCode(expression.trim())} = **${result}**`);
                } catch (e) {
                    replyError(ctx, e);
                }
            }
        }
    ]
});
