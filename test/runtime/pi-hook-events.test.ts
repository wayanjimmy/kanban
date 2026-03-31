import { describe, expect, it } from "vitest";
import { enrichPiReviewMetadata } from "../../src/commands/pi-hook-events";
import type { RuntimeTaskHookActivity } from "../../src/core/api-contract";

describe("enrichPiReviewMetadata", () => {
	it("keeps non-pi sources unchanged", async () => {
		const input = {
			event: "to_review" as const,
			metadata: {
				source: "claude",
			},
			payload: {
				last_assistant_message: "Done",
			},
		};
		const result = await enrichPiReviewMetadata(input);
		expect(result).toEqual(input);
	});

	it("uses payload final message for pi review metadata", async () => {
		const result = await enrichPiReviewMetadata({
			event: "to_review",
			metadata: {
				source: "pi",
			} satisfies Partial<RuntimeTaskHookActivity>,
			payload: {
				last_assistant_message: "Implemented all requested changes",
			},
		});
		const metadata = result.metadata as Partial<RuntimeTaskHookActivity> | undefined;
		expect(metadata?.finalMessage).toBe("Implemented all requested changes");
		expect(metadata?.activityText).toBe("Final: Implemented all requested changes");
	});

	it("keeps existing activity text while enriching final message", async () => {
		const result = await enrichPiReviewMetadata({
			event: "to_review",
			metadata: {
				source: "pi",
				activityText: "Waiting for review",
			} satisfies Partial<RuntimeTaskHookActivity>,
			payload: {
				last_assistant_message: "Added tests",
			},
		});
		const metadata = result.metadata as Partial<RuntimeTaskHookActivity> | undefined;
		expect(metadata?.finalMessage).toBe("Added tests");
		expect(metadata?.activityText).toBe("Waiting for review");
	});
});
