import type { RuntimeHookEvent, RuntimeTaskHookActivity } from "../core/api-contract";

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function readStringField(record: Record<string, unknown>, key: string): string | null {
	const value = record[key];
	if (typeof value !== "string") {
		return null;
	}
	const normalized = normalizeWhitespace(value);
	return normalized.length > 0 ? normalized : null;
}

function readFinalMessageFromMetadata(metadata: Partial<RuntimeTaskHookActivity>): string | null {
	const finalMessage = metadata.finalMessage;
	if (typeof finalMessage !== "string") {
		return null;
	}
	const normalized = normalizeWhitespace(finalMessage);
	return normalized.length > 0 ? normalized : null;
}

function readFinalMessageFromPayload(payload: Record<string, unknown> | null): string | null {
	if (!payload) {
		return null;
	}
	const direct =
		readStringField(payload, "last_assistant_message") ??
		readStringField(payload, "lastAssistantMessage") ??
		readStringField(payload, "last-assistant-message");
	if (direct) {
		return direct;
	}

	const messageRecord = asRecord(payload.message);
	if (!messageRecord || readStringField(messageRecord, "role") !== "assistant") {
		return null;
	}
	const content = messageRecord.content;
	if (typeof content === "string") {
		const normalized = normalizeWhitespace(content);
		return normalized.length > 0 ? normalized : null;
	}
	if (!Array.isArray(content)) {
		return null;
	}

	const textParts: string[] = [];
	for (const item of content) {
		const block = asRecord(item);
		if (!block || readStringField(block, "type") !== "text") {
			continue;
		}
		const text = readStringField(block, "text");
		if (text) {
			textParts.push(text);
		}
	}
	if (textParts.length === 0) {
		return null;
	}
	return normalizeWhitespace(textParts.join("\n"));
}

export async function enrichPiReviewMetadata<
	T extends {
		event: RuntimeHookEvent;
		metadata?: Partial<RuntimeTaskHookActivity>;
		payload?: Record<string, unknown> | null;
	},
>(args: T): Promise<T> {
	if (args.event !== "to_review") {
		return args;
	}
	const metadata = args.metadata ?? {};
	if (metadata.source?.toLowerCase() !== "pi") {
		return args;
	}

	const finalMessage = readFinalMessageFromMetadata(metadata) ?? readFinalMessageFromPayload(args.payload ?? null);
	if (!finalMessage) {
		return args;
	}

	return {
		...args,
		metadata: {
			...metadata,
			finalMessage,
			activityText: metadata.activityText ?? `Final: ${finalMessage}`,
		},
	};
}
