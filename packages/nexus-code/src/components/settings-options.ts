import type { PickerOption } from './OptionPicker.js';
import type { AppConfig } from '../types.js';

export type SettingsAction =
  | 'provider-switch'
  | 'provider-manage'
  | 'model'
  | 'mode'
  | 'theme';

export function buildSettingsOptions(config: AppConfig): PickerOption[] {
  const activeProvider = config.providers.find(p => p.id === config.activeProviderId);
  const activeTheme = config.ui?.theme || 'tech-dark';

  return [
    {
      id: 'provider-switch',
      label: 'Switch provider',
      detail: `current: ${config.activeProviderId}${activeProvider ? ` (${activeProvider.name})` : ''}`,
    },
    {
      id: 'provider-manage',
      label: 'Manage providers',
      detail: `add / edit / remove (${config.providers.length} configured)`,
    },
    {
      id: 'model',
      label: 'Model',
      detail: `current: ${config.activeModelId || '(none)'}`,
    },
    {
      id: 'mode',
      label: 'MMFE mode',
      detail: `current: ${config.mode}`,
    },
    {
      id: 'theme',
      label: 'Theme',
      detail: `current: ${activeTheme}`,
    },
  ];
}
