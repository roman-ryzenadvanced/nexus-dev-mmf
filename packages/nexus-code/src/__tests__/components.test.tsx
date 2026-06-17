import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar } from '../components/StatusBar.js';
import { HelpOverlay } from '../components/HelpOverlay.js';
import { ChatView } from '../components/ChatView.js';
import type { AppConfig, ChatMessage } from '../types.js';

const CONFIG: AppConfig = {
  version: '1.1.5',
  activeProviderId: 'zai',
  activeModelId: 'glm-5.2',
  mode: 'balanced',
  useMMFE: true,
  providers: [
    { id: 'zai', kind: 'zai', name: 'Z.ai', mmfe: true, defaultModel: 'glm-5.2' },
    { id: 'openai', kind: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', mmfe: false, defaultModel: 'gpt-4o' },
  ],
  manualModels: [],
  mcpServers: [],
  ui: { theme: 'tech-dark', showRouting: true, showTokens: true, showTimestamps: false },
};

describe('<StatusBar />', () => {
  it('renders with default config', () => {
    const { lastFrame } = render(<StatusBar config={CONFIG} streaming={false} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('mmfe:on');
    expect(frame).toContain('mode:balanced');
    expect(frame).toContain('provider:zai');
    expect(frame).toContain('model:glm-5.2');
  });

  it('shows streaming indicator when streaming', () => {
    const { lastFrame } = render(<StatusBar config={CONFIG} streaming={true} />);
    expect(lastFrame()).toContain('streaming');
  });

  it('shows mmfe:off when useMMFE is false', () => {
    const cfg = { ...CONFIG, useMMFE: false };
    const { lastFrame } = render(<StatusBar config={cfg} streaming={false} />);
    expect(lastFrame()).toContain('mmfe:off');
  });

  it('shows quality score when lastMessage has one', () => {
    const msg: ChatMessage = {
      id: 'm1',
      role: 'assistant',
      content: 'test',
      model: 'glm-5.2',
      elapsedMs: 1234,
      qualityScore: 94,
      ts: Date.now(),
    };
    const { lastFrame } = render(<StatusBar config={CONFIG} streaming={false} lastMessage={msg} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Q:94');
    expect(frame).toContain('1234ms');
  });

  it('shows model used when lastMessage has model', () => {
    const msg: ChatMessage = {
      id: 'm1',
      role: 'assistant',
      content: 'test',
      model: 'glm-5.2, glm-4.7',
      elapsedMs: 500,
      ts: Date.now(),
    };
    const { lastFrame } = render(<StatusBar config={CONFIG} streaming={false} lastMessage={msg} />);
    expect(lastFrame()).toContain('via glm-5.2, glm-4.7');
  });

  it('shows token counts when lastMessage has them', () => {
    const msg: ChatMessage = {
      id: 'm1',
      role: 'assistant',
      content: 'test',
      elapsedMs: 100,
      tokens: { input: 42, output: 17 },
      ts: Date.now(),
    };
    const { lastFrame } = render(<StatusBar config={CONFIG} streaming={false} lastMessage={msg} />);
    expect(lastFrame()).toContain('42');
    expect(lastFrame()).toContain('17');
  });
});

describe('<HelpOverlay />', () => {
  it('renders all command names', () => {
    const { lastFrame } = render(<HelpOverlay />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('help');
    expect(frame).toContain('mode');
    expect(frame).toContain('provider');
    expect(frame).toContain('exit');
  });

  it('renders with a border', () => {
    const { lastFrame } = render(<HelpOverlay />);
    const frame = lastFrame() ?? '';
    // Ink border characters — at least one corner should be present
    expect(frame).toMatch(/[╭┌]/);
  });
});

describe('<ChatView />', () => {
  it('renders empty state when no messages', () => {
    const { lastFrame } = render(
      <ChatView messages={[]} streaming={false} streamBuffer="" showRouting={true} showTokens={true} />
    );
    // Empty ChatView should render without crashing
    expect(lastFrame()).toBeDefined();
  });

  it('renders user message', () => {
    const msg: ChatMessage = {
      id: 'u1',
      role: 'user',
      content: 'Hello, world!',
      ts: Date.now(),
    };
    const { lastFrame } = render(
      <ChatView messages={[msg]} streaming={false} streamBuffer="" showRouting={true} showTokens={true} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('user');
    expect(frame).toContain('Hello, world!');
  });

  it('renders assistant message with model + latency', () => {
    const msg: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      content: 'Hi there',
      model: 'glm-5.2',
      elapsedMs: 432,
      ts: Date.now(),
    };
    const { lastFrame } = render(
      <ChatView messages={[msg]} streaming={false} streamBuffer="" showRouting={true} showTokens={true} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('assistant');
    expect(frame).toContain('glm-5.2');
    expect(frame).toContain('432');
  });

  it('renders streaming buffer when streaming', () => {
    const { lastFrame } = render(
      <ChatView messages={[]} streaming={true} streamBuffer="partial response..." showRouting={true} showTokens={true} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('partial response');
    // ChatView renders "(streaming…)" with parens + ellipsis
    expect(frame).toMatch(/streaming/i);
  });

  it('renders tool message', () => {
    const msg: ChatMessage = {
      id: 't1',
      role: 'tool',
      content: '{"result":"ok"}',
      ts: Date.now(),
    };
    const { lastFrame } = render(
      <ChatView messages={[msg]} streaming={false} streamBuffer="" showRouting={true} showTokens={true} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('tool');
  });

  it('renders routing decisions when present', () => {
    const msg: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      content: 'response',
      model: 'glm-5.2',
      routing: [
        {
          subTaskId: 'st1',
          subtaskLabel: 'API contracts',
          selectedModel: 'glm-4.7',
          confidence: 0.88,
          reason: 'creative code synthesis',
          alternativeModels: ['glm-5.1'],
        },
      ],
      qualityScore: 92,
      ts: Date.now(),
    };
    const { lastFrame } = render(
      <ChatView messages={[msg]} streaming={false} streamBuffer="" showRouting={true} showTokens={true} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('API contracts');
    expect(frame).toContain('glm-4.7');
    expect(frame).toContain('88');
    expect(frame).toContain('quality');
  });

  it('hides routing when showRouting=false', () => {
    const msg: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      content: 'response',
      model: 'glm-5.2',
      routing: [
        {
          subTaskId: 'st1',
          subtaskLabel: 'subtask',
          selectedModel: 'glm-4.7',
          confidence: 0.5,
          reason: 'x',
          alternativeModels: [],
        },
      ],
      ts: Date.now(),
    };
    const { lastFrame } = render(
      <ChatView messages={[msg]} streaming={false} streamBuffer="" showRouting={false} showTokens={true} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).not.toContain('subtask');
  });

  it('renders multiple messages in order', () => {
    const msgs: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'first', ts: 1 },
      { id: 'a1', role: 'assistant', content: 'reply1', model: 'glm-5.2', ts: 2 },
      { id: 'u2', role: 'user', content: 'second', ts: 3 },
    ];
    const { lastFrame } = render(
      <ChatView messages={msgs} streaming={false} streamBuffer="" showRouting={true} showTokens={true} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('first');
    expect(frame).toContain('reply1');
    expect(frame).toContain('second');
    // Verify order: first should appear before reply1, reply1 before second
    expect(frame.indexOf('first')).toBeLessThan(frame.indexOf('reply1'));
    expect(frame.indexOf('reply1')).toBeLessThan(frame.indexOf('second'));
  });
});
