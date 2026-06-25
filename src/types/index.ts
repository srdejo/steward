export type Category = 'cred' | 'fijo' | 'tarjeta' | 'var';

export interface CategoryDef {
  id: string;
  key: Category;
  label: string;
  color: string;
}

// Draft types for onboarding (values as strings before parsing)
export interface DraftAccount {
  id: string;
  name: string;
  color: string;
  saldo: string;
}

export interface DraftIncome {
  id: string;
  name: string;
  bruto: string;
  neto: string;
  accountId: string;
}

export interface DraftDebt {
  id: string;
  name: string;
  saldo: string;
  tasa: string;
  cuota: string;
}

export interface UserProfile {
  name: string;
  diezmar: boolean;
  cats: CategoryDef[];
}

export interface OnboardDraft {
  name: string;
  diezmar: boolean | null;
  cats: CategoryDef[];
  accounts: DraftAccount[];
  incomes: DraftIncome[];
  hasDebts: boolean | null;
  debts: DraftDebt[];
}

export type DiezmoMode = 'separado' | 'agrupado';
export type MovType = 'transfer' | 'retiro' | 'pago';
export type DebtSort = 'tasa' | 'saldo';
export type SheetKind = 'gasto' | 'income' | 'cuenta' | 'deuda' | 'mov' | 'pay' | 'profile';
export type SheetMode = 'add' | 'edit';

export interface Gasto {
  id: string;
  cat: Category;
  name: string;
  amount: number;
  real?: number;
  paid: boolean;
  source?: string;
  sourceName?: string;
  debtId?: string;
}

export interface Income {
  id: string;
  name: string;
  bruto: number;
  neto: number;
  fecha: string | null;
  recibido: boolean;
  diezmoPaid: boolean;
  accountId?: string;
  recurrente?: boolean;
}

export interface Account {
  id: string;
  name: string;
  color: string;
  saldo: number;
  incluir: boolean;
}

export interface Movimiento {
  id: string;
  desc: string;
  meta: string;
  monto: number;
  type: MovType;
}

export interface MonthBudget {
  exists: boolean;
  diezmoMode: DiezmoMode;
  diezmoGrupoPaid: boolean;
  gastos: Gasto[];
  incomes: Income[];
  accounts: Account[];
  movimientos: Movimiento[];
}

export interface Debt {
  id: string;
  name: string;
  saldo: number;
  tasa: number;
  cuota?: number;
}

export interface SheetState {
  kind: SheetKind;
  mode?: SheetMode;
  id?: string;
  cat?: Category;
  name?: string;
  a1?: string;
  a2?: string;
  a3?: string;
  type?: 'transfer' | 'retiro';
  from?: string;
  to?: string;
  gastoId?: string;
  gastoName?: string;
  monto?: number;
  payBudgeted?: number;
  payMode?: 'same' | 'otro';
  payAmt?: string;
  color?: string;
  accountId?: string;
  recurrente?: boolean;
}
