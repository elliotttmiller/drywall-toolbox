/**
 * PageTransition
 *
 * Wraps page content with a smooth fade + upward-drift entrance and a quick
 * fade-out exit on every route change, powered by Framer Motion.
 *
 * Usage:
 *   <PageTransition locationKey={location.key}>
 *     <Suspense>…<Routes>…</Routes></Suspense>
 *   </PageTransition>
 *
 * `AnimatePresence mode="wait"` ensures the outgoing page fully exits before
 * the incoming page starts entering, preventing overlapping content flashes.
 * The `locationKey` prop is used as the React key on the animated wrapper so
 * a new animation plays on every pathname change. Using `location.pathname`
 * (not `location.key`) prevents in-page `navigate({replace:true})` calls
 * (e.g. syncing query params) from re-triggering the transition.
 *
 * Accessibility: when `prefers-reduced-motion: reduce` is active the animation
 * is skipped entirely — only a clean opacity cross-fade is applied to prevent
 * triggering motion sensitivity.
 */
import { motion as Motion, AnimatePresence } from 'framer-motion';

// Detect reduced-motion preference once at module load time.
// Components that need reactivity should use the `useReducedMotion` hook
// from Framer Motion, but for a module-level constant this is sufficient.
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Enter: matches ProductModal's panelTransition easing for site-wide consistency.
// Exit: slightly faster ease-in so it gets out of the way quickly.
// Reduced-motion variant: opacity-only, no spatial movement.
const VARIANTS = prefersReducedMotion
  ? {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.15 } },
      exit:    { opacity: 0, transition: { duration: 0.1  } },
    }
  : {
      initial: { opacity: 0, y: 12 },
      animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.28, ease: [ 0.22, 1, 0.36, 1 ] },
      },
      exit: {
        opacity: 0,
        y: -8,
        transition: { duration: 0.18, ease: [ 0.36, 0, 0.66, 0 ] },
      },
    };

export default function PageTransition( { children, locationKey } ) {
  return (
    <AnimatePresence mode="wait" initial={ false }>
      <Motion.div
        key={ locationKey }
        variants={ VARIANTS }
        initial="initial"
        animate="animate"
        exit="exit"
        style={ { width: '100%' } }
      >
        { children }
      </Motion.div>
    </AnimatePresence>
  );
}
