export type Table = string[][]

declare module 'claude-code' {
  interface PluginState {
    'table-copy': { tables: Table[] }
  }
}
