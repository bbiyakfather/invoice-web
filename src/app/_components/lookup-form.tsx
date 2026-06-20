'use client'

/**
 * 고객 견적서 조회 폼 (사명 + 사업자번호 본인확인)
 * 두 값을 모두 입력해야 조회되며, 결과는 본인확인을 통과한 견적서만 표시한다.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Search, FileText, ChevronRight } from 'lucide-react'
import { lookupAction } from '../actions'
import type { Invoice } from '@/types/invoice'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/format'
import { INVOICE_STATUS_LABELS } from '@/lib/constants'
import type { InvoiceStatus } from '@/types/invoice'

const statusVariant: Record<
  InvoiceStatus,
  'default' | 'secondary' | 'destructive'
> = {
  pending: 'default',
  approved: 'secondary',
  rejected: 'destructive',
}

export function LookupForm() {
  const [businessNumber, setBusinessNumber] = useState('')
  const [results, setResults] = useState<Invoice[]>([])
  const [searched, setSearched] = useState(false)
  const [isPending, startTransition] = useTransition()

  const canSubmit = businessNumber.trim() !== ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    startTransition(async () => {
      const result = await lookupAction(businessNumber)
      setResults(result.invoices)
      setSearched(result.searched)
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="businessNumber" className="text-sm font-medium">
                사업자번호
              </label>
              <Input
                id="businessNumber"
                placeholder="예: 123-45-67890"
                value={businessNumber}
                onChange={e => setBusinessNumber(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit || isPending}
            >
              <Search className="mr-2 h-4 w-4" />
              {isPending ? '조회 중...' : '견적서 조회'}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              본인확인을 위해 사업자번호가 일치해야 조회됩니다.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* 조회 결과 */}
      {searched && (
        <div className="space-y-3">
          {results.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-center text-sm">
                일치하는 견적서가 없습니다. 사명과 사업자번호를 다시 확인해
                주세요.
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                {results.length}건의 견적서를 찾았습니다.
              </p>
              {results.map(invoice => (
                <Link
                  key={invoice.id}
                  href={`/invoice/${invoice.id}`}
                  className="block"
                >
                  <Card className="hover:border-primary transition-colors">
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {invoice.invoiceNumber}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {formatDate(invoice.issueDate, 'short')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={statusVariant[invoice.status]}>
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </Badge>
                        <span className="hidden font-medium sm:inline">
                          {formatCurrency(invoice.totalAmount)}
                        </span>
                        <ChevronRight className="text-muted-foreground h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
