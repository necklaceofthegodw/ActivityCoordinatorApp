import { useEffect, useRef } from 'react'

// Module-level stack — one global listener, only the topmost modal reacts
const closeStack: Array<() => void> = []
let listenerActive = false

function handleGlobalPopState() {
  if (closeStack.length === 0) return

  const top = closeStack.pop()
  top?.()

  if (closeStack.length === 0) {
    window.removeEventListener('popstate', handleGlobalPopState)
    listenerActive = false
  }
}

export function useBackButton(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    const handler = () => onCloseRef.current()
    closeStack.push(handler)
    history.pushState({ backModal: true }, '')

    if (!listenerActive) {
      listenerActive = true
      window.addEventListener('popstate', handleGlobalPopState as EventListener)
    }

    return () => {
      // Modal closed via UI — remove from stack, leave history entry orphaned.
      // Orphaned entries are harmless: pressing back with no modal open just
      // triggers a React Router re-render at the same route (no remount).
      const idx = closeStack.indexOf(handler)
      if (idx !== -1) closeStack.splice(idx, 1)

      if (closeStack.length === 0 && listenerActive) {
        window.removeEventListener('popstate', handleGlobalPopState as EventListener)
        listenerActive = false
      }
    }
  }, [isOpen])
}
