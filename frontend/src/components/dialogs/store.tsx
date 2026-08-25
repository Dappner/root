import { ComponentType, createContext, useContext } from 'react';
import { create } from 'zustand';

export interface BaseDialogProps<TResult = unknown> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve?: (value: TResult) => void;
  onCancel?: () => void;
}

export type DialogResult<T = unknown, TValues = unknown> =
  | { kind: 'success'; value: T }
  | { kind: 'cancel' }
  | { kind: 'failed'; error?: unknown; values?: TValues };

// Use this to declare a dialog's result type without requiring runtime props

export interface WithDialogResult<TResult = void> {
  /** @internal Phantom type for result type inference - do not use directly */
  __resolveType?: TResult;
}

// Runtime context - available to utility components like DialogForm, DialogFormFooter
export interface DialogRuntimeContext {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resolve: (value: unknown) => void;
  resolveResult: (result: DialogResult) => void;
  cancel: () => void;
}

const DialogRuntime = createContext<DialogRuntimeContext | null>(null);

export const DialogRuntimeProvider = DialogRuntime.Provider;

export function useDialogRuntime(): DialogRuntimeContext {
  const ctx = useContext(DialogRuntime);
  if (!ctx) {
    throw new Error('useDialogRuntime must be used within a DialogRuntimeProvider');
  }
  return ctx;
}

// Distributive Omit that properly handles union types
type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

type DialogProps<T> = T extends ComponentType<infer P>
  ? DistributiveOmit<P, "open" | "onOpenChange">
  : never;

type DialogAsyncProps<T> = DialogProps<T> & {
  onResolve?: (value: unknown) => void;
  onCancel?: () => void;
};

type RequiredKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

interface OpenDialogOptions {
  isSheet?: boolean;
}

type OpenDialogArgs<T extends ComponentType<any>> =
  RequiredKeys<DialogProps<T>> extends never
  ? [component: T, props?: DialogProps<T>, options?: OpenDialogOptions]
  : [component: T, props: DialogProps<T>, options?: OpenDialogOptions];

interface DialogState {
  component: ComponentType<any> | null;
  props: Record<string, unknown>;
  open: boolean;
  isSheet: boolean;
}

// Store holds state only - no actions with generics
export const useDialogStore = create<DialogState>(() => ({
  component: null,
  props: {},
  open: false,
  isSheet: false,
}));

// Type-safe actions defined outside store
function openDialog<T extends ComponentType<any>>(
  ...args: OpenDialogArgs<T>
): void {
  const [component, props, options] = args;
  useDialogStore.setState({
    component: component as ComponentType<any>,
    props: (props ?? {}) as Record<string, unknown>,
    open: true,
    isSheet: options?.isSheet ?? false,
  });
}

function closeDialog(): void {
  // Only set open to false - keep component mounted for exit animation
  // AnimatePresence will handle unmounting after animation completes
  useDialogStore.setState({ open: false });
}

type ResolveValue<T> = T extends ComponentType<infer P>
  ? P extends { __resolveType?: infer R }
    ? R
    : P extends { onResolve?: (value: infer R) => void }
      ? R
      : unknown
  : unknown;

export function openDialogAsync<T extends ComponentType<any>>(
  component: T,
  props?: DialogProps<T>,
  options?: OpenDialogOptions,
): Promise<ResolveValue<T> | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const existingOnCancel = (props as { onCancel?: () => void } | undefined)
      ?.onCancel;
    openDialog(
      component,
      {
        ...(props ?? {}),
        onResolve: (value: ResolveValue<T>) => {
          resolved = true;
          closeDialog();
          resolve(value);
        },
        onCancel: () => {
          existingOnCancel?.();
          if (!resolved) {
            resolve(null);
          }
        },
      } as DialogAsyncProps<T>,
      options,
    );
  });
}

function isDialogResult(value: unknown): value is DialogResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const kind = (value as { kind?: string }).kind;
  return kind === "success" || kind === "cancel" || kind === "failed";
}

export async function openDialogResult<T extends ComponentType<any>>(
  component: T,
  props?: DialogProps<T>,
  options?: OpenDialogOptions,
): Promise<DialogResult<ResolveValue<T>>> {
  try {
    const value = await openDialogAsync(component, props, options);
    if (isDialogResult(value)) {
      return value as DialogResult<ResolveValue<T>>;
    }
    if (value === null) {
      return { kind: 'cancel' };
    }
    return { kind: 'success', value };
  } catch (error) {
    return { kind: 'failed', error };
  }
}

export function useDialog() {
  return { openDialog, closeDialog } as const;
}
