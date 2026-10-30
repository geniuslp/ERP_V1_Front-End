// Packs print rows into A4 pages using each row's REAL measured height (mm), so a row that wraps onto several
// lines (long item names, remarks with "1." / "-" lists) can no longer push the footer off the page.
//
//   heights      measured height of every row, in order
//   avail        room for rows on one page (page height minus header, info box and table head)
//   footerH      height of the footer block that sits on the LAST page only
//
// Returns the row indexes of each page. A row is never split. The last page always leaves room for the footer:
// if the trailing rows would crowd it out, as many trailing rows as fit together with the footer become the
// final page and the rest stay on the page before it, so the footer is on the last page, at the bottom,
// whether the document is one page or several.
export const paginateRows = (heights: number[], avail: number, footerH: number): number[][] => {
  const pages: number[][] = []
  let cur: number[] = []
  let used = 0
  heights.forEach((h, i) => {
    if (cur.length > 0 && used + h > avail) {
      pages.push(cur)
      cur = []
      used = 0
    }
    cur.push(i)
    used += h
  })
  pages.push(cur)

  const last = pages[pages.length - 1]
  const lastUsed = last.reduce((a, i) => a + heights[i], 0)
  if (last.length > 0 && lastUsed + footerH > avail) {
    const tail: number[] = []
    let t = footerH
    for (let k = last.length - 1; k >= 0; k--) {
      if (tail.length > 0 && t + heights[last[k]] > avail) break
      tail.unshift(last[k])
      t += heights[last[k]]
    }
    const head = last.slice(0, last.length - tail.length)
    pages.pop()
    if (head.length > 0) pages.push(head)
    pages.push(tail)
  }
  return pages
}
