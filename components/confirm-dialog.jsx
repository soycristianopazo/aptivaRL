'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

// Module-level singleton so any component can trigger the platform confirm modal
let opener = null;

/**
 * Promise-based confirm. Returns true if confirmed, false if cancelled.
 * Usage: if (!(await confirmDialog({ title, description }))) return;
 */
export function confirmDialog(options = {}) {
  if (!opener) return Promise.resolve(false);
  return opener(options);
}

export function ConfirmDialogHost() {
  const [state, setState] = useState({ open: false, opts: {}, resolve: null });

  useEffect(() => {
    opener = (opts) =>
      new Promise((resolve) => {
        setState({ open: true, opts: opts || {}, resolve });
      });
    return () => { opener = null; };
  }, []);

  const close = (result) => {
    if (state.resolve) state.resolve(result);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const {
    title = '¿Confirmar acción?',
    description = 'Esta acción no se puede deshacer.',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    destructive = true,
  } = state.opts;

  return (
    <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${destructive ? 'bg-red-100' : 'bg-blue-100'}`}>
              <AlertTriangle className={`h-5 w-5 ${destructive ? 'text-red-600' : 'text-blue-600'}`} />
            </div>
            <div className="space-y-1 pt-0.5">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription className="whitespace-pre-line">{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={destructive ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' : ''}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
