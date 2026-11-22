"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import { dialogMotion, overlayMotion } from "./motion-presets";

/**
 * animate-ui's Radix Dialog primitive (animate-ui.com/docs/primitives/radix/dialog), controlled only:
 * every dialog here passes `open`. The portal stays mounted while the content plays its exit.
 */

const OpenContext = React.createContext(false);

type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root> & {
  open: boolean;
};

function Dialog(props: DialogProps) {
  return (
    <OpenContext.Provider value={props.open}>
      <DialogPrimitive.Root data-slot="dialog" {...props} />
    </OpenContext.Provider>
  );
}

function DialogPortal(
  props: Omit<
    React.ComponentProps<typeof DialogPrimitive.Portal>,
    "forceMount"
  >,
) {
  const open = React.useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal
          data-slot="dialog-portal"
          forceMount
          {...props}
        />
      )}
    </AnimatePresence>
  );
}

type DialogOverlayProps = Omit<
  React.ComponentProps<typeof DialogPrimitive.Overlay>,
  "forceMount" | "asChild"
> &
  HTMLMotionProps<"div">;

function DialogOverlay(props: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay data-slot="dialog-overlay" asChild forceMount>
      <motion.div key="dialog-overlay" {...overlayMotion} {...props} />
    </DialogPrimitive.Overlay>
  );
}

type DialogContentProps = Omit<
  React.ComponentProps<typeof DialogPrimitive.Content>,
  "forceMount" | "asChild"
> &
  HTMLMotionProps<"div">;

function DialogContent({
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: DialogContentProps) {
  const reduce = useReducedMotion();
  return (
    <DialogPrimitive.Content
      asChild
      forceMount
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
      onEscapeKeyDown={onEscapeKeyDown}
      onPointerDownOutside={onPointerDownOutside}
      onInteractOutside={onInteractOutside}
    >
      <motion.div
        key="dialog-content"
        data-slot="dialog-content"
        {...dialogMotion(reduce)}
        {...props}
      />
    </DialogPrimitive.Content>
  );
}

const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;
const DialogClose = DialogPrimitive.Close;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  type DialogProps,
  type DialogContentProps,
};
