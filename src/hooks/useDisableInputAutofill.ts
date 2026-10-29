import { useEffect } from 'react'

// Stops the browser from remembering/suggesting what was typed into text inputs on every page
// (some forms/search boxes never got autoComplete="off"). antd renders plain <input>/<textarea>
// elements, including inside modals/dropdowns that mount in a portal, so a MutationObserver
// on <body> marks each one as it appears. Inputs that already declare their own autocomplete
// value (e.g. the change-password fields) are left alone.
const SELECTOR = 'input:not([autocomplete]):not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea:not([autocomplete])'

const apply = (root: ParentNode) => {
  root.querySelectorAll?.(SELECTOR).forEach((el) => el.setAttribute('autocomplete', 'off'))
}

export const useDisableInputAutofill = () => {
  useEffect(() => {
    apply(document)
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return
          const el = n as Element
          if (el.matches?.(SELECTOR)) el.setAttribute('autocomplete', 'off')
          apply(el)
        })
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
}
