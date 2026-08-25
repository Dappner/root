'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  DialogRuntimeContext,
  DialogRuntimeProvider,
  useDialog,
  useDialogStore,
} from './store';

export function DialogRenderer() {
  const { component: Component, props, open, isSheet } = useDialogStore();
  const { closeDialog } = useDialog();

  const propsRef = useRef(props);
  // Guard against double resolve/cancel
  const settledRef = useRef(false);

  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  // Reset settled state when dialog opens
  useEffect(() => {
    if (open) {
      settledRef.current = false;
    }
  }, [open]);

  const handleExitComplete = () => {
    // Only cleanup if no new dialog has been opened during exit animation
    const currentState = useDialogStore.getState();
    if (!currentState.open) {
      useDialogStore.setState({ component: null, props: {}, isSheet: false });
    }
  };

  const cancel = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    (propsRef.current as { onCancel?: () => void }).onCancel?.();
    closeDialog();
  }, [closeDialog]);

  const onOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      cancel();
    }
  }, [cancel]);

  const resolve = useCallback((value: unknown) => {
    if (settledRef.current) return;
    settledRef.current = true;
    (propsRef.current as { onResolve?: (v: unknown) => void }).onResolve?.(value);
    closeDialog();
  }, [closeDialog]);

  const resolveResult = useCallback((value: unknown) => {
    resolve(value);
  }, [resolve]);

  const runtimeContext = useMemo<DialogRuntimeContext>(
    () => ({ open, onOpenChange, resolve, resolveResult, cancel }),

    [open, onOpenChange, resolve, resolveResult, cancel]
  );

  if (!Component) return null;

  const dialogProps = {
    ...props,
    open,
    onOpenChange,
    resolve,
    isSheet,
  };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {open && (
        <motion.div
          key="dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <DialogRuntimeProvider value={runtimeContext}>
            <Component {...dialogProps} />
          </DialogRuntimeProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
