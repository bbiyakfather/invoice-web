/**
 * 고객 랜딩(공개) Server Actions
 */

'use server'

import { lookupInvoicesByClient } from '@/lib/services/invoice.service'
import type { Invoice } from '@/types/invoice'

/** 고객 조회 결과 */
export type LookupResult = {
  /** 본인확인을 통과한 견적서 목록 */
  invoices: Invoice[]
  /** 조회가 수행되었는지 여부 (초기 상태와 결과 없음 구분용) */
  searched: boolean
}

/**
 * 사명 + 사업자번호로 본인 견적서 조회 (공개)
 * 둘 다 정확히 일치해야 결과를 반환한다.
 */
export async function lookupAction(
  clientName: string,
  businessNumber: string
): Promise<LookupResult> {
  const invoices = await lookupInvoicesByClient(clientName, businessNumber)
  return { invoices, searched: true }
}
