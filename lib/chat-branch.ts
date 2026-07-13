import type { DBMessage } from "./db/schema";

export function copyMessagesForBranch({
  sourceMessages,
  sourceBranchMessageId,
  newChatId,
  generateId,
}: {
  sourceMessages: DBMessage[];
  sourceBranchMessageId: string;
  newChatId: string;
  generateId: () => string;
}) {
  const branchIndex = sourceMessages.findIndex(
    (currentMessage) => currentMessage.id === sourceBranchMessageId
  );
  const branchMessage = sourceMessages[branchIndex];

  if (branchIndex < 0 || branchMessage?.role !== "user") {
    throw new Error("Branch message not found");
  }

  let newBranchMessageId = "";
  const messages = sourceMessages
    .slice(0, branchIndex + 1)
    .map((currentMessage) => {
      const newMessageId = generateId();
      if (currentMessage.id === sourceBranchMessageId) {
        newBranchMessageId = newMessageId;
      }

      return {
        ...currentMessage,
        id: newMessageId,
        chatId: newChatId,
      };
    });

  return { messages, branchMessageId: newBranchMessageId };
}
