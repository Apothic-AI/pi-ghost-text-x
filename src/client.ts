/**
 * Suggestion model client — prompt and completion options, plus response
 * classification.
 *
 * Only `import type` from pi packages, so `classifyResponse` is testable
 * with plain Node.
 *
 * @module
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";

export const GENERATION_TIMEOUT_MS = 8_000;
/**
 * Output cap per suggestion.
 *
 * 150 is enough for the one-line answer itself but not for a reasoning model,
 * which spends the entire budget thinking and returns an empty text channel.
 * Measured on nemotron-3-nano-30b-a3b: ~150-200 reasoning tokens before the
 * first character, so anything under ~512 yields `content: null` and no ghost.
 * Unused budget costs nothing, so the cap is set to leave room for both.
 */
export const MAX_TOKENS = 600;
export const TEMPERATURE = 0.3;

export const SYSTEM_PROMPT = `You complete prompts in an AI coding assistant's input box, like ghost-text autocomplete.

Given the recent conversation and the text the user has typed so far, predict the full prompt the user is most likely to submit.

Rules:
- Output ONLY the predicted prompt text. No quotes, no explanation, no markdown.
- If partial input is provided, your output MUST begin with that exact text, unchanged.
- Keep it short: one line, at most two sentences.
- Be specific to the conversation. Prefer concrete next steps (run the tests, commit, fix the file just discussed) over generic requests.
- If there is no confident prediction, output exactly: NONE`;

export type ResponseClass =
	| { ok: true; text: string }
	| { ok: false; reason: "error" | "no-content" | "no-text"; message?: string };

/**
 * Classify a completion response into usable suggestion text or a structured
 * failure reason. Extracts only visible text content.
 */
export function classifyResponse(response: AssistantMessage): ResponseClass {
	if (response.stopReason === "error") {
		return { ok: false, reason: "error", message: response.errorMessage ?? response.stopReason };
	}
	if (!response.content || response.content.length === 0) {
		return { ok: false, reason: "no-content" };
	}
	const text = response.content
		.filter((c) => c.type === "text")
		.map((c) => c.text ?? "")
		.join("");
	if (!text.trim()) {
		return { ok: false, reason: "no-text" };
	}
	return { ok: true, text };
}

/** System prompt for one suggestion, or for several delimited alternatives. */
export function systemPromptFor(candidates: number): string {
	if (candidates <= 1) return SYSTEM_PROMPT;
	return `${SYSTEM_PROMPT}

Additional instruction: provide ${candidates} clearly DIFFERENT alternatives. Output each alternative with no numbering or bullets, separated by a line containing only "---". Each alternative must independently satisfy all the rules above.`;
}
