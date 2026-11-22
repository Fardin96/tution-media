"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import { popoverMotion } from "./motion-presets";

/**
 * animate-ui's Radix Popover primitive (animate-ui.com/docs/primitives/radix/popover), controlled
 * only. The content springs out of its trigger (Radix's transform-origin) and shrinks back into it.
 */

const OpenContext = React.createContext(false);

type PopoverProps = React.ComponentProps<typeof PopoverPrimitive.Root> & {
  open: boolean;
};

function Popover(props: PopoverProps) {
  return (
    <OpenContext.Provider value={props.open}>
      <PopoverPrimitive.Root data-slot="popover" {...props} />
    </OpenContext.Provider>
  );
}

const PopoverTrigger = PopoverPrimitive.Trigger;

function PopoverPortal(
  props: Omit<
    React.ComponentProps<typeof PopoverPrimitive.Portal>,
    "forceMount"
  >,
) {
  const open = React.useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <PopoverPrimitive.Portal
          data-slot="popover-portal"
          forceMount
          {...props}
        />
      )}
    </AnimatePresence>
  );
}

type PopoverContentProps = Omit<
  React.ComponentProps<typeof PopoverPrimitive.Content>,
  "forceMount" | "asChild"
> &
  HTMLMotionProps<"div">;

function PopoverContent({
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  align,
  alignOffset,
  side,
  sideOffset,
  avoidCollisions,
  collisionBoundary,
  collisionPadding,
  arrowPadding,
  sticky,
  hideWhenDetached,
  style,
  ...props
}: PopoverContentProps) {
  const reduce = useReducedMotion();
  return (
    <PopoverPrimitive.Content
      asChild
      forceMount
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      avoidCollisions={avoidCollisions}
      collisionBoundary={collisionBoundary}
      collisionPadding={collisionPadding}
      arrowPadding={arrowPadding}
      sticky={sticky}
      hideWhenDetached={hideWhenDetached}
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
      onEscapeKeyDown={onEscapeKeyDown}
      onPointerDownOutside={onPointerDownOutside}
      onInteractOutside={onInteractOutside}
      onFocusOutside={onFocusOutside}
    >
      <motion.div
        key="popover-content"
        data-slot="popover-content"
        {...popoverMotion(reduce)}
        style={{
          transformOrigin: "var(--radix-popover-content-transform-origin)",
          ...style,
        }}
        {...props}
      />
    </PopoverPrimitive.Content>
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
  type PopoverProps,
  type PopoverContentProps,
};
