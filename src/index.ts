#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { program } from "commander";
import { parseRST } from "./parser";
import { convertToMDX } from "./converter";
import { logger, startSpinner, stopSpinner, createNote } from "./logger";

program
  .name("rst-to-mdx")
  .description("Convert RST files to MDX format")
  .version("1.0.0")
  .argument("<input>", "Input RST file or directory")
  .option("-o, --output <output>", "Output directory for MDX files")
  .option("-r, --recursive", "Process directories recursively")
  .option("-v, --verbose", "Enable verbose output")
  .option(
    "-w, --width <number>",
    "Maximum line width before wrapping (default: 80)",
    (value) => parseInt(value, 10),
    80
  )
  .action(async (input, options) => {
    try {
      const isVerbose = !!options.verbose;
      const wrapWidth = options.width;

      const inputPath = path.resolve(process.cwd(), input);
      const outputPath = options.output
        ? path.resolve(process.cwd(), options.output)
        : path.dirname(inputPath);

      if (isVerbose) {
        logger.info(`Input path: ${inputPath}`);
        logger.info(`Output path: ${outputPath}`);
        logger.info(`Recursive mode: ${options.recursive ? "enabled" : "disabled"}`);
        logger.info(`Paragraph wrap width: ${wrapWidth > 0 ? wrapWidth : "disabled"}`);
      }

      const stats = await fs.stat(inputPath);

      if (stats.isFile()) {
        if (!inputPath.endsWith(".rst")) {
          logger.warn(`Warning: ${inputPath} is not an RST file. Skipping.`);
          return;
        }

        await convertFile(inputPath, outputPath, isVerbose, wrapWidth);
      } else if (stats.isDirectory()) {
        await processDirectory(inputPath, outputPath, !!options.recursive, isVerbose, wrapWidth);
      }

      logger.success("Conversion completed successfully!");
    } catch (error) {
      logger.error("Error during conversion:", error);
      process.exit(1);
    }
  });

async function convertFile(
  inputFile: string,
  outputDir: string,
  verbose: boolean,
  wrapWidth: number
): Promise<void> {
  const spinnerText = `Converting ${path.basename(inputFile)}`;
  const spinner = startSpinner(spinnerText);

  try {
    if (verbose) {
      logger.info(`Reading file: ${inputFile}`);
    }

    const rstContent = await fs.readFile(inputFile, "utf-8");

    if (verbose) {
      logger.info(`Parsing RST content (${rstContent.length} bytes)`);
    }

    const parsedContent = parseRST(rstContent);

    if (verbose) {
      logger.info(`Parsed ${parsedContent.length} nodes`);
      logger.info("Converting to MDX");
    }

    const mdxContent = convertToMDX(parsedContent, wrapWidth);
    const outputFile = path.join(outputDir, path.basename(inputFile).replace(/\.rst$/, ".mdx"));

    if (verbose) {
      logger.info(`Ensuring output directory exists: ${path.dirname(outputFile)}`);
    }

    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    if (verbose) {
      logger.info(`Writing MDX content to: ${outputFile}`);
    }

    await fs.writeFile(outputFile, mdxContent, "utf-8");

    stopSpinner(
      spinner,
      `Converted ${path.basename(inputFile)} → ${path.basename(outputFile)}`,
      true
    );

    if (verbose) {
      const note = createNote(`File details:
Input: ${inputFile} (${rstContent.length} bytes)
Output: ${outputFile} (${mdxContent.length} bytes)
Nodes: ${parsedContent.length}`);
      console.log(note);
    }
  } catch (error) {
    stopSpinner(spinner, `Failed to convert ${path.basename(inputFile)}`, false);
    throw error;
  }
}

async function processDirectory(
  inputDir: string,
  outputDir: string,
  recursive: boolean,
  verbose: boolean,
  wrapWidth: number
): Promise<void> {
  if (verbose) {
    logger.info(`Processing directory: ${inputDir}`);
    logger.info(`Output directory: ${outputDir}`);
    logger.info(`Recursive mode: ${recursive ? "enabled" : "disabled"}`);
  }

  const entries = await fs.readdir(inputDir, { withFileTypes: true });

  if (verbose) {
    logger.info(`Found ${entries.length} entries in directory`);
  }

  let fileCount = 0;
  let dirCount = 0;

  for (const entry of entries) {
    const inputPath = path.join(inputDir, entry.name);
    const relativePath = path.relative(inputDir, inputPath);
    const outputPath = path.join(outputDir, relativePath);

    if (entry.isFile() && entry.name.endsWith(".rst")) {
      fileCount++;
      await convertFile(inputPath, path.dirname(outputPath), verbose, wrapWidth);
    } else if (entry.isDirectory() && recursive) {
      dirCount++;
      await processDirectory(
        inputPath,
        path.join(outputDir, entry.name),
        recursive,
        verbose,
        wrapWidth
      );
    }
  }

  if (verbose) {
    logger.info(`Processed ${fileCount} files and ${dirCount} directories in ${inputDir}`);
  }
}

program.parse();
