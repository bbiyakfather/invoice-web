/**
 * 관리자 대시보드 홈 페이지
 * Server Component - 최근 견적서를 실데이터로 표시
 */

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Users, Clock, ChevronRight } from 'lucide-react'
import { getInvoicesFromNotion } from '@/lib/services/invoice.service'
import { formatCurrency, formatDate } from '@/lib/format'
import { INVOICE_STATUS_LABELS } from '@/lib/constants'
import type { Invoice, InvoiceStatus } from '@/types/invoice'

const statusVariant: Record<
  InvoiceStatus,
  'default' | 'secondary' | 'destructive'
> = {
  pending: 'default',
  approved: 'secondary',
  rejected: 'destructive',
}

/**
 * 최근 견적서 조회 (실패 시 빈 배열로 대시보드 보호)
 */
async function getRecentInvoices(): Promise<Invoice[]> {
  try {
    const { invoices } = await getInvoicesFromNotion(5, undefined, 'issue_date')
    return invoices
  } catch {
    return []
  }
}

export default async function AdminPage() {
  const recentInvoices = await getRecentInvoices()

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        <p className="text-muted-foreground mt-2">
          견적서 관리 시스템에 오신 것을 환영합니다
        </p>
      </div>

      {/* 주요 기능 카드 (클릭 시 이동) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/invoices" className="group">
          <Card className="group-hover:border-primary transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">견적서 관리</CardTitle>
              <FileText className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                발행한 모든 견적서를 확인하고 수정할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/clients" className="group">
          <Card className="group-hover:border-primary transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                클라이언트 관리
              </CardTitle>
              <Users className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                클라이언트별 견적 현황을 확인할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 최근 활동 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            최근 활동
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              최근 견적서가 없습니다.
            </p>
          ) : (
            <ul className="divide-y">
              {recentInvoices.map(invoice => (
                <li key={invoice.id}>
                  <Link
                    href={`/admin/invoices/${invoice.id}`}
                    className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {invoice.clientName}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={statusVariant[invoice.status]}>
                        {INVOICE_STATUS_LABELS[invoice.status]}
                      </Badge>
                      <span className="hidden text-sm font-medium sm:inline">
                        {formatCurrency(invoice.totalAmount)}
                      </span>
                      <span className="text-muted-foreground hidden text-sm md:inline">
                        {formatDate(invoice.issueDate, 'short')}
                      </span>
                      <ChevronRight className="text-muted-foreground h-4 w-4" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
