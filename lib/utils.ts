import type {
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { DBMessage, Document } from '@/lib/db/schema';
import {
  ChatbotError,
  type ErrorCode,
  getErrorMessageFromUnknown,
} from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes, MessageMetadata } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw await createErrorFromResponse(response);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const responseTimeoutController = new AbortController();
  let responseTimedOut = false;
  const responseTimeout = globalThis.setTimeout(() => {
    responseTimedOut = true;
    responseTimeoutController.abort();
  }, 60_000);

  try {
    const signal = init?.signal
      ? AbortSignal.any([init.signal, responseTimeoutController.signal])
      : responseTimeoutController.signal;
    const response = await fetch(input, { ...init, signal });
    globalThis.clearTimeout(responseTimeout);

    if (!response.ok) {
      throw await createErrorFromResponse(response);
    }

    return response;
  } catch (error: unknown) {
    globalThis.clearTimeout(responseTimeout);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatbotError('offline:chat');
    }

    if (responseTimedOut) {
      throw new ChatbotError(
        'offline:chat',
        'The server did not start the response within 60 seconds. Your message was kept; please retry.'
      );
    }

    throw error;
  }
}

async function createErrorFromResponse(response: Response) {
  let payload: unknown;

  try {
    payload = await response.clone().json();
  } catch {
    try {
      payload = await response.text();
    } catch {
      payload = undefined;
    }
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'code' in payload &&
    typeof payload.code === 'string' &&
    payload.code.includes(':')
  ) {
    const cause =
      'cause' in payload && payload.cause !== undefined
        ? String(payload.cause)
        : undefined;
    return new ChatbotError(payload.code as ErrorCode, cause);
  }

  const rawMessage =
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
      ? payload.message
      : payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          typeof payload.error === 'string'
        ? payload.error
        : typeof payload === 'string'
          ? payload
          : undefined;

  const { message } = getErrorMessageFromUnknown(
    rawMessage,
    response.statusText || 'Request failed.'
  );

  return new Error(message);
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function sanitizeText(text: string | null | undefined) {
  return (text ?? '')
    .replace(/<\|\s*DSML\s*\|\s*tool_calls\s*>[\s\S]*?<\/\|\s*DSML\s*\|\s*tool_calls\s*>/g, '')
    .replace(/<\/?\|\s*DSML\s*\|\s*[^>]*>/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace('</think>', '')
    .replace('<think>', '')
    .replace('<has_function_call>', '');
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
      ...(typeof message.metadata === 'object' && message.metadata !== null
        ? (message.metadata as object)
        : {}),
    } as MessageMetadata,
  }));
}

export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return sanitizeText(
    message.parts
      .map((part) => {
        if (part.type === 'text') {
          return (part as { type: 'text'; text: string }).text;
        }

        const runtimePart: unknown = part;
        if (
          typeof runtimePart === 'object' &&
          runtimePart !== null &&
          'type' in runtimePart &&
          runtimePart.type === 'error' &&
          'errorText' in runtimePart &&
          typeof runtimePart.errorText === 'string'
        ) {
          return runtimePart.errorText;
        }

        return '';
      })
      .join(''),
  );
}
