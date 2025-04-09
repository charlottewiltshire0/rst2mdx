import { logger } from "./logger";

export interface RSTNode {
  type: string;
  content?: string;
  children?: RSTNode[];
  options?: Record<string, string>;
}

export function parseRST(content: string): RSTNode[] {
  const lines = content.split("\n");
  const nodes: RSTNode[] = [];

  let i = 0;
  // Skip reference links at the beginning (e.g., ".. _doc_your_first_2d_game_creating_the_enemy:")
  while (
    i < lines.length &&
    (lines[i].trim() === "" || lines[i].trim().match(/^\.\.\s+_[a-z0-9_]+:/))
  ) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (line === "") {
      i++;
      continue;
    }

    // Check for section headers (text underlined by ===, ---, etc.)
    if (i + 1 < lines.length && /^[=\-`~:'"^_*+#<>]{3,}$/.test(lines[i + 1].trim())) {
      const level = getHeaderLevel(lines[i + 1].trim()[0]);
      nodes.push({
        type: "heading",
        content: line,
        options: { level: level.toString() },
      });
      i += 2;
      continue;
    }

    // Check for directive (.. directive::)
    if (line.startsWith(".. ") && line.includes("::")) {
      const directive = parseDirective(lines, i);
      nodes.push(directive.node);
      i = directive.nextLine;
      continue;
    }

    // Check for bullet list
    if (line.match(/^[*\-+]\s/)) {
      const list = parseList(lines, i, /^[*\-+]\s/);
      nodes.push(list.node);
      i = list.nextLine;
      continue;
    }

    // Check for enumerated list
    if (line.match(/^\d+\.\s/)) {
      const list = parseList(lines, i, /^\d+\.\s/);
      nodes.push(list.node);
      i = list.nextLine;
      continue;
    }

    // Check for literal block (indented text)
    if (i > 0 && lines[i - 1].trim() === "" && line.startsWith("    ")) {
      const codeBlock = parseCodeBlock(lines, i);
      nodes.push(codeBlock.node);
      i = codeBlock.nextLine;
      continue;
    }

    // Default to paragraph
    const paragraph = parseParagraph(lines, i);
    nodes.push(paragraph.node);
    i = paragraph.nextLine;
  }

  console.log(nodes);

  return nodes;
}

/**
 * Determines the heading level based on the underline character.
 * @param char - The character used for underlining (e.g., '=', '-').
 * @returns The corresponding heading level (1-6).
 */
function getHeaderLevel(char: string): number {
  // Standard RST heading levels based on underline character
  const levelMap: Record<string, number> = {
    "=": 1, // H1
    "-": 2, // H2
    "`": 3, // H3
    ":": 4, // H4
    "'": 5, // H5
    '"': 6, // H6
    "~": 3,
    "*": 4,
    "+": 5,
    "^": 6,
  };
  return levelMap[char] || 2; // Default to H2 if the character is not standard
}

function parseDirective(lines: string[], startLine: number): { node: RSTNode; nextLine: number } {
  const line = lines[startLine].trim();
  const match = line.match(/^\.\.\s+(\w+)::(.*)/);

  if (!match) {
    return {
      node: { type: "paragraph", content: line },
      nextLine: startLine + 1,
    };
  }

  const directiveType = match[1];
  const directiveArg = match[2].trim();

  let i = startLine + 1;
  let content = "";
  let indentation = 0;
  let contentStarted = false;

  // Find the indentation level of the directive content
  while (i < lines.length && !contentStarted) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }

    const contentMatch = lines[i].match(/^(\s+)/);
    if (contentMatch) {
      indentation = contentMatch[1].length;
      contentStarted = true;
    } else {
      // If we hit a line without indentation, it's not part of this directive
      break;
    }
  }

  // If we didn't find any indented content, just return
  if (!contentStarted) {
    // For directives that might not need indented content (like image)
    if (directiveType === "image") {
      return {
        node: {
          type: "image",
          content: directiveArg,
          options: {},
        },
        nextLine: i,
      };
    }

    return {
      node: {
        type: directiveType === "image" ? "image" : "directive",
        content: "",
        options: directiveType === "image" ? {} : { name: directiveType, argument: directiveArg },
      },
      nextLine: i,
    };
  }

  // Collect the directive content
  let directiveEnd = i;
  while (directiveEnd < lines.length) {
    const currentLine = lines[directiveEnd];

    // If line is empty, check if next line is still part of directive
    if (currentLine.trim() === "") {
      let nextNonEmptyLine = directiveEnd + 1;
      while (nextNonEmptyLine < lines.length && lines[nextNonEmptyLine].trim() === "") {
        nextNonEmptyLine++;
      }

      // If next non-empty line isn't indented enough, we're out of the directive
      if (nextNonEmptyLine < lines.length) {
        const nextLine = lines[nextNonEmptyLine];
        if (!nextLine.startsWith(" ".repeat(indentation))) {
          break;
        }
      }

      // Add empty line to content
      content += "\n";
      directiveEnd++;
      continue;
    }

    // If line doesn't have enough indentation, we're out of the directive
    if (!currentLine.startsWith(" ".repeat(indentation))) {
      break;
    }

    // Add line to content, removing indentation
    content += currentLine.substring(indentation) + "\n";
    directiveEnd++;
  }

  // Set i to the line after directive ends
  i = directiveEnd;

  // Handle specific directives
  switch (directiveType) {
    case "code-block":
    case "code":
      return {
        node: {
          type: "codeBlock",
          content: content.trim(),
          options: { language: directiveArg || "text" },
        },
        nextLine: i,
      };
    case "image":
      return {
        node: {
          type: "image",
          content: directiveArg,
          options: parseOptions(content),
        },
        nextLine: i,
      };
    case "note":
    case "warning":
    case "danger":
    case "tip":
      return {
        node: {
          type: "admonition",
          content: content.trim(),
          options: { kind: directiveType },
        },
        nextLine: i,
      };
    default:
      // Generic directive handling
      return {
        node: {
          type: "directive",
          content: content.trim(),
          options: {
            name: directiveType,
            argument: directiveArg,
          },
        },
        nextLine: i,
      };
  }
}

function parseOptions(content: string): Record<string, string> {
  const options: Record<string, string> = {};
  const lines = content.trim().split("\n");

  for (const line of lines) {
    const match = line.match(/^:([^:]+):\s*(.*)/);
    if (match) {
      options[match[1].trim()] = match[2].trim();
    }
  }

  return options;
}

function parseList(
  lines: string[],
  startLine: number,
  pattern: RegExp
): { node: RSTNode; nextLine: number } {
  const items: RSTNode[] = [];
  let i = startLine;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === "" || !line.match(pattern)) {
      // If we hit an empty line or a line that doesn't match the pattern,
      // check if the next non-empty line continues the list
      let nextNonEmpty = i;
      while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim() === "") {
        nextNonEmpty++;
      }

      if (nextNonEmpty < lines.length && lines[nextNonEmpty].trim().match(pattern)) {
        // Skip empty lines and continue with the list
        i = nextNonEmpty;
        continue;
      }

      // Otherwise, we're done with the list
      break;
    }

    // Extract the content after the list marker
    const content = line.replace(pattern, "").trim();
    items.push({
      type: "listItem",
      content: processInlineMarkup(content),
    });

    i++;
  }

  return {
    node: {
      type: pattern.toString().includes("\\d+") ? "orderedList" : "unorderedList",
      children: items,
    },
    nextLine: i,
  };
}

function parseCodeBlock(lines: string[], startLine: number): { node: RSTNode; nextLine: number } {
  let content = "";
  let i = startLine;

  while (i < lines.length && (lines[i].startsWith("    ") || lines[i].trim() === "")) {
    if (lines[i].trim() !== "") {
      content += lines[i].substring(4) + "\n";
    } else {
      content += "\n";
    }
    i++;
  }

  return {
    node: {
      type: "codeBlock",
      content: content.trim(),
      options: { language: "text" },
    },
    nextLine: i,
  };
}

function parseParagraph(lines: string[], startLine: number): { node: RSTNode; nextLine: number } {
  let content = "";
  let i = startLine;

  while (i < lines.length && lines[i].trim() !== "") {
    content += (content ? " " : "") + lines[i].trim();
    i++;
  }

  content = processInlineMarkup(content);

  return {
    node: {
      type: "paragraph",
      content,
    },
    nextLine: i + 1,
  };
}

/**
 * Formats a specific type of reference (':ref:') that points to a class definition.
 * Input format expected: :ref:`DisplayText <class_ClassName> Optional Text`
 * Output format: [DisplayText](/engine/classes/class_classname) Optional Text
 * @param refContent - The content inside the :ref:`...` backticks.
 * @returns A formatted Markdown link string.
 */
function formatClassReference(refContent: string): string {
  const classRefRegex = /^(.*?)\s*<\s*(class_[^>]+)\s*>\s*(.*)$/i;
  const match = refContent.trim().match(classRefRegex);

  if (match) {
    const displayText = match[1].trim();
    const classIdentifier = match[2].trim();

    const url = `/engine/classes/${classIdentifier.toLowerCase()}`;
    return `[${displayText}](${url})`;
  }

  logger.warn(`Could not parse class reference format: ${refContent}`);
  const fallbackText = refContent.replace(/<.*?>/g, "").trim(); // Basic cleanup
  return `[${fallbackText}](#${fallbackText.toLowerCase().replace(/\s+/g, "-")})`;
}

/**
 * Process inline markup in RST text and convert it to MDX format
 * Handles bold, italic, code, links, and other inline elements
 */
function processInlineMarkup(text: string): string {
  // Storage for processed parts to avoid double processing
  const processed = new Map<string, string>();
  let processedText = text;
  let id = 0;

  // First, extract and replace all link patterns with placeholders to protect them
  // Capture and preserve RST external links: `text <url>`_ and `text <url>`__
  processedText = processedText.replace(
    /`([^`<>]+)\s+<([^>]+)>`(__?)/g,
    (match, linkText, url, suffix) => {
      const placeholder = `__LINK_${id++}__`;
      processed.set(placeholder, `[${linkText.trim()}](${url.trim()})`);
      return placeholder;
    }
  );

  // Handle reference links: `text`_
  processedText = processedText.replace(/`([^`]+)`_/g, (match, linkText) => {
    const placeholder = `__LINK_${id++}__`;
    processed.set(
      placeholder,
      `[${linkText.trim()}](#${linkText.trim().toLowerCase().replace(/\s+/g, "-")})`
    );
    return placeholder;
  });

  // Process strong emphasis (bold) - **text**
  processedText = processedText.replace(/\*\*([^*]+)\*\*/g, "**$1**");

  // Process emphasis (italic) - *text*
  processedText = processedText.replace(/\*([^*]+)\*/g, "*$1*");

  // Process inline literals (code) - ``text``
  processedText = processedText.replace(/``([^`]+)``/g, "`$1`");

  // Process inline code - `text`
  // Only process backticks that are not placeholders
  processedText = processedText.replace(/`([^`_][^`]*)`/g, "`$1`");

  // Process interpreted text roles - :role:`text`
  processedText = processedText.replace(/:([a-z-]+):`([^`]+)`/g, (match, role, content) => {
    switch (role) {
      case "code":
        return `\`${content}\``;
      case "em":
      case "emphasis":
        return `*${content}*`;
      case "strong":
        return `**${content}**`;
      case "literal":
        return `\`${content}\``;
      case "math":
        return `$${content}$`;
      case "ref":
        // Check if it's a class reference using the new function
        if (content.includes("<class_")) {
          return formatClassReference(content);
        }
        // Otherwise, treat as a standard internal reference link
        return `[${content}](#${content.toLowerCase().replace(/\s+/g, "-")})`;
      case "doc":
        return `[${content}](${content})`;
      default:
        return `<span className="${role}">${content}</span>`;
    }
  });

  for (const [placeholder, replacement] of processed.entries()) {
    processedText = processedText.replace(placeholder, replacement);
  }

  return processedText;
}
