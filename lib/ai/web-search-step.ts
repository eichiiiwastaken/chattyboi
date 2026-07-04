type WebSearchStepSettings =
  | {
      activeTools: ["webSearch"];
      toolChoice: "auto";
    }
  | {
      activeTools: ["webSearch"];
      system: string;
      toolChoice: "none";
    };

export function getWebSearchStepSettings({
  baseSystemPrompt,
  stepNumber,
}: {
  baseSystemPrompt: string;
  stepNumber: number;
}): WebSearchStepSettings {
  if (stepNumber === 0) {
    return {
      activeTools: ["webSearch"],
      toolChoice: "auto",
    };
  }

  return {
    activeTools: ["webSearch"],
    system: `${baseSystemPrompt}\n\nYou have already received the webSearch result for this turn. Do not call tools again. Answer the user's latest request now using the returned search results, and cite the source title and URL for current or external claims. If the results are insufficient, say what the results showed and what remains uncertain.`,
    toolChoice: "none",
  };
}
