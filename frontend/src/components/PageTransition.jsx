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
 * a new animation plays on every navigation.
 */
import { motion as Motion, AnimatePresence } from 'framer-motion';

const VARIANTS = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [ 0.16, 1, 0.3, 1 ] },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.18, ease: [ 0.4, 0, 1, 1 ] },
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
