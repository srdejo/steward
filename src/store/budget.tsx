import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import type {
  Account,
  Category,
  CategoryDef,
  Debt,
  DebtSort,
  DiezmoMode,
  Gasto,
  Income,
  MonthBudget,
  Movimiento,
  OnboardDraft,
  SheetState,
  UserProfile,
} from '@/types';

// ---- Meses dinámicos ----

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatMonth(date: Date): string {
  return `${MONTH_NAMES_ES[date.getMonth()]} ${date.getFullYear()}`;
}

function generateMonths(): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = -3; i <= 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    result.push(formatMonth(d));
  }
  return result;
}

export const MONTHS = generateMonths();
export const CURRENT_IDX = 3;

// ---- Estado ----

const ACCOUNT_COLORS = ['#34d399', '#ef6a6a', '#b794f6', '#6aa6f6', '#f0c040', '#5aa6a4'];
const DEFAULT_ACCOUNTS: Account[] = [];

export const CAT_PALETTE = ['#16a34a', '#ea580c', '#7c3aed', '#2563eb', '#0d9488', '#dc2626', '#8b94a0', '#f59e0b', '#06b6d4'];

export const DEFAULT_CATS: CategoryDef[] = [
  { id: 'cat_cred', key: 'cred', label: 'Deudas Crediservir', color: '#16a34a' },
  { id: 'cat_fijo', key: 'fijo', label: 'Gastos fijos', color: '#ea580c' },
  { id: 'cat_tarjeta', key: 'tarjeta', label: 'Tarjetas y cuotas', color: '#7c3aed' },
  { id: 'cat_var', key: 'var', label: 'Variables', color: '#8b94a0' },
];

const DEFAULT_PROFILE: UserProfile = { name: 'Yo', diezmar: true, cats: DEFAULT_CATS };

const DEFAULT_DRAFT: OnboardDraft = { name: '', diezmar: null, cats: DEFAULT_CATS };

export interface BudgetState {
  curIdx: number;
  budgets: Record<string, MonthBudget>;
  debtSort: DebtSort;
  debts: Debt[];
  sheet: SheetState | null;
  onboarded: boolean;
  onboardStep: number;
  profile: UserProfile;
  draft: OnboardDraft;
}

type PersistedState = Omit<BudgetState, 'curIdx' | 'sheet' | 'onboardStep' | 'draft'>;

type Action =
  | { type: 'ONBOARD_NEXT' }
  | { type: 'ONBOARD_BACK' }
  | { type: 'ONBOARD_SET_NAME'; name: string }
  | { type: 'ONBOARD_SET_DIEZMAR'; diezmar: boolean }
  | { type: 'ONBOARD_ADD_CAT' }
  | { type: 'ONBOARD_REMOVE_CAT'; id: string }
  | { type: 'ONBOARD_SET_CAT_LABEL'; id: string; label: string }
  | { type: 'ONBOARD_CYCLE_COLOR'; id: string }
  | { type: 'ONBOARD_COMPLETE' }
  | { type: 'PROFILE_OPEN' }
  | { type: 'PROFILE_SAVE' }
  | { type: 'PREV_MONTH' }
  | { type: 'NEXT_MONTH' }
  | { type: 'COPY_PREV' }
  | { type: 'START_EMPTY' }
  | { type: 'SET_DIEZMO_MODE'; mode: DiezmoMode }
  | { type: 'TOGGLE_GASTO_PAID'; gastoId: string; sourceId: string; sourceName: string }
  | { type: 'UNPAY_GASTO'; gastoId: string }
  | { type: 'TOGGLE_RECIBIDO'; incId: string }
  | { type: 'TOGGLE_DIEZMO'; incId?: string; isGroup?: boolean }
  | { type: 'TOGGLE_INCLUIR'; accountId: string }
  | { type: 'SET_DEBT_SORT'; sort: DebtSort }
  | { type: 'OPEN_SHEET'; sheet: SheetState }
  | { type: 'CLOSE_SHEET' }
  | { type: 'SET_SHEET'; patch: Partial<SheetState> }
  | { type: 'SAVE_SHEET' }
  | { type: 'DELETE_SHEET' }
  | { type: 'RESTORE'; payload: PersistedState };

// ---- Seed ----

function seedBudget(): Record<string, MonthBudget> {
  return {};
}

const INITIAL_STATE: BudgetState = {
  curIdx: CURRENT_IDX,
  budgets: seedBudget(),
  debtSort: 'tasa',
  debts: [],
  sheet: null,
  onboarded: false,
  onboardStep: 0,
  profile: DEFAULT_PROFILE,
  draft: DEFAULT_DRAFT,
};

// ---- Helpers ----

function curName(state: BudgetState) {
  return MONTHS[state.curIdx];
}

function curBudget(state: BudgetState): MonthBudget | null {
  return state.budgets[curName(state)] ?? null;
}

function patchBudget(state: BudgetState, patch: Partial<MonthBudget>): BudgetState {
  const m = curName(state);
  const existing = state.budgets[m] ?? {
    exists: false, diezmoMode: 'separado', diezmoGrupoPaid: false,
    gastos: [], incomes: [], accounts: [], movimientos: [],
  };
  return { ...state, budgets: { ...state.budgets, [m]: { ...existing, ...patch } } };
}

function setGastos(state: BudgetState, fn: (gs: Gasto[]) => Gasto[]): BudgetState {
  const b = curBudget(state);
  if (!b) return state;
  return patchBudget(state, { gastos: fn(b.gastos) });
}

function setIncomes(state: BudgetState, fn: (is: Income[]) => Income[]): BudgetState {
  const b = curBudget(state);
  if (!b) return state;
  return patchBudget(state, { incomes: fn(b.incomes) });
}

function setAccounts(state: BudgetState, fn: (as: Account[]) => Account[]): BudgetState {
  const b = curBudget(state);
  if (!b) return state;
  return patchBudget(state, { accounts: fn(b.accounts) });
}

function setMovimientos(state: BudgetState, fn: (ms: Movimiento[]) => Movimiento[]): BudgetState {
  const b = curBudget(state);
  if (!b) return state;
  return patchBudget(state, { movimientos: fn(b.movimientos) });
}

function realOf(g: Gasto) {
  return g.real != null ? g.real : g.amount;
}

function parseNum(s: string | undefined) {
  return parseInt(String(s ?? '').replace(/[^0-9]/g, ''), 10) || 0;
}

function parseRate(s: string | undefined) {
  return parseFloat(String(s ?? '').replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
}

// Cuentas del mes anterior (estructura sin saldo) para copiar al nuevo mes
function prevAccountsTemplate(state: BudgetState): Account[] {
  const prevBudget = state.budgets[MONTHS[state.curIdx - 1]];
  const source = prevBudget?.accounts?.length ? prevBudget.accounts : DEFAULT_ACCOUNTS;
  return source.map((a) => ({ ...a, saldo: 0 }));
}

// ---- Reducer ----

function reducer(state: BudgetState, action: Action): BudgetState {
  switch (action.type) {
    case 'RESTORE':
      return { ...INITIAL_STATE, ...action.payload, curIdx: CURRENT_IDX, sheet: null, onboardStep: 0, draft: DEFAULT_DRAFT };

    case 'ONBOARD_NEXT':
      return { ...state, onboardStep: Math.min(2, state.onboardStep + 1) };

    case 'ONBOARD_BACK':
      return { ...state, onboardStep: Math.max(0, state.onboardStep - 1) };

    case 'ONBOARD_SET_NAME':
      return { ...state, draft: { ...state.draft, name: action.name } };

    case 'ONBOARD_SET_DIEZMAR':
      return { ...state, draft: { ...state.draft, diezmar: action.diezmar } };

    case 'ONBOARD_ADD_CAT': {
      const color = CAT_PALETTE[state.draft.cats.length % CAT_PALETTE.length];
      const newCat: CategoryDef = { id: 'cat_' + Date.now(), key: 'var', label: 'Nueva categoría', color };
      return { ...state, draft: { ...state.draft, cats: [...state.draft.cats, newCat] } };
    }

    case 'ONBOARD_REMOVE_CAT':
      return { ...state, draft: { ...state.draft, cats: state.draft.cats.filter((c) => c.id !== action.id) } };

    case 'ONBOARD_SET_CAT_LABEL':
      return { ...state, draft: { ...state.draft, cats: state.draft.cats.map((c) => c.id === action.id ? { ...c, label: action.label } : c) } };

    case 'ONBOARD_CYCLE_COLOR': {
      return {
        ...state,
        draft: {
          ...state.draft,
          cats: state.draft.cats.map((c) => {
            if (c.id !== action.id) return c;
            const i = CAT_PALETTE.indexOf(c.color);
            return { ...c, color: CAT_PALETTE[(i + 1) % CAT_PALETTE.length] };
          }),
        },
      };
    }

    case 'PROFILE_OPEN':
      return { ...state, draft: { name: state.profile.name, diezmar: state.profile.diezmar, cats: [...state.profile.cats] }, sheet: { kind: 'profile' } };

    case 'PROFILE_SAVE': {
      const name = state.draft.name.trim() || state.profile.name;
      const diezmar = state.draft.diezmar !== null ? state.draft.diezmar : state.profile.diezmar;
      const cats = state.draft.cats.length ? state.draft.cats : state.profile.cats;
      return { ...state, profile: { name, diezmar, cats }, sheet: null };
    }

    case 'ONBOARD_COMPLETE': {
      const name = state.draft.name.trim() || 'Yo';
      const diezmar = state.draft.diezmar !== false;
      const cats = state.draft.cats.length ? state.draft.cats : DEFAULT_CATS;
      const profile: UserProfile = { name, diezmar, cats };
      return { ...state, onboarded: true, onboardStep: 0, profile, draft: DEFAULT_DRAFT };
    }

    case 'PREV_MONTH':
      return { ...state, curIdx: Math.max(0, state.curIdx - 1) };

    case 'NEXT_MONTH':
      return { ...state, curIdx: Math.min(MONTHS.length - 1, state.curIdx + 1) };

    case 'COPY_PREV': {
      const prev = state.budgets[MONTHS[state.curIdx - 1]];
      if (!prev) return state;
      const gastos = prev.gastos.map((g) => {
        const n = { ...g, paid: false };
        delete n.real; delete n.source; delete n.sourceName;
        return n;
      });
      const incomes = prev.incomes.map((i) => ({ ...i, recibido: false, diezmoPaid: false }));
      const accounts = prevAccountsTemplate(state);
      return patchBudget(state, {
        exists: true, diezmoMode: prev.diezmoMode, diezmoGrupoPaid: false,
        gastos, incomes, accounts, movimientos: [],
      });
    }

    case 'START_EMPTY':
      return patchBudget(state, {
        exists: true, diezmoMode: 'separado', diezmoGrupoPaid: false,
        gastos: [], incomes: [],
        accounts: prevAccountsTemplate(state),
        movimientos: [],
      });

    case 'SET_DIEZMO_MODE':
      return patchBudget(state, { diezmoMode: action.mode });

    case 'TOGGLE_GASTO_PAID': {
      const { gastoId, sourceId, sourceName } = action;
      const sh = state.sheet;
      const b = curBudget(state);
      if (!b) return state;
      const g = b.gastos.find((x) => x.id === gastoId);
      if (!g || g.paid) return { ...state, sheet: null };
      // Monto: "Lo presupuestado" vs "Otro valor"
      const budgeted = g.amount;
      const monto = sh?.payMode !== 'otro' ? budgeted : (parseNum(sh?.payAmt) || budgeted);
      const real = monto !== budgeted ? monto : undefined;
      // Marcar pagado
      let next = setGastos(state, (gs) =>
        gs.map((x) => x.id === gastoId ? { ...x, paid: true, source: sourceId, sourceName, real } : x),
      );
      // Deducir del saldo de la cuenta (solo si no es efectivo)
      if (sourceId !== 'efectivo') {
        next = setAccounts(next, (as) =>
          as.map((a) => a.id === sourceId ? { ...a, saldo: Math.max(0, a.saldo - monto) } : a),
        );
      }
      // Registrar movimiento
      const mv: Movimiento = { id: 'pay_' + gastoId, desc: g.name + ' · ' + sourceName, meta: 'Pago · hoy', monto, type: 'pago' };
      next = setMovimientos(next, (ms) => [mv, ...ms.filter((m) => m.id !== 'pay_' + gastoId)]);
      return { ...next, sheet: null };
    }

    case 'UNPAY_GASTO': {
      const { gastoId } = action;
      const b = curBudget(state);
      if (!b) return state;
      const g = b.gastos.find((x) => x.id === gastoId);
      if (!g || !g.paid) return state;
      const monto = realOf(g);
      // Desmarcar
      let next = setGastos(state, (gs) =>
        gs.map((x) => x.id === gastoId ? { ...x, paid: false, source: undefined, sourceName: undefined } : x),
      );
      // Devolver al saldo de la cuenta
      if (g.source && g.source !== 'efectivo') {
        next = setAccounts(next, (as) =>
          as.map((a) => a.id === g.source ? { ...a, saldo: a.saldo + monto } : a),
        );
      }
      next = setMovimientos(next, (ms) => ms.filter((m) => m.id !== 'pay_' + gastoId));
      return next;
    }

    case 'TOGGLE_RECIBIDO':
      return setIncomes(state, (is) => is.map((i) => i.id === action.incId ? { ...i, recibido: !i.recibido } : i));

    case 'TOGGLE_DIEZMO': {
      if (action.isGroup) {
        const b = curBudget(state);
        if (!b) return state;
        return patchBudget(state, { diezmoGrupoPaid: !b.diezmoGrupoPaid });
      }
      return setIncomes(state, (is) => is.map((i) => i.id === action.incId ? { ...i, diezmoPaid: !i.diezmoPaid } : i));
    }

    case 'TOGGLE_INCLUIR':
      return setAccounts(state, (as) =>
        as.map((a) => a.id === action.accountId ? { ...a, incluir: !a.incluir } : a),
      );

    case 'SET_DEBT_SORT':
      return { ...state, debtSort: action.sort };

    case 'OPEN_SHEET':
      return { ...state, sheet: action.sheet };

    case 'CLOSE_SHEET':
      return { ...state, sheet: null };

    case 'SET_SHEET':
      if (!state.sheet) return state;
      return { ...state, sheet: { ...state.sheet, ...action.patch } };

    case 'SAVE_SHEET': {
      const sh = state.sheet;
      if (!sh) return state;
      const a1 = parseNum(sh.a1);
      const a2 = parseNum(sh.a2);

      if (sh.kind === 'gasto') {
        const name = sh.name?.trim() || 'Sin nombre';
        if (sh.mode === 'add') {
          const item: Gasto = { id: 'g' + Date.now(), cat: sh.cat ?? 'var', name, amount: a1, paid: false };
          return { ...setGastos(state, (gs) => [...gs, item]), sheet: null };
        } else {
          const real = sh.a2 !== '' && sh.a2 !== undefined ? a2 : undefined;
          return { ...setGastos(state, (gs) => gs.map((g) => g.id === sh.id ? { ...g, name, amount: a1, real } : g)), sheet: null };
        }
      }

      if (sh.kind === 'income') {
        const name = sh.name?.trim() || 'Ingreso';
        if (sh.mode === 'add') {
          const item: Income = { id: 'i' + Date.now(), name, bruto: a1, neto: a2 || a1, fecha: null, recibido: false, diezmoPaid: false };
          return { ...setIncomes(state, (is) => [...is, item]), sheet: null };
        } else {
          return { ...setIncomes(state, (is) => is.map((i) => i.id === sh.id ? { ...i, name, bruto: a1, neto: a2 || a1 } : i)), sheet: null };
        }
      }

      if (sh.kind === 'cuenta') {
        const name = sh.name?.trim() || 'Cuenta';
        const b = curBudget(state);
        const currentAccounts = b?.accounts ?? [];
        if (sh.mode === 'add') {
          const item: Account = { id: 'a' + Date.now(), name, color: ACCOUNT_COLORS[currentAccounts.length % ACCOUNT_COLORS.length], saldo: a1, incluir: true };
          return { ...setAccounts(state, (as) => [...as, item]), sheet: null };
        } else {
          return { ...setAccounts(state, (as) => as.map((a) => a.id === sh.id ? { ...a, name, saldo: a1 } : a)), sheet: null };
        }
      }

      if (sh.kind === 'deuda') {
        const name = sh.name?.trim() || 'Deuda';
        const tasa = parseRate(sh.a2);
        if (sh.mode === 'add') {
          return { ...state, debts: [...state.debts, { id: 'd' + Date.now(), name, saldo: a1, tasa }], sheet: null };
        } else {
          return { ...state, debts: state.debts.map((d) => d.id === sh.id ? { ...d, name, saldo: a1, tasa } : d), sheet: null };
        }
      }

      if (sh.kind === 'mov') {
        const isT = sh.type === 'transfer';
        const desc = isT ? `${sh.from} → ${sh.to}` : `Retiro · ${sh.from}`;
        const item: Movimiento = { id: 'm' + Date.now(), desc, meta: (isT ? 'Transferencia' : 'Cajero') + ' · hoy', monto: a1, type: sh.type ?? 'transfer' };
        return { ...setMovimientos(state, (ms) => [item, ...ms]), sheet: null };
      }

      return { ...state, sheet: null };
    }

    case 'DELETE_SHEET': {
      const sh = state.sheet;
      if (!sh || sh.mode !== 'edit') return { ...state, sheet: null };
      if (sh.kind === 'gasto') return { ...setGastos(state, (gs) => gs.filter((g) => g.id !== sh.id)), sheet: null };
      if (sh.kind === 'income') return { ...setIncomes(state, (is) => is.filter((i) => i.id !== sh.id)), sheet: null };
      if (sh.kind === 'cuenta') return { ...setAccounts(state, (as) => as.filter((a) => a.id !== sh.id)), sheet: null };
      if (sh.kind === 'deuda') return { ...state, debts: state.debts.filter((d) => d.id !== sh.id), sheet: null };
      return { ...state, sheet: null };
    }

    default:
      return state;
  }
}

// ---- Selectores ----

export function fmt(n: number): string {
  return '$' + Math.round(n || 0).toLocaleString('es-CO');
}

export function selectDisponible(state: BudgetState): number {
  const accounts = curBudget(state)?.accounts ?? [];
  return accounts.filter((a) => a.incluir).reduce((s, a) => s + a.saldo, 0);
}

export function selectCuentasLabel(state: BudgetState): string {
  const accounts = curBudget(state)?.accounts ?? [];
  return accounts.filter((a) => a.incluir).map((a) => a.name).join(' + ');
}

export function selectPendiente(state: BudgetState): number {
  const b = curBudget(state);
  if (!b) return 0;
  const gastosPend = b.gastos.filter((g) => !g.paid).reduce((s, g) => s + g.amount, 0);
  const diezmosPend = diezmoEntries(b).filter((e) => e.payable && !e.paid).reduce((s, e) => s + e.amount, 0);
  return gastosPend + diezmosPend;
}

export function selectEjecutado(state: BudgetState): number {
  const b = curBudget(state);
  if (!b) return 0;
  const gastosExec = b.gastos.filter((g) => g.paid).reduce((s, g) => s + realOf(g), 0);
  const diezmosExec = diezmoEntries(b).filter((e) => e.payable && e.paid).reduce((s, e) => s + e.amount, 0);
  return gastosExec + diezmosExec;
}

export function diezmoEntries(b: MonthBudget) {
  const recibidos = b.incomes.filter((i) => i.recibido);
  if (b.diezmoMode === 'agrupado') {
    const amt = recibidos.reduce((a, i) => a + Math.round(i.bruto * 0.1), 0);
    return [{
      id: '__grupo', incId: undefined as string | undefined, isGroup: true,
      name: 'Diezmo del mes', amount: amt, payable: recibidos.length > 0,
      paid: !!b.diezmoGrupoPaid, fecha: null as string | null,
    }];
  }
  return b.incomes.map((i) => ({
    id: 'dz_' + i.id, incId: i.id, isGroup: false,
    name: 'Diezmo · ' + i.name, amount: Math.round(i.bruto * 0.1),
    payable: i.recibido, paid: i.recibido && i.diezmoPaid, fecha: i.fecha,
  }));
}

export function selectCurrentBudget(state: BudgetState) {
  return curBudget(state);
}

export function selectMonthName(state: BudgetState) {
  return MONTHS[state.curIdx];
}

// ---- Persistencia local ----

const STORAGE_KEY = '@steward/budget_v3';

async function loadPersistedState(): Promise<PersistedState | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return JSON.parse(json) as PersistedState;
  } catch {
    return null;
  }
}

async function saveState(state: BudgetState): Promise<void> {
  try {
    const { curIdx: _, sheet: __, ...toSave } = state;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // silencioso
  }
}

// ---- Context ----

interface BudgetContextValue {
  state: BudgetState;
  dispatch: React.Dispatch<Action>;
  ready: boolean;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadPersistedState().then((saved) => {
      if (saved) dispatch({ type: 'RESTORE', payload: saved });
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveState(state);
  }, [state, ready]);

  return (
    <BudgetContext.Provider value={{ state, dispatch, ready }}>
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used inside BudgetProvider');
  return ctx;
}
