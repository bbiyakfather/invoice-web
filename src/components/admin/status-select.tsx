'use client'

/**
 * 견적서 상태 빠른 변경 셀렉트 (목록 테이블용)
 * 낙관적 갱신 + 실패 시 롤백 + 토스트 피드백
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateStatusAction } from '@/app/admin/invoices/actions'
import { INVOICE_STATUS_LABELS } from '@/lib/constants'
import type { InvoiceStatus } from '@/types/invoice'

const STATUS_OPTIONS: InvoiceStatus[] = ['pending', 'approved', 'rejected']

export function StatusSelect({
  invoiceId,
  status,
}: {
  invoiceId: string
  status: InvoiceStatus
}) {
  const [value, setValue] = useState<InvoiceStatus>(status)
  const [isPending, startTransition] = useTransition()

  function handleChange(next: string) {
    const previous = value
    const nextStatus = next as InvoiceStatus
    setValue(nextStatus) // 낙관적 갱신
    startTransition(async () => {
      const result = await updateStatusAction(invoiceId, nextStatus)
      if (result.success) {
        toast.success('상태가 변경되었습니다')
      } else {
        setValue(previous) // 롤백
        toast.error(result.error ?? '상태 변경에 실패했습니다')
      }
    })
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-[100px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map(option => (
          <SelectItem key={option} value={option}>
            {INVOICE_STATUS_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
