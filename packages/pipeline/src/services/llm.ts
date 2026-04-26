import OpenAI from 'openai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export interface ScriptResult {
  script: string;
  model: string;
  thinkingModel: string | null;
  provider: string;
}

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const DEFAULT_PROMPT_PATH = join(REPO_ROOT, 'prompts', 'script-system-prompt.txt');

function resolvePromptPath(): string {
  const envPath = process.env.SCRIPT_PROMPT_PATH;
  if (!envPath) return DEFAULT_PROMPT_PATH;
  return isAbsolute(envPath) ? envPath : resolve(PACKAGE_ROOT, envPath);
}

let cachedSystemPrompt: string | null = null;
function getSystemPrompt(): string {
  if (cachedSystemPrompt !== null) return cachedSystemPrompt;
  const promptPath = resolvePromptPath();
  try {
    cachedSystemPrompt = readFileSync(promptPath, 'utf8');
    return cachedSystemPrompt;
  } catch (err) {
    throw new Error(
      `Prompt file not found at ${promptPath}. Set SCRIPT_PROMPT_PATH or place the file at <repo-root>/prompts/script-system-prompt.txt. Original error: ${(err as Error).message}`
    );
  }
}

function buildUserMessage(title: string, text: string): string {
  return `標題：${title}\n\n內容：\n${text}`;
}

export async function generateScriptWithLLM(title: string, text: string): Promise<ScriptResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const model = process.env.LLM_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
  const thinkingModel = process.env.LLM_THINKING_MODEL || null;

  const openai = new OpenAI({
    apiKey,
    baseURL,
  });

  const system = getSystemPrompt();
  const user = buildUserMessage(title, text);

  interface OpenRouterExtraBody {
    thinking?: {
      type: 'optimized';
      model: string;
    };
  }

  const extraBody: OpenRouterExtraBody = {};
  if (thinkingModel) {
    extraBody.thinking = {
      type: 'optimized',
      model: thinkingModel,
    };
  }

  const params: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
    };
    if (Object.keys(extraBody).length > 0) {
      params.extra_body = extraBody;
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completion = await openai.chat.completions.create(params as any) as any;

  const script = completion.choices[0]?.message?.content || '';
  const provider = completion.provider || 'unknown';
  const actualModel = completion.model || model;

  return { script, model: actualModel, thinkingModel, provider };
}