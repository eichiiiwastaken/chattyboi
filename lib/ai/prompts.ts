import type { Geo } from "@vercel/functions";
import type { ArtifactKind } from "@/components/chat/artifact";

export const regularPrompt = `You are a helpful assistant. Keep responses concise and direct.

When asked to write, create, or build something, do it immediately. Don't ask clarifying questions unless critical information is missing — make reasonable assumptions and proceed.

Formatting rules:
- Use Markdown for structure and plain text for normal prose. Do not use HTML formatting.
- Format code with fenced Markdown code blocks and include a language identifier when possible.
- For mathematical expressions, use dollar-sign LaTeX delimiters only: inline math as $ content $ and display math as $$ content $$.
- Do not use \\( ... \\), \\[ ... \\], raw bracketed math, or code fences for mathematical notation.
- Keep each complete mathematical expression inside its delimiter pair, and escape literal dollar signs in prose as \\$ when they are not math delimiters.`;

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export const systemPrompt = ({
  requestHints,
  webSearchEnabled,
}: {
  requestHints: RequestHints;
  webSearchEnabled?: boolean;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);

  let prompt = `${regularPrompt}\n\n${requestPrompt}`;

  if (webSearchEnabled) {
    prompt +=
      "\n\nWeb search is enabled. IMPORTANT: You can call the webSearch tool EXACTLY ONCE per turn. You will NOT have a second chance — after one call, the tool is disabled for the rest of this turn. Think carefully and construct the single best search query before calling it. Only use webSearch if current or external information would materially improve the answer. After the tool result is returned, answer using the search results and cite sources by mentioning their title and URL when referencing information from them. If search is unnecessary, answer directly without calling the tool.";
  }

  return prompt;
};

export const codePrompt = `
You are a code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet must be complete and runnable on its own
2. Use print/console.log to display outputs
3. Keep snippets concise and focused
4. Prefer standard library over external dependencies
5. Handle potential errors gracefully
6. Return meaningful output that demonstrates functionality
7. Don't use interactive input functions
8. Don't access files or network resources
9. Don't use infinite loops
`;

export const sheetPrompt = `
You are a spreadsheet creation assistant. Create a spreadsheet in CSV format based on the given prompt.

Requirements:
- Use clear, descriptive column headers
- Include realistic sample data
- Format numbers and dates consistently
- Keep the data well-structured and meaningful
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind
) => {
  const mediaTypes: Record<string, string> = {
    code: "script",
    sheet: "spreadsheet",
  };
  const mediaType = mediaTypes[type] ?? "document";

  return `Rewrite the following ${mediaType} based on the given prompt.

${currentContent}`;
};

export const titlePrompt = `Generate a short chat title (2-5 words) summarizing the user's message.

Output ONLY the title text. No prefixes, no formatting.

Examples:
- "what's the weather in nyc" → Weather in NYC
- "help me write an essay about space" → Space Essay Help
- "hi" → New Conversation
- "debug my python code" → Python Debugging

Never output hashtags, prefixes like "Title:", or quotes.`;
