"use client"

import { useReducedMotion } from "framer-motion"

export function useMotionAllowed() {
  const reduced = useReducedMotion()
  return !reduced
}

export const motionEase = [0.25, 0.1, 0.25, 1] as const

export function fadeInProps(reduced: boolean) {
  if (reduced) {
    return {
      initial: false,
      animate: { opacity: 1 },
    }
  }
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: motionEase },
  }
}

export function staggerContainer(reduced: boolean) {
  if (reduced) {
    return {
      initial: false,
      animate: "show" as const,
      variants: {
        hidden: {},
        show: {
          transition: { staggerChildren: 0 },
        },
      },
    }
  }
  return {
    initial: "hidden" as const,
    animate: "show" as const,
    variants: {
      hidden: {},
      show: {
        transition: { staggerChildren: 0.06, delayChildren: 0.04 },
      },
    },
  }
}

export function staggerItem(reduced: boolean) {
  if (reduced) {
    return {
      variants: {
        hidden: { opacity: 1 },
        show: { opacity: 1 },
      },
    }
  }
  return {
    variants: {
      hidden: { opacity: 0, y: 10 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.25, ease: motionEase },
      },
    },
  }
}
