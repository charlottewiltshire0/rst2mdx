import type { RSTNode } from "./parser";
import wrap from "word-wrap";

/**
 * Convert the parsed RST nodes to MDX format
 * @param nodes - Array of RST nodes to convert
 * @param wrapWidth - Maximum line width for paragraphs (0 or undefined to disable wrapping)
 */
export function convertToMDX(nodes: RSTNode[], wrapWidth: number): string {
  let mdx = "";
  let firstHeadingProcessed = false;

  for (const node of nodes) {
    if (node.type === "heading" && !firstHeadingProcessed) {
      mdx += `---\ntitle: ${node.content}\n---\n\n`;
      firstHeadingProcessed = true;
    } else {
      mdx += convertNode(node, wrapWidth) + "\n\n";
    }
  }

  return mdx.trim();
}

/**
 * Recursively converts a single RST node to MDX
 * @param node - The RST node to convert
 * @param wrapWidth - Maximum line width for paragraphs
 */
function convertNode(node: RSTNode, wrapWidth: number): string {
  switch (node.type) {
    case "heading":
      return convertHeading(node);
    case "paragraph":
      return convertParagraph(node, wrapWidth);
    case "unorderedList":
      return convertUnorderedList(node, wrapWidth);
    case "orderedList":
      return convertOrderedList(node, wrapWidth);
    case "listItem":
      return convertListItem(node);
    case "codeBlock":
      return convertCodeBlock(node);
    case "image":
      return convertImage(node);
    case "admonition":
      return convertAdmonition(node, wrapWidth);
    case "directive":
      return convertDirective(node, wrapWidth);
    default:
      console.warn(`Unknown node type: ${node.type}`);
      const content = node.content || "";
      return wrapWidth > 0 ? wrap(content, { width: wrapWidth }) : content;
  }
}

/**
 * Converts a heading node to MDX heading format (e.g., ## Heading)
 * @param node - Heading node
 */
function convertHeading(node: RSTNode): string {
  const level = Number.parseInt(node.options?.level || "2", 10);
  const hashes = "#".repeat(level);
  return `${hashes} ${node.content}`;
}

/**
 * Converts a paragraph node, applying line wrapping
 * @param node - Paragraph node
 * @param wrapWidth - Maximum line width
 */
function convertParagraph(node: RSTNode, wrapWidth: number): string {
  const content = node.content || "";
  return wrapWidth > 0 ? wrap(content, { width: wrapWidth, indent: "" }) : content;
}

/**
 * Converts an unordered list node to MDX format
 * @param node - Unordered list node
 * @param wrapWidth - Maximum line width for list item content
 */
function convertUnorderedList(node: RSTNode, wrapWidth: number): string {
  if (!node.children) return "";
  return node.children.map((item) => `- ${convertNode(item, wrapWidth)}`).join("\n");
}

/**
 * Converts an ordered list node to MDX format
 * @param node - Ordered list node
 * @param wrapWidth - Maximum line width for list item content
 */
function convertOrderedList(node: RSTNode, wrapWidth: number): string {
  if (!node.children) return "";
  return node.children
    .map((item, index) => `${index + 1}. ${convertNode(item, wrapWidth)}`)
    .join("\n");
}

/**
 * Converts a list item node (primarily its content)
 * @param node - List item node
 */
function convertListItem(node: RSTNode): string {
  return node.content || "";
}

/**
 * Converts a code block node to MDX fenced code block format
 * @param node - Code block node
 */
function convertCodeBlock(node: RSTNode): string {
  const language = node.options?.language || "";
  return "```" + language + "\n" + (node.content || "") + "\n```";
}

/**
 * Converts an image node to MDX image format
 * @param node - Image node
 */
function convertImage(node: RSTNode): string {
  const src = node.content || "";
  let alt = node.options?.alt || "";

  if (!alt) {
    const filename = src.split("/").pop() || "";
    alt = filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    alt = alt.charAt(0).toUpperCase() + alt.slice(1);
  }

  return `![${alt}](${src})`;
}

/**
 * Converts an admonition node (note, warning, etc.) to the requested ::: format
 * @param node - Admonition node
 * @param wrapWidth - Maximum line width for the content
 */
function convertAdmonition(node: RSTNode, wrapWidth: number): string {
  const rawKind = node.options?.kind || "note";
  const validKinds = ["note", "warning", "danger", "tip"];
  const kind = validKinds.includes(rawKind) ? rawKind : "note";

  const content = node.content || "";
  const wrappedContent = wrapWidth > 0 ? wrap(content, { width: wrapWidth, indent: "" }) : content;

  return `:::${kind}\n\n${wrappedContent}\n\n:::`;
}

function convertDirective(node: RSTNode, wrapWidth: number): string {
  const name = node.options?.name || "";
  const argument = node.options?.argument || "";
  const content = node.content || "";
  const wrappedContent = wrapWidth > 0 ? wrap(content, { width: wrapWidth, indent: "" }) : content;

  // Handle special directives
  switch (name) {
    case "include":
      return `{/* Include: ${argument} */}`;
    case "toctree":
      return `{/* Table of Contents */}`;
    default:
      return `{/*
Directive: ${name}
Argument: ${argument}
Content:
${wrappedContent}
*/}`;
  }
}

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
