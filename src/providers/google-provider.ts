/**
 * Nexus-Dev MMFE — Google Provider Adapter
 *
 * Wraps the Google AI API (Gemini) as an LLMProvider, supporting
 * Gemini 2.5 Pro, Gemini 2.5 Flash, and other Gemini models.
 *
 * Requires the GOOGLE_API_KEY or GEMINI_API_KEY environment variable,
 * or apiKey in config.
 *
 * @version 4.0.0
 */

import {
  LLMProvider,
  ProviderId,
  ProviderConfig,
  ProviderMessage,
  ProviderCompletionOptions,
  ProviderCompletionResult,
} from './types.js';

export class GoogleProvider implements LLMProvider {
  readonly providerId: ProviderId = 'google';
  readonly name = 'Google AI (Gemini)';
  readonly supportedModels: string[] = [
    'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];

  // Friendly aliases
  private static readonly MODEL_ALIASES: Record<string, string> = {
    'gemini-2.5-pro': 'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-flash': 'gemini-2.5-flash-preview-05-20',
    'gemini-2-flash': 'gemini-2.0-flash',
    'gemini-2-flash-lite': 'gemini-2.0-flash-lite',
  };

  private apiKey: string = '';
  private baseURL: string = 'https://generativelanguage.googleapis.com/v1beta';
  private _isReady = false;

  get isReady(): boolean {
    return this._isReady;
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.apiKey = config.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? '';
    this.baseURL = config.baseURL ?? process.env.GOOGLE_AI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta';

    if (!this.apiKey) {
      throw new Error('Google provider requires GOOGLE_API_KEY, GEMINI_API_KEY, or apiKey in config');
    }

    this._isReady = true;
  }

  /**
   * Resolve model aliases to full model IDs.
   */
  private resolveModel(modelId: string): string {
    return GoogleProvider.MODEL_ALIASES[modelId] ?? modelId;
  }

  async complete(
    model: string,
    messages: ProviderMessage[],
    options?: ProviderCompletionOptions
  ): Promise<ProviderCompletionResult> {
    if (!this._isReady) {
      throw new Error('Google provider not initialized');
    }

    const resolvedModel = this.resolveModel(model);

    // Convert to Gemini's content format
    const contents: any[] = [];
    let systemInstruction: string | undefined;

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = systemInstruction
          ? `${systemInstruction}\n\n${msg.content}`
          : msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const body: any = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.4,
        maxOutputTokens: options?.maxTokens ?? 8192,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (options?.topP !== undefined) {
      body.generationConfig.topP = options.topP;
    }

    if (options?.stopSequences) {
      body.generationConfig.stopSequences = options.stopSequences;
    }

    // Enable thinking for Gemini 2.5 models
    if (options?.enableThinking && resolvedModel.includes('2.5')) {
      body.generationConfig.thinkingConfig = {
        thinkingBudget: 10000,
      };
    }

    // Merge provider-specific options
    if (options?.providerOptions) {
      Object.assign(body, options.providerOptions);
    }

    const url = `${this.baseURL}/models/${resolvedModel}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google AI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as any;

    // Extract text from Gemini's candidates format
    let content = '';
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.text) {
          content += part.text;
        }
      }
    }

    return {
      content,
      model: data.modelVersion ?? resolvedModel,
      provider: 'google',
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata.totalTokenCount ?? 0,
      } : undefined,
      thinkingUsed: options?.enableThinking && resolvedModel.includes('2.5'),
      metadata: {
        finishReason: data.candidates?.[0]?.finishReason,
        safetyRatings: data.candidates?.[0]?.safetyRatings,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseURL}/models?key=${this.apiKey}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  listModels(): string[] {
    return [...this.supportedModels, ...Object.keys(GoogleProvider.MODEL_ALIASES)];
  }

  supportsModel(modelId: string): boolean {
    return this.supportedModels.includes(modelId) ||
           modelId in GoogleProvider.MODEL_ALIASES;
  }

  async shutdown(): Promise<void> {
    this._isReady = false;
  }
}
