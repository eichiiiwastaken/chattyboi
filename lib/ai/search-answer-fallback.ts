import type { InferUIMessageChunk } from "ai";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

// Search results are usually short. This keeps a provider that ignores its token
// limit from flooding the browser with an unrenderable response.
export const MAX_SEARCH_ANSWER_CHARACTERS = 16_000;
export const MAX_SEARCH_ANSWER_TOKENS = 4096;

function searchResultCount(output: unknown) {
  if (
    output &&
    typeof output === "object" &&
    "results" in output &&
    Array.isArray(output.results)
  ) {
    return output.results.length;
  }

  return 0;
}

export function withSearchAnswerFallback(
  stream: ReadableStream<InferUIMessageChunk<ChatMessage>>,
  context: { chatId: string; modelId: string }
) {
  let sawSearchOutput = false;
  let sawTextAfterSearch = false;
  let searchAnswerLength = 0;
  let answerWasTruncated = false;

  return stream.pipeThrough(
    new TransformStream<InferUIMessageChunk<ChatMessage>>({
      transform(chunk, controller) {
        if (
          chunk.type === "tool-output-available" &&
          searchResultCount(chunk.output) > 0
        ) {
          sawSearchOutput = true;
        }

        if (sawSearchOutput && chunk.type === "text-delta") {
          const remaining = MAX_SEARCH_ANSWER_CHARACTERS - searchAnswerLength;
          const delta = chunk.delta.slice(0, Math.max(remaining, 0));

          if (delta.trim().length > 0) {
            sawTextAfterSearch = true;
          }

          searchAnswerLength += delta.length;
          answerWasTruncated ||= delta.length < chunk.delta.length;

          if (delta.length > 0) {
            controller.enqueue({ ...chunk, delta });
          }
          return;
        }

        if (chunk.type === "finish" && sawSearchOutput) {
          if (!sawTextAfterSearch) {
            console.error("Search turn finished without answer text", context);
            enqueueNotice(
              controller,
              "I found search results, but the model finished without producing a visible answer. Please retry the message; the search results above did come back successfully."
            );
          } else if (answerWasTruncated || chunk.finishReason === "length") {
            console.warn("Search answer was truncated", {
              ...context,
              finishReason: chunk.finishReason,
              visibleCharacterCount: searchAnswerLength,
            });
            enqueueNotice(
              controller,
              "_This response reached its length limit and may be incomplete. Please ask a narrower follow-up or retry the question._"
            );
          }
        }

        controller.enqueue(chunk);
      },
    })
  );
}

function enqueueNotice(
  controller: TransformStreamDefaultController<
    InferUIMessageChunk<ChatMessage>
  >,
  text: string
) {
  const id = generateUUID();
  controller.enqueue({ type: "text-start", id });
  controller.enqueue({ type: "text-delta", id, delta: text });
  controller.enqueue({ type: "text-end", id });
}
