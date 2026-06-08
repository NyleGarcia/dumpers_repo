import { fromMilliScu, toMilliScu } from './resourceQuantity'

export interface FulfillmentItemRow {
  resourceKey: string
  quantity: number
}

export function fulfillmentItemsMatch(
  stored: { resource_key: string; quantity: number | string }[] | undefined,
  computed: FulfillmentItemRow[]
): boolean {
  const normalize = (rows: { key: string; qty: number }[]) =>
    [...rows].sort((a, b) => a.key.localeCompare(b.key))

  const a = normalize(
    (stored ?? []).map((row) => ({
      key: row.resource_key,
      qty: fromMilliScu(toMilliScu(Number(row.quantity))),
    }))
  )
  const b = normalize(
    computed.map((row) => ({
      key: row.resourceKey,
      qty: fromMilliScu(toMilliScu(row.quantity)),
    }))
  )

  if (a.length !== b.length) return false
  return a.every((row, index) => row.key === b[index].key && row.qty === b[index].qty)
}

export function fulfillmentItemsToOrderShape(items: FulfillmentItemRow[]) {
  return items.map((item) => ({
    resource_key: item.resourceKey,
    quantity: fromMilliScu(toMilliScu(item.quantity)),
  }))
}
