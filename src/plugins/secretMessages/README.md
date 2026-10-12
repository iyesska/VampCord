# SecretMessages

End-to-end encrypted messages inside Discord. Only people using VampCord with the same passphrase can read them;
Discord and everyone else only see scrambled text.

## How to use

1. In a DM or channel, run `/secret newkey`. VampCord creates a random passphrase and shows it only to you
2. Share the passphrase privately (in person, another app...) with the people you want to talk to.
   They run `/secret setkey passphrase:<the passphrase>`
3. Click the 🔒 lock button next to the message box to turn on **secret mode**. Everything you send in that channel is
   encrypted automatically. You can also send a single message with `/secret send`

Secret messages show up decrypted right below the original message. Use `/secret info` to compare the passphrase id
with your friends and make sure you're using the same one.

## Security

-   AES-256-GCM encryption with a random IV for every message, so tampering is detected
-   The passphrase is stretched with PBKDF2 (310,000 iterations, SHA-256)
-   Passphrases are stored only on your device, they are never synced or sent anywhere
-   If something goes wrong while encrypting, the message is **not** sent, it is never sent unencrypted
-   Attachments, embeds and reactions are not encrypted. Discord can still see who talks to whom and when
-   Anyone who knows the passphrase can read every message encrypted with it, so share it carefully
