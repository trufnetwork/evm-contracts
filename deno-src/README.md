## Deno Sources

It's utterly important to run the prettier check on deno sources. Main reason is that every line should have a semicolon at the end. Otherwise the deployed code will fail with an opaque error. And that only happens in live environments.

It's also important to test the code in a live testnetwork to confirm it works. It's not equal to the local environment. There might have some syntax errors that only happen in live environments (example, `return await XX` makes the code fail in live environments).