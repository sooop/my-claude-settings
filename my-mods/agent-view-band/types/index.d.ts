export type AgentModel = { model: string; effort?: string | number }

declare module 'claude-code' {
  interface PluginState {
    'agent-view-band': { models: Record<string, AgentModel> }
  }
}
