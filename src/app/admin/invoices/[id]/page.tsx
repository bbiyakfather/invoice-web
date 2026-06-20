/**
 * 관리자 견적서 상세/편집 페이지
 * Server Component - 견적서 데이터를 조회해 편집 폼에 전달
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getOptimizedInvoice } from '@/lib/services/invoice.service'
import { Button } from '@/components/ui/button'
import { InvoiceEditForm } from './_components/invoice-edit-form'

interface AdminInvoiceDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AdminInvoiceDetailPage({
  params,
}: AdminInvoiceDetailPageProps) {
  const { id } = await params

  let invoice
  try {
    invoice = await getOptimizedInvoice(id)
  } catch {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">견적서 수정</h1>
        <p className="text-muted-foreground mt-2">
          {invoice.invoiceNumber} · {invoice.clientName}
        </p>
      </div>

      <InvoiceEditForm invoice={invoice} />
    </div>
  )
}
