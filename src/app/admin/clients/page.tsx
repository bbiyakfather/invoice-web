/**
 * 관리자 클라이언트 관리 페이지
 * 견적서 client_name을 집계한 클라이언트 목록을 표시한다 (Server Component)
 */

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { getClients } from '@/lib/services/invoice.service'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">클라이언트 관리</h1>
        <p className="text-muted-foreground mt-2">
          견적서에 등록된 클라이언트를 한눈에 확인하고 관리할 수 있습니다
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">클라이언트가 없습니다</p>
            <p className="text-muted-foreground mt-2 text-sm">
              견적서를 추가하면 클라이언트가 자동으로 집계됩니다
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>클라이언트명</TableHead>
                <TableHead>사업자번호</TableHead>
                <TableHead className="text-right">견적서 수</TableHead>
                <TableHead className="text-right">총 견적액</TableHead>
                <TableHead className="w-[140px]">최근 발행일</TableHead>
                <TableHead className="w-[140px] text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(client => (
                <TableRow key={client.name}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.businessNumber || '-'}</TableCell>
                  <TableCell className="text-right">
                    {client.invoiceCount}건
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(client.totalAmount)}
                  </TableCell>
                  <TableCell>
                    {client.lastIssueDate
                      ? formatDate(client.lastIssueDate, 'short')
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={`/admin/invoices?query=${encodeURIComponent(client.name)}`}
                      >
                        견적서 보기
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
