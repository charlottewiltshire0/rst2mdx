import type { RSTNode } from "./parser";

/**
 * Convert the parsed RST nodes to MDX format
 */
export function convertToMDX(nodes: RSTNode[]): string {
  let mdx = "";
  let firstHeadingProcessed = false;

  for (const node of nodes) {
    // Special handling for the first heading - convert to frontmatter
    if (node.type === "heading" && !firstHeadingProcessed) {
      mdx += `---\ntitle: ${node.content}\n---\n\n`;
      firstHeadingProcessed = true;
    } else {
      mdx += convertNode(node) + "\n\n";
    }
  }

  return mdx.trim();
}

function convertNode(node: RSTNode): string {
  switch (node.type) {
    case "heading":
      return convertHeading(node);
    case "paragraph":
      return convertParagraph(node);
    case "unorderedList":
      return convertUnorderedList(node);
    case "orderedList":
      return convertOrderedList(node);
    case "listItem":
      return convertListItem(node);
    case "codeBlock":
      return convertCodeBlock(node);
    case "image":
      return convertImage(node);
    case "admonition":
      return convertAdmonition(node);
    case "directive":
      return convertDirective(node);
    default:
      console.warn(`Unknown node type: ${node.type}`);
      return node.content || "";
  }
}

function convertHeading(node: RSTNode): string {
  const level = Number.parseInt(node.options?.level || "2", 10);
  const hashes = "#".repeat(level);
  return `${hashes} ${node.content}`;
}

function convertParagraph(node: RSTNode): string {
  return node.content || "";
}

function convertUnorderedList(node: RSTNode): string {
  if (!node.children) return "";

  return node.children.map((item) => `- ${convertNode(item)}`).join("\n");
}

function convertOrderedList(node: RSTNode): string {
  if (!node.children) return "";

  return node.children.map((item, index) => `${index + 1}. ${convertNode(item)}`).join("\n");
}

function convertListItem(node: RSTNode): string {
  return node.content || "";
}

function convertCodeBlock(node: RSTNode): string {
  const language = node.options?.language || "";
  return "```" + language + "\n" + (node.content || "") + "\n```";
}

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

function convertAdmonition(node: RSTNode): string {
  const kind = node.options?.kind || "note";
  const title = capitalizeFirstLetter(kind);

  // For MDX, we can use a custom component
  return `<Admonition type="${kind}" title="${title}">

${node.content}

</Admonition>`;
}

function convertDirective(node: RSTNode): string {
  const name = node.options?.name || "";
  const argument = node.options?.argument || "";

  // Handle special directives
  switch (name) {
    case "include":
      return `{/* Include: ${argument} */}`;
    case "toctree":
      return `{/* Table of Contents */}`;
    default:
      // For unknown directives, add a comment
      return `{/* 
Directive: ${name}
Argument: ${argument}
Content:
${node.content}
*/}`;
  }
}

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
