export type Category = 'cred' | 'fijo' | 'tarjeta' | 'var';
export type DiezmoMode = 'separado' | 'agrupado';
export type MovType = 'transfer' | 'retiro' | 'pago';
export type DebtSort = 'tasa' | 'saldo';
export type SheetKind = 'gasto' | 'income' | 'cuenta' | 'deuda' | 'mov' | 'pay';
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
}

export interface Income {
  id: string;
  name: string;
  bruto: number;
  neto: number;
  fecha: string | null;
  recibido: boolean;
  diezmoPaid: boolean;
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
  accounts: Account[];        // saldos propios del mes
  movimientos: Movimiento[];  // movimientos del mes
}

export interface Debt {
  id: string;
  name: string;
  saldo: number;
  tasa: number;
}

export interface SheetState {
  kind: SheetKind;
  mode?: SheetMode;
  id?: string;
  cat?: Category;
  name?: string;
  a1?: string;
  a2?: string;
  type?: 'transfer' | 'retiro';
  from?: string;
  to?: string;
  gastoId?: string;
  gastoName?: string;
  monto?: number;
  payBudgeted?: number;
  payMode?: 'same' | 'otro';
  payAmt?: string;
}
