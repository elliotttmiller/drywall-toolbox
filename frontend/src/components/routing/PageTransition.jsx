/**
 * PageTransition
 *
 * A route-level opacity crossfade. The shell stays mounted while outgoing and
 * incoming route content overlap, so navigation feels continuous without
 * delaying data rendering or hiding component-level loading states.
 */
import { motion as Motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { routeVariants, reducedRouteVariants } from '../../motion/dtbMotion.js';

export default function PageTransition({ children, locationKey }) {
  const reduceMotion = useReducedMotion();
  const variants = reduceMotion ? reducedRouteVariants : routeVariants;

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <Motion.div
        key={locationKey}
        className="dtb-page-transition"
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{
          width: '100%',
          minHeight: '100%',
          willChange: 'opacity',
          position: 'relative',
          backfaceVisibility: 'hidden',
          contain: 'layout paint',
        }}
      >
        {children}
      </Motion.div>
    </AnimatePresence>
  );
}
