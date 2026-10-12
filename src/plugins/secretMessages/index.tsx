/*
 * VampCord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { addMessagePreSendListener, MessageObject, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { sendMessage } from "@utils/discord";
import { useAwaiter, useForceUpdater } from "@utils/react";
import { toInlineCode } from "@utils/text";
import definePlugin, { IconComponent } from "@utils/types";
import { Message } from "@vampcord/discord-types";
import { Parser, showToast, useEffect } from "@webpack/common";

import { decrypt, encrypt, findToken, generatePassphrase, getKeyId, MAX_PLAINTEXT_BYTES, utf8Length } from "./crypto";

const cl = classNameFactory("vc-secret-");

// Passphrases are only kept on this device (not in settings, which can be synced to the cloud)
const KEYS_STORE_KEY = "VampCord_secretMessagesKeys";
const DEFAULT_KEY = "default";

let keys: Record<string, string> = {};
const secretModeChannels = new Set<string>();
const listeners = new Set<() => void>();

function notifyChange() {
    listeners.forEach(l => l());
}

function useSecretState() {
    const forceUpdate = useForceUpdater();
    useEffect(() => {
        listeners.add(forceUpdate);
        return () => void listeners.delete(forceUpdate);
    }, []);
}

const getPassphrase = (channelId: string) => keys[channelId] || keys[DEFAULT_KEY] || "";
const getAllPassphrases = () => Object.values(keys);

async function setKey(target: string, passphrase: string | null) {
    if (passphrase) keys[target] = passphrase;
    else delete keys[target];

    if (!getPassphrase(target)) secretModeChannels.delete(target);

    await DataStore.set(KEYS_STORE_KEY, keys);
    notifyChange();
}

const formatSecret = (token: string) => `🔒 Secret message (VampCord)\n${toInlineCode(token)}`;

async function encryptForChannel(channelId: string, text: string) {
    const passphrase = getPassphrase(channelId);
    if (!passphrase) throw new Error("There is no passphrase for this channel. Set one with /secret setkey or /secret newkey");

    const size = utf8Length(text);
    if (size > MAX_PLAINTEXT_BYTES)
        throw new Error(`Secret messages can be up to ${MAX_PLAINTEXT_BYTES} bytes, yours is ${size}. Split it into multiple messages`);

    return formatSecret(await encrypt(text, passphrase));
}

// Messages being sent in secret mode, see onBeforeMessageSend
const pendingSecretSends = new WeakSet<MessageObject>();

const encryptOnSend: MessageSendListener = async (channelId, message) => {
    if (!secretModeChannels.has(channelId) || !message.content.trim() || findToken(message.content)) return;

    // Other plugins (eg TextReplace) may change the message after us and would corrupt the encrypted text.
    // Moving ourselves to the end of the listeners makes this listener run again after all others, which then encrypts
    if (!pendingSecretSends.has(message)) {
        pendingSecretSends.add(message);
        removeMessagePreSendListener(encryptOnSend);
        addMessagePreSendListener(encryptOnSend);
        return;
    }
    pendingSecretSends.delete(message);

    try {
        message.content = await encryptForChannel(channelId, message.content);
    } catch (err) {
        // Never send the message unencrypted
        showToast(err instanceof Error ? err.message : "Failed to encrypt your message", "failure");
        return { cancel: true };
    }
};

const LockIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg viewBox="0 0 24 24" height={height} width={width} className={className} aria-hidden="true">
        <path
            fill="currentColor"
            d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Zm3 4a2 2 0 0 1 1 3.73V19h-2v-1.27A2 2 0 0 1 12 14Z"
        />
    </svg>
);

const SecretModeButton: ChatBarButtonFactory = ({ isMainChat, channel }) => {
    useSecretState();

    if (!isMainChat || !getPassphrase(channel.id)) return null;

    const enabled = secretModeChannels.has(channel.id);

    return (
        <ChatBarButton
            tooltip={enabled ? "Secret mode is ON: your messages here are encrypted" : "Turn on secret mode"}
            onClick={() => {
                if (enabled) secretModeChannels.delete(channel.id);
                else secretModeChannels.add(channel.id);
                notifyChange();
            }}
            buttonProps={{ className: enabled ? cl("button-active") : undefined }}
        >
            <LockIcon />
        </ChatBarButton>
    );
};

function SecretAccessory({ message }: { message: Message; }) {
    useSecretState();

    const [result, , pending] = useAwaiter(
        () => decrypt(message.content, getAllPassphrases()),
        { fallbackValue: null, deps: [message.content, getAllPassphrases().join("\n")] }
    );

    if (pending || !result) return null;

    if (result.status === "no-key") {
        return (
            <div className={cl("hint")}>
                🔒 You don't have the passphrase for this secret message. Ask the sender and add it with <code>/secret setkey</code>
            </div>
        );
    }

    if (result.status === "invalid") {
        return <div className={cl("hint")}>⚠️ This secret message was modified or is corrupted and can't be decrypted</div>;
    }

    return (
        <div className={cl("message")}>
            <span className={cl("label")}>
                <LockIcon height={14} width={14} /> Secret message
            </span>
            <div className={cl("content")}>{Parser.parse(result.text)}</div>
        </div>
    );
}

export default definePlugin({
    name: "SecretMessages",
    description: "End-to-end encrypted messages with a shared passphrase. Only people using VampCord with the same passphrase can read them",
    tags: ["Chat", "Privacy", "Commands"],
    authors: [Devs.iyesska],

    async start() {
        keys = await DataStore.get<Record<string, string>>(KEYS_STORE_KEY) ?? {};
        notifyChange();
    },

    stop() {
        secretModeChannels.clear();
    },

    onBeforeMessageSend: encryptOnSend,

    chatBarButton: {
        icon: LockIcon,
        render: SecretModeButton
    },

    renderMessageAccessory: ({ message }) => {
        if (!findToken(message.content)) return null;
        return (
            <ErrorBoundary noop>
                <SecretAccessory message={message} />
            </ErrorBoundary>
        );
    },

    commands: [
        {
            name: "secret",
            description: "Send and manage end-to-end encrypted messages",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "send",
                    description: "Send an encrypted message",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [{
                        name: "message",
                        description: "The message to encrypt",
                        type: ApplicationCommandOptionType.STRING,
                        required: true
                    }]
                },
                {
                    name: "newkey",
                    description: "Create a random passphrase for this channel and show it so you can share it",
                    type: ApplicationCommandOptionType.SUB_COMMAND
                },
                {
                    name: "setkey",
                    description: "Use a passphrase someone shared with you",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "passphrase",
                            description: "The shared passphrase",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        },
                        {
                            name: "everywhere",
                            description: "Use it in every channel without its own passphrase (default: only this channel)",
                            type: ApplicationCommandOptionType.BOOLEAN,
                            required: false
                        }
                    ]
                },
                {
                    name: "removekey",
                    description: "Forget the passphrase of this channel",
                    type: ApplicationCommandOptionType.SUB_COMMAND
                },
                {
                    name: "info",
                    description: "Show which passphrase this channel uses, to compare with the people you talk to",
                    type: ApplicationCommandOptionType.SUB_COMMAND
                }
            ],
            async execute(args, ctx) {
                const channelId = ctx.channel.id;
                const sub = args[0];
                const reply = (content: string) => sendBotMessage(channelId, { content });

                try {
                    switch (sub.name) {
                        case "send": {
                            const text: string = findOption(sub.options, "message", "");
                            sendMessage(channelId, { content: await encryptForChannel(channelId, text) });
                            break;
                        }
                        case "newkey": {
                            const passphrase = generatePassphrase();
                            await setKey(channelId, passphrase);
                            reply(
                                `🔑 New passphrase for this channel: ${toInlineCode(passphrase)}\n` +
                                "Share it privately (not in this chat!) with the people who should read your secret messages. " +
                                "They add it with `/secret setkey`. Then turn on secret mode with the lock button or use `/secret send`."
                            );
                            break;
                        }
                        case "setkey": {
                            const passphrase: string = findOption(sub.options, "passphrase", "").trim();
                            if (passphrase.length < 8) return reply("❌ Use a passphrase of at least 8 characters");

                            const everywhere = findOption(sub.options, "everywhere", false);
                            await setKey(everywhere ? DEFAULT_KEY : channelId, passphrase);
                            reply(`🔑 Passphrase saved ${everywhere ? "as the default for all channels" : "for this channel"} (id ${toInlineCode(await getKeyId(passphrase))}). It never leaves this device.`);
                            break;
                        }
                        case "removekey": {
                            if (!keys[channelId]) return reply("This channel has no passphrase of its own");
                            await setKey(channelId, null);
                            reply("🗑️ Removed the passphrase of this channel");
                            break;
                        }
                        case "info": {
                            const passphrase = getPassphrase(channelId);
                            if (!passphrase) return reply("This channel has no passphrase. Create one with `/secret newkey`");
                            reply(
                                `🔑 This channel uses ${keys[channelId] ? "its own passphrase" : "your default passphrase"} with id ${toInlineCode(await getKeyId(passphrase))}. ` +
                                "Everyone with the same passphrase sees the same id.\n" +
                                `Secret mode is ${secretModeChannels.has(channelId) ? "ON" : "OFF"}.`
                            );
                            break;
                        }
                    }
                } catch (err) {
                    reply(`❌ ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }
    ]
});
