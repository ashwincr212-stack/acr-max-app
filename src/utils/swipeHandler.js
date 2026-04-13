/* ACR MAX — Swipe Handler Hook
   Returns touch + mouse handlers and animation state */
import { useState, useRef } from 'react'

const SWIPE_THRESHOLD = 75

export function useSwipeHandler({ onSwipe, disabled = false }) {
  const [dragX,    setDragX]    = useState(0)
  const [dragging, setDragging] = useState(false)
  const [exiting,  setExiting]  = useState(null) // 'left' | 'right' | null
  const startX = useRef(null)
  const startY = useRef(null)

  const triggerSwipe = (dir) => {
    if (disabled) return
    setExiting(dir)
    setTimeout(() => {
      setExiting(null)
      setDragX(0)
      onSwipe(dir)
    }, 340)
  }

  const onTouchStart = (e) => {
    if (disabled) return
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    setDragging(true)
  }

  const onTouchMove = (e) => {
    if (!dragging || disabled) return
    const dx = e.touches[0].clientX - startX.current
    const dy = Math.abs(e.touches[0].clientY - startY.current)
    if (dy > 40) { setDragging(false); setDragX(0); return }
    setDragX(dx)
  }

  const onTouchEnd = () => {
    setDragging(false)
    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      triggerSwipe(dragX > 0 ? 'right' : 'left')
    } else {
      setDragX(0)
    }
  }

  const onMouseDown = (e) => {
    if (disabled) return
    startX.current = e.clientX
    setDragging(true)
  }

  const onMouseMove = (e) => {
    if (!dragging || !startX.current || disabled) return
    setDragX(e.clientX - startX.current)
  }

  const onMouseUp = () => {
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      triggerSwipe(dragX > 0 ? 'right' : 'left')
    } else {
      setDragX(0)
    }
    startX.current = null
  }

  // Computed transform values
  const translateX = exiting === 'left' ? -380 : exiting === 'right' ? 380 : dragX
  const rotate     = (exiting ? dragX * 0.12 : dragX * 0.07)
  const opacity    = exiting ? 0 : 1
  const isAnimating = dragging || !!exiting

  return {
    dragX, dragging, exiting,
    translateX, rotate, opacity, isAnimating,
    triggerSwipe,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp },
    showLikeIndicator:  dragX > 40,
    showSkipIndicator:  dragX < -40,
    likeOpacity:  Math.min((dragX - 40) / 60, 1),
    skipOpacity:  Math.min((-dragX - 40) / 60, 1),
  }
}