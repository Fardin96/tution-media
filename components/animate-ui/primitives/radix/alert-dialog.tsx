"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import { dialogMotion, overlayMotion } from "./motion-presets";

/**
 * animate-ui's Radix AlertDialog primitive (animate-ui.com/docs/primitives/radix/alert-dialog),
 * controlled only. Same motion as Dialog; an outside click does not dismiss it.
 */

const OpenContext = React.createContext(false);

type AlertDialogProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Root
> & { open: boolean };

function AlertDialog(props: AlertDialogProps) {
  return (
    <OpenContext.Provider value={props.open}>
      <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
    </OpenContext.Provider>
  );
}

function AlertDialogPortal(
  props: Omit<
    React.ComponentProps<typeof AlertDialogPrimitive.Portal>,
    "forceMount"
  >,
) {
  const open = React.useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <AlertDialogPrimitive.Portal
          data-slot="alert-dialog-portal"
          forceMount
          {...props}
        />
      )}
    </AnimatePresence>
  );
}

type AlertDialogOverlayProps = Omit<
  React.ComponentProps<typeof AlertDialogPrimitive.Overlay>,
  "forceMount" | "asChild"
> &
  HTMLMotionProps<"div">;

function AlertDialogOverlay(props: AlertDialogOverlayProps) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      asChild
      forceMount
    >
      <motion.div key="alert-dialog-overlay" {...overlayMotion} {...props} />
    </AlertDialogPrimitive.Overlay>
  );
}

type AlertDialogContentProps = Omit<
  React.ComponentProps<typeof AlertDialogPrimitive.Content>,
  "forceMount" | "asChild"
> &
  HTMLMotionProps<"div">;

function AlertDialogContent({
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  ...props
}: AlertDialogContentProps) {
  const reduce = useReducedMotion();
  return (
    <AlertDialogPrimitive.Content
      asChild
      forceMount
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
      onEscapeKeyDown={onEscapeKeyDown}
    >
      <motion.div
        key="alert-dialog-content"
        data-slot="alert-dialog-content"
        {...dialogMotion(reduce)}
        {...props}
      />
    </AlertDialogPrimitive.Content>
  );
}

const AlertDialogTitle = AlertDialogPrimitive.Title;
const AlertDialogDescription = AlertDialogPrimitive.Description;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  type AlertDialogProps,
  type AlertDialogContentProps,
};
