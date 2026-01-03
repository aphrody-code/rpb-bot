import { container } from "@sapphire/framework";
import { addLog } from "./api-server.js";

// Wrap the Sapphire logger to capture logs
export function setupLogCapture() {
  const originalLogger = container.logger;

  // Create proxy for each log level
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

  for (const level of levels) {
    const originalMethod = originalLogger[level].bind(originalLogger);

    originalLogger[level] = (...args: unknown[]) => {
      // Call original method
      originalMethod(...args);

      // Capture the log
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg),
        )
        .join(" ");

      addLog(level.toUpperCase(), message);
    };
  }
}
