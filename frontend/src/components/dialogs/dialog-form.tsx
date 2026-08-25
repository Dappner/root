'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FormEventHandler, KeyboardEventHandler, ReactNode } from 'react';
import { useDialogRuntime } from './store';

interface DialogFormProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onKeyDown?: KeyboardEventHandler<HTMLFormElement>;
  className?: string;
}

export function DialogForm({
  title,
  description,
  children,
  onSubmit,
  onKeyDown,
  className,
}: DialogFormProps) {
  const { open, onOpenChange } = useDialogRuntime();
  const isPlainDescription = typeof description === 'string';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-lg', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription render={isPlainDescription ? undefined : <div />}>
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={onSubmit} onKeyDown={onKeyDown}>{children}</form>
      </DialogContent>
    </Dialog>
  );
}

interface DialogFormFooterProps {
  submitLabel: string;
  pending?: boolean;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  pendingLabel?: string;
  submitVariant?: 'default' | 'destructive';
}

export function DialogFormFooter({
  submitLabel,
  pending = false,
  cancelLabel = 'Cancel',
  cancelDisabled = false,
  pendingLabel,
  submitVariant = 'default',
}: DialogFormFooterProps) {
  const { cancel } = useDialogRuntime();

  // Generate loading text: "Create Source" -> "Creating..."
  const resolvedPendingLabel = pendingLabel ?? (submitLabel.startsWith('Create')
    ? submitLabel.replace('Create', 'Creating') + '...'
    : submitLabel + '...');

  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={cancel} disabled={cancelDisabled}>
        {cancelLabel}
      </Button>
      <Button type="submit" disabled={pending} variant={submitVariant}>
        {pending ? resolvedPendingLabel : submitLabel}
      </Button>
    </DialogFooter>
  );
}
