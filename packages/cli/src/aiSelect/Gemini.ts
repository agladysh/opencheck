import {
  ApiError,
  FunctionCallingConfigMode,
  type FunctionDeclaration,
  type GenerateContentParameters,
  type GenerateContentResponse,
  GoogleGenAI,
} from '@google/genai';
import { ArkErrors } from 'arktype';
import { setTimeout } from 'node:timers/promises';
import type { AISelectOptions, AISelectOptionType, AISelectRequest } from 'packages/lib/src/types/OpenCheck/Runtime.ts';
import type { OneOf } from '@opencheck/lib/types/OneOf.js';
import { type Brand, make } from 'ts-brand';

interface AIRequestFunctions {
  functionDeclarations: FunctionDeclaration[];
  allowedFunctionNames: string[];
  optionIndexes: Record<string, number>;
}

function buildFunctionDeclarations<T extends AISelectOptions>(options: T): AIRequestFunctions {
  const result: AIRequestFunctions = {
    functionDeclarations: [],
    allowedFunctionNames: [],
    optionIndexes: {},
  };

  for (let i = 0; i < options.length; ++i) {
    const name = `reply-${i + 1}`;
    result.functionDeclarations.push({
      name,
      parametersJsonSchema: options[i].jsonSchema,
    });
    result.allowedFunctionNames.push(name);
    result.optionIndexes[name] = i;
  }

  return result;
}

function buildAIRequest<T extends AISelectOptions>(
  input: AISelectRequest<T>
): {
  request: GenerateContentParameters;
  optionIndexes: AIRequestFunctions['optionIndexes'];
} {
  const { functionDeclarations, allowedFunctionNames, optionIndexes } = buildFunctionDeclarations(input.options);
  const user = `User message:
<user>
${input.user}
</user>
Answer by using a function call. Strictly follow the schema:
<schema>
${JSON.stringify(functionDeclarations, null, 2)}
</schema>
Gotcha: Make sure to generate any constant fields in the schema verbatim.
`;
  const request = {
    model: 'gemini-flash-latest',
    contents: [
      {
        parts: [{ text: user }],
        role: 'user',
      },
    ],
    config: {
      systemInstruction: input.system,
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY, // Force a function call.
          allowedFunctionNames,
        },
      },
      tools: [{ functionDeclarations }],
      temperature: 0,
    },
  };
  return { request, optionIndexes };
}

interface RetryOptions {
  maxRetries: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 5,
};

async function generateContent(
  ai: GoogleGenAI,
  request: GenerateContentParameters,
  options: Partial<RetryOptions> = {}
): Promise<GenerateContentResponse> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  if (opts.maxRetries <= 0) {
    throw new Error('generateContent: no retries left');
  }

  try {
    return await ai.models.generateContent(request);
  } catch (e: unknown) {
    console.error('generateContent', String(e));
    console.log(JSON.stringify(e));
    if (!(e instanceof ApiError)) {
      throw e;
    }
    if (e.status === 503) {
      // TODO: Handle 429 etc
      const delay = 10 * 1000;
      console.log(`generateContent: got 503, retrying in ${delay / 1000}s`);
      await setTimeout(delay); // TODO: Exponential backoff
      return generateContent(ai, request, { ...opts, maxRetries: opts.maxRetries - 1 });
    }
    throw e;
  }
}

type GeminiErrorMessage = Brand<string, 'OpenSpec.Gemini.ErrorMessage'>;
const GeminiErrorMessage = make<GeminiErrorMessage>();

interface FunctionCallSuccess<T extends AISelectOptions> {
  status: 'success';
  value: AISelectOptionType<OneOf<T>>;
}
const FunctionCallSuccess = <T extends AISelectOptions>(
  value: AISelectOptionType<OneOf<T>>
): FunctionCallSuccess<T> => ({ status: 'success', value });

interface FunctionCallError {
  status: 'error';
  value: string;
}
const FunctionCallError = (value: string): FunctionCallError => ({ status: 'error', value });

type FunctionCallResult<T extends AISelectOptions> = FunctionCallSuccess<T> | FunctionCallError;

function validateFunctionCall<T extends AISelectOptions>(
  options: T,
  optionIndexes: AIRequestFunctions['optionIndexes'],
  response: GenerateContentResponse
): FunctionCallResult<T> {
  if (!response.functionCalls) {
    return FunctionCallError(
      'No function calls found in the response. You must respond with a single function call as instructed. Try again.'
    );
  }

  if (response.functionCalls.length !== 1) {
    return FunctionCallError(
      `${response.functionCalls.length} function calls found in the response. You must respond with a SINGLE function call as instructed. Try again.`
    );
  }

  const { name, args } = response.functionCalls[0];
  const index: number | undefined = name ? optionIndexes[name] : undefined;
  if (index === undefined) {
    return FunctionCallError(
      `Unknown function name "${name}" called. Known are: "${Object.values(optionIndexes).join(
        '", "'
      )}". You must respond with a single known function call as instructed. Try again.`
    );
  }

  const result = options[index].validate(args);
  if (result instanceof ArkErrors) {
    return FunctionCallError(`Invalid function "${name}" call arguments:
<error>
${result.summary}
</error>

Schema for function "${name}":
<schema>
${JSON.stringify(options[index].jsonSchema, null, 2)}
</schema>

Correct the function call arguments to strictly adhere to the schema.

Respond by retrying the corrected function call.
`);
  }

  return FunctionCallSuccess<T>(result as AISelectOptionType<OneOf<T>>);
}

export async function aiSelectGemini<T extends AISelectOptions>(
  input: AISelectRequest<T>
): Promise<AISelectOptionType<OneOf<T>>> {
  const { request, optionIndexes } = buildAIRequest(input);

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is unset');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  let triesLeft = 2;
  while (triesLeft-- > 0) {
    const response = await generateContent(ai, request);
    const result = validateFunctionCall(input.options, optionIndexes, response);
    if (result.status === 'success') {
      return result.value;
    }

    console.warn('LLM returned malformed response:', response.functionCalls, result.value);

    if (!Array.isArray(request.contents)) {
      throw new Error('unreachable'); // Guard to make TS happy
    }

    request.contents.push(
      {
        parts: (response.functionCalls ?? []).map((functionCall) => ({ functionCall })),
        role: 'model',
      },
      {
        parts: [{ text: result.value }],
        role: 'user',
      }
    );
  }

  throw new Error('Given up on trying to get a well-formed response from LLM');
}
