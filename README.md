# tweet-test

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

to test multiple sends at once

```bash
bun run schedule-sent.ts
```

# Send all tweets with default 2-minute delay

```sh
bun run schedule-send.ts
```

# Send tweets with 4-minute delay

```sh
bun run schedule-send.ts --delay 4min
```

# Send only 5 tweets with 4-minute delay

```sh
bun run schedule-send.ts --delay 4min --count 5
```

# You can also just use numbers for minutes

```sh
bun run schedule-send.ts --delay 2 --count 5
```

This project was created using `bun init` in bun v1.1.42. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
