/**
 * 고객 랜딩(공개) Server Actions
 */

'use server'

import { lookupInvoicesByBusinessNumber } from '@/lib/services/invoice.service'
import type { Invoice } from '@/types/invoice'

/** 고객 조회 결과 */
export type LookupResult = {
  /** 본인확인을 통과한 견적서 목록 */
  invoices: Invoice[]
  /** 조회가 수행되었는지 여부 (초기 상태와 결과 없음 구분용) */
  searched: boolean
}

/**
 * 사업자번호로 본인 견적서 조회 (공개)
 * 사업자번호가 정확히 일치해야 결과를 반환한다.
 */
export async function lookupAction(
  businessNumber: string
): Promise<LookupResult> {
  const invoices = await lookupInvoicesByBusinessNumber(businessNumber)
  return { invoices, searched: true }
}
