/*
 * VampCord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Uniformly distributed random integer in [0, max) using the crypto rng */
export function randomInt(max: number) {
    if (!Number.isSafeInteger(max) || max <= 0) throw new RangeError("max must be a positive safe integer");

    // Rejection sampling to avoid modulo bias
    const limit = 2 ** 32 - (2 ** 32 % max);
    const buf = new Uint32Array(1);
    do {
        crypto.getRandomValues(buf);
    } while (buf[0] >= limit);

    return buf[0] % max;
}

export const MAX_DICE = 100;
export const MAX_SIDES = 1_000_000;

export interface DiceRoll {
    count: number;
    sides: number;
    modifier: number;
    rolls: number[];
    total: number;
}

/**
 * Parse and roll dice notation like "d20", "2d6", "3d8+2" or "1d100-5"
 */
export function rollDice(notation: string): DiceRoll {
    const match = notation.replace(/\s+/g, "").toLowerCase().match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!match) throw new Error(`Invalid dice "${notation}". Use something like d20, 2d6 or 3d8+2`);

    const count = match[1] ? Number(match[1]) : 1;
    const sides = Number(match[2]);
    const modifier = match[3] ? Number(match[3]) : 0;

    if (count < 1 || count > MAX_DICE) throw new Error(`You can roll between 1 and ${MAX_DICE} dice`);
    if (sides < 2 || sides > MAX_SIDES) throw new Error(`Dice must have between 2 and ${MAX_SIDES} sides`);
    if (!Number.isSafeInteger(modifier)) throw new Error("Modifier is too large");

    const rolls = Array.from({ length: count }, () => randomInt(sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0) + modifier;

    return { count, sides, modifier, rolls, total };
}

/**
 * Split a list like "pizza, tacos, sushi" or "a | b | c" into its non empty choices
 */
export function parseChoices(input: string) {
    const separator = input.includes("|") ? "|" : ",";
    return input.split(separator).map(s => s.trim()).filter(Boolean);
}

const FUNCTIONS: Record<string, (x: number) => number> = {
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    ln: Math.log,
    log: Math.log10,
    log2: Math.log2,
    exp: Math.exp
};

const CONSTANTS: Record<string, number> = {
    pi: Math.PI,
    e: Math.E,
    tau: 2 * Math.PI
};

type Token =
    | { type: "num"; value: number; }
    | { type: "ident"; value: string; }
    | { type: "op"; value: string; };

function tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < expr.length) {
        const char = expr[i];

        if (/\s/.test(char)) {
            i++;
        } else if (/[\d.]/.test(char)) {
            const num = expr.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i)?.[0];
            if (!num || expr[i + num.length] === ".") throw new Error(`Invalid number at position ${i + 1}`);
            tokens.push({ type: "num", value: Number(num) });
            i += num.length;
        } else if (/[a-z]/i.test(char)) {
            const ident = expr.slice(i).match(/^[a-z][a-z0-9]*/i)![0];
            tokens.push({ type: "ident", value: ident.toLowerCase() });
            i += ident.length;
        } else if ("+-*/%^()×÷".includes(char)) {
            tokens.push({ type: "op", value: char === "×" ? "*" : char === "÷" ? "/" : char });
            i++;
        } else {
            throw new Error(`Unexpected character "${char}" at position ${i + 1}`);
        }
    }

    return tokens;
}

/**
 * Safely evaluate a math expression without using eval.
 *
 * Supports + - * / % ^ (power, right associative), parentheses, implicit multiplication like 2pi or 3(4+5),
 * the constants pi, e and tau and the functions sqrt, cbrt, abs, round, floor, ceil, sin, cos, tan, asin, acos,
 * atan, ln, log (base 10), log2 and exp
 */
export function evaluateExpression(expr: string): number {
    const tokens = tokenize(expr);
    if (!tokens.length) throw new Error("Empty expression");

    let pos = 0;
    const peek = () => tokens[pos];
    const isOp = (value: string) => peek()?.type === "op" && peek().value === value;

    function expect(value: string) {
        if (!isOp(value)) throw new Error(`Expected "${value}"`);
        pos++;
    }

    // expression := term (("+" | "-") term)*
    function parseExpression(): number {
        let value = parseTerm();
        while (isOp("+") || isOp("-")) {
            const op = tokens[pos++].value;
            const rhs = parseTerm();
            value = op === "+" ? value + rhs : value - rhs;
        }
        return value;
    }

    // term := unary (("*" | "/" | "%") unary | implicit multiplication)*
    function parseTerm(): number {
        let value = parseUnary();
        while (true) {
            if (isOp("*") || isOp("/") || isOp("%")) {
                const op = tokens[pos++].value;
                const rhs = parseUnary();
                if (op === "*") value *= rhs;
                else if (op === "/") value /= rhs;
                else value %= rhs;
            } else if (peek() && (peek().type === "num" || peek().type === "ident" || isOp("("))) {
                value *= parseUnary();
            } else {
                return value;
            }
        }
    }

    // unary := ("+" | "-") unary | power
    function parseUnary(): number {
        if (isOp("-")) {
            pos++;
            return -parseUnary();
        }
        if (isOp("+")) {
            pos++;
            return parseUnary();
        }
        return parsePower();
    }

    // power := primary ("^" unary)?
    function parsePower(): number {
        const base = parsePrimary();
        if (isOp("^")) {
            pos++;
            return base ** parseUnary();
        }
        return base;
    }

    // primary := number | constant | function primary | "(" expression ")"
    function parsePrimary(): number {
        const token = peek();
        if (!token) throw new Error("Unexpected end of expression");

        if (token.type === "num") {
            pos++;
            return token.value;
        }

        if (token.type === "ident") {
            pos++;
            if (Object.hasOwn(CONSTANTS, token.value)) return CONSTANTS[token.value];
            if (Object.hasOwn(FUNCTIONS, token.value)) return FUNCTIONS[token.value](parsePrimary());
            throw new Error(`Unknown name "${token.value}"`);
        }

        if (isOp("(")) {
            pos++;
            const value = parseExpression();
            expect(")");
            return value;
        }

        throw new Error(`Unexpected "${token.value}"`);
    }

    const result = parseExpression();
    if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos].value}"`);

    return result;
}

export function formatNumber(n: number) {
    if (Number.isNaN(n)) return "NaN";
    if (!Number.isFinite(n)) return n > 0 ? "∞" : "-∞";

    // Get rid of floating point noise like 0.1 + 0.2 = 0.30000000000000004
    const rounded = Number(n.toPrecision(12));
    return Math.abs(rounded) >= 1e21 || (rounded !== 0 && Math.abs(rounded) < 1e-6)
        ? rounded.toExponential()
        : String(rounded);
}
