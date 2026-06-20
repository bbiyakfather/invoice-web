/**
 * 견적서 상세/편집 Server Actions
 */

'use server'

import {
  archiveInvoiceItem,
  createInvoiceItem,
  getOptimizedInvoice,
  updateInvoice,
  updateInvoiceItem,
} from '@/lib/services/invoice.service'
import { invoiceEditSchema } from '@/lib/validations/invoice'
import type { ActionResult } from '@/app/admin/invoices/actions'

/**
 * 견적서 전체 수정 (상위 속성 + 항목 생성/수정/삭제 diff 처리)
 * @param invoiceId - 견적서 페이지 ID
 * @param input - 폼 입력값 (invoiceEditSchema로 검증)
 */
export async function updateInvoiceAction(
  invoiceId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = invoiceEditSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: '입력값이 유효하지 않습니다.' }
  }
  const data = parsed.data

  try {
    // 0) 항목 diff를 위해 기존 항목 ID 확보 (쓰기 전에 조회)
    const current = await getOptimizedInvoice(invoiceId)
    const originalItemIds = new Set(current.items.map(item => item.id))

    // 1) 상위 속성 수정
    // 사업자번호는 값이 있을 때만 전송한다. 빈 값이면 payload에서 제외해
    // Notion에 business_number 속성이 아직 없는 환경에서도 수정이 동작하게 한다.
    await updateInvoice(invoiceId, {
      clientName: data.clientName,
      ...(data.businessNumber ? { businessNumber: data.businessNumber } : {}),
      issueDate: data.issueDate,
      validUntil: data.validUntil,
      status: data.status,
      totalAmount: data.totalAmount,
    })

    // 2) 항목 처리: id 없으면 생성, 있으면 수정
    const incomingIds = new Set<string>()
    for (const item of data.items) {
      const itemData = {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      }
      if (item.id) {
        incomingIds.add(item.id)
        await updateInvoiceItem(item.id, itemData, invoiceId)
      } else {
        await createInvoiceItem(invoiceId, itemData)
      }
    }

    // 3) 기존엔 있으나 폼에서 제거된 항목은 아카이브(삭제)
    for (const originalId of originalItemIds) {
      if (!incomingIds.has(originalId)) {
        await archiveInvoiceItem(originalId, invoiceId)
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}
