"use client"

import Link from "next/link"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table"
import { useState } from "react"
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, XCircle, MinusCircle, RefreshCw,
} from "lucide-react"
import { ProfileAvatar } from "@/components/ui/profile-avatar"

export interface PaymentRow {
  id: string
  amount: number
  status: "pending" | "approved" | "rejected" | "cancelled" | "refunded" | "cash"
  mp_payment_id: string | null
  created_at: string
  user_id: string | null
  profiles: {
    full_name: string | null
    avatar_url: string | null
  } | null
}

const STATUS_LABEL: Record<PaymentRow["status"], string> = {
  approved:  "Aprobado",
  pending:   "Pendiente",
  rejected:  "Rechazado",
  cancelled: "Cancelado",
  refunded:  "Reintegrado",
  cash:      "Efectivo",
}

const STATUS_CLASS: Record<PaymentRow["status"], string> = {
  approved:  "bg-emerald-500/15 text-emerald-400",
  pending:   "bg-amber-500/15 text-amber-400",
  rejected:  "bg-red-500/15 text-red-400",
  cancelled: "bg-zinc-500/15 text-zinc-400",
  refunded:  "bg-cyan-500/15 text-cyan-400",
  cash:      "bg-blue-500/15 text-blue-400",
}

const STATUS_ICON: Record<PaymentRow["status"], React.ElementType> = {
  approved:  CheckCircle2,
  pending:   Clock,
  rejected:  XCircle,
  cancelled: MinusCircle,
  refunded:  RefreshCw,
  cash:      CheckCircle2,
}

function formatARS(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const col = createColumnHelper<PaymentRow>()

const columns = [
  col.accessor((row) => row.profiles?.full_name ?? "—", {
    id: "member",
    header: "Miembro",
    cell: ({ row }) => {
      const userId = row.original.user_id
      const inner = (
        <div className="flex items-center gap-2.5">
          <ProfileAvatar
            src={row.original.profiles?.avatar_url}
            name={row.original.profiles?.full_name}
            size={32}
          />
          <span className="text-sm text-zinc-100 truncate max-w-[160px] group-hover:text-brand-400 transition-colors">
            {row.original.profiles?.full_name ?? "—"}
          </span>
        </div>
      )
      return userId ? (
        <Link href={`/members/${userId}`} className="group">
          {inner}
        </Link>
      ) : inner
    },
  }),
  col.accessor("amount", {
    header: "Monto",
    cell: ({ getValue }) => (
      <span className="text-sm font-semibold text-emerald-400">
        {formatARS(getValue())}
      </span>
    ),
  }),
  col.accessor("status", {
    header: "Estado",
    cell: ({ getValue }) => {
      const s = getValue()
      const Icon = STATUS_ICON[s]
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[s]}`}>
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          {STATUS_LABEL[s]}
        </span>
      )
    },
  }),
  col.accessor("created_at", {
    header: "Fecha",
    cell: ({ getValue }) => (
      <span className="text-sm text-zinc-400">{formatDate(getValue())}</span>
    ),
  }),
]

export default function PaymentsTable({ payments }: { payments: PaymentRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ])

  const table = useReactTable({
    data: payments,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  if (payments.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-xl border border-zinc-800 bg-zinc-900/60 text-sm text-zinc-600">
        Sin pagos registrados aún
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-zinc-800">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider select-none"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                    aria-sort={
                      header.column.getIsSorted() === "asc" ? "ascending" :
                      header.column.getIsSorted() === "desc" ? "descending" :
                      header.column.getCanSort() ? "none" : undefined
                    }
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <ChevronUp className="h-3 w-3" />}
                      {header.column.getIsSorted() === "desc" && <ChevronDown className="h-3 w-3" />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-zinc-500">
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex items-center justify-center min-w-[36px] min-h-[36px] rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 transition-colors cursor-pointer"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex items-center justify-center min-w-[36px] min-h-[36px] rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 transition-colors cursor-pointer"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
