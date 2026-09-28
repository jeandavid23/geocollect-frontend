// Déclarations minimales des bibliothèques de formules (livrées sans types TypeScript)

declare module 'fast-formula-parser' {
  export interface CellRef { sheet?: string; row: number; col: number }
  export interface RangeRef { sheet?: string; from: { row: number; col: number }; to: { row: number; col: number } }
  export interface FunctionArg { value: unknown; isArray: boolean; isRangeRef?: boolean; isCellRef?: boolean; omitted?: boolean }

  export class FormulaError {
    constructor(error: string, msg?: string)
    error: string
    message?: string
  }

  export default class FormulaParser {
    static FormulaError: typeof FormulaError
    constructor(config?: {
      functions?: Record<string, (...args: FunctionArg[]) => unknown>
      functionsNeedContext?: Record<string, (context: unknown, ...args: FunctionArg[]) => unknown>
      onCell?: (ref: CellRef) => unknown
      onRange?: (ref: RangeRef) => unknown[][]
      onVariable?: (name: string, sheet: string) => unknown
    })
    functions: Record<string, unknown>
    parse(formula: string, position: { sheet: string; row: number; col: number }, allowReturnArray?: boolean): unknown
  }
}

declare module '@formulajs/formulajs' {
  const formulajs: Record<string, unknown>
  export = formulajs
}
