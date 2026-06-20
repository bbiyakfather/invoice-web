/**
 * 견적서 목록 관련 Server Actions
 */

'use server'

import { updateInvoice } from '@/lib/services/invoice.service'
import type { InvoiceStatus } from '@/types/invoice'

/** Server Action 공통 결과 타입 */
export type ActionResult = { success: boolean; error?: string }

const VALID_STATUSES: InvoiceStatus[] = ['pending', 'approved', 'rejected']

/**
 * 견적서 상태만 빠르게 변경 (목록 테이블에서 사용)
 * @param invoiceId - 견적서 페이지 ID
 * @param status - 변경할 상태
 */
export async function updateStatusAction(
  invoiceId: string,
  status: InvoiceStatus
): Promise<ActionResult> {
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: '유효하지 않은 상태값입니다.' }
  }
  try {
    await updateInvoice(invoiceId, { status })
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}
