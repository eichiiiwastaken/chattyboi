export function normalizeLatexDelimiters(markdown: string) {
  const blocks: string[] = [];
  let current = "";
  let inCodeBlock = false;
  let codeFence = "";
  const lines = markdown.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWithBreak = line + (i < lines.length - 1 ? "\n" : "");

    if (!inCodeBlock && /^```/.test(line)) {
      blocks.push(normalizeLatexInText(current));
      current = lineWithBreak;
      inCodeBlock = true;
      codeFence = line.match(/^`+/)?.[0] ?? "```";
      continue;
    }

    if (inCodeBlock) {
      current += lineWithBreak;

      if (line.startsWith(codeFence)) {
        blocks.push(current);
        current = "";
        inCodeBlock = false;
      }
      continue;
    }

    current += lineWithBreak;
  }

  if (current) {
    blocks.push(inCodeBlock ? current : normalizeLatexInText(current));
  }

  return blocks.join("");
}

function normalizeLatexInText(text: string) {
  return text
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (match, math: string) => {
      const content = math.trim();
      return content ? `$$\n${content}\n$$` : match;
    })
    .replace(/\\\((.*?)\\\)/g, (match, math: string) => {
      const content = math.trim();
      return content ? `$${content}$` : match;
    });
}
