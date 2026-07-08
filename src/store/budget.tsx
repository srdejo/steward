import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import type {
  Account,
  Category,
  CategoryDef,
  Debt,
  DebtSort,
  DiezmoMode,
  DraftAccount,
  DraftDebt,
  DraftIncome,
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

export function daysUntilDue(monthName: string, venceDia: number): number {
  const [name, yearStr] = monthName.split(' ');
  const monthIdx = MONTH_NAMES_ES.indexOf(name);
  const due = new Date(Number(yearStr), monthIdx, venceDia);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due.getTime() - todayMidnight.getTime()) / 86400000);
}

// ---- Estado ----

const ACCOUNT_COLORS = ['#34d399', '#ef6a6a', '#b794f6', '#6aa6f6', '#f0c040', '#5aa6a4'];
const DEFAULT_ACCOUNTS: Account[] = [];
export const ACCT_PALETTE = ['#ef4444', '#7c3aed', '#3b82f6', '#16a34a', '#f59e0b', '#0d9488', '#ec4899', '#6b7280', '#f97316'];

export const CAT_PALETTE = ['#16a34a', '#ea580c', '#7c3aed', '#2563eb', '#0d9488', '#dc2626', '#8b94a0', '#f59e0b', '#06b6d4'];

export const DEFAULT_CATS: CategoryDef[] = [
  { id: 'cat_cred', key: 'cred', label: 'Créditos', color: '#16a34a' },
  { id: 'cat_fijo', key: 'fijo', label: 'Gastos fijos', color: '#ea580c' },
  { id: 'cat_tarjeta', key: 'tarjeta', label: 'Tarjetas y cuotas', color: '#7c3aed' },
  { id: 'cat_var', key: 'var', label: 'Variables', color: '#8b94a0' },
];

const DEFAULT_PROFILE: UserProfile = { name: 'Yo', diezmar: true, cats: DEFAULT_CATS };

const DEFAULT_DRAFT: OnboardDraft = {
  name: '',
  diezmar: null,
  cats: DEFAULT_CATS,
  accounts: [],
  incomes: [],
  hasDebts: null,
  debts: [],
};

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
  | { type: 'ONBOARD_ADD_ACCOUNT' }
  | { type: 'ONBOARD_REMOVE_ACCOUNT'; id: string }
  | { type: 'ONBOARD_SET_ACCOUNT'; id: string; patch: Partial<DraftAccount> }
  | { type: 'ONBOARD_CYCLE_ACCOUNT_COLOR'; id: string }
  | { type: 'ONBOARD_ADD_INCOME' }
  | { type: 'ONBOARD_REMOVE_INCOME'; id: string }
  | { type: 'ONBOARD_SET_INCOME'; id: string; patch: Partial<DraftIncome> }
  | { type: 'ONBOARD_SET_HAS_DEBTS'; value: boolean }
  | { type: 'ONBOARD_ADD_DEBT' }
  | { type: 'ONBOARD_REMOVE_DEBT'; id: string }
  | { type: 'ONBOARD_SET_DEBT'; id: string; patch: Partial<DraftDebt> }
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

function syncCreditGastos(state: BudgetState): BudgetState {
  const b = curBudget(state);
  if (!b) return state;
  const manual = b.gastos.filter((g) => !g.debtId);
  const existingAuto: Record<string, Gasto> = {};
  b.gastos.forEach((g) => { if (g.debtId) existingAuto[g.debtId] = g; });
  const creditGastos: Gasto[] = state.debts
    .filter((d) => d.cuota && d.cuota > 0)
    .map((d) => {
      const prev = existingAuto[d.id];
      return {
        id: prev?.id ?? ('auto_' + d.id),
        cat: 'cred' as Category,
        name: d.name,
        amount: d.cuota!,
        paid: prev?.paid ?? false,
        debtId: d.id,
        ...(d.venceDia ? { venceDia: d.venceDia } : {}),
        ...(prev?.source ? { source: prev.source, sourceName: prev.sourceName, real: prev.real } : {}),
      };
    });
  return patchBudget(state, { gastos: [...manual, ...creditGastos] });
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
      return { ...state, onboardStep: Math.min(5, state.onboardStep + 1) };

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
      return { ...state, draft: { ...DEFAULT_DRAFT, name: state.profile.name, diezmar: state.profile.diezmar, cats: [...state.profile.cats] }, sheet: { kind: 'profile' } };

    case 'PROFILE_SAVE': {
      const name = state.draft.name.trim() || state.profile.name;
      const diezmar = state.draft.diezmar !== null ? state.draft.diezmar : state.profile.diezmar;
      const cats = state.draft.cats.length ? state.draft.cats : state.profile.cats;
      return { ...state, profile: { name, diezmar, cats }, sheet: null };
    }

    case 'ONBOARD_ADD_ACCOUNT': {
      const color = ACCT_PALETTE[state.draft.accounts.length % ACCT_PALETTE.length];
      const newAcct: DraftAccount = { id: 'a' + Date.now(), name: '', color, saldo: '' };
      return { ...state, draft: { ...state.draft, accounts: [...state.draft.accounts, newAcct] } };
    }

    case 'ONBOARD_REMOVE_ACCOUNT':
      return { ...state, draft: { ...state.draft, accounts: state.draft.accounts.filter((a) => a.id !== action.id) } };

    case 'ONBOARD_SET_ACCOUNT':
      return { ...state, draft: { ...state.draft, accounts: state.draft.accounts.map((a) => a.id === action.id ? { ...a, ...action.patch } : a) } };

    case 'ONBOARD_CYCLE_ACCOUNT_COLOR': {
      return {
        ...state, draft: { ...state.draft, accounts: state.draft.accounts.map((a) => {
          if (a.id !== action.id) return a;
          const i = ACCT_PALETTE.indexOf(a.color);
          return { ...a, color: ACCT_PALETTE[(i + 1) % ACCT_PALETTE.length] };
        }) },
      };
    }

    case 'ONBOARD_ADD_INCOME': {
      const defaultAccountId = state.draft.accounts[0]?.id ?? '';
      const newInc: DraftIncome = { id: 'ri' + Date.now(), name: '', bruto: '', neto: '', accountId: defaultAccountId };
      return { ...state, draft: { ...state.draft, incomes: [...state.draft.incomes, newInc] } };
    }

    case 'ONBOARD_REMOVE_INCOME':
      return { ...state, draft: { ...state.draft, incomes: state.draft.incomes.filter((i) => i.id !== action.id) } };

    case 'ONBOARD_SET_INCOME':
      return { ...state, draft: { ...state.draft, incomes: state.draft.incomes.map((i) => i.id === action.id ? { ...i, ...action.patch } : i) } };

    case 'ONBOARD_SET_HAS_DEBTS': {
      const debts = action.value && state.draft.debts.length === 0
        ? [{ id: 'dd' + Date.now(), name: '', saldo: '', tasa: '', cuota: '' }]
        : state.draft.debts;
      return { ...state, draft: { ...state.draft, hasDebts: action.value, debts } };
    }

    case 'ONBOARD_ADD_DEBT': {
      const newDebt: DraftDebt = { id: 'dd' + Date.now(), name: '', saldo: '', tasa: '', cuota: '' };
      return { ...state, draft: { ...state.draft, debts: [...state.draft.debts, newDebt] } };
    }

    case 'ONBOARD_REMOVE_DEBT':
      return { ...state, draft: { ...state.draft, debts: state.draft.debts.filter((d) => d.id !== action.id) } };

    case 'ONBOARD_SET_DEBT':
      return { ...state, draft: { ...state.draft, debts: state.draft.debts.map((d) => d.id === action.id ? { ...d, ...action.patch } : d) } };

    case 'ONBOARD_COMPLETE': {
      const d = state.draft;
      const name = d.name.trim() || 'Yo';
      const diezmar = d.diezmar !== false;
      const cats = d.cats.length ? d.cats : DEFAULT_CATS;
      const profile: UserProfile = { name, diezmar, cats };

      // Convertir cuentas del draft → Account[]
      const accounts: Account[] = d.accounts
        .filter((a) => a.name.trim())
        .map((a) => ({ id: a.id, name: a.name.trim(), color: a.color, saldo: parseNum(a.saldo), incluir: true }));

      // Convertir debts del draft → Debt[]
      const debts: Debt[] = (d.hasDebts ? d.debts : [])
        .filter((x) => x.name.trim() || parseNum(x.saldo))
        .map((x) => {
          const cuota = parseNum(x.cuota);
          const venceDia = parseNum(x.dia) || undefined;
          return { id: x.id, name: x.name.trim() || 'Crédito', saldo: parseNum(x.saldo), tasa: parseRate(x.tasa), ...(cuota > 0 ? { cuota } : {}), ...(venceDia ? { venceDia } : {}) };
        });

      // Convertir ingresos recurrentes → incomes del mes actual
      const incomes: Income[] = d.incomes
        .filter((i) => i.name.trim() || parseNum(i.bruto))
        .map((i, idx) => ({
          id: 'i' + Date.now() + '_' + idx,
          name: i.name.trim() || 'Ingreso',
          bruto: parseNum(i.bruto),
          neto: parseNum(i.neto) || parseNum(i.bruto),
          accountId: i.accountId,
          recurrente: true,
          fecha: null,
          recibido: false,
          diezmoPaid: false,
        }));

      const m = MONTHS[state.curIdx];
      const monthBudget: MonthBudget = {
        exists: true,
        diezmoMode: 'separado',
        diezmoGrupoPaid: false,
        gastos: [],
        incomes,
        accounts,
        movimientos: [],
      };

      const afterOnboard: BudgetState = {
        ...state,
        onboarded: true,
        onboardStep: 0,
        profile,
        debts,
        budgets: { ...state.budgets, [m]: monthBudget },
        draft: DEFAULT_DRAFT,
      };
      return syncCreditGastos(afterOnboard);
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
      const afterCopy = patchBudget(state, {
        exists: true, diezmoMode: prev.diezmoMode, diezmoGrupoPaid: false,
        gastos, incomes, accounts, movimientos: [],
      });
      return syncCreditGastos(afterCopy);
    }

    case 'START_EMPTY': {
      const afterEmpty = patchBudget(state, {
        exists: true, diezmoMode: 'separado', diezmoGrupoPaid: false,
        gastos: [], incomes: [],
        accounts: prevAccountsTemplate(state),
        movimientos: [],
      });
      return syncCreditGastos(afterEmpty);
    }

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

    case 'TOGGLE_RECIBIDO': {
      const b = curBudget(state);
      if (!b) return state;
      const inc = b.incomes.find((i) => i.id === action.incId);
      if (!inc) return state;
      const wasRecibido = inc.recibido;
      let next = setIncomes(state, (is) => is.map((i) => i.id === action.incId ? { ...i, recibido: !i.recibido } : i));
      if (!wasRecibido && inc.accountId) {
        next = setAccounts(next, (as) =>
          as.map((a) => a.id === inc.accountId ? { ...a, saldo: a.saldo + inc.neto } : a),
        );
        const acctName = b.accounts.find((a) => a.id === inc.accountId)?.name ?? '';
        const mv: Movimiento = {
          id: 'inc_' + inc.id,
          desc: inc.name + (acctName ? ' → ' + acctName : ''),
          meta: 'Ingreso · hoy',
          monto: inc.neto,
          type: 'transfer',
        };
        next = setMovimientos(next, (ms) => [mv, ...ms.filter((m) => m.id !== 'inc_' + inc.id)]);
      } else if (wasRecibido && inc.accountId) {
        next = setAccounts(next, (as) =>
          as.map((a) => a.id === inc.accountId ? { ...a, saldo: a.saldo - inc.neto } : a),
        );
        next = setMovimientos(next, (ms) => ms.filter((m) => m.id !== 'inc_' + inc.id));
      }
      return next;
    }

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
        const venceDia = parseNum(sh.dia) || undefined;
        if (sh.mode === 'add') {
          const item: Gasto = { id: 'g' + Date.now(), cat: sh.cat ?? 'var', name, amount: a1, paid: false, ...(venceDia ? { venceDia } : {}) };
          return { ...setGastos(state, (gs) => [...gs, item]), sheet: null };
        } else {
          const real = sh.a2 !== '' && sh.a2 !== undefined ? a2 : undefined;
          return { ...setGastos(state, (gs) => gs.map((g) => g.id === sh.id ? { ...g, name, amount: a1, real, ...(venceDia ? { venceDia } : { venceDia: undefined }) } : g)), sheet: null };
        }
      }

      if (sh.kind === 'income') {
        const name = sh.name?.trim() || 'Ingreso';
        if (sh.mode === 'add') {
          const item: Income = { id: 'i' + Date.now(), name, bruto: a1, neto: a2 || a1, fecha: null, recibido: false, diezmoPaid: false, accountId: sh.accountId, recurrente: sh.recurrente ?? false };
          return { ...setIncomes(state, (is) => [...is, item]), sheet: null };
        } else {
          return { ...setIncomes(state, (is) => is.map((i) => i.id === sh.id ? { ...i, name, bruto: a1, neto: a2 || a1, accountId: sh.accountId ?? i.accountId, recurrente: sh.recurrente ?? i.recurrente } : i)), sheet: null };
        }
      }

      if (sh.kind === 'cuenta') {
        const name = sh.name?.trim() || 'Cuenta';
        const b = curBudget(state);
        const currentAccounts = b?.accounts ?? [];
        if (sh.mode === 'add') {
          const color = sh.color ?? ACCT_PALETTE[currentAccounts.length % ACCT_PALETTE.length];
          const item: Account = { id: 'a' + Date.now(), name, color, saldo: a1, incluir: true };
          return { ...setAccounts(state, (as) => [...as, item]), sheet: null };
        } else {
          const color = sh.color;
          return { ...setAccounts(state, (as) => as.map((a) => a.id === sh.id ? { ...a, name, saldo: a1, ...(color ? { color } : {}) } : a)), sheet: null };
        }
      }

      if (sh.kind === 'deuda') {
        const name = sh.name?.trim() || 'Crédito';
        const tasa = parseRate(sh.a2);
        const cuota = parseNum(sh.a3);
        const venceDia = parseNum(sh.dia) || undefined;
        let next: BudgetState;
        if (sh.mode === 'add') {
          const debt: Debt = { id: 'd' + Date.now(), name, saldo: a1, tasa, ...(cuota > 0 ? { cuota } : {}), ...(venceDia ? { venceDia } : {}) };
          next = { ...state, debts: [...state.debts, debt], sheet: null };
        } else {
          next = { ...state, debts: state.debts.map((d) => d.id === sh.id ? { ...d, name, saldo: a1, tasa, cuota: cuota > 0 ? cuota : undefined, ...(venceDia ? { venceDia } : { venceDia: undefined }) } : d), sheet: null };
        }
        return syncCreditGastos(next);
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
      if (sh.kind === 'deuda') {
        const afterDel = { ...state, debts: state.debts.filter((d) => d.id !== sh.id), sheet: null };
        return syncCreditGastos(afterDel);
      }
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
