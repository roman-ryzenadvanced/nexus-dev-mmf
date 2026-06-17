// ============================================================
// Slash command registry exports
// ============================================================

export {
  REGISTRY,
  PLUGIN_COMMANDS,
  findCommand,
  runSlash,
  registerPluginCommand,
  unregisterPluginCommand,
  allCommands,
  clearPluginCommands,
} from './builtin.js';
export type { SlashCommand, SlashCommandContext } from '../types.js';
