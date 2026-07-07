import { createReadStream, existsSync } from "node:fs";
import * as readline from "node:readline";

interface LogQueryOptions {
  file?: string;
  keyword?: string;
  level?: string;
  limit?: number;
  status?: number;
  userId?: string;
}

function parseArgs(args: string[]): LogQueryOptions {
  const options: LogQueryOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--file" && args[i + 1]) {
      const value = args[++i];
      if (value !== undefined) {
        options.file = value;
      }
    } else if (arg === "--level" && args[i + 1]) {
      const value = args[++i];
      if (value !== undefined) {
        options.level = value;
      }
    } else if (arg === "--userId" && args[i + 1]) {
      const value = args[++i];
      if (value !== undefined) {
        options.userId = value;
      }
    } else if (arg === "--status" && args[i + 1]) {
      options.status = Number(args[++i]);
    } else if (arg === "--keyword" && args[i + 1]) {
      const value = args[++i];
      if (value !== undefined) {
        options.keyword = value.toLowerCase();
      }
    } else if (arg === "--limit" && args[i + 1]) {
      options.limit = Number(args[++i]);
    }
  }
  return options;
}

async function queryLogs() {
  const options = parseArgs(process.argv.slice(2));
  const inputStream =
    options.file && existsSync(options.file)
      ? createReadStream(options.file, "utf8")
      : process.stdin;

  const rl = readline.createInterface({
    input: inputStream,
    terminal: false,
  });

  let count = 0;
  const limit = options.limit ?? 1000;

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;

      if (options.level && entry.level !== options.level) {
        continue;
      }
      if (options.userId && entry.userId !== options.userId) {
        continue;
      }
      if (options.status !== undefined && entry.status !== options.status) {
        continue;
      }
      if (options.keyword && !line.toLowerCase().includes(options.keyword)) {
        continue;
      }

      console.log(JSON.stringify(entry, null, 2));
      count++;
      if (count >= limit) {
        break;
      }
    } catch {
      // Ignore non-JSON lines
    }
  }
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") ?? "")) {
  queryLogs().catch((err) => {
    console.error("Error querying logs:", err);
    process.exit(1);
  });
}

export { parseArgs, queryLogs };
