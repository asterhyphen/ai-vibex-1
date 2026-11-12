import type { Transition, Variants } from 'framer-motion'

export const springConfig: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 24,
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
}

export const stagger = (delay = 0.06): Variants => ({
  hidden: {},
  show: {
    transition: {
      staggerChildren: delay,
    },
  },
})

export const scaleIn: Variants = {
  hidden: { scale: 0.9, opacity: 0 },
  show: {
    scale: 1,
    opacity: 1,
    transition: springConfig,
  },
}

export const maskRevealLine: Variants = {
  hidden: { y: '105%', opacity: 0 },
  show: {
    y: '0%',
    opacity: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}
