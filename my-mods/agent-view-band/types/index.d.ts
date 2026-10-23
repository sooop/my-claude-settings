export type AgentModel = { model: string; effort?: string | number; tokens?: number; window?: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-view-band': { models: Record<string, AgentModel> }
  }
}
