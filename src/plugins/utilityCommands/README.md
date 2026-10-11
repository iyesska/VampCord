# UtilityCommands

Adds a few handy slash commands. By default the result is only visible to you; set `send: True` to post it in chat.

- `/roll dice:2d6+3` – roll dice in `NdM+K` notation (`d20`, `4d6`, `1d100-5`, …)
- `/coinflip` – heads or tails
- `/choose options:pizza, tacos, sushi` – pick a random option (separate with `,` or `|`)
- `/calc expression:(2 + 3) * sqrt(16)` – calculator supporting `+ - * / % ^`, parentheses, `pi`, `e`, `tau`
  and `sqrt cbrt abs round floor ceil sin cos tan asin acos atan ln log log2 exp`. It never uses `eval`.

Randomness uses `crypto.getRandomValues` without modulo bias.
