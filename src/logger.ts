import { intro, outro, spinner, note, log } from "@clack/prompts";
import colors from "picocolors";

// Create a logger with different log levels
export const logger = {
  info: (message: string) => {
    log.info(message);
  },
  warn: (message: string) => {
    log.warn(colors.yellow(message));
  },
  error: (message: string, error?: any) => {
    log.error(colors.red(message));
    if (error) {
      if (error instanceof Error) {
        console.error(colors.red(error.stack || error.message));
      } else {
        console.error(colors.red(String(error)));
      }
    }
  },
  success: (message: string) => {
    outro(colors.green(message));
  },
  intro: (message: string) => {
    intro(colors.cyan(message));
  },
};

// Start a spinner with the given text
export function startSpinner(text: string) {
  const spin = spinner();
  spin.start(text);
  return spin;
}

// Stop a spinner with success or error
export function stopSpinner(
  spin: ReturnType<typeof spinner>,
  text: string,
  success: boolean,
) {
  if (success) {
    spin.stop(colors.green(text));
  } else {
    spin.stop(colors.red(text));
  }
}

// Create a note box
export function createNote(text: string) {
  return note(text, "Details");
}
