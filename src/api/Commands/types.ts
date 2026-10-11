/*
 * VampCord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Command } from "@vampcord/discord-types";
export { ApplicationCommandInputType, ApplicationCommandOptionType, ApplicationCommandType } from "@vampcord/discord-types/enums";

export interface VampCordCommand extends Command {
    isVampCordCommand?: boolean;
    rootCommand?: VampCordCommand;
}
