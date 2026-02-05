import { useState, useRef, useEffect } from 'react';
import '../styles/zoomable-diagram.css';

/**
 * ZoomableDiagram - A mobile-optimized container that provides zoom and pan functionality
 * for interactive schematic diagrams with hotspots.
 */
export default function ZoomableDiagram({ children, onInteractionStart, onInteractionEnd }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  
  // Track if we're on a touch device
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // Pinch zoom state
  const [initialPinchDistance, setInitialPinchDistance] = useState(null);
  const [initialScale, setInitialScale] = useState(1);
  
  useEffect(() => {
    // Detect touch device
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  
  // Calculate distance between two touch points
  const getTouchDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  // Get center point between two touches
  const getTouchCenter = (touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };
  
  // Handle touch start for pinch zoom
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Two finger pinch zoom
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      setInitialPinchDistance(distance);
      setInitialScale(scale);
      if (onInteractionStart) onInteractionStart();
    } else if (e.touches.length === 1) {
      // Single finger pan (only if zoomed in)
      if (scale > 1) {
        const rect = containerRef.current.getBoundingClientRect();
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y
        });
        if (onInteractionStart) onInteractionStart();
      }
    }
  };
  
  // Handle touch move for pinch zoom and pan
  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && initialPinchDistance) {
      // Pinch zoom
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      const scaleChange = distance / initialPinchDistance;
      let newScale = initialScale * scaleChange;
      
      // Constrain scale between 1x and 4x
      newScale = Math.max(1, Math.min(4, newScale));
      
      setScale(newScale);
      
      // If zooming out to 1x, reset position
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Pan
      e.preventDefault();
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      
      // Constrain panning to keep content visible
      const maxX = (contentRef.current.offsetWidth * (scale - 1)) / 2;
      const maxY = (contentRef.current.offsetHeight * (scale - 1)) / 2;
      
      setPosition({
        x: Math.max(-maxX, Math.min(maxX, newX)),
        y: Math.max(-maxY, Math.min(maxY, newY))
      });
    }
  };
  
  // Handle touch end
  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      setInitialPinchDistance(null);
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
      if (onInteractionEnd) onInteractionEnd();
    }
  };
  
  // Mouse wheel zoom (for desktop/hybrid devices)
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const scaleChange = delta > 0 ? 1.1 : 0.9;
      let newScale = scale * scaleChange;
      
      // Constrain scale
      newScale = Math.max(1, Math.min(4, newScale));
      
      setScale(newScale);
      
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    }
  };
  
  // Mouse drag for desktop
  const handleMouseDown = (e) => {
    if (scale > 1 && e.button === 0) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      if (onInteractionStart) onInteractionStart();
    }
  };
  
  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      const maxX = (contentRef.current.offsetWidth * (scale - 1)) / 2;
      const maxY = (contentRef.current.offsetHeight * (scale - 1)) / 2;
      
      setPosition({
        x: Math.max(-maxX, Math.min(maxX, newX)),
        y: Math.max(-maxY, Math.min(maxY, newY))
      });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    if (onInteractionEnd) onInteractionEnd();
  };
  
  // Zoom control buttons
  const handleZoomIn = () => {
    let newScale = Math.min(4, scale + 0.25);
    setScale(newScale);
  };
  
  const handleZoomOut = () => {
    let newScale = Math.max(1, scale - 0.25);
    setScale(newScale);
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  };
  
  const handleZoomReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  
  return (
    <div className="zoomable-diagram-wrapper">
      {/* Zoom controls - visible on mobile when zoomed */}
      {isTouchDevice && (
        <div className="zoom-controls-mobile">
          <button
            className={`zoom-control-btn ${scale <= 1 ? 'disabled' : ''}`}
            onClick={handleZoomOut}
            disabled={scale <= 1}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          
          <div className="zoom-level-indicator">
            {Math.round(scale * 100)}%
          </div>
          
          <button
            className={`zoom-control-btn ${scale >= 4 ? 'disabled' : ''}`}
            onClick={handleZoomIn}
            disabled={scale >= 4}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          
          {scale > 1 && (
            <button
              className="zoom-control-btn zoom-reset-btn"
              onClick={handleZoomReset}
              aria-label="Reset zoom"
              title="Reset zoom"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      )}
      
      {/* Instruction hint for mobile users */}
      {isTouchDevice && scale === 1 && (
        <div className="zoom-hint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h6m-6 6V5m0 4v4m0 0h4m-4 0H5m10 0v4m0-4h4m-4 4v4m0 0h-4m4 0h4m0-4v4m0-4V9m0 10v-4m0 4a2 2 0 0 1-2 2h-4m10-2h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Pinch to zoom
        </div>
      )}
      
      <div
        ref={containerRef}
        className="zoomable-diagram-container"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          touchAction: scale > 1 || initialPinchDistance ? 'none' : 'auto'
        }}
      >
        <div
          ref={contentRef}
          className="zoomable-diagram-content"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging || initialPinchDistance ? 'none' : 'transform 0.2s ease-out'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
