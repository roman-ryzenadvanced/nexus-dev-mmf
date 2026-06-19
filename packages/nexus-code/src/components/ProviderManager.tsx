// ============================================================
// ProviderManager — interactive add / remove / edit overlay.
//
// A self-contained multi-step wizard that surfaces the same primitives
// the rest of nexus-code uses (OptionPicker for picks, a masked text
// field for secrets). It never writes API keys into config.json — keys
// are routed through the onPersistKeys callback so they land in the
// on-disk key store (~/.nexus/keys.json, mode 0600).
//
// Opened from:
//   /provider add      → fresh provider (5 steps)
//   /provider remove   → pick + confirm
//   /provider edit     → pick provider → pick field → enter new value
//   /provider picker   → "➕ Add / ✏️ Edit / 🗑 Remove" action rows
// ============================================================

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { OptionPicker, type PickerOption } from './OptionPicker.js';
import type { AppConfig, ProviderConfig, ProviderKind } from '../types.js';

export type ProviderManagerMode = 'add' | 'remove' | 'edit';

export interface KeyChange {
  /** providerId → key. For add/edit we set; for remove we clear. */
  set?: Record<string, string>;
  clear?: string[];
}

export interface ProviderManagerProps {
  mode: ProviderManagerMode;
  providers: ProviderConfig[];
  activeProviderId: string;
  onClose: () => void;
  /**
   * Commit the new providers array (already without apiKey fields), an
   * optional change to the active provider, and any key-store mutations.
   * The caller is responsible for saveConfig() + saveKey()/clearKey().
   */
  onPersist: (next: {
    providers: ProviderConfig[];
    activeProviderId?: string;
    keys: KeyChange;
  }) => void;
}

const KIND_OPTIONS: Array<{ id: ProviderKind; label: string; hint: string }> = [
  { id: 'openai', label: 'OpenAI-compatible', hint: 'Chat Completions — FreeModel, OpenRouter, Groq, Ollama, …' },
  { id: 'anthropic', label: 'Anthropic', hint: 'Messages API — Claude family' },
  { id: 'zai', label: 'Z.ai (MMFE native)', hint: 'GLM family; key from ~/.z-ai-config' },
];

// Editable fields offered for an existing provider. baseURL/key are omitted
// for zai (it resolves its own auth); name/defaultModel always apply.
type EditableField = 'name' | 'kind' | 'baseURL' | 'defaultModel' | 'apiKey';

function editableFields(p: ProviderConfig): EditableField[] {
  const base: EditableField[] = ['name', 'defaultModel'];
  if (p.kind === 'zai') return base;
  return ['name', 'kind', 'baseURL', 'defaultModel', 'apiKey'];
}

const FIELD_LABEL: Record<EditableField, string> = {
  name: 'Display name',
  kind: 'Protocol kind',
  baseURL: 'Base URL',
  defaultModel: 'Default model id',
  apiKey: 'API key (stored in keys.json, never config.json)',
};

// ----------------------------------------------------------------
// Validation helpers (pure, exported for unit tests)
// ----------------------------------------------------------------
export function validateProviderId(raw: string, existing: ProviderConfig[]): string | null {
  const id = raw.trim().toLowerCase();
  if (!id) return 'Provider id cannot be empty.';
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(id)) return 'Use lowercase letters, digits, - or _.';
  if (existing.some(p => p.id === id)) return `Provider "${id}" already exists.`;
  return null;
}

export function validateBaseURL(raw: string): string | null {
  const u = raw.trim();
  if (!u) return 'Base URL cannot be empty.';
  try {
    // eslint-disable-next-line no-new
    new URL(u);
    return null;
  } catch {
    return 'Enter a full URL, e.g. https://api.example.com/v1';
  }
}

export function ProviderManager(props: ProviderManagerProps) {
  const { mode, providers, activeProviderId, onClose, onPersist } = props;

  // ---- shared flow state ----
  const [step, setStep] = useState<string>('init');
  const [draft, setDraft] = useState<Partial<ProviderConfig>>({});
  const [selectedId, setSelectedId] = useState<string>('');
  const [field, setField] = useState<EditableField | ''>('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  void value;

  // ----------------------------------------------------------------
  // REMOVE flow
  // ----------------------------------------------------------------
  if (mode === 'remove') {
    const removeOptions: PickerOption[] = providers.map(p => ({
      id: p.id,
      label: p.id,
      detail: `${p.name}${p.id === activeProviderId ? ' (active)' : ''}`,
    }));

    const doRemove = (id: string) => {
      const remaining = providers.filter(p => p.id !== id);
      let nextActive = activeProviderId;
      if (activeProviderId === id) {
        nextActive = remaining[0]?.id || '';
      }
      onPersist({
        providers: remaining,
        activeProviderId: nextActive,
        keys: { clear: [id] },
      });
      onClose();
    };

    if (confirmRemove && selectedId) {
      return (
        <ConfirmRemove
          provider={providers.find(p => p.id === selectedId)!}
          activeProviderId={activeProviderId}
          onConfirm={() => doRemove(selectedId)}
          onCancel={() => {
            setConfirmRemove(false);
            setSelectedId('');
          }}
        />
      );
    }

    if (providers.length <= 1) {
      return (
        <Notice color="#EF4444" title="Cannot remove" onClose={onClose}>
          At least one provider must remain. Add another first.
        </Notice>
      );
    }
    return (
      <OptionPicker
        title="Remove provider"
        options={removeOptions}
        currentId={selectedId}
        hint="↑↓ move · ↵ select to remove · esc cancel"
        onPick={id => {
          setSelectedId(id);
          setConfirmRemove(true);
        }}
        onClose={onClose}
      />
    );
  }

  // ----------------------------------------------------------------
  // EDIT flow
  // ----------------------------------------------------------------
  if (mode === 'edit') {
    // step: 'select' → 'field' → 'value'
    if (step === 'init' || (step === 'select' && !selectedId)) {
      return (
        <OptionPicker
          title="Edit provider"
          options={providers.map(p => ({
            id: p.id,
            label: p.id,
            detail: `${p.name} [${p.kind}]${p.id === activeProviderId ? ' (active)' : ''}`,
          }))}
          currentId={activeProviderId}
          hint="↑↓ move · ↵ select · esc cancel"
          onPick={id => {
            setSelectedId(id);
            setStep('field');
          }}
          onClose={onClose}
        />
      );
    }

    const target = providers.find(p => p.id === selectedId)!;
    if (step === 'field') {
      const opts: PickerOption[] = editableFields(target).map(f => {
        let current = '';
        if (f === 'apiKey') current = target.apiKey ? 'set ●' : 'unset';
        else if (f === 'kind') current = target.kind;
        else current = String((target as unknown as Record<string, unknown>)[f] ?? '');
        return { id: f, label: FIELD_LABEL[f], detail: current ? `current: ${current.slice(0, 50)}` : 'current: (empty)' };
      });
      return (
        <OptionPicker
          title={`Edit ${target.id}`}
          options={opts}
          hint="↑↓ move · ↵ select field · esc back"
          onPick={id => {
            setField(id as EditableField);
            setValue('');
            setStep('value');
          }}
          onClose={onClose}
        />
      );
    }

    // step === 'value'
    if (!field) return null;
    if (field === 'kind') {
      return (
        <OptionPicker
          title={`New kind for ${target.id}`}
          options={KIND_OPTIONS.map(k => ({ id: k.id, label: k.label, detail: k.hint }))}
          currentId={target.kind}
          hint="↑↓ move · ↵ select · esc back"
          onPick={id => {
            commitEdit(target, { kind: id as ProviderKind });
          }}
          onClose={() => setStep('field')}
        />
      );
    }

    const isSecret = field === 'apiKey';
    const isURL = field === 'baseURL';
    return (
      <TextField
        title={`${FIELD_LABEL[field]} for ${target.id}`}
        placeholder={`new ${field}`}
        secret={isSecret}
        error={error}
        onCancel={() => {
          setError('');
          setStep('field');
        }}
        onSubmit={raw => {
          const v = raw.trim();
          if (field === 'baseURL') {
            const err = validateBaseURL(v);
            if (err) {
              setError(err);
              return;
            }
          }
          if (field === 'apiKey') {
            commitEdit(target, {}, { set: { [target.id]: v } });
            return;
          }
          commitEdit(target, { [field]: v } as Partial<ProviderConfig>);
        }}
      />
    );
  }

  // ----------------------------------------------------------------
  // ADD flow (steps: kind → id → name → baseURL → key → defaultModel)
  // ----------------------------------------------------------------
  if (step === 'init' || step === 'kind') {
    return (
      <OptionPicker
        title="Add provider — choose protocol"
        options={KIND_OPTIONS.map(k => ({ id: k.id, label: k.label, detail: k.hint }))}
        hint="↑↓ move · ↵ select · esc cancel"
        onPick={id => {
          setDraft({ kind: id as ProviderKind, mmfe: id === 'zai' });
          setStep('id');
        }}
        onClose={onClose}
      />
    );
  }

  const kind = (draft.kind as ProviderKind) || 'openai';
  const needsURL = kind !== 'zai';

  if (step === 'id') {
    return (
      <TextField
        title="New provider id (lowercase, e.g. my-gateway)"
        placeholder="provider-id"
        error={error}
        onCancel={onClose}
        onSubmit={raw => {
          const err = validateProviderId(raw, providers);
          if (err) {
            setError(err);
            return;
          }
          setDraft(d => ({ ...d, id: raw.trim().toLowerCase() }));
          setStep('name');
        }}
      />
    );
  }
  if (step === 'name') {
    return (
      <TextField
        title="Display name (human-readable)"
        placeholder={String(draft.id || 'My Provider')}
        error=""
        onCancel={() => setStep('id')}
        onSubmit={raw => {
          const name = raw.trim() || String(draft.id || 'Provider');
          setDraft(d => ({ ...d, name }));
          setStep(needsURL ? 'baseURL' : 'defaultModel');
        }}
      />
    );
  }
  if (step === 'baseURL' && needsURL) {
    return (
      <TextField
        title="Base URL (OpenAI/Anthropic-compatible endpoint)"
        placeholder="https://api.example.com/v1"
        error={error}
        onCancel={() => setStep('name')}
        onSubmit={raw => {
          const err = validateBaseURL(raw);
          if (err) {
            setError(err);
            return;
          }
          setDraft(d => ({ ...d, baseURL: raw.trim() }));
          setStep('key');
        }}
      />
    );
  }
  if (step === 'key' && needsURL) {
    return (
      <TextField
        title={`API key for ${String(draft.name || draft.id)} (optional — stored in keys.json)`}
        placeholder="paste key, or Enter to skip"
        secret
        error=""
        onCancel={() => setStep(needsURL ? 'baseURL' : 'name')}
        onSubmit={raw => {
          const k = raw.trim();
          if (k) setDraft(d => ({ ...d, _key: k }));
          setStep('defaultModel');
        }}
      />
    );
  }
  // step === 'defaultModel'
  return (
    <TextField
      title="Default model id (optional — Enter to skip)"
      placeholder="model-id"
      error=""
      onCancel={() => setStep(needsURL ? 'key' : 'name')}
      onSubmit={raw => {
        const defaultModel = raw.trim();
        finalizeAdd(defaultModel);
      }}
    />
  );

  // ----------------------------------------------------------------
  // Committers
  // ----------------------------------------------------------------
  function commitEdit(target: ProviderConfig, patch: Partial<ProviderConfig>, keys: KeyChange = {}) {
    const next = providers.map(p => (p.id === target.id ? ({ ...p, ...patch, apiKey: undefined } as ProviderConfig) : p));
    onPersist({ providers: next, keys });
    onClose();
  }

  function finalizeAdd(defaultModel: string) {
    const id = String(draft.id);
    const newProvider: ProviderConfig = {
      id,
      kind: (draft.kind as ProviderKind) || 'openai',
      name: String(draft.name || id),
      mmfe: draft.kind === 'zai',
      ...(draft.baseURL ? { baseURL: draft.baseURL } : {}),
      ...(defaultModel ? { defaultModel } : {}),
    };
    const keyRaw = (draft as Record<string, unknown>)._key;
    const keys: KeyChange = keyRaw ? { set: { [id]: String(keyRaw) } } : {};
    onPersist({
      providers: [...providers, newProvider],
      activeProviderId: id, // newly-added becomes active for immediate use
      keys,
    });
    onClose();
  }
}

// ============================================================
// Sub-components
// ============================================================

function Notice({ color, title, onClose, children }: { color: string; title: string; onClose: () => void; children: React.ReactNode }) {
  useInput((_input, key) => {
    if (key.escape || key.return) onClose();
  });
  return (
    <Box flexDirection="column" marginY={1} paddingX={1}>
      <Text color={color} bold>
        ⚠ {title}
      </Text>
      <Text color="#94A3B8">{children}</Text>
      <Text color="#475569" dimColor>
        press esc to close
      </Text>
    </Box>
  );
}

function ConfirmRemove({
  provider,
  activeProviderId,
  onConfirm,
  onCancel,
}: {
  provider: ProviderConfig;
  activeProviderId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useInput((input, key) => {
    if (key.escape) return onCancel();
    const c = input.toLowerCase();
    if (c === 'y') onConfirm();
    else if (c === 'n') onCancel();
  });
  return (
    <Box flexDirection="column" marginY={1} paddingX={1}>
      <Text color="#EF4444" bold>
        🗑 Remove "{provider.id}" ({provider.name})?
      </Text>
      {provider.id === activeProviderId && (
        <Text color="#F59E0B">This is your active provider — removing it switches to another.</Text>
      )}
      <Text color="#94A3B8">Saved key (if any) will also be cleared from keys.json.</Text>
      <Text color="#475569" dimColor>
        [y] confirm · [n] / esc cancel
      </Text>
    </Box>
  );
}

/** Single-line masked text field for wizard inputs. */
function TextField({
  title,
  placeholder,
  secret = false,
  error = '',
  onSubmit,
  onCancel,
}: {
  title: string;
  placeholder?: string;
  secret?: boolean;
  error?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState('');
  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.return) {
      onSubmit(val);
      setVal('');
      return;
    }
    if (key.backspace || key.delete) {
      setVal(v => v.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setVal(v => v + input);
    }
  });
  return (
    <Box flexDirection="column" marginY={1} paddingX={1} flexShrink={0}>
      <Text color="#06B6D4" bold>
        ✦ {title}
      </Text>
      <Box gap={1}>
        <Text color="#8B5CF6" bold>
          ❯
        </Text>
        <Text color="#E2E8F0">
          {secret ? '•'.repeat(val.length) : val || (placeholder ? '' : '')}
          {(!val || (secret && val)) && <Text color="#06B6D4">▋</Text>}
          {!val && placeholder && !secret && (
            <Text color="#475569">
              {placeholder}
              <Text color="#06B6D4">▋</Text>
            </Text>
          )}
        </Text>
      </Box>
      <Text color={error ? '#EF4444' : '#475569'} dimColor={!error}>
        {error || 'enter to confirm · esc back'}
      </Text>
    </Box>
  );
}

/** Single-line masked text field for wizard inputs. */
