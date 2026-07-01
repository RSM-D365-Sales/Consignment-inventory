import { useMemo, useState } from 'react'
import type { InventoryLine } from '../models/types'
import { lineValue } from '../lib/aggregations'
import { money, moneyCents, units } from '../lib/format'
import { CATEGORY_COLORS } from './charts/StackedBar'

type SortKey = 'style' | 'category' | 'season' | 'units' | 'value'

interface Props {
  lines: InventoryLine[]
  /** Show the compact variant (fewer columns) for tight contexts. */
  compact?: boolean
}

export function InventoryTable({ lines, compact = false }: Props) {
  const [sort, setSort] = useState<SortKey>('value')
  const [dir, setDir] = useState<1 | -1>(-1)

  const sorted = useMemo(() => {
    const arr = [...lines]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sort) {
        case 'style':
          cmp = a.styleName.localeCompare(b.styleName)
          break
        case 'category':
          cmp = a.category.localeCompare(b.category)
          break
        case 'season':
          cmp = a.season.localeCompare(b.season)
          break
        case 'units':
          cmp = a.unitsOnHand - b.unitsOnHand
          break
        case 'value':
          cmp = lineValue(a) - lineValue(b)
          break
      }
      return cmp * dir
    })
    return arr
  }, [lines, sort, dir])

  function toggleSort(key: SortKey) {
    if (key === sort) setDir((d) => (d === 1 ? -1 : 1))
    else {
      setSort(key)
      setDir(key === 'style' || key === 'category' || key === 'season' ? 1 : -1)
    }
  }

  const indicator = (key: SortKey) =>
    sort === key ? (dir === 1 ? ' ↑' : ' ↓') : ''

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th onClick={() => toggleSort('style')} className="th-sort">
              Style{indicator('style')}
            </th>
            {!compact && <th>Item</th>}
            <th onClick={() => toggleSort('category')} className="th-sort">
              Category{indicator('category')}
            </th>
            {!compact && <th>Color / Size</th>}
            <th onClick={() => toggleSort('season')} className="th-sort">
              Season{indicator('season')}
            </th>
            <th
              onClick={() => toggleSort('units')}
              className="th-sort th-right"
            >
              Units{indicator('units')}
            </th>
            {!compact && <th className="th-right">Unit cost</th>}
            <th
              onClick={() => toggleSort('value')}
              className="th-sort th-right"
            >
              Ext. value{indicator('value')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((l) => (
            <tr key={l.id}>
              <td className="td-style">{l.styleName}</td>
              {!compact && <td className="muted numeric">{l.itemNumber}</td>}
              <td>
                <span className="cat-tag">
                  <span
                    className="cat-tag__dot"
                    style={{ background: CATEGORY_COLORS[l.category] }}
                  />
                  {l.category}
                </span>
              </td>
              {!compact && (
                <td className="muted">
                  {l.color} · {l.size}
                </td>
              )}
              <td className="muted">{l.season}</td>
              <td className="td-right numeric">{units(l.unitsOnHand)}</td>
              {!compact && (
                <td className="td-right numeric muted">
                  {moneyCents(l.unitCost)}
                </td>
              )}
              <td className="td-right numeric">{money(lineValue(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
